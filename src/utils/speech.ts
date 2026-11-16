import { useEffect, useState } from 'react';

export type SpeechLang = 'en' | 'ar' | 'auto';

export interface SpeechSnapshot {
  activeId: string | null;
  status: 'idle' | 'speaking' | 'error';
  errorMessage: string | null;
  missingLang: 'en' | 'ar' | null;
  initialized: boolean;
}

interface AndroidTTSBridge {
  isReady: () => boolean;
  isLanguageAvailable: (langTag: string) => boolean;
  speak: (speechId: string, text: string, langTag: string, rate: number) => void;
  stop: () => void;
  openInstallVoiceData: () => void;
  openAppSettings: () => void;
}

declare global {
  interface Window {
    AndroidTTS?: AndroidTTSBridge;
    __onAndroidTTSEvent?: (speechId: string, type: string, detail: string) => void;
  }
}

let snapshot: SpeechSnapshot = {
  activeId: null,
  status: 'idle',
  errorMessage: null,
  missingLang: null,
  initialized: false,
};

const listeners = new Set<(s: SpeechSnapshot) => void>();
let voicesCache: SpeechSynthesisVoice[] = [];
let watchdogTimer: ReturnType<typeof setTimeout> | null = null;
let speakDelayTimer: ReturnType<typeof setTimeout> | null = null;
let currentUtterance: SpeechSynthesisUtterance | null = null;

function notify() {
  for (const fn of listeners) fn({ ...snapshot });
}

function setSnapshot(partial: Partial<SpeechSnapshot>) {
  snapshot = { ...snapshot, ...partial };
  notify();
}

function clearTimers() {
  if (watchdogTimer) {
    clearTimeout(watchdogTimer);
    watchdogTimer = null;
  }
  if (speakDelayTimer) {
    clearTimeout(speakDelayTimer);
    speakDelayTimer = null;
  }
}

export function detectTextLanguage(text: string): 'en' | 'ar' {
  return /[\u0600-\u06FF]/.test(text) ? 'ar' : 'en';
}

function refreshVoices() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    voicesCache = window.speechSynthesis.getVoices() || [];
  } catch {
    voicesCache = [];
  }
}

export function initSpeechEngine(): void {
  if (typeof window === 'undefined') return;

  window.__onAndroidTTSEvent = (speechId, type, detail) => {
    if (type === 'start') {
      clearTimers();
      setSnapshot({ activeId: speechId, status: 'speaking', errorMessage: null, missingLang: null });
    } else if (type === 'done') {
      clearTimers();
      if (snapshot.activeId === speechId) {
        setSnapshot({ activeId: null, status: 'idle' });
      }
    } else if (type === 'missing_lang') {
      clearTimers();
      const missing: 'en' | 'ar' = detail.startsWith('ar') ? 'ar' : 'en';
      setSnapshot({
        activeId: null,
        status: 'error',
        missingLang: missing,
        errorMessage:
          missing === 'ar'
            ? 'حزمة الصوت العربي غير مثبتة على جهازك. اضغط لتحميلها من إعدادات النطق.'
            : 'حزمة الصوت الإنجليزي غير مثبتة على جهازك. اضغط لتحميلها من إعدادات النطق.',
      });
    } else if (type === 'error') {
      clearTimers();
      setSnapshot({
        activeId: null,
        status: 'error',
        errorMessage: detail || 'تعذر تشغيل الصوت. تأكد من مستوى صوت الوسائط أو حزمة اللغة.',
      });
    }
  };

  if ('speechSynthesis' in window) {
    refreshVoices();
    if (typeof window.speechSynthesis.addEventListener === 'function') {
      window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
    } else {
      window.speechSynthesis.onvoiceschanged = refreshVoices;
    }
  }

  setSnapshot({ initialized: true });
}

export function stopAllSpeech(): void {
  clearTimers();
  currentUtterance = null;
  if (typeof window !== 'undefined') {
    try {
      if (window.AndroidTTS?.isReady()) {
        window.AndroidTTS.stop();
      }
    } catch {
      // Ignore
    }
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
    }
  }
  setSnapshot({ activeId: null, status: 'idle' });
}

export function clearSpeechError(): void {
  setSnapshot({ errorMessage: null, missingLang: null, status: snapshot.activeId ? 'speaking' : 'idle' });
}

export function openDeviceVoiceDownload(): void {
  if (typeof window !== 'undefined' && window.AndroidTTS) {
    try {
      window.AndroidTTS.openInstallVoiceData();
      return;
    } catch {
      // Fallback below
    }
  }
  setSnapshot({
    errorMessage:
      'لتحميل حزمة اللغة: افتح إعدادات الجهاز ← اللغات والإدخال ← تحويل النص إلى كلام (Text-to-Speech) ← تثبيت بيانات الصوت (English US).',
  });
}

