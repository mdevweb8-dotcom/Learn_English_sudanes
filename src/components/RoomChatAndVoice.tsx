import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  HeadphoneOff,
  Headphones,
  MessageCircle,
  Mic,
  MicOff,
  Radio,
  RefreshCw,
  Send,
  Settings,
  Smile,
  Trash2,
  Users,
  VolumeX,
  X,
} from 'lucide-react';
import type { ChatChannel, ChatMessage, TeamMember, TeamRoomState } from '../types';
import { realtimeClient } from '../services/realtime';
import {
  ensureMicrophoneStream,
  openDeviceAppPermissions,
  playMessageDing,
  subscribeMicPermissionChanges,
} from '../utils/speech';
import { AvatarView } from './AvatarView';

interface RoomChatAndVoiceProps {
  room: TeamRoomState;
  myCode: string;
  messages: ChatMessage[];
  speakingPeers: Record<string, boolean>;
  voiceChatEnabled: boolean;
  chatSoundEnabled: boolean;
  chatClosedMessage: string | null;
}

const EMOJIS = ['👍', '🔥', '🎉', '💡', '😂', '👏', '❤️', '🏆'];

function lowerAudioBitrateSDP(sdp: string, kbps = 20): string {
  // Adaptive low-bitrate Opus hint for weak networks without interrupting game
  if (!sdp.includes('a=fmtp:111')) return sdp;
  return sdp.replace(/a=fmtp:111 ([^\r\n]+)/g, (line) =>
    line.includes('maxaveragebitrate') ? line : `${line};maxaveragebitrate=${kbps * 1000};usedtx=1`,
  );
}

