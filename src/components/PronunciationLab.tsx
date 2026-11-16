import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, CheckCircle2, RotateCcw } from 'lucide-react';
import {
  evaluatePronunciation,
  getSpeechRecognitionConstructor,
  isSpeechRecognitionSupported,
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
  const [spokenText, setSpokenText] = useState('');
  const [result, setResult] = useState<PronunciationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const supported = isSpeechRecognitionSupported();

  useEffect(() => {
    setSpokenText('');
    setResult(null);
    setErrorMsg('');
    setListening(false);
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        // Ignore
      }
    };
  }, [targetText]);

  const handleStartMic = () => {
    if (disabled) return;
    const RecognitionCtor = getSpeechRecognitionConstructor();
    if (!RecognitionCtor) {
      setErrorMsg('التسجيل الصوتي المباشر غير مدعوم في هذا المتصفح، استخدم زر "سمعت نفسي".');
      return;
    }

    setErrorMsg('');
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
        // Pick best matching alternative for fairness
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
        triggerHaptic(bestEval.score >= 50 ? 'success' : 'warning');
        onRecorded(finalResult);
      };

      rec.onerror = (ev) => {
        setListening(false);
        if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
          setErrorMsg('يرجى السماح بصلاحية الميكروفون أو استخدام التقييم الذاتي "سمعت نفسي".');
        } else if (ev.error === 'no-speech') {
          setErrorMsg('لم نسمع صوتاً، قرّب الهاتف وحاول مرة أخرى أو اضغط "سمعت نفسي".');
        } else {
          setErrorMsg('تعذر التقاط الصوت حالياً، يمكنك استخدام زر "سمعت نفسي" بالأسفل.');
        }
      };

      rec.onend = () => {
        setListening(false);
      };

      recognitionRef.current = rec;
      setListening(true);
      rec.start();
    } catch {
      setListening(false);
      setErrorMsg('تعذر تشغيل الميكروفون، يمكنك المتابعة باستخدام "سمعت نفسي".');
    }
  };

  const handleStopMic = () => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // Ignore
    }
    setListening(false);
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
        {supported && (
          <button
            type="button"
            disabled={disabled}
            onClick={listening ? handleStopMic : handleStartMic}
            className={`inline-flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
              listening
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)]'
            }`}
          >
            {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            <span className="whitespace-nowrap">{listening ? 'جاري الاستماع... اضغط للإيقاف' : '🎤 انطق الآن'}</span>
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

      {!supported && (
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
        <p className="mt-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-800">
          {errorMsg}
        </p>
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
            <p className="mt-1 text-xs opacity-90" dir="ltr">
              ما التقطه الميكروفون: &ldquo;{spokenText}&rdquo;
            </p>
          )}
          {result.feedback === 'حاول مرة أخرى' && !disabled && (
            <button
              type="button"
              onClick={handleStartMic}
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
