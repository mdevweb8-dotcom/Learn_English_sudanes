import React, { useEffect, useState } from 'react';
import { BookOpen, Loader2, Send, X } from 'lucide-react';
import type { CEFRLevelId } from '../types';
import { getLocalSudaneseExplanation } from '../data/curriculum';
import { SpeakButton } from './SpeakButton';

interface AITeacherModalProps {
  initialQuery?: string;
  levelId: CEFRLevelId;
  mode: 'kids' | 'adults';
  onClose: () => void;
}

export const AITeacherModal: React.FC<AITeacherModalProps> = ({
  initialQuery = '',
  levelId,
  mode,
  onClose,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [usedOffline, setUsedOffline] = useState(false);

  const askTeacher = async (textToAsk: string) => {
    const clean = textToAsk.trim();
    if (!clean) return;
    setLoading(true);
    setUsedOffline(false);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch('/api/teacher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: clean, level: levelId, mode }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error('Server fallback');
      }
      const data = (await res.json()) as { answer?: string };
      if (data.answer) {
        setAnswer(data.answer);
      } else {
        throw new Error('Empty response');
      }
    } catch {
      setUsedOffline(true);
      setAnswer(getLocalSudaneseExplanation(clean, levelId));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialQuery.trim()) {
      askTeacher(initialQuery);
    }
  }, [initialQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    askTeacher(query);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-lg rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">اسأل المعلم (بالسوداني البسيط)</h3>
              <p className="text-xs text-slate-500">اكتب أي كلمة إنجليزية أو قاعدة لنشرحها ببساطة</p>
            </div>
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

        <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="مثال: Approach أو متى نستخدم must have؟"
            className="min-h-[44px] flex-1 rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-[var(--accent-primary)]"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--accent-primary-hover)] disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span>اشرح لي</span>
          </button>
        </form>

        <div className="mt-4 min-h-[140px] rounded-xl border border-slate-200 bg-slate-50 p-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm font-semibold text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--accent-primary)]" />
              <span>المعلم يجهز لك الشرح المبسط...</span>
            </div>
          ) : answer ? (
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[var(--accent-text)]">
                  {usedOffline ? 'شرح المعلم المحلي (بدون نت)' : 'شرح المعلم'}
                </span>
                {query.trim() && (
                  <SpeakButton
                    speechId={`ai-teacher-${query.trim().slice(0, 20)}`}
                    text={query.trim()}
                    lang="auto"
                    variant="pill"
                    label="اسمع النطق"
                  />
                )}
              </div>
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-800">{answer}</p>
            </div>
          ) : (
            <p className="py-8 text-center text-xs text-slate-500">
              جرّب كتابة كلمة مثل <span className="font-en font-bold">Capable</span> أو{' '}
              <span className="font-en font-bold">Despite</span> وسنشرحها لك بالدارجة السودانية السهلة.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
