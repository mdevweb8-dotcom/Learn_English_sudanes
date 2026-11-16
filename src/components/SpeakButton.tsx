import React from 'react';
import { AlertTriangle, Download, Square, Turtle, Volume2, X } from 'lucide-react';
import {
  clearSpeechError,
  openDeviceVoiceDownload,
  speakEnglish,
  useSpeech,
  type SpeechLang,
} from '../utils/speech';

interface SpeakButtonProps {
  speechId: string;
  text: string;
  lang?: SpeechLang;
  slow?: boolean;
  label?: string;
  size?: 'sm' | 'md';
  variant?: 'icon' | 'pill';
  className?: string;
}

export const SpeakButton: React.FC<SpeakButtonProps> = ({
  speechId,
  text,
  lang = 'auto',
  slow = false,
  label,
  size = 'md',
  variant = 'icon',
  className = '',
}) => {
  const speech = useSpeech();
  const isSpeaking = speech.activeId === speechId && speech.status === 'speaking';

  const handlePress = () => {
    speakEnglish(text, { id: speechId, lang, slow });
  };

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={handlePress}
        aria-pressed={isSpeaking}
        className={`inline-flex min-h-[42px] shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition active:scale-[0.98] ${
          isSpeaking
            ? 'bg-rose-600 text-white ring-2 ring-rose-300'
            : slow
              ? 'border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
              : 'bg-[var(--accent-soft)] text-[var(--accent-text)] hover:opacity-90'
        } ${className}`}
      >
        {isSpeaking ? (
          <Square className="h-4 w-4 fill-current" />
        ) : slow ? (
          <Turtle className="h-4 w-4" />
        ) : (
          <Volume2 className="h-4 w-4" />
        )}
        <span className="whitespace-nowrap">
          {isSpeaking ? 'جاري النطق... إيقاف' : label || (slow ? 'نطق بطيء' : 'استمع للنطق')}
        </span>
      </button>
    );
  }

  const dim = size === 'sm' ? 'h-9 w-9' : 'h-11 w-11';
  return (
    <button
      type="button"
      onClick={handlePress}
      aria-pressed={isSpeaking}
      aria-label={isSpeaking ? 'إيقاف النطق' : label || `نطق ${text}`}
      title={isSpeaking ? 'اضغط لإيقاف النطق' : slow ? 'نطق بطيء' : 'استمع للنطق'}
      className={`grid ${dim} shrink-0 place-items-center rounded-xl transition active:scale-[0.96] ${
        isSpeaking
          ? 'bg-rose-600 text-white ring-2 ring-rose-300'
          : slow
            ? 'border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
            : 'bg-[var(--accent-soft)] text-[var(--accent-primary)] hover:opacity-90'
      } ${className}`}
    >
      {isSpeaking ? (
        <Square className="h-4 w-4 fill-current" />
      ) : slow ? (
        <Turtle className="h-4 w-4" />
      ) : (
        <Volume2 className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} />
      )}
    </button>
  );
};

export const SpeechErrorBanner: React.FC = () => {
  const speech = useSpeech();
  if (!speech.errorMessage) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-lg rounded-2xl border border-rose-300 bg-rose-50 p-4 shadow-xl lg:bottom-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div>
            <p className="text-xs font-extrabold text-rose-950">تنبيه محرك النطق</p>
            <p className="mt-1 text-xs leading-relaxed text-rose-900">{speech.errorMessage}</p>
            {speech.missingLang && (
              <button
                type="button"
                onClick={openDeviceVoiceDownload}
                className="mt-2.5 inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-rose-700"
              >
                <Download className="h-3.5 w-3.5" />
                <span>تحميل حزمة الصوت ({speech.missingLang === 'ar' ? 'العربية' : 'الإنجليزية'})</span>
              </button>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={clearSpeechError}
          aria-label="إغلاق التنبيه"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-rose-700 hover:bg-rose-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