export function openDeviceAppPermissions(): void {
  if (typeof window !== 'undefined' && window.AndroidTTS) {
    try {
      window.AndroidTTS.openAppSettings();
    } catch {
      // Ignore
    }
  }
}

export interface SpeakOptions {
  id?: string;
  lang?: SpeechLang;
  rate?: number;
  slow?: boolean;
}

export function speakEnglish(text: string, rateOrOptions?: number | SpeakOptions): Promise<void> {
  const clean = String(text || '').trim();
  if (!clean) {
    setSnapshot({
      activeId: null,
      status: 'error',
      errorMessage: 'لا يوجد نص للنطق.',
    });
    return Promise.resolve();
  }

  const opts: SpeakOptions =
    typeof rateOrOptions === 'number' ? { rate: rateOrOptions } : rateOrOptions || {};

  const speechId = opts.id || `auto-${clean.slice(0, 24)}`;

  // Toggle behavior: clicking the currently speaking button stops speech immediately
  if (snapshot.activeId === speechId && snapshot.status === 'speaking') {
    stopAllSpeech();
    return Promise.resolve();
  }

  // Stop any previously speaking utterance first (never overlap two voices!)
  stopAllSpeech();

  if (!snapshot.initialized) {
    initSpeechEngine();
  }

  const resolvedLang: 'en' | 'ar' =
    opts.lang && opts.lang !== 'auto' ? opts.lang : detectTextLanguage(clean);

  const wordCount = clean.split(/\s+/).filter(Boolean).length;
  // Learning speeds: slower for single words, natural for full sentences, slowest when explicit slow mode
  const targetRate = opts.slow
    ? 0.56
    : typeof opts.rate === 'number'
      ? opts.rate
      : wordCount <= 2
        ? 0.78
        : 0.96;

  // 1) Native Android TTS path inside Capacitor APK
  if (typeof window !== 'undefined' && window.AndroidTTS) {
    try {
      if (window.AndroidTTS.isReady()) {
        const langTag = resolvedLang === 'ar' ? 'ar-SA' : 'en-US';
        if (!window.AndroidTTS.isLanguageAvailable(langTag)) {
          setSnapshot({
            activeId: null,
            status: 'error',
            missingLang: resolvedLang,
            errorMessage:
              resolvedLang === 'ar'
                ? 'حزمة الصوت العربي غير مثبتة على جهازك. اضغط زر التحميل لإضافتها.'
                : 'حزمة الصوت الإنجليزي (en-US) غير مثبتة على جهازك. اضغط زر التحميل لإضافتها.',
          });
          return Promise.resolve();
        }
        setSnapshot({ activeId: speechId, status: 'speaking', errorMessage: null, missingLang: null });
        window.AndroidTTS.speak(speechId, clean, langTag, targetRate);
        return Promise.resolve();
      }
    } catch {
      // Fall through to Web SpeechSynthesis
    }
  }

  // 2) Web Speech Synthesis path (Browser / PWA)
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    setSnapshot({
      activeId: null,
      status: 'error',
      errorMessage: 'المتصفح الحالي لا يدعم محرك النطق الصوتي (SpeechSynthesis). جرّب Chrome أو Edge.',
    });
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    refreshVoices();
    const targetPrefix = resolvedLang === 'ar' ? 'ar' : 'en';
    const matchingVoices = voicesCache.filter((v) => v.lang.toLowerCase().startsWith(targetPrefix));

    // Only flag missing voice if browser already populated voices for other languages but none for target
    if (voicesCache.length > 0 && matchingVoices.length === 0) {
      setSnapshot({
        activeId: null,
        status: 'error',
        missingLang: resolvedLang,
        errorMessage:
          resolvedLang === 'ar'
            ? 'لغة النطق العربية غير مثبتة على هذا المتصفح/الجهاز.'
            : 'لغة النطق الإنجليزية غير مثبتة على هذا المتصفح/الجهاز.',
      });
      resolve();
      return;
    }

    setSnapshot({ activeId: speechId, status: 'speaking', errorMessage: null, missingLang: null });

    // Small 45ms delay after cancel() avoids the well-known Chromium/Android WebView dropped-utterance bug
    speakDelayTimer = setTimeout(() => {
      try {
        try {
          window.speechSynthesis.resume();
        } catch {
          // Ignore
        }

        const utterance = new SpeechSynthesisUtterance(clean);
        currentUtterance = utterance;
        utterance.lang = resolvedLang === 'ar' ? 'ar-SA' : 'en-US';
        utterance.rate = targetRate;
        utterance.volume = 1.0; // Always loud & clear, never 0
        utterance.pitch = 1.0;

        const preferredVoice =
          matchingVoices.find((v) => v.lang.toLowerCase() === utterance.lang.toLowerCase() && v.localService) ||
          matchingVoices.find((v) => v.lang.toLowerCase() === utterance.lang.toLowerCase()) ||
          matchingVoices[0];
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }

        let started = false;
        let finished = false;

        const finishSuccess = () => {
          if (finished) return;
          finished = true;
          clearTimers();
          if (currentUtterance === utterance) currentUtterance = null;
          if (snapshot.activeId === speechId) {
            setSnapshot({ activeId: null, status: 'idle' });
          }
          resolve();
        };

        const finishError = (msg: string) => {
          if (finished) return;
          finished = true;
          clearTimers();
          if (currentUtterance === utterance) currentUtterance = null;
          setSnapshot({
            activeId: null,
            status: 'error',
            errorMessage: msg,
          });
          resolve();
        };

        utterance.onstart = () => {
          started = true;
          if (watchdogTimer) {
            clearTimeout(watchdogTimer);
            watchdogTimer = null;
          }
          // Safety completion ceiling in case browser stalls onend
          const estMs = Math.max(4500, clean.length * 160 + 2500);
          watchdogTimer = setTimeout(() => {
            finishSuccess();
          }, estMs);
        };

        utterance.onend = () => {
          finishSuccess();
        };

        utterance.onerror = (ev) => {
          if (ev.error === 'interrupted' || ev.error === 'canceled') {
            finished = true;
            clearTimers();
            resolve();
            return;
          }
          if (ev.error === 'language-unavailable' || ev.error === 'voice-unavailable') {
            setSnapshot({ missingLang: resolvedLang });
            finishError(
              resolvedLang === 'ar'
                ? 'حزمة النطق العربية غير متوفرة على جهازك. يرجى تحميلها.'
                : 'حزمة النطق الإنجليزية غير متوفرة على جهازك. يرجى تحميلها.',
            );
            return;
          }
          finishError('تعذر تشغيل الصوت على هذا الجهاز. تحقق من مستوى الصوت وإعدادات المتصفح.');
        };

        // Watchdog if speechSynthesis.speak() silently fails to start within 1600ms
        watchdogTimer = setTimeout(() => {
          if (!started && !finished) {
            try {
              window.speechSynthesis.cancel();
            } catch {
              // Ignore
            }
            finishError(
              'لم يستجب محرك الصوت في هذا المتصفح. تأكد من عدم كتم الصوت أو افتح التطبيق في Chrome / تطبيق الأندرويد.',
            );
          }
        }, 1600);

        window.speechSynthesis.speak(utterance);
      } catch {
        setSnapshot({
          activeId: null,
          status: 'error',
          errorMessage: 'حدث خطأ غير متوقع أثناء تشغيل النطق.',
        });
        resolve();
      }
    }, 45);
  });
}

