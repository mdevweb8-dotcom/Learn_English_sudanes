import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Globe,
  History,
  LogOut,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Swords,
  Table2,
  TimerOff,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
  Wifi,
  X,
  XCircle,
} from 'lucide-react';
import type {
  AppState,
  ConnectionMode,
  MatchRecord,
  PeerInfo,
  TeamFormat,
} from '../types';
import { realtimeClient, type RealtimeState } from '../services/realtime';
import { AvatarView } from './AvatarView';
import { RoomChatAndVoice } from './RoomChatAndVoice';
import { SpeakButton } from './SpeakButton';

interface MultiplayerHubModalProps {
  initialTab: 'wifi' | 'online' | 'teams';
  state: AppState;
  realtime: RealtimeState;
  onRegenerateCode: () => void;
  onUpdateLanUrl: (url: string) => void;
  onSaveMatchResult: (record: MatchRecord, xpReward: number, coinsReward: number) => void;
  onAddFriendByAnyCode: (code: string) => Promise<{ ok: boolean; message: string }>;
  onAddFriendFromPeer: (peer: PeerInfo) => { ok: boolean; message: string };
  onOpenComparisonModal: () => void;
  onClose: () => void;
}

export const MultiplayerHubModal: React.FC<MultiplayerHubModalProps> = ({
  initialTab,
  state,
  realtime,
  onRegenerateCode,
  onUpdateLanUrl,
  onSaveMatchResult,
  onAddFriendByAnyCode,
  onAddFriendFromPeer,
  onOpenComparisonModal,
  onClose,
}) => {
  const [tab, setTab] = useState<'wifi' | 'online' | 'teams'>(initialTab);
  const [manualCode, setManualCode] = useState('');
  const [manualError, setManualError] = useState('');
  const [friendFeedback, setFriendFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [wifiSearch, setWifiSearch] = useState('');
  const [onlineSearch, setOnlineSearch] = useState('');
  const [useTimer, setUseTimer] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [lanInput, setLanInput] = useState(state.profile.lanServerUrl || '');

  // Team creation / join inputs
  const [teamNameInput, setTeamNameInput] = useState(`فريق ${state.profile.name}`);
  const [teamFormat, setTeamFormat] = useState<TeamFormat>('2v2');
  const [teamMode, setTeamMode] = useState<ConnectionMode>('online');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinSide, setJoinSide] = useState<'A' | 'B'>('A');

  // Outgoing 30s invite countdown
  const [inviteSecondsLeft, setInviteSecondsLeft] = useState<number>(30);

  // Active multiplayer quiz state
  const [qIndex, setQIndex] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState('');
  const [orderedWords, setOrderedWords] = useState<Array<{ word: string; idx: number }>>([]);
  const [answeredThisQ, setAnsweredThisQ] = useState(false);
  const [lastWasCorrect, setLastWasCorrect] = useState(false);
  const [questionTimerLeft, setQuestionTimerLeft] = useState<number>(15);
  const [myFinished, setMyFinished] = useState(false);
  const [recordedRoomId, setRecordedRoomId] = useState<string | null>(null);

  const myCode = state.profile.privateCode;
  const room = realtime.room;

  // Auto-discover Wi-Fi peers and refresh active search whenever opening lobby
  useEffect(() => {
    if (room) return;
    if (tab === 'wifi') {
      void realtimeClient.discoverWifi();
      const pollId = setInterval(() => {
        void realtimeClient.discoverWifi();
      }, 4500);
      return () => clearInterval(pollId);
    }
    if (tab === 'online') {
      void realtimeClient.searchPeers(onlineSearch, 'online');
    }
  }, [tab, realtime.connected, realtime.registeredCode, room]);

  // Countdown for outgoing challenge (30s)
  useEffect(() => {
    if (!realtime.outgoingInvite) return;
    const tick = () => {
      const rem = Math.max(0, Math.ceil((realtime.outgoingInvite!.expiresAt - Date.now()) / 1000));
      setInviteSecondsLeft(rem);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [realtime.outgoingInvite]);

  // Reset local quiz state when a new match starts
  useEffect(() => {
    if (room?.status === 'playing' && room.startedAt) {
      setQIndex(0);
      setSelectedOpt('');
      setOrderedWords([]);
      setAnsweredThisQ(false);
      setLastWasCorrect(false);
      setQuestionTimerLeft(room.timerSeconds || 15);
      setMyFinished(false);
    }
  }, [room?.roomId, room?.status, room?.startedAt]);

  // Question timer during active game (stops if pausedByDisconnect or useTimer=false)
  useEffect(() => {
    if (
      !room ||
      room.status !== 'playing' ||
      !room.useTimer ||
      room.pausedByDisconnect ||
      myFinished ||
      answeredThisQ
    ) {
      return;
    }

    const id = setInterval(() => {
      setQuestionTimerLeft((prev) => {
        if (prev <= 1) {
          // Time expired for this question -> submit wrong and show answer
          setAnsweredThisQ(true);
          setLastWasCorrect(false);
          realtimeClient.submitGameAnswer(false, qIndex + 1);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [room?.status, room?.useTimer, room?.pausedByDisconnect, myFinished, answeredThisQ, qIndex]);

  // Record finished match once into last 10 matchHistory
  useEffect(() => {
    if (!room || room.status !== 'finished' || recordedRoomId === room.roomId) return;
    setRecordedRoomId(room.roomId);

    const myMember = room.members.find((m) => m.privateCode === myCode);
    const mySide = myMember?.side || 'A';
    const sideAScore = room.members.filter((m) => m.side === 'A').reduce((s, m) => s + m.score, 0);
    const sideBScore = room.members.filter((m) => m.side === 'B').reduce((s, m) => s + m.score, 0);
    const myTeamScore = mySide === 'A' ? sideAScore : sideBScore;
    const oppScore = mySide === 'A' ? sideBScore : sideAScore;
    const won = myTeamScore > oppScore;

    onSaveMatchResult(
      {
        id: `M-${Date.now()}`,
        date: new Date().toLocaleDateString('ar-EG'),
        format: room.format,
        mode: room.mode,
        teamName: room.teamName,
        myTeamScore,
        opponentScore: oppScore,
        won,
      },
      won ? 60 : 25,
      won ? 20 : 10,
    );
  }, [room?.status, room?.roomId]);

  const currentQuestion = room?.questions?.[qIndex];
  const shuffledOrderWords = useMemo(() => {
    if (!currentQuestion?.wordsToOrder) return [];
    return [...currentQuestion.wordsToOrder].sort((a, b) => a.localeCompare(b));
  }, [currentQuestion?.id]);

  const isFriendAdded = (privateCode: string) =>
    state.friends.some((f) => f.privateCode === privateCode || f.code === `CODE-${privateCode}`);

  const filteredWifiPeers = useMemo(() => {
    const q = wifiSearch.trim().toLowerCase();
    if (!q) return realtime.wifiPeers;
    return realtime.wifiPeers.filter(
      (p) => p.name.toLowerCase().includes(q) || p.privateCode.includes(q),
    );
  }, [realtime.wifiPeers, wifiSearch]);

  const savedFriendsWithCode = useMemo(
    () => state.friends.filter((f) => Boolean(f.privateCode)),
    [state.friends],
  );

  const handleManualChallenge = (mode: ConnectionMode) => {
    const clean = manualCode.trim();
    if (!/^\d{6}$/.test(clean)) {
      setManualError('يجب أن يتكون الرقم الخاص من 6 أرقام بالضبط.');
      return;
    }
    if (clean === myCode) {
      setManualError('لا يمكنك تحدي رقمك الخاص!');
      return;
    }
    setManualError('');
    if (mode === 'online') {
      void realtimeClient.lookupPeer(clean);
    }
    void realtimeClient.sendChallenge(clean, mode, useTimer);
  };

  const handleManualAddFriend = async () => {
    const clean = manualCode.trim();
    if (!/^\d{6}$/.test(clean)) {
      setManualError('أدخل رقم الصديق المكون من 6 أرقام لإضافته.');
      return;
    }
    if (clean === myCode) {
      setManualError('لا يمكنك إضافة رقمك الخاص كصديق.');
      return;
    }
    setManualError('');
    const res = await onAddFriendByAnyCode(clean);
    setFriendFeedback({ ok: res.ok, text: res.message });
  };

  const handleConfirmQuizAnswer = () => {
    if (!currentQuestion || answeredThisQ) return;
    let correct = false;
    if (currentQuestion.type === 'order') {
      const built = orderedWords.map((o) => o.word).join(' ').trim().toLowerCase();
      correct = built === currentQuestion.answer.trim().toLowerCase();
    } else {
      correct = selectedOpt === currentQuestion.answer;
    }
    setAnsweredThisQ(true);
    setLastWasCorrect(correct);
    realtimeClient.submitGameAnswer(correct, qIndex + 1);
  };

  const handleNextQuestion = () => {
    if (!room) return;
    if (qIndex + 1 < room.questions.length) {
      setQIndex((i) => i + 1);
      setSelectedOpt('');
      setOrderedWords([]);
      setAnsweredThisQ(false);
      setLastWasCorrect(false);
      setQuestionTimerLeft(room.timerSeconds || 15);
    } else {
      setMyFinished(true);
    }
  };

  const copyPrivateCode = async () => {
    try {
      await navigator.clipboard.writeText(myCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      setCopiedCode(false);
    }
  };

  // ==================== VIEW 1: ACTIVE GAME OR RESULTS INSIDE ROOM ====================
  if (room && (room.status === 'playing' || room.status === 'finished')) {
    const sideAMembers = room.members.filter((m) => m.side === 'A');
    const sideBMembers = room.members.filter((m) => m.side === 'B');
    const sideAScore = sideAMembers.reduce((s, m) => s + m.score, 0);
    const sideBScore = sideBMembers.reduce((s, m) => s + m.score, 0);
    const isLeader = room.leaderCode === myCode;
    const winnerSide = sideAScore > sideBScore ? 'A' : sideBScore > sideAScore ? 'B' : 'draw';

    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-50">
        <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 px-4 py-4">
          {/* Top Bar */}
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 sm:text-base">
                {room.teamName} ({room.format})
              </h2>
              <p className="text-xs text-slate-500">
                {room.mode === 'wifi' ? 'على نفس الواي فاي' : 'أونلاين بالرقم الخاص'} ·{' '}
                {room.useTimer ? 'بمؤقت مشترك' : 'بدون مؤقت'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => realtimeClient.leaveRoom()}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700"
            >
              <LogOut className="h-4 w-4" />
              <span>مغادرة</span>
            </button>
          </div>

          {/* Disconnect Warning Banner */}
          {room.pausedByDisconnect && (
            <div className="flex items-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-extrabold text-amber-950">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
              <span>
                {room.format === '1v1'
                  ? 'غادر صديقك اللعبة — تم إيقاف المؤقت تلقائياً.'
                  : `غادر ${room.disconnectedPlayerName || 'أحد اللاعبين'} اللعبة — تم إيقاف المؤقت تلقائياً.`}
              </span>
            </div>
          )}

          {/* Reconnecting Banner */}
          {!realtime.connected && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-900">
              انقطع الاتصال مؤقتاً — جاري إعادة الاتصال تلقائياً بدون حذف نتيجتك...
            </div>
          )}

          {/* Live Team Scoreboard */}
          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="rounded-xl bg-[var(--accent-soft)] p-3 text-center">
              <p className="text-xs font-bold text-[var(--accent-text)]">
                {room.format === '1v1' ? sideAMembers[0]?.name || 'الفريق أ' : 'الفريق أ'}
              </p>
              <p className="font-mono mt-1 text-2xl font-extrabold tabular-nums text-slate-900">{sideAScore}</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-3 text-center">
              <p className="text-xs font-bold text-amber-900">
                {room.format === '1v1' ? sideBMembers[0]?.name || 'الفريق ب' : 'الفريق ب'}
              </p>
              <p className="font-mono mt-1 text-2xl font-extrabold tabular-nums text-slate-900">{sideBScore}</p>
            </div>
          </div>

          {/* Voice + Text Chat Strip (always available during game & 60s after end) */}
          <RoomChatAndVoice
            room={room}
            myCode={myCode}
            messages={realtime.messages}
            speakingPeers={realtime.speakingPeers}
            voiceChatEnabled={state.settings.voiceChatEnabled}
            chatSoundEnabled={state.settings.chatSoundEnabled}
            chatClosedMessage={realtime.chatClosedMessage}
          />

          {/* Game Results Screen */}
          {room.status === 'finished' ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-amber-100 text-amber-600">
                <Trophy className="h-8 w-8" />
              </div>
              <h3 className="mt-4 text-xl font-extrabold text-slate-900">
                {winnerSide === 'draw'
                  ? 'تعادل رائع بين الفريقين!'
                  : room.format === '1v1'
                    ? `الفائز: ${(winnerSide === 'A' ? sideAMembers[0]?.name : sideBMembers[0]?.name) || 'البطل'}`
                    : `الفريق الفائز: ${winnerSide === 'A' ? 'الفريق أ' : 'الفريق ب'}!`}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                يُحدد الفائز بعدد الإجابات الصحيحة الأكثر (نقاط الفريق بالكامل).
              </p>

              {/* Individual Player Scores */}
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  { title: 'الفريق أ', score: sideAScore, list: sideAMembers },
                  { title: 'الفريق ب', score: sideBScore, list: sideBMembers },
                ].map((sideObj) => (
                  <div key={sideObj.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-start">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-xs font-extrabold">
                      <span>{sideObj.title}</span>
                      <span className="font-mono tabular-nums text-[var(--accent-primary)]">
                        المجموع: {sideObj.score}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {sideObj.list.map((m) => (
                        <div key={m.privateCode} className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-800">
                            {m.name} (#{m.privateCode})
                          </span>
                          <span className="font-mono font-bold tabular-nums text-slate-900">
                            {m.score}/{room.questions.length}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                {isLeader && (
                  <button
                    type="button"
                    onClick={() => realtimeClient.playAgain()}
                    className="inline-flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-5 py-2.5 text-sm font-bold text-white"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>العب مرة أخرى</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    realtimeClient.leaveRoom();
                    onClose();
                  }}
                  className="min-h-[46px] flex-1 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-800"
                >
                  العودة للقائمة الرئيسية
                </button>
              </div>
            </div>
          ) : myFinished ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
              <h3 className="mt-3 text-lg font-extrabold text-slate-900">أنهيت جميع أسئلتك!</h3>
              <p className="mt-1 text-xs text-slate-500">
                بانتظار إكمال باقي اللاعبين لأسئلتهم لعرض لوحة النتائج النهائية...
              </p>
            </div>
          ) : (
            currentQuestion && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 text-xs font-bold">
                  <span className="font-mono tabular-nums text-slate-600">
                    سؤال {qIndex + 1} من {room.questions.length}
                  </span>
                  {room.useTimer ? (
                    <span
                      className={`inline-flex items-center gap-1 font-mono tabular-nums ${
                        questionTimerLeft <= 5 ? 'text-rose-600' : 'text-[var(--accent-primary)]'
                      }`}
                    >
                      <Clock className="h-4 w-4" /> {questionTimerLeft}ث
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-slate-500">
                      <TimerOff className="h-4 w-4" /> بدون مؤقت
                    </span>
                  )}
                </div>

                {currentQuestion.promptAr && (
                  <p className="mt-4 text-sm font-bold text-[var(--accent-text)]">{currentQuestion.promptAr}</p>
                )}
                <div className="mt-2 flex items-start justify-between gap-2">
                  <p
                    className="text-lg font-extrabold text-slate-900"
                    dir={currentQuestion.type === 'tf' || currentQuestion.type === 'order' ? 'rtl' : 'ltr'}
                  >
                    {currentQuestion.prompt}
                  </p>
                  {currentQuestion.audioText && (
                    <SpeakButton
                      speechId={`mp-q-${currentQuestion.id}`}
                      text={currentQuestion.audioText}
                      lang="en"
                    />
                  )}
                </div>

                {/* Options */}
                {(currentQuestion.type === 'mcq' || currentQuestion.type === 'tf') && currentQuestion.options && (
                  <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                    {currentQuestion.options.map((opt) => {
                      const picked = selectedOpt === opt;
                      const isAns = opt === currentQuestion.answer;
                      let cls = 'border-slate-200 bg-white text-slate-900 hover:border-[var(--accent-primary)]';
                      if (answeredThisQ) {
                        if (isAns) cls = 'border-emerald-500 bg-emerald-50 text-emerald-900';
                        else if (picked) cls = 'border-rose-500 bg-rose-50 text-rose-900';
                      } else if (picked) {
                        cls = 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-text)]';
                      }

                      return (
                        <button
                          key={opt}
                          type="button"
                          disabled={answeredThisQ}
                          onClick={() => setSelectedOpt(opt)}
                          className={`min-h-[46px] rounded-xl border-2 px-4 py-2.5 text-start text-sm font-bold transition disabled:cursor-not-allowed ${cls}`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}

                {currentQuestion.type === 'order' && (
                  <div className="mt-4 space-y-3">
                    <div
                      dir="ltr"
                      className="flex min-h-[54px] flex-wrap gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-3"
                    >
                      {orderedWords.map((item) => (
                        <button
                          key={`${item.word}-${item.idx}`}
                          type="button"
                          disabled={answeredThisQ}
                          onClick={() => setOrderedWords((prev) => prev.filter((x) => x.idx !== item.idx))}
                          className="font-en rounded-xl border border-[var(--accent-primary)] bg-white px-3 py-1.5 text-sm font-bold"
                        >
                          {item.word}
                        </button>
                      ))}
                    </div>
                    <div dir="ltr" className="flex flex-wrap gap-2">
                      {shuffledOrderWords.map((word, idx) => {
                        const used = orderedWords.some((o) => o.idx === idx);
                        return (
                          <button
                            key={`${word}-${idx}`}
                            type="button"
                            disabled={answeredThisQ || used}
                            onClick={() => setOrderedWords((prev) => [...prev, { word, idx }])}
                            className={`font-en rounded-xl border px-3 py-1.5 text-sm font-bold ${
                              used ? 'border-slate-200 bg-slate-100 text-slate-300' : 'border-slate-300 bg-white'
                            }`}
                          >
                            {word}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {answeredThisQ && (
                  <div
                    className={`mt-4 rounded-xl border p-3.5 text-xs ${
                      lastWasCorrect
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                        : 'border-rose-200 bg-rose-50 text-rose-900'
                    }`}
                  >
                    <p className="font-extrabold">
                      {lastWasCorrect ? 'إجابة صحيحة! (+1 نقطة للفريق)' : `الإجابة الصحيحة: ${currentQuestion.answer}`}
                    </p>
                    <p className="mt-1">{currentQuestion.explanation}</p>
                  </div>
                )}

                <div className="mt-5">
                  {!answeredThisQ ? (
                    <button
                      type="button"
                      disabled={
                        currentQuestion.type === 'order' ? orderedWords.length === 0 : !selectedOpt
                      }
                      onClick={handleConfirmQuizAnswer}
                      className="min-h-[46px] w-full rounded-xl bg-[var(--accent-primary)] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                    >
                      تأكيد الإجابة
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleNextQuestion}
                      className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-5 py-2.5 text-sm font-bold text-white"
                    >
                      <span>{qIndex + 1 < room.questions.length ? 'السؤال التالي' : 'عرض النتيجة النهائية'}</span>
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      </div>
    );
  }

  // ==================== VIEW 2: TEAM WAITING ROOM ====================
  if (room && room.status === 'waiting') {
    const isLeader = room.leaderCode === myCode;
    const sideA = room.members.filter((m) => m.side === 'A');
    const sideB = room.members.filter((m) => m.side === 'B');

    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 p-3 sm:p-6">
        <div className="mx-auto max-w-2xl space-y-4 rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <span className="text-xs font-bold text-[var(--accent-text)]">
                غرفة الفريق ({room.format} · {room.mode === 'wifi' ? 'واي فاي' : 'أونلاين'})
              </span>
              <h2 className="text-lg font-extrabold text-slate-900">{room.teamName}</h2>
              <p className="mt-0.5 text-xs text-slate-600">
                كود الفريق للمشاركة: <span className="font-mono font-extrabold text-slate-900">{room.teamCode}</span> · رقم
                القائد: <span className="font-mono font-extrabold text-slate-900">{room.leaderCode}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => realtimeClient.leaveRoom()}
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700"
            >
              <LogOut className="h-4 w-4" />
              <span>مغادرة الفريق</span>
            </button>
          </div>

          {realtime.teamNotice && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-900">
              {realtime.teamNotice}
            </div>
          )}

          {/* Join Requests Queue (Leader Only) */}
          {isLeader && room.joinRequests.length > 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-extrabold text-emerald-950">طلبات الانضمام للفريق:</p>
              <div className="mt-2 space-y-2">
                {room.joinRequests.map((jr) => (
                  <div
                    key={jr.requestId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <AvatarView avatarId={jr.avatarId} size={30} />
                      <span className="font-bold text-slate-900">{jr.name}</span>
                      <span className="font-mono text-slate-500">#{jr.privateCode}</span>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => realtimeClient.approveJoinRequest(jr.requestId, true, 'A')}
                        className="rounded-lg bg-emerald-600 px-2.5 py-1.5 font-bold text-white"
                      >
                        قبول في فريقي
                      </button>
                      <button
                        type="button"
                        onClick={() => realtimeClient.approveJoinRequest(jr.requestId, true, 'B')}
                        className="rounded-lg bg-amber-500 px-2.5 py-1.5 font-bold text-white"
                      >
                        قبول كمنافس
                      </button>
                      <button
                        type="button"
                        onClick={() => realtimeClient.approveJoinRequest(jr.requestId, false)}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 font-bold text-rose-700"
                      >
                        رفض
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Teams Side A vs Side B */}
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: 'فريقك (أ)', list: sideA },
              { label: 'الفريق المنافس (ب)', list: sideB },
            ].map((side) => (
              <div key={side.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <p className="border-b border-slate-200 pb-2 text-xs font-extrabold text-slate-800">{side.label}</p>
                <div className="mt-2.5 space-y-2">
                  {side.list.length === 0 ? (
                    <p className="py-3 text-center text-xs text-slate-400">لا يوجد لاعبون بعد</p>
                  ) : (
                    side.list.map((m) => (
                      <div key={m.privateCode} className="flex items-center justify-between rounded-xl bg-white p-2.5">
                        <div className="flex items-center gap-2.5">
                          <AvatarView avatarId={m.avatarId} size={34} />
                          <div>
                            <p className="text-xs font-extrabold text-slate-900">
                              {m.name} {m.isLeader ? '(القائد)' : ''}
                            </p>
                            <p className="font-mono text-[11px] text-slate-500">#{m.privateCode}</p>
                          </div>
                        </div>
                        <span className="text-[11px] font-bold text-emerald-700">متصل</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => realtimeClient.switchSide()}
              className="min-h-[40px] rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              تبديل بين الفريق أ / ب
            </button>

            {isLeader && (
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={room.useTimer}
                  onChange={(e) => realtimeClient.setTeamTimer(e.target.checked)}
                />
                <span>اللعب بمؤقت مشترك (15ث للسؤال)</span>
              </label>
            )}
          </div>

          {/* Chat & Voice inside Waiting Room */}
          <RoomChatAndVoice
            room={room}
            myCode={myCode}
            messages={realtime.messages}
            speakingPeers={realtime.speakingPeers}
            voiceChatEnabled={state.settings.voiceChatEnabled}
            chatSoundEnabled={state.settings.chatSoundEnabled}
            chatClosedMessage={realtime.chatClosedMessage}
          />

          {isLeader ? (
            <button
              type="button"
              onClick={() => realtimeClient.startTeamGame()}
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-6 py-3 text-sm font-extrabold text-white"
            >
              <Play className="h-4 w-4" />
              <span>ابدأ المباراة الآن (للقائد فقط)</span>
            </button>
          ) : (
            <p className="text-center text-xs font-bold text-slate-500">
              بانتظار ضغط القائد على &ldquo;ابدأ المباراة&rdquo;...
            </p>
          )}
        </div>
      </div>
    );
  }

  // ==================== VIEW 3: LOBBY (WIFI / ONLINE / TEAMS) ====================
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 p-3 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-5 rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">اللعب مع الأصدقاء والفرق</h2>
            <p className="text-xs text-slate-500">
              تحدَّ أصدقاء الواي فاي أو أي صديق أونلاين برقمك الخاص، أو أنشئ فريقاً حتى 4 ضد 4
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User Private 6-Digit Code Card + Connection Status */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <p className="text-xs font-bold text-slate-600">رقمك الخاص الدائم (6 أرقام):</p>
            <div className="mt-1 flex items-center gap-2.5">
              <span className="font-mono text-2xl font-extrabold tracking-widest text-[var(--accent-primary)]">
                {myCode}
              </span>
              <button
                type="button"
                onClick={copyPrivateCode}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700"
              >
                {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedCode ? 'تم النسخ' : 'نسخ الرقم'}</span>
              </button>
              <button
                type="button"
                onClick={onRegenerateCode}
                className="min-h-[36px] rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                تغيير الرقم
              </button>
            </div>
          </div>

          <div className="text-xs font-bold">
            {realtime.codeConflictError ? (
              <span className="text-rose-700">تعارض رقم على الشبكة! غيّر رقمك</span>
            ) : realtime.connected ? (
              <span className="text-emerald-700">متصل بالخادم الفوري ✓</span>
            ) : (
              <span className="text-amber-700">جاري الاتصال...</span>
            )}
          </div>
        </div>

        {realtime.codeConflictError && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-300 bg-rose-50 p-4 text-xs font-bold text-rose-900">
            <span>{realtime.codeConflictError}</span>
            <button
              type="button"
              onClick={onRegenerateCode}
              className="rounded-xl bg-rose-600 px-3.5 py-2 text-white"
            >
              توليد رقم جديد فريد
            </button>
          </div>
        )}

        {realtime.challengeNotice && (
          <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900">
            <span>{realtime.challengeNotice}</span>
            <button type="button" onClick={() => realtimeClient.clearNotices()}>
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {realtime.outgoingInvite && (
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs font-bold text-sky-900">
            تم إرسال طلب التحدي إلى #{realtime.outgoingInvite.toCode} — بانتظار الرد ({inviteSecondsLeft} ثانية)...
          </div>
        )}

        {/* Mode Tabs */}
        <div className="flex gap-2 overflow-x-auto">
          {[
            { id: 'wifi', label: 'أصدقاء الواي فاي', icon: <Wifi className="h-4 w-4" /> },
            { id: 'online', label: 'أونلاين بالرقم الخاص', icon: <Globe className="h-4 w-4" /> },
            { id: 'teams', label: 'الفرق (1v1 - 4v4)', icon: <Users className="h-4 w-4" /> },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as typeof tab)}
              className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-extrabold transition ${
                tab === t.id
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {t.icon}
              <span className="whitespace-nowrap">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Shared Timer Preference before Starting */}
        {tab !== 'teams' && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs">
            <span className="font-bold text-slate-800">خيار المؤقت قبل بدء التحدي:</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setUseTimer(true)}
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 py-1.5 font-bold ${
                  useTimer
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                    : 'border-slate-200 text-slate-600'
                }`}
              >
                <Clock className="h-3.5 w-3.5" /> بمؤقت (15ث/سؤال)
              </button>
              <button
                type="button"
                onClick={() => setUseTimer(false)}
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 py-1.5 font-bold ${
                  !useTimer
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                    : 'border-slate-200 text-slate-600'
                }`}
              >
                <TimerOff className="h-3.5 w-3.5" /> بدون مؤقت
              </button>
            </div>
          </div>
        )}

        {/* TAB 1: SAME WI-FI FRIENDS DISCOVERY + SEARCH + ADD FRIEND + MANUAL FALLBACK */}
        {tab === 'wifi' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-extrabold text-slate-900">
                الأجهزة المكتشفة على نفس شبكة الواي فاي ({filteredWifiPeers.length})
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenComparisonModal();
                  }}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-100"
                >
                  <Table2 className="h-3.5 w-3.5 text-[var(--accent-primary)]" /> جدول المقارنة
                </button>
                <button
                  type="button"
                  disabled={realtime.wifiLoading}
                  onClick={() => void realtimeClient.discoverWifi()}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${realtime.wifiLoading ? 'animate-spin' : ''}`} />{' '}
                  {realtime.wifiLoading ? 'جاري البحث...' : 'تحديث البحث'}
                </button>
              </div>
            </div>

            {/* Wi-Fi Search Input */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={wifiSearch}
                  onChange={(e) => setWifiSearch(e.target.value)}
                  placeholder="ابحث عن صديق على الواي فاي بالاسم أو الرقم الخاص..."
                  className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-white pl-3 pr-9 text-xs font-semibold text-slate-900 outline-none focus:border-[var(--accent-primary)]"
                />
              </div>
              <button
                type="button"
                onClick={() => void realtimeClient.searchPeers(wifiSearch, 'all')}
                className="min-h-[42px] rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-xs font-bold text-slate-800 hover:bg-slate-100"
              >
                بحث شامل
              </button>
            </div>

            {realtime.wifiError && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-900">
                {realtime.wifiError}
              </div>
            )}

            {friendFeedback && (
              <div
                className={`rounded-xl border px-4 py-2.5 text-xs font-bold ${
                  friendFeedback.ok
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-rose-200 bg-rose-50 text-rose-900'
                }`}
              >
                {friendFeedback.text}
              </div>
            )}

            {filteredWifiPeers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-xs text-slate-500">
                {wifiSearch.trim()
                  ? 'لا توجد نتائج مطابقة على نفس الشبكة — جرب البحث الشامل أو أدخل الرقم الخاص أدناه.'
                  : 'لم يُكتشف أصدقاء على نفس الواي فاي بعد — اطلب من صديقك فتح التطبيق، أو أدخل رقمه الخاص أدناه!'}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredWifiPeers.map((peer) => {
                  const added = isFriendAdded(peer.privateCode);
                  return (
                    <div
                      key={peer.privateCode}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <AvatarView avatarId={peer.avatarId} size={40} />
                        <div>
                          <p className="text-sm font-extrabold text-slate-900">{peer.name}</p>
                          <p className="text-xs text-slate-500">
                            الرقم: <span className="font-mono font-bold">{peer.privateCode}</span> · المستوى{' '}
                            {peer.levelId} ·{' '}
                            <span className={peer.status === 'online' ? 'text-emerald-700' : 'text-amber-700'}>
                              {peer.status === 'online' ? 'متصل' : 'في لعبة'}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const res = onAddFriendFromPeer(peer);
                            setFriendFeedback({ ok: res.ok, text: res.message });
                          }}
                          className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold ${
                            added
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100'
                          }`}
                        >
                          {added ? <Check className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
                          <span>{added ? 'مضاف' : 'إضافة صديق'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void realtimeClient.sendChallenge(peer.privateCode, 'wifi', useTimer)}
                          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-xs font-bold text-white"
                        >
                          <Swords className="h-4 w-4" /> تحدي
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Manual 6-digit fallback (Challenge OR Add Friend) */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-800">
                بديل يدوي: أدخل الرقم الخاص لصديقك (6 أرقام) لإضافته أو تحديه على الواي فاي
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  type="text"
                  maxLength={6}
                  dir="ltr"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="مثال: 482910"
                  className="font-mono min-h-[42px] min-w-[140px] flex-1 rounded-xl border border-slate-200 bg-white px-3 text-center text-base font-bold tracking-widest"
                />
                <button
                  type="button"
                  onClick={() => void handleManualAddFriend()}
                  className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100"
                >
                  <UserPlus className="h-4 w-4" /> إضافة صديق
                </button>
                <button
                  type="button"
                  onClick={() => handleManualChallenge('wifi')}
                  className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-xs font-bold text-white"
                >
                  <Swords className="h-4 w-4" /> إرسال تحدي
                </button>
              </div>
              {manualError && <p className="mt-1.5 text-xs font-bold text-rose-700">{manualError}</p>}
            </div>

            {/* Optional Local LAN Host URL for Offline Wi-Fi Routers */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-xs">
              <p className="font-bold text-slate-700">عنوان خادم الواي فاي المحلي (للعب بدون إنترنت خارجي):</p>
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  dir="ltr"
                  value={lanInput}
                  onChange={(e) => setLanInput(e.target.value)}
                  placeholder="اتركه فارغاً للافتراضي أو اكتب 192.168.1.10:3000"
                  className="font-mono min-h-[38px] flex-1 rounded-xl border border-slate-200 px-3 text-xs"
                />
                <button
                  type="button"
                  onClick={() => onUpdateLanUrl(lanInput.trim())}
                  className="min-h-[38px] rounded-xl border border-slate-300 px-3 font-bold text-slate-800"
                >
                  ربط
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ONLINE PLAY BY 6-DIGIT PRIVATE CODE + LIVE SEARCH + SAVED FRIENDS */}
        {tab === 'online' && (
          <div className="space-y-4">
            {/* Search by Name or 6-Digit Code */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-extrabold text-slate-900">
                  البحث عن الأصدقاء أونلاين بالاسم أو الرقم الخاص:
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenComparisonModal();
                  }}
                  className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-800 hover:bg-slate-100"
                >
                  <Table2 className="h-3.5 w-3.5 text-[var(--accent-primary)]" /> جدول المقارنة المفصل
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void realtimeClient.searchPeers(onlineSearch, 'online');
                }}
                className="mt-2.5 flex gap-2"
              >
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={onlineSearch}
                    onChange={(e) => setOnlineSearch(e.target.value)}
                    placeholder="اكتب اسم الصديق أو رقمه الخاص (6 أرقام)..."
                    className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 pl-3 pr-9 text-xs font-semibold text-slate-900 outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={realtime.searchingPeers}
                  className="min-h-[42px] rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  {realtime.searchingPeers ? 'جاري البحث...' : 'بحث'}
                </button>
              </form>
              {realtime.searchError && (
                <p className="mt-1.5 text-xs font-bold text-rose-700">{realtime.searchError}</p>
              )}

              {realtime.searchResults.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                  <p className="text-[11px] font-bold text-slate-500">
                    نتائج البحث المتصلة ({realtime.searchResults.length}):
                  </p>
                  {realtime.searchResults.map((peer) => {
                    const added = isFriendAdded(peer.privateCode);
                    return (
                      <div
                        key={peer.privateCode}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5"
                      >
                        <div className="flex items-center gap-2.5">
                          <AvatarView avatarId={peer.avatarId} size={36} />
                          <div>
                            <p className="text-xs font-extrabold text-slate-900">{peer.name}</p>
                            <p className="text-[11px] text-slate-500">
                              <span className="font-mono font-bold">#{peer.privateCode}</span> · المستوى{' '}
                              {peer.levelId} ·{' '}
                              <span className={peer.status === 'online' ? 'text-emerald-700' : 'text-amber-700'}>
                                {peer.status === 'online' ? 'متصل الآن' : 'في لعبة'}
                              </span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const res = onAddFriendFromPeer(peer);
                              setFriendFeedback({ ok: res.ok, text: res.message });
                            }}
                            className={`inline-flex min-h-[36px] items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold ${
                              added
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                : 'border-slate-300 bg-white text-slate-800'
                            }`}
                          >
                            {added ? <Check className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
                            <span>{added ? 'مضاف' : 'إضافة'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void realtimeClient.sendChallenge(peer.privateCode, 'online', useTimer)}
                            className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-[var(--accent-primary)] px-3 py-1 text-[11px] font-bold text-white"
                          >
                            <Swords className="h-3.5 w-3.5" /> تحدي
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Direct 6-digit Code Lookup / Add / Challenge */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-800">
                أو أدخل الرقم الخاص لصديقك (6 أرقام) مباشرة للتحقق أو الإضافة أو التحدي:
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  type="text"
                  maxLength={6}
                  dir="ltr"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="482910"
                  className="font-mono min-h-[44px] min-w-[140px] flex-1 rounded-xl border border-slate-200 bg-white px-3 text-center text-base font-bold tracking-widest"
                />
                <button
                  type="button"
                  onClick={() => void realtimeClient.lookupPeer(manualCode.trim())}
                  className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800"
                >
                  تحقق من الحالة
                </button>
                <button
                  type="button"
                  onClick={() => void handleManualAddFriend()}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-900"
                >
                  <UserPlus className="h-4 w-4" /> إضافة صديق
                </button>
                <button
                  type="button"
                  onClick={() => handleManualChallenge('online')}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-xs font-bold text-white"
                >
                  <Swords className="h-4 w-4" /> تحدي أونلاين
                </button>
              </div>
              {manualError && <p className="mt-1.5 text-xs font-bold text-rose-700">{manualError}</p>}
              {realtime.lookupError && <p className="mt-1.5 text-xs font-bold text-rose-700">{realtime.lookupError}</p>}
              {friendFeedback && (
                <p className={`mt-1.5 text-xs font-bold ${friendFeedback.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {friendFeedback.text}
                </p>
              )}
            </div>

            {realtime.lookedUpPeer && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <AvatarView avatarId={realtime.lookedUpPeer.avatarId} size={40} />
                  <div>
                    <p className="text-sm font-extrabold text-slate-900">{realtime.lookedUpPeer.name}</p>
                    <p className="text-xs text-slate-500">
                      #{realtime.lookedUpPeer.privateCode} · المستوى {realtime.lookedUpPeer.levelId} ·{' '}
                      <span
                        className={
                          realtime.lookedUpPeer.status === 'online'
                            ? 'font-bold text-emerald-700'
                            : realtime.lookedUpPeer.status === 'in_game'
                              ? 'font-bold text-amber-700'
                              : 'font-bold text-slate-500'
                        }
                      >
                        {realtime.lookedUpPeer.status === 'online'
                          ? 'متصل الآن'
                          : realtime.lookedUpPeer.status === 'in_game'
                            ? 'في لعبة حالياً'
                            : 'غير متصل'}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const res = onAddFriendFromPeer(realtime.lookedUpPeer!);
                      setFriendFeedback({ ok: res.ok, text: res.message });
                    }}
                    className="inline-flex min-h-[38px] items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800"
                  >
                    <UserPlus className="h-3.5 w-3.5" /> إضافة للقائمة
                  </button>
                  {realtime.lookedUpPeer.status === 'online' && (
                    <button
                      type="button"
                      onClick={() =>
                        void realtimeClient.sendChallenge(realtime.lookedUpPeer!.privateCode, 'online', useTimer)
                      }
                      className="min-h-[38px] rounded-xl bg-[var(--accent-primary)] px-4 py-1.5 text-xs font-bold text-white"
                    >
                      إرسال تحدي
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Quick Challenge Saved Friends */}
            {savedFriendsWithCode.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-extrabold text-slate-800">أصدقاؤك المضافون ({savedFriendsWithCode.length}):</p>
                <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                  {savedFriendsWithCode.map((fr) => (
                    <div
                      key={fr.code}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <AvatarView avatarId={fr.avatarId || 'avatar-scholar'} size={32} />
                        <div>
                          <p className="font-extrabold text-slate-900">{fr.name}</p>
                          <p className="font-mono text-[11px] text-slate-500">
                            #{fr.privateCode} · {fr.level}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void realtimeClient.sendChallenge(fr.privateCode!, 'online', useTimer)}
                        className="rounded-lg bg-[var(--accent-primary)] px-3 py-1.5 text-[11px] font-bold text-white"
                      >
                        تحدي
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: TEAMS (1v1 .. 4v4) + MATCH HISTORY */}
        {tab === 'teams' && (
          <div className="space-y-4">
            {realtime.teamNotice && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-900">
                {realtime.teamNotice}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {/* Create Team */}
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                  <Users className="h-4 w-4 text-[var(--accent-primary)]" />
                  <span>إنشاء فريق جديد</span>
                </div>
                <input
                  type="text"
                  value={teamNameInput}
                  onChange={(e) => setTeamNameInput(e.target.value)}
                  placeholder="اسم الفريق"
                  className="min-h-[40px] w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={teamFormat}
                    onChange={(e) => setTeamFormat(e.target.value as TeamFormat)}
                    className="min-h-[40px] rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-bold"
                  >
                    <option value="1v1">1 ضد 1</option>
                    <option value="2v2">2 ضد 2</option>
                    <option value="3v3">3 ضد 3</option>
                    <option value="4v4">4 ضد 4</option>
                  </select>
                  <select
                    value={teamMode}
                    onChange={(e) => setTeamMode(e.target.value as ConnectionMode)}
                    className="min-h-[40px] rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-bold"
                  >
                    <option value="online">أونلاين</option>
                    <option value="wifi">واي فاي</option>
                  </select>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700">
                  <input type="checkbox" checked={useTimer} onChange={(e) => setUseTimer(e.target.checked)} />
                  <span>تشغيل مؤقت مشترك (15ث)</span>
                </label>
                <button
                  type="button"
                  onClick={() => realtimeClient.createTeam(teamNameInput, teamFormat, teamMode, useTimer)}
                  className="min-h-[42px] w-full rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-xs font-bold text-white"
                >
                  إنشاء فريق وتوليد كود
                </button>
              </div>

              {/* Join Team */}
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                  <UserPlus className="h-4 w-4 text-emerald-600" />
                  <span>الانضمام لفريق</span>
                </div>
                <input
                  type="text"
                  dir="ltr"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  placeholder="كود الفريق (TM-1234) أو رقم القائد"
                  className="font-mono min-h-[40px] w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold"
                />
                <div className="flex gap-2 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setJoinSide('A')}
                    className={`min-h-[38px] flex-1 rounded-xl border ${
                      joinSide === 'A'
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    انضمام للفريق أ
                  </button>
                  <button
                    type="button"
                    onClick={() => setJoinSide('B')}
                    className={`min-h-[38px] flex-1 rounded-xl border ${
                      joinSide === 'B'
                        ? 'border-amber-400 bg-amber-50 text-amber-900'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    كفريق منافس (ب)
                  </button>
                </div>
                <button
                  type="button"
                  disabled={!joinCodeInput.trim()}
                  onClick={() => realtimeClient.requestJoinTeam(joinCodeInput.trim(), joinSide)}
                  className="min-h-[42px] w-full rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  إرسال طلب الانضمام للقائد
                </button>
              </div>
            </div>

            {/* Last 10 Matches History */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <History className="h-4 w-4 text-[var(--accent-primary)]" />
                <h4 className="text-xs font-extrabold text-slate-900">سجل آخر 10 مباريات ({state.matchHistory.length})</h4>
              </div>
              {state.matchHistory.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-400">لم تُسجل مباريات فرق أو تحديات بعد.</p>
              ) : (
                <div className="mt-2 divide-y divide-slate-100 text-xs">
                  {state.matchHistory.map((m) => (
                    <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <div>
                        <span className="font-bold text-slate-900">{m.teamName}</span>{' '}
                        <span className="text-slate-500">
                          ({m.format} · {m.mode === 'wifi' ? 'واي فاي' : 'أونلاين'}) · {m.date}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold tabular-nums text-slate-800">
                          {m.myTeamScore} - {m.opponentScore}
                        </span>
                        <span className={`font-extrabold ${m.won ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {m.won ? 'فاز ✓' : 'خسر'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface IncomingChallengeBannerProps {
  invite: NonNullable<RealtimeState['incomingInvite']>;
}

export const IncomingChallengeBanner: React.FC<IncomingChallengeBannerProps> = ({ invite }) => {
  const [secs, setSecs] = useState(30);

  useEffect(() => {
    const tick = () => {
      setSecs(Math.max(0, Math.ceil((invite.expiresAt - Date.now()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [invite.inviteId, invite.expiresAt]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-center gap-3">
          <AvatarView avatarId={invite.fromAvatar} size={48} />
          <div>
            <p className="text-xs font-bold text-[var(--accent-text)]">
              طلب تحدي {invite.mode === 'wifi' ? 'على نفس الواي فاي' : 'أونلاين'}
            </p>
            <h3 className="text-base font-extrabold text-slate-900">{invite.fromName}</h3>
            <p className="font-mono text-xs font-bold text-slate-600">الرقم الخاص: {invite.fromCode}</p>
          </div>
        </div>

        <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
          الوضع: <span className="font-bold">{invite.useTimer ? 'بمؤقت (15ث/سؤال)' : 'بدون مؤقت'}</span> · ينتهي
          الطلب خلال <span className="font-mono font-bold text-rose-600">{secs}ث</span>
        </p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => realtimeClient.respondToChallenge(invite.inviteId, true)}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white"
          >
            <UserCheck className="h-4 w-4" /> قبول التحدي
          </button>
          <button
            type="button"
            onClick={() => realtimeClient.respondToChallenge(invite.inviteId, false)}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-extrabold text-rose-700"
          >
            <XCircle className="h-4 w-4" /> رفض
          </button>
        </div>
      </div>
    </div>
  );
};
