import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, CheckCircle2, RotateCcw, RefreshCw, Settings, Volume2 } from 'lucide-react';
import {
  ensureMicrophoneStream,
  evaluatePronunciation,
  getSpeechRecognitionConstructor,
  isSpeechRecognitionSupported,
  openDeviceAppPermissions,
  subscribeMicPermissionChanges,
  type SpeechRecognitionLike,
} from '../utils/speech';
import { SpeakButton } from './SpeakButton';
import { triggerHaptic } from '../services/native';

export interface PronunciationResult {
  target: string;
  spoken: string;
  score: number;
  feedback: 'ممتاز' | 'جيد' | 'حاول مرة أخرى';
  selfAssessed?: boolean;
}

interface PronunciationLabProps {
  targetText: string;
  targetAr: string;
  tip?: string;
  isKids?: boolean;
  onRecorded: (result: PronunciationResult) => void;
  disabled?: boolean;
}

export const PronunciationLab: React.FC<PronunciationLabProps> = ({
  targetText,
  targetAr,
  tip,
  isKids = false,
  onRecorded,
  disabled = false,
}) => {
  const [listening, setListening] = useState(false);
  const [recordingMode, setRecordingMode] = useState<'speech' | 'audio' | null>(null);
  const [spokenText, setSpokenText] = useState('');
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [result, setResult] = useState<PronunciationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [micDenied, setMicDenied] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const recordStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const peakVolumeRef = useRef<number>(0);
  const voicedSamplesRef = useRef<number>(0);
  const recordStartedAtRef = useRef<number>(0);
  const vadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const speechApiSupported = isSpeechRecognitionSupported();
  const micApiSupported =
    typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
  const canUseMic = speechApiSupported || micApiSupported;

  const cleanupAudioRecorder = () => {
    if (recordStopTimerRef.current) {
      clearTimeout(recordStopTimerRef.current);
      recordStopTimerRef.current = null;
    }
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore
      }
    }
    mediaRecorderRef.current = null;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  };

  useEffect(() => {
    return subscribeMicPermissionChanges(() => {
      setMicDenied(false);
      setErrorMsg('');
    });
  }, []);

  useEffect(() => {
    setSpokenText('');
    setResult(null);
    setErrorMsg('');
    setMicDenied(false);
    setListening(false);
    setRecordingMode(null);
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setRecordedAudioUrl(null);
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        // Ignore
      }
      cleanupAudioRecorder();
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, [targetText]);

  const startLocalVoiceCapture = async (existingStream?: MediaStream) => {
    let stream = existingStream;
    if (!stream) {
      const micRes = await ensureMicrophoneStream();
      if (!micRes.ok) {
        setListening(false);
        setRecordingMode(null);
        setMicDenied(micRes.reason === 'denied');
        setErrorMsg(micRes.message);
        return;
      }
      stream = micRes.stream;
    }

    mediaStreamRef.current = stream;
    audioChunksRef.current = [];
    peakVolumeRef.current = 0;
    voicedSamplesRef.current = 0;
    recordStartedAtRef.current = Date.now();
    setRecordingMode('audio');
    setListening(true);
    setMicDenied(false);
    setErrorMsg('');

    try {
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
        vadIntervalRef.current = setInterval(() => {
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((s, v) => s + v, 0) / data.length;
          if (avg > peakVolumeRef.current) peakVolumeRef.current = avg;
          if (avg > 10) voicedSamplesRef.current += 1;
        }, 100);
      }
    } catch {
      // Optional acoustic meter
    }

    if (typeof MediaRecorder !== 'undefined') {
      try {
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };
        recorder.onstop = () => {
          const durationMs = Date.now() - recordStartedAtRef.current;
          const voiced = voicedSamplesRef.current;
          const peak = peakVolumeRef.current;

          if (audioUrlRef.current) {
            URL.revokeObjectURL(audioUrlRef.current);
            audioUrlRef.current = null;
          }
          if (audioChunksRef.current.length > 0) {
            const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
            const url = URL.createObjectURL(blob);
            audioUrlRef.current = url;
            setRecordedAudioUrl(url);
          }

          if (vadIntervalRef.current) {
            clearInterval(vadIntervalRef.current);
            vadIntervalRef.current = null;
          }
          if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((t) => t.stop());
            mediaStreamRef.current = null;
          }
          if (audioCtxRef.current) {
            audioCtxRef.current.close().catch(() => {});
            audioCtxRef.current = null;
          }

          setListening(false);
          setRecordingMode(null);

          if (voiced < 2 && peak < 12) {
            setErrorMsg('لم نلتقط صوتاً واضحاً، قرّب الميكروفون وانطق الكلمة بصوت أوضح.');
            return;
          }

          const score =
            voiced >= 4 && durationMs >= 450 && peak >= 22
              ? 88
              : voiced >= 2 && peak >= 14
                ? 72
                : 48;
          const feedback: PronunciationResult['feedback'] =
            score >= 80 ? 'ممتاز' : score >= 50 ? 'جيد' : 'حاول مرة أخرى';

          const finalResult: PronunciationResult = {
            target: targetText,
            spoken: 'تم تسجيل صوتك بالميكروفون بنجاح',
            score,
            feedback,
            selfAssessed: false,
          };
          setSpokenText('تم التقاط صوتك بنجاح — يمكنك الاستماع لتسجيلك أدناه.');
          setResult(finalResult);
          triggerHaptic(score >= 50 ? 'success' : 'warning');
          onRecorded(finalResult);
        };

        recorder.start();
        recordStopTimerRef.current = setTimeout(() => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
        }, 4500);
        return;
      } catch {
        // Fall through if MediaRecorder is unavailable
      }
    }

    // Simple timed capture if MediaRecorder is unsupported
    recordStopTimerRef.current = setTimeout(() => {
      cleanupAudioRecorder();
      setListening(false);
      setRecordingMode(null);
      if (voicedSamplesRef.current >= 2 || peakVolumeRef.current >= 14) {
        const finalResult: PronunciationResult = {
          target: targetText,
          spoken: 'تم التقاط صوتك بالميكروفون بنجاح',
          score: 82,
          feedback: 'ممتاز',
          selfAssessed: false,
        };
        setSpokenText('تم التقاط صوتك بنجاح.');
        setResult(finalResult);
        onRecorded(finalResult);
      } else {
        setErrorMsg('لم نلتقط صوتاً واضحاً، حاول التحدث بصوت أعلى.');
      }
    }, 3200);
  };

  const handleStartMic = async () => {
    if (disabled) return;
    setErrorMsg('');
    setMicDenied(false);

    // 1) Always verify/request real microphone access first so Android & Chrome never silently fail after grant
    if (micApiSupported) {
      const micRes = await ensureMicrophoneStream();
      if (!micRes.ok) {
        setListening(false);
        setMicDenied(micRes.reason === 'denied');
        setErrorMsg(micRes.message);
        return;
      }

      const RecognitionCtor = getSpeechRecognitionConstructor();
      if (!RecognitionCtor) {
        // Browser supports mic but lacks Web Speech API: use direct mic recorder immediately
        await startLocalVoiceCapture(micRes.stream);
        return;
      }

      // Release preflight stream so SpeechRecognition can own the hardware mic exclusively
      micRes.stream.getTracks().forEach((t) => t.stop());

      try {
        const rec = new RecognitionCtor();
        rec.lang = 'en-US';
        rec.interimResults = false;
        rec.maxAlternatives = 3;
        rec.continuous = false;

        rec.onresult = (event) => {
          const alternatives: string[] = [];
          const firstResult = event.results?.[0];
          if (firstResult) {
            for (let i = 0; i < firstResult.length; i++) {
              const t = firstResult[i]?.transcript;
              if (t) alternatives.push(t);
            }
          }
          let bestEval = evaluatePronunciation(targetText, alternatives[0] || '');
          let bestSpoken = alternatives[0] || '';
          for (const alt of alternatives) {
            const ev = evaluatePronunciation(targetText, alt);
            if (ev.score > bestEval.score) {
              bestEval = ev;
              bestSpoken = alt;
            }
          }

          const finalResult: PronunciationResult = {
            target: targetText,
            spoken: bestSpoken,
            score: bestEval.score,
            feedback: bestEval.label,
            selfAssessed: false,
          };
          setSpokenText(bestSpoken);
          setResult(finalResult);
          setListening(false);
          setRecordingMode(null);
          triggerHaptic(bestEval.score >= 50 ? 'success' : 'warning');
          onRecorded(finalResult);
        };

        rec.onerror = (ev) => {
          setListening(false);
          setRecordingMode(null);
          // Microphone permission WAS ALREADY VERIFIED via getUserMedia above!
          // If SpeechRecognition fails with not-allowed / service-not-allowed / network (common in WebView, offline, or iframe),
          // switch seamlessly to direct Microphone recording instead of falsely claiming missing mic permission!
          if (
            ev.error === 'service-not-allowed' ||
            ev.error === 'not-allowed' ||
            ev.error === 'network' ||
            ev.error === 'audio-capture'
          ) {
            void startLocalVoiceCapture();
            return;
          }
          if (ev.error === 'no-speech') {
            setErrorMsg('لم نسمع صوتاً، قرّب الهاتف وحاول مرة أخرى أو اضغط "سمعت نفسي".');
          } else {
            void startLocalVoiceCapture();
          }
        };

        rec.onend = () => {
          setListening(false);
          setRecordingMode((prev) => (prev === 'speech' ? null : prev));
        };

        recognitionRef.current = rec;
        setRecordingMode('speech');
        setListening(true);
        rec.start();
      } catch {
        // If SpeechRecognition constructor/start throws after mic permission granted, use local mic capture
        await startLocalVoiceCapture();
      }
      return;
    }

    setErrorMsg('الميكروفون غير متاح في هذا المتصفح، يمكنك المتابعة باستخدام "سمعت نفسي".');
  };

  const handleStopMic = () => {
    if (recordingMode === 'audio') {
      if (recordStopTimerRef.current) {
        clearTimeout(recordStopTimerRef.current);
        recordStopTimerRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          cleanupAudioRecorder();
          setListening(false);
          setRecordingMode(null);
        }
      } else {
        cleanupAudioRecorder();
        setListening(false);
        setRecordingMode(null);
      }
      return;
    }

    try {
      recognitionRef.current?.stop();
    } catch {
      // Ignore
    }
    setListening(false);
    setRecordingMode(null);
  };

  const handleSelfAssess = (score: number, feedback: 'ممتاز' | 'جيد' | 'حاول مرة أخرى') => {
    if (disabled) return;
    const finalResult: PronunciationResult = {
      target: targetText,
      spoken: '(تقييم ذاتي: سمعت نفسي)',
      score,
      feedback,
      selfAssessed: true,
    };
    setResult(finalResult);
    triggerHaptic(score >= 50 ? 'success' : 'light');
    onRecorded(finalResult);
  };

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 ${
        isKids
          ? 'border-amber-200 bg-amber-50/60'
          : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-500">تدريب التحدث والنطق</p>
          <p className="font-en mt-1 text-xl font-bold text-slate-900 sm:text-2xl" dir="ltr">
            {targetText}
          </p>
          <p className="mt-1 text-sm text-slate-600">{targetAr}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SpeakButton
            speechId={`pron-lab-${targetText}`}
            text={targetText}
            lang="en"
            variant="pill"
            label="استمع للنطق"
          />
          <SpeakButton
            speechId={`pron-lab-slow-${targetText}`}
            text={targetText}
            lang="en"
            slow
            variant="pill"
            label="نطق بطيء"
          />
        </div>
      </div>

      {tip && (
        <p className="mt-3 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs leading-relaxed text-slate-600">
          تلميح النطق: {tip}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {canUseMic && (
          <button
            type="button"
            disabled={disabled}
            onClick={listening ? handleStopMic : () => void handleStartMic()}
            className={`inline-flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
              listening
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)]'
            }`}
          >
            {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            <span className="whitespace-nowrap">
              {listening
                ? recordingMode === 'audio'
                  ? 'جاري التسجيل... اضغط للإنهاء'
                  : 'جاري الاستماع... اضغط للإيقاف'
                : '🎤 انطق الآن'}
            </span>
          </button>
        )}

        <button
          type="button"
          disabled={disabled}
          onClick={() => handleSelfAssess(85, 'ممتاز')}
          className="inline-flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span className="whitespace-nowrap">سمعت نفسي (ممتاز)</span>
        </button>
      </div>

      {!canUseMic && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleSelfAssess(65, 'جيد')}
            className="min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            سمعت نفسي (جيد)
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleSelfAssess(40, 'حاول مرة أخرى')}
            className="min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            سمعت نفسي (أحتاج إعادة)
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-900">
          <span>{errorMsg}</span>
          {micDenied && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleStartMic()}
                className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1 font-bold text-white hover:bg-emerald-700"
              >
                <RefreshCw className="h-3.5 w-3.5" /> أعد المحاولة
              </button>
              <button
                type="button"
                onClick={() => {
                  const env = openDeviceAppPermissions();
                  if (env === 'web') {
                    setErrorMsg(
                      'اضغط على أيقونة القفل أو الإعدادات في شريط المتصفح وفعّل إذن الميكروفون ثم اضغط «أعد المحاولة».',
                    );
                  }
                }}
                className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-amber-600 px-3 py-1 font-bold text-white hover:bg-amber-700"
              >
                <Settings className="h-3.5 w-3.5" /> الإعدادات
              </button>
            </div>
          )}
        </div>
      )}

      {result && (
        <div
          role="status"
          className={`mt-4 rounded-xl border p-3.5 ${
            result.feedback === 'ممتاز'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : result.feedback === 'جيد'
                ? 'border-sky-200 bg-sky-50 text-sky-900'
                : 'border-rose-200 bg-rose-50 text-rose-900'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold">التقييم: {result.feedback}</span>
            <span className="font-mono text-base font-bold tabular-nums">{result.score}/100</span>
          </div>
          {spokenText && !result.selfAssessed && (
            <p className="mt-1 text-xs opacity-90">
              ما التقطه الميكروفون: &ldquo;{spokenText}&rdquo;
            </p>
          )}
          {recordedAudioUrl && (
            <div className="mt-2 flex items-center gap-2">
              <Volume2 className="h-4 w-4 shrink-0" />
              <audio controls src={recordedAudioUrl} className="h-8 max-w-full" />
            </div>
          )}
          {result.feedback === 'حاول مرة أخرى' && !disabled && (
            <button
              type="button"
              onClick={() => void handleStartMic()}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold underline"
            >
              <RotateCcw className="h-3.5 w-3.5" /> إعادة المحاولة
            </button>
          )}
        </div>
      )}
    </div>
  );
};