export function useSpeech() {
  const [state, setState] = useState<SpeechSnapshot>(snapshot);
  useEffect(() => {
    const listener = (next: SpeechSnapshot) => setState(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return state;
}

export interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }>>;
}

export function getSpeechRecognitionConstructor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionConstructor() !== null;
}

export function normalizeSpeechText(text: string): string {
  return String(text)
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

export function evaluatePronunciation(
  target: string,
  spoken: string,
): { score: number; label: 'ممتاز' | 'جيد' | 'حاول مرة أخرى' } {
  const normTarget = normalizeSpeechText(target);
  const normSpoken = normalizeSpeechText(spoken);

  if (!normSpoken) {
    return { score: 0, label: 'حاول مرة أخرى' };
  }
  if (normTarget === normSpoken) {
    return { score: 100, label: 'ممتاز' };
  }

  const maxLen = Math.max(normTarget.length, normSpoken.length);
  const charDist = levenshtein(normTarget, normSpoken);
  const charRatio = maxLen > 0 ? Math.max(0, 1 - charDist / maxLen) : 0;

  const targetWords = normTarget.split(' ').filter(Boolean);
  const spokenWords = normSpoken.split(' ').filter(Boolean);
  let matchedWords = 0;
  for (const tw of targetWords) {
    if (spokenWords.some((sw) => sw === tw || levenshtein(sw, tw) <= 1)) {
      matchedWords++;
    }
  }
  const wordRatio = targetWords.length > 0 ? matchedWords / targetWords.length : 0;

  const combined = Math.round((charRatio * 0.55 + wordRatio * 0.45) * 100);
  const score = Math.max(0, Math.min(100, combined));
  const label: 'ممتاز' | 'جيد' | 'حاول مرة أخرى' =
    score >= 80 ? 'ممتاز' : score >= 50 ? 'جيد' : 'حاول مرة أخرى';

  return { score, label };
}

export function playMessageDing(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(784, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.09);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.17);
  } catch {
    // Ignore audio context block
  }
}