export const RoomChatAndVoice: React.FC<RoomChatAndVoiceProps> = ({
  room,
  myCode,
  messages,
  speakingPeers,
  voiceChatEnabled,
  chatSoundEnabled,
  chatClosedMessage,
}) => {
  const [chatOpen, setChatOpen] = useState(false);
  const [channel, setChannel] = useState<ChatChannel>(room.format === '1v1' ? 'all' : 'team');
  const [privateTarget, setPrivateTarget] = useState<string>('');
  const [input, setInput] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Voice states
  const [voiceMode, setVoiceMode] = useState<'ptt' | 'toggle'>('ptt');
  const [micActive, setMicActive] = useState(false);
  const [selfMuted, setSelfMuted] = useState(false);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [talkToAll, setTalkToAll] = useState(room.format === '1v1');
  const [mutedPlayers, setMutedPlayers] = useState<Record<string, boolean>>({});
  const [muteMenuTarget, setMuteMenuTarget] = useState<TeamMember | null>(null);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [checkingMic, setCheckingMic] = useState(false);
  const [postGameSecondsLeft, setPostGameSecondsLeft] = useState<number | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const vadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdingPttRef = useRef<boolean>(false);
  const lastMsgCountRef = useRef<number>(messages.length);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Automatically clear permission warning as soon as browser or Android Settings grant microphone
  useEffect(() => {
    return subscribeMicPermissionChanges(() => {
      setMicPermissionDenied(false);
      setVoiceError(null);
    });
  }, []);

  const myMember = room.members.find((m) => m.privateCode === myCode);
  const isLeader = room.leaderCode === myCode;
  const otherMembers = room.members.filter((m) => m.privateCode !== myCode);

  useEffect(() => {
    if (!privateTarget && otherMembers.length > 0) {
      setPrivateTarget(otherMembers[0].privateCode);
    }
  }, [otherMembers.length]);

  // 60-second post-game chat & voice auto-close countdown
  useEffect(() => {
    if (!room.chatExpiresAt) {
      setPostGameSecondsLeft(null);
      return;
    }
    const tick = () => {
      const rem = Math.max(0, Math.ceil((room.chatExpiresAt! - Date.now()) / 1000));
      setPostGameSecondsLeft(rem);
      if (rem <= 0) {
        teardownVoice();
        setChatOpen(false);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [room.chatExpiresAt]);

  const chatExpired = postGameSecondsLeft !== null && postGameSecondsLeft <= 0;

  // Unread badge + soft chime on new incoming messages
  useEffect(() => {
    if (messages.length > lastMsgCountRef.current) {
      const latest = messages[messages.length - 1];
      if (latest && latest.senderCode !== myCode) {
        if (chatSoundEnabled) playMessageDing();
        if (!chatOpen) setUnreadCount((c) => c + (messages.length - lastMsgCountRef.current));
      }
    }
    lastMsgCountRef.current = messages.length;
    if (chatOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, chatOpen, chatSoundEnabled, myCode]);

  useEffect(() => {
    if (chatOpen) setUnreadCount(0);
  }, [chatOpen]);

  // Helper to teardown ephemeral voice stream & peer connections (zero audio ever recorded/saved)
  const teardownVoice = () => {
    if (vadTimerRef.current) {
      clearInterval(vadTimerRef.current);
      vadTimerRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    for (const pc of peerConnectionsRef.current.values()) {
      pc.close();
    }
    peerConnectionsRef.current.clear();
    for (const el of audioElsRef.current.values()) {
      el.pause();
      el.srcObject = null;
    }
    audioElsRef.current.clear();
    setMicActive(false);
    realtimeClient.send({ type: 'voice:speaking', speaking: false, talkToAll });
  };

  useEffect(() => {
    return () => {
      teardownVoice();
    };
  }, [room.roomId]);

  // Apply mute settings to remote audio elements
  useEffect(() => {
    for (const [peerCode, el] of audioElsRef.current.entries()) {
      const peerMember = room.members.find((m) => m.privateCode === peerCode);
      const teamFiltered = !talkToAll && myMember && peerMember && peerMember.side !== myMember.side;
      el.muted = speakerMuted || Boolean(mutedPlayers[peerCode]) || Boolean(teamFiltered);
    }
  }, [speakerMuted, mutedPlayers, talkToAll, room.members, myMember?.side]);

  // Check if network is weak via Navigator NetworkInformation API
  const isWeakConnection = (): boolean => {
    const conn = (navigator as unknown as { connection?: { effectiveType?: string } }).connection;
    return conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g' || conn?.effectiveType === '3g';
  };

  const getOrCreatePeerConnection = (peerCode: string): RTCPeerConnection => {
    const existing = peerConnectionsRef.current.get(peerCode);
    if (existing) return existing;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        realtimeClient.send({
          type: 'webrtc:signal',
          toCode: peerCode,
          signal: { kind: 'candidate', candidate: ev.candidate },
        });
      }
    };

    pc.ontrack = (ev) => {
      let audioEl = audioElsRef.current.get(peerCode);
      if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        audioElsRef.current.set(peerCode, audioEl);
      }
      audioEl.srcObject = ev.streams[0];
      audioEl.muted = speakerMuted || Boolean(mutedPlayers[peerCode]);
      audioEl.play().catch(() => {});
    };

    peerConnectionsRef.current.set(peerCode, pc);
    return pc;
  };

  // Subscribe to WebRTC signaling messages
  useEffect(() => {
    const unsub = realtimeClient.onWebRTCSignal(async (fromCode, rawSig) => {
      if (!voiceChatEnabled || chatExpired) return;
      const sig = rawSig as {
        kind: 'offer' | 'answer' | 'candidate';
        sdp?: RTCSessionDescriptionInit;
        candidate?: RTCIceCandidateInit;
      };
      if (!sig || !sig.kind) return;

      const pc = getOrCreatePeerConnection(fromCode);
      try {
        if (sig.kind === 'offer' && sig.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(sig.sdp));
          const answer = await pc.createAnswer();
          const finalSdp = isWeakConnection() && answer.sdp ? lowerAudioBitrateSDP(answer.sdp) : answer.sdp;
          await pc.setLocalDescription({ type: 'answer', sdp: finalSdp });
          realtimeClient.send({
            type: 'webrtc:signal',
            toCode: fromCode,
            signal: { kind: 'answer', sdp: pc.localDescription },
          });
        } else if (sig.kind === 'answer' && sig.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(sig.sdp));
        } else if (sig.kind === 'candidate' && sig.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(sig.candidate));
        }
      } catch {
        // Ignore transient ICE negotiation race
      }
    });
    return unsub;
  }, [voiceChatEnabled, chatExpired, speakerMuted, mutedPlayers]);

  // Clean up closed peers if a member left the room
  useEffect(() => {
    const memberCodes = new Set(room.members.map((m) => m.privateCode));
    for (const [peerCode, pc] of peerConnectionsRef.current.entries()) {
      if (!memberCodes.has(peerCode)) {
        pc.close();
        peerConnectionsRef.current.delete(peerCode);
        const audioEl = audioElsRef.current.get(peerCode);
        if (audioEl) {
          audioEl.pause();
          audioEl.srcObject = null;
          audioElsRef.current.delete(peerCode);
        }
      }
    }
  }, [room.members]);

  const ensureMicrophoneAndConnect = async (): Promise<boolean> => {
    if (!voiceChatEnabled || chatExpired) return false;
    if (localStreamRef.current) {
      setMicPermissionDenied(false);
      setVoiceError(null);
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !selfMuted;
      });
      return true;
    }

    setCheckingMic(true);
    setMicPermissionDenied(false);
    setVoiceError(null);
    const micRes = await ensureMicrophoneStream();
    setCheckingMic(false);

    if (!micRes.ok) {
      if (micRes.reason === 'denied') {
        setMicPermissionDenied(true);
        setVoiceError(micRes.message);
      } else {
        setMicPermissionDenied(false);
        setVoiceError(micRes.message);
      }
      return false;
    }

    const stream = micRes.stream;
    localStreamRef.current = stream;

    try {
      // Setup local Voice Activity Detection for speaking indicator
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        let lastSent = false;
        vadTimerRef.current = setInterval(() => {
          const trackEnabled = stream.getAudioTracks()[0]?.enabled ?? false;
          if (!trackEnabled) {
            if (lastSent) {
              lastSent = false;
              realtimeClient.send({ type: 'voice:speaking', speaking: false, talkToAll });
            }
            return;
          }
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((s, v) => s + v, 0) / data.length;
          const nowSpeaking = avg > 14;
          if (nowSpeaking !== lastSent) {
            lastSent = nowSpeaking;
            realtimeClient.send({ type: 'voice:speaking', speaking: nowSpeaking, talkToAll });
          }
        }, 220);
      }
    } catch {
      // VAD meter optional; audio transmission still works
    }

    try {
      // Connect to target peers
      const targets = otherMembers.filter((m) => talkToAll || !myMember || m.side === myMember.side);
      for (const peer of targets) {
        const pc = getOrCreatePeerConnection(peer.privateCode);
        stream.getTracks().forEach((track) => {
          const alreadySending = pc.getSenders().some((s) => s.track === track);
          if (!alreadySending) pc.addTrack(track, stream);
        });
        const offer = await pc.createOffer();
        const sdp = isWeakConnection() && offer.sdp ? lowerAudioBitrateSDP(offer.sdp) : offer.sdp;
        await pc.setLocalDescription({ type: 'offer', sdp });
        realtimeClient.send({
          type: 'webrtc:signal',
          toCode: peer.privateCode,
          signal: { kind: 'offer', sdp: pc.localDescription },
        });
      }
    } catch {
      // WebRTC negotiation errors should never be labeled as microphone permission errors
      setVoiceError('تم فتح الميكروفون، لكن حدث تأخير مؤقت في ربط الصوت مع الصديق.');
    }

    return true;
  };

  const startTalking = async (fromPtt = false) => {
    if (!voiceChatEnabled || selfMuted || chatExpired) return;
    const ok = await ensureMicrophoneAndConnect();
    if (!ok) return;
    // If user released PTT button while answering the browser permission dialog, prepare stream silently
    if (fromPtt && !holdingPttRef.current) {
      localStreamRef.current?.getAudioTracks().forEach((t) => {
        t.enabled = false;
      });
      setMicActive(false);
      return;
    }
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = true;
    });
    setMicActive(true);
    realtimeClient.send({ type: 'voice:speaking', speaking: true, talkToAll });
  };

  const stopTalking = () => {
    holdingPttRef.current = false;
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = false;
      });
    }
    setMicActive(false);
    realtimeClient.send({ type: 'voice:speaking', speaking: false, talkToAll });
  };

  const handleToggleSelfMute = () => {
    const next = !selfMuted;
    setSelfMuted(next);
    if (next) stopTalking();
  };

  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      if (channel === 'team') return m.channel === 'team';
      if (channel === 'all') return m.channel === 'all';
      return (
        m.channel === 'private' &&
        ((m.senderCode === myCode && m.recipientCode === privateTarget) ||
          (m.senderCode === privateTarget && m.recipientCode === myCode))
      );
    });
  }, [messages, channel, myCode, privateTarget]);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || chatExpired) return;
    realtimeClient.sendChatMessage(
      trimmed.slice(0, 200),
      channel,
      channel === 'private' ? privateTarget : undefined,
    );
    setInput('');
    setShowEmojis(false);
  };

  return (
    <>
      {/* Top-of-screen Red Active Talking Banner */}
      {micActive && !selfMuted && (
        <div className="fixed left-1/2 top-3 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-rose-600 px-4 py-1.5 text-xs font-extrabold text-white shadow-lg">
          <Radio className="h-3.5 w-3.5 animate-pulse" />
          <span>أنت تتحدث الآن</span>
        </div>
      )}

      {/* Compact Voice + Peer Speaking Strip (does not cover game buttons) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Player Speaking Avatars (Long press to mute a specific player) */}
          <div className="flex flex-wrap items-center gap-2">
            {room.members.map((m) => {
              const isTalking =
                (m.privateCode === myCode && micActive && !selfMuted) || Boolean(speakingPeers[m.privateCode]);
              const isMuted = Boolean(mutedPlayers[m.privateCode]);

              return (
                <button
                  key={m.privateCode}
                  type="button"
                  onPointerDown={() => {
                    if (m.privateCode === myCode) return;
                    longPressTimerRef.current = setTimeout(() => {
                      setMuteMenuTarget(m);
                    }, 520);
                  }}
                  onPointerUp={() => {
                    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                  }}
                  onPointerCancel={() => {
                    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                  }}
                  onContextMenu={(e) => {
                    if (m.privateCode === myCode) return;
                    e.preventDefault();
                    setMuteMenuTarget(m);
                  }}
                  title={m.privateCode === myCode ? 'أنت' : 'اضغط مطولاً لكتم هذا اللاعب'}
                  className={`flex items-center gap-1.5 rounded-xl border px-2 py-1 text-xs font-bold transition ${
                    isTalking
                      ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-400'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className={isTalking ? 'animate-pulse rounded-full ring-2 ring-emerald-500' : ''}>
                    <AvatarView avatarId={m.avatarId} size={28} />
                  </div>
                  <span className="max-w-[70px] truncate text-slate-800">{m.name}</span>
                  {isMuted && <VolumeX className="h-3.5 w-3.5 text-rose-600" />}
                </button>
              );
            })}
          </div>

          {postGameSecondsLeft !== null && (
            <span className="font-mono text-xs font-bold tabular-nums text-amber-700">
              {postGameSecondsLeft > 0
                ? `الشات والصوت مفتوحان للاحتفال: ${postGameSecondsLeft}ث`
                : 'أُغلق شات المباراة تلقائياً'}
            </span>
          )}
        </div>

        {/* Thumb-friendly Voice + Chat Action Row */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          {voiceChatEnabled && !chatExpired ? (
            <div className="flex flex-wrap items-center gap-2">
              {voiceMode === 'ptt' ? (
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    holdingPttRef.current = true;
                    void startTalking(true);
                  }}
                  onPointerUp={() => stopTalking()}
                  onPointerLeave={() => {
                    if (holdingPttRef.current || micActive) stopTalking();
                  }}
                  onPointerCancel={() => stopTalking()}
                  className={`inline-flex min-h-[46px] select-none items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition ${
                    micActive
                      ? 'bg-rose-600 text-white shadow-md'
                      : 'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)]'
                  }`}
                >
                  <Mic className="h-4 w-4" />
                  <span>{micActive ? 'تحدث الآن... (اترك للإيقاف)' : 'اضغط مطولاً للتحدث 🎤'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => (micActive ? stopTalking() : startTalking())}
                  className={`inline-flex min-h-[46px] items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition ${
                    micActive
                      ? 'bg-rose-600 text-white shadow-md'
                      : 'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)]'
                  }`}
                >
                  {micActive ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                  <span>{micActive ? 'الميكروفون مفتوح (اضغط للإغلاق)' : 'اضغط لفتح الميكروفون'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  stopTalking();
                  setVoiceMode((m) => (m === 'ptt' ? 'toggle' : 'ptt'));
                }}
                className="min-h-[42px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
              >
                {voiceMode === 'ptt' ? 'الوضع: ضغط مطول' : 'الوضع: ضغطة واحدة'}
              </button>

              <button
                type="button"
                onClick={handleToggleSelfMute}
                aria-label={selfMuted ? 'إلغاء كتم الميكروفون' : 'كتم الميكروفون'}
                className={`grid h-11 w-11 place-items-center rounded-xl border transition ${
                  selfMuted
                    ? 'border-rose-300 bg-rose-50 text-rose-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
                title="كتم نفسي"
              >
                {selfMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>

              <button
                type="button"
                onClick={() => setSpeakerMuted((s) => !s)}
                aria-label={speakerMuted ? 'فتح السماعة' : 'كتم السماعة'}
                className={`grid h-11 w-11 place-items-center rounded-xl border transition ${
                  speakerMuted
                    ? 'border-rose-300 bg-rose-50 text-rose-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
                title="كتم السماعة"
              >
                {speakerMuted ? <HeadphoneOff className="h-4 w-4" /> : <Headphones className="h-4 w-4" />}
              </button>

              {room.format !== '1v1' && (
                <button
                  type="button"
                  onClick={() => setTalkToAll((v) => !v)}
                  className={`inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                    talkToAll
                      ? 'border-amber-300 bg-amber-50 text-amber-900'
                      : 'border-emerald-300 bg-emerald-50 text-emerald-900'
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>{talkToAll ? 'الصوت: الكل يسمعك' : 'الصوت: فريقي فقط'}</span>
                </button>
              )}
            </div>
          ) : (
            <span className="text-xs font-semibold text-slate-500">
              {chatExpired ? 'انتهت جلسة الصوت لهذه المباراة' : 'الشات الصوتي معطل من الإعدادات'}
            </span>
          )}

          {/* Large Chat Button with Red Unread Badge */}
          {!chatExpired && (
            <button
              type="button"
              onClick={() => setChatOpen((o) => !o)}
              className="relative inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-extrabold text-slate-800 shadow-sm hover:bg-slate-50"
            >
              <MessageCircle className="h-4 w-4 text-[var(--accent-primary)]" />
              <span>الشات الكتابي</span>
              {unreadCount > 0 && (
                <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-rose-600 px-1.5 font-mono text-[11px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Mic permission denied guidance */}
        {micPermissionDenied && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <span>يجب السماح بصلاحية الميكروفون للتحدث مع أصدقائك أثناء اللعب.</span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={checkingMic}
                onClick={async () => {
                  const ok = await ensureMicrophoneAndConnect();
                  if (ok && localStreamRef.current) {
                    localStreamRef.current.getAudioTracks().forEach((t) => {
                      t.enabled = false;
                    });
                    setMicPermissionDenied(false);
                    setVoiceError(null);
                  }
                }}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${checkingMic ? 'animate-spin' : ''}`} />
                <span>أعد المحاولة الآن</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const env = openDeviceAppPermissions();
                  if (env === 'web') {
                    setVoiceError(
                      'اضغط على أيقونة القفل أو الإعدادات بجانب رابط الموقع في أعلى المتصفح وفعّل إذن الميكروفون ثم اضغط «أعد المحاولة الآن».',
                    );
                  }
                }}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 font-bold text-white hover:bg-amber-700"
              >
                <Settings className="h-3.5 w-3.5" /> فتح الإعدادات
              </button>
            </div>
          </div>
        )}

        {voiceError && (
          <p className="mt-2 text-xs font-bold text-rose-700">{voiceError}</p>
        )}
      </div>

      {/* Individual Player Mute Context Modal */}
      {muteMenuTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-xl">
            <h4 className="text-sm font-extrabold text-slate-900">{muteMenuTarget.name}</h4>
            <p className="mt-0.5 font-mono text-xs text-slate-500">الرقم الخاص: {muteMenuTarget.privateCode}</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setMutedPlayers((prev) => ({
                    ...prev,
                    [muteMenuTarget.privateCode]: !prev[muteMenuTarget.privateCode],
                  }));
                  setMuteMenuTarget(null);
                }}
                className="min-h-[42px] flex-1 rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white"
              >
                {mutedPlayers[muteMenuTarget.privateCode] ? 'إلغاء كتم هذا اللاعب' : 'كتم هذا اللاعب'}
              </button>
              <button
                type="button"
                onClick={() => setMuteMenuTarget(null)}
                className="min-h-[42px] rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Overlay Chat Drawer (does not pause or hide the game) */}
      {chatOpen && !chatExpired && (
        <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto flex h-[380px] max-w-md flex-col rounded-2xl border border-slate-300 bg-white shadow-2xl sm:left-6 sm:right-auto sm:w-96">
          {/* Chat Header */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-[var(--accent-primary)]" />
              <h3 className="text-sm font-extrabold text-slate-900">دردشة الغرفة</h3>
            </div>
            <div className="flex items-center gap-1.5">
              {isLeader && (
                <button
                  type="button"
                  onClick={() => realtimeClient.clearChat()}
                  className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>مسح الشات</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                aria-label="إغلاق الشات"
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Channel Switcher (Team vs All vs Private) */}
          <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-3 py-2">
            {room.format !== '1v1' && (
              <button
                type="button"
                onClick={() => setChannel('team')}
                className={`min-h-[34px] flex-1 rounded-lg px-2 text-xs font-bold transition ${
                  channel === 'team' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700'
                }`}
              >
                شات الفريق
              </button>
            )}
            <button
              type="button"
              onClick={() => setChannel('all')}
              className={`min-h-[34px] flex-1 rounded-lg px-2 text-xs font-bold transition ${
                channel === 'all' ? 'bg-[var(--accent-primary)] text-white' : 'bg-white text-slate-700'
              }`}
            >
              شات عام للكل
            </button>
            {otherMembers.length > 0 && (
              <button
                type="button"
                onClick={() => setChannel('private')}
                className={`min-h-[34px] flex-1 rounded-lg px-2 text-xs font-bold transition ${
                  channel === 'private' ? 'bg-violet-600 text-white' : 'bg-white text-slate-700'
                }`}
              >
                شات خاص
              </button>
            )}
          </div>

          {channel === 'private' && otherMembers.length > 0 && (
            <div className="flex items-center gap-2 border-b border-slate-100 bg-violet-50/50 px-3 py-1.5 text-xs">
              <span className="font-bold text-violet-900">مع:</span>
              <select
                value={privateTarget}
                onChange={(e) => setPrivateTarget(e.target.value)}
                className="flex-1 rounded-lg border border-violet-200 bg-white px-2 py-1 text-xs font-bold text-slate-800"
              >
                {otherMembers.map((m) => (
                  <option key={m.privateCode} value={m.privateCode}>
                    {m.name} ({m.privateCode})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Messages List (Team chat has distinct emerald styling vs general blue/slate) */}
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {chatClosedMessage && (
              <p className="text-center text-xs font-bold text-amber-700">{chatClosedMessage}</p>
            )}
            {filteredMessages.length === 0 ? (
              <p className="py-10 text-center text-xs text-slate-400">
                لا توجد رسائل بعد في هذا القسم — ابدأ التحية!
              </p>
            ) : (
              filteredMessages.map((m) => {
                const mine = m.senderCode === myCode;
                const channelBg =
                  m.channel === 'team'
                    ? mine
                      ? 'bg-emerald-600 text-white'
                      : 'border border-emerald-200 bg-emerald-50 text-emerald-950'
                    : m.channel === 'private'
                      ? mine
                        ? 'bg-violet-600 text-white'
                        : 'border border-violet-200 bg-violet-50 text-violet-950'
                      : mine
                        ? 'bg-[var(--accent-primary)] text-white'
                        : 'border border-slate-200 bg-slate-50 text-slate-900';

                return (
                  <div key={m.id} className={`flex flex-col ${mine ? 'items-start' : 'items-end'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs ${channelBg}`}>
                      <div className="mb-1 flex items-center gap-1.5 text-[10px] opacity-85">
                        <span className="font-extrabold">{m.senderName}</span>
                        <span className="font-mono">#{m.senderCode}</span>
                        <span>· {m.timestamp}</span>
                      </div>
                      <p className="break-words leading-relaxed">{m.text}</p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Emojis */}
          {showEmojis && (
            <div className="flex flex-wrap gap-1 border-t border-slate-100 bg-slate-50 px-3 py-2">
              {EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setInput((prev) => `${prev}${em}`.slice(0, 200))}
                  className="grid h-8 w-8 place-items-center rounded-lg text-base hover:bg-slate-200"
                >
                  {em}
                </button>
              ))}
            </div>
          )}

          {/* Input Form (200 char max, blocks empty) */}
          <form onSubmit={handleSendChat} className="flex items-center gap-1.5 border-t border-slate-100 p-2.5">
            <button
              type="button"
              onClick={() => setShowEmojis((s) => !s)}
              aria-label="إيموجي"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <Smile className="h-4 w-4" />
            </button>
            <input
              type="text"
              maxLength={200}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="اكتب رسالة (بحد أقصى 200 حرف)..."
              className="min-h-[40px] flex-1 rounded-xl border border-slate-200 px-3 text-xs text-slate-900 outline-none focus:border-[var(--accent-primary)]"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="إرسال"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-primary)] text-white disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
