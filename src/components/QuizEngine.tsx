import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  HelpCircle,
  RotateCcw,
  SkipForward,
  Swords,
  Trophy,
  X,
  XCircle,
} from 'lucide-react';
import type { LessonQuestion, Rival, SkillTag } from '../types';
import { SKILL_LABELS } from '../data/curriculum';
import { SpeakButton } from './SpeakButton';
import { PronunciationLab, type PronunciationResult } from './PronunciationLab';
import { AvatarView } from './AvatarView';
import { triggerHaptic } from '../services/native';

export interface QuizSessionOutcome {
  totalUnique: number;
  firstTryCorrect: number;
  mistakesCount: number;
  scorePercent: number;
  passed: boolean;
  xpEarned: number;
  coinsEarned: number;
  skillEvents: Array<{ skill: SkillTag; correct: boolean }>;
  pronunciationRecords: PronunciationResult[];
  beatRival?: boolean;
  rivalName?: string;
}

interface QuizQueueItem {
  question: LessonQuestion;
  instanceKey: string;
  isRetry: boolean;
  retryCount: number;
}

interface QuizEngineProps {
  title: string;
  subtitle?: string;
  questions: LessonQuestion[];
  passThreshold?: number; // e.g., 70
  isKids?: boolean;
  rivalChallenge?: { rival: Rival; rivalTargetAccuracy: number };
  onAskTeacher?: (wordOrTopic: string) => void;
  onComplete: (outcome: QuizSessionOutcome) => void;
  onClose: () => void;
}

function normalizeAnswer(val: string): string {
  return val
    .toLowerCase()
    .replace(/[.!?,،؟]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function shuffleWords(words: string[]): string[] {
  const arr = [...words];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const QuizEngine: React.FC<QuizEngineProps> = ({
  title,
  subtitle,
  questions,
  passThreshold = 70,
  isKids = false,
  rivalChallenge,
  onAskTeacher,
  onComplete,
  onClose,
}) => {
  const initialQueue: QuizQueueItem[] = useMemo(
    () =>
      questions.map((q, idx) => ({
        question: q,
        instanceKey: `${q.id}-init-${idx}`,
        isRetry: false,
        retryCount: 0,
      })),
    [questions],
  );

  const [queue, setQueue] = useState<QuizQueueItem[]>(initialQueue);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Per-instance answer state
  const [selectedOption, setSelectedOption] = useState('');
  const [textAnswer, setTextAnswer] = useState('');
  const [orderedWords, setOrderedWords] = useState<Array<{ word: string; idx: number }>>([]);
  const [pronResult, setPronResult] = useState<PronunciationResult | null>(null);

  // Confirmation & single-count guard
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isCurrentCorrect, setIsCurrentCorrect] = useState(false);
  const [scoredInstanceKeys, setScoredInstanceKeys] = useState<Record<string, boolean>>({});

  // Cumulative stats
  const [firstTryCorrectIds, setFirstTryCorrectIds] = useState<Record<string, boolean>>({});
  const [mistakesCount, setMistakesCount] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [skillEvents, setSkillEvents] = useState<Array<{ skill: SkillTag; correct: boolean }>>([]);
  const [pronRecords, setPronRecords] = useState<PronunciationResult[]>([]);
  const [finished, setFinished] = useState(false);
  const [rivalScore, setRivalScore] = useState(0);

  const currentItem = queue[currentIndex];
  const currentQ = currentItem?.question;

  const availableOrderWords = useMemo(() => {
    if (!currentQ || currentQ.type !== 'order' || !currentQ.wordsToOrder) return [];
    return shuffleWords(currentQ.wordsToOrder);
  }, [currentItem?.instanceKey]);

  useEffect(() => {
    setSelectedOption('');
    setTextAnswer('');
    setOrderedWords([]);
    setPronResult(null);
    setIsConfirmed(false);
    setIsCurrentCorrect(false);
  }, [currentIndex, currentItem?.instanceKey]);

  if (!questions.length) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-xl">
          <p className="text-base font-bold text-slate-900">لا توجد أسئلة متاحة حالياً لهذا القسم.</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 min-h-[44px] w-full rounded-xl bg-[var(--accent-primary)] px-4 py-2.5 text-sm font-bold text-white"
          >
            إغلاق
          </button>
        </div>
      </div>
    );
  }

  const hasUserInput = (() => {
    if (!currentQ) return false;
    if (currentQ.type === 'mcq' || currentQ.type === 'tf') return selectedOption !== '';
    if (currentQ.type === 'fill' || currentQ.type === 'listen') return textAnswer.trim().length > 0;
    if (currentQ.type === 'order') return orderedWords.length > 0;
    if (currentQ.type === 'pronunciation') return pronResult !== null;
    return false;
  })();

  const evaluateCurrentAnswer = (): boolean => {
    if (!currentQ) return false;
    if (currentQ.type === 'mcq' || currentQ.type === 'tf') {
      return selectedOption === currentQ.answer;
    }
    if (currentQ.type === 'fill' || currentQ.type === 'listen') {
      return normalizeAnswer(textAnswer) === normalizeAnswer(currentQ.answer);
    }
    if (currentQ.type === 'order') {
      const built = orderedWords.map((o) => o.word).join(' ');
      return normalizeAnswer(built) === normalizeAnswer(currentQ.answer);
    }
    if (currentQ.type === 'pronunciation') {
      return (pronResult?.score ?? 0) >= 50;
    }
    return false;
  };

  // Single-count confirmation handler: locks all options immediately, counts mistake once only
  const handleConfirm = () => {
    if (!currentItem || !currentQ || isConfirmed || !hasUserInput) return;
    if (scoredInstanceKeys[currentItem.instanceKey]) return;

    const correct = evaluateCurrentAnswer();

    // Lock options & mark instance scored immediately
    setIsConfirmed(true);
    setIsCurrentCorrect(correct);
    setScoredInstanceKeys((prev) => ({ ...prev, [currentItem.instanceKey]: true }));
    setSkillEvents((prev) => [...prev, { skill: currentQ.skill_tag, correct }]);

    if (rivalChallenge) {
      const rivalGetsPoint = Math.random() < rivalChallenge.rivalTargetAccuracy;
      if (rivalGetsPoint) setRivalScore((s) => s + 1);
    }

    if (correct) {
      triggerHaptic('success');
      // +10 XP for every right answer
      setXpEarned((x) => x + 10);
      if (!currentItem.isRetry) {
        setFirstTryCorrectIds((prev) => ({ ...prev, [currentQ.id]: true }));
      }
      // Answered right on retry -> no re-queue (removed from retry cycle!)
    } else {
      triggerHaptic('warning');
      setMistakesCount((m) => m + 1);
      // Re-queue the exact same question after 3 questions (currentIndex + 4)
      const insertAt = Math.min(queue.length, currentIndex + 4);
      const retryItem: QuizQueueItem = {
        question: currentQ,
        instanceKey: `${currentQ.id}-retry-${currentItem.retryCount + 1}-${Date.now()}`,
        isRetry: true,
        retryCount: currentItem.retryCount + 1,
      };
      setQueue((prev) => {
        const next = [...prev];
        next.splice(Math.min(next.length, insertAt), 0, retryItem);
        return next;
      });
    }
  };

  const handleNextOrSkip = () => {
    if (!currentItem || !currentQ) return;
    // Allow skip if user hasn't confirmed yet (records skipped without looping infinitely)
    if (currentIndex + 1 < queue.length) {
      setCurrentIndex((i) => i + 1);
    } else {
      setFinished(true);
    }
  };

  const handlePronunciationRecorded = (res: PronunciationResult) => {
    if (isConfirmed) return;
    setPronResult(res);
    setPronRecords((prev) => [...prev, res]);
  };

  const totalUnique = questions.length;
  const firstTryCorrect = Object.keys(firstTryCorrectIds).length;
  const scorePercent = Math.round((firstTryCorrect / totalUnique) * 100);
  const passed = scorePercent >= passThreshold;
  const coinsEarned = passed ? Math.max(10, Math.round(xpEarned / 4)) : Math.round(xpEarned / 5);
  const beatRival = rivalChallenge ? firstTryCorrect >= rivalScore : undefined;

  if (finished) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-50">
        <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              className="grid h-11 w-11 place-items-center rounded-xl text-slate-500 hover:bg-slate-200/70"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="my-auto py-8 text-center">
            <div
              className={`mx-auto grid h-20 w-20 place-items-center rounded-2xl ${
                passed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}
            >
              {passed ? <Trophy className="h-10 w-10" /> : <RotateCcw className="h-10 w-10" />}
            </div>

            <h3 className="mt-5 text-2xl font-extrabold text-slate-900">
              {rivalChallenge
                ? beatRival
                  ? `🎉 فزت في تحدي اليوم ضد ${rivalChallenge.rival.name}!`
                  : `تحدٍ رائع مع ${rivalChallenge.rival.name}! واصل التدريب`
                : passed
                  ? 'أحسنت! أتممت التمرين بنجاح'
                  : 'محاولة طيبة! أعد التدريب للوصول لدرجة النجاح'}
            </h3>

            <p className="mt-2 text-sm text-slate-600">
              {passed
                ? 'تم تسجيل نقاطك وتحديث تحليلك الذكي للمهارات.'
                : `درجة النجاح المطلوبة هي ${passThreshold}%. راجع الأخطاء وحاول مرة أخرى.`}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="font-mono text-2xl font-bold tabular-nums text-slate-900">{scorePercent}%</div>
                <div className="mt-1 text-xs font-semibold text-slate-500">النتيجة</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="font-mono text-2xl font-bold tabular-nums text-emerald-600">
                  {firstTryCorrect}/{totalUnique}
                </div>
                <div className="mt-1 text-xs font-semibold text-slate-500">من أول محاولة</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="font-mono text-2xl font-bold tabular-nums text-[var(--accent-primary)]">
                  +{xpEarned} XP
                </div>
                <div className="mt-1 text-xs font-semibold text-slate-500">نقاط الخبرة</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="font-mono text-2xl font-bold tabular-nums text-amber-600">+{coinsEarned}</div>
                <div className="mt-1 text-xs font-semibold text-slate-500">عملات (Coins)</div>
              </div>
            </div>

            {rivalChallenge && (
              <div className="mt-5 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-sm">
                <div className="flex items-center gap-3">
                  <AvatarView avatarId={rivalChallenge.rival.avatarId} size={40} />
                  <div className="text-start">
                    <p className="font-bold text-slate-900">نتيجة {rivalChallenge.rival.name}</p>
                    <p className="text-xs text-slate-500">منافس تحدي اليوم</p>
                  </div>
                </div>
                <span className="font-mono text-lg font-bold tabular-nums text-slate-900">
                  {rivalScore}/{totalUnique}
                </span>
              </div>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() =>
                  onComplete({
                    totalUnique,
                    firstTryCorrect,
                    mistakesCount,
                    scorePercent,
                    passed,
                    xpEarned,
                    coinsEarned,
                    skillEvents,
                    pronunciationRecords: pronRecords,
                    beatRival,
                    rivalName: rivalChallenge?.rival.name,
                  })
                }
                className="min-h-[48px] flex-1 rounded-xl bg-[var(--accent-primary)] px-6 py-3 text-sm font-bold text-white transition hover:bg-[var(--accent-primary-hover)]"
              >
                حفظ النتيجة والمتابعة
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const progressPct = Math.round(((currentIndex + (isConfirmed ? 1 : 0)) / queue.length) * 100);

  return (
    <div className={`fixed inset-0 z-50 overflow-y-auto ${isKids ? 'bg-[#FFFBF2]' : 'bg-[#F8FAFC]'}`}>
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 pb-10 pt-4">
        {/* Top Quiz Bar */}
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-600 transition hover:bg-slate-200/70"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1 text-center">
            <h2 className="truncate text-sm font-bold text-slate-900 sm:text-base">{title}</h2>
            {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
          </div>

          {onAskTeacher && currentQ ? (
            <button
              type="button"
              onClick={() => onAskTeacher(currentQ.prompt)}
              className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl bg-[var(--accent-soft)] px-3 py-2 text-xs font-bold text-[var(--accent-text)]"
            >
              <HelpCircle className="h-4 w-4" />
              <span className="whitespace-nowrap">اسأل المعلم</span>
            </button>
          ) : (
            <span className="w-11" />
          )}
        </header>

        {/* Progress & Metadata */}
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-600">
            <div className="flex items-center gap-2">
              <span className="tabular-nums">
                سؤال {currentIndex + 1} من {queue.length}
              </span>
              <span aria-hidden="true">·</span>
              <span>المهارة: {SKILL_LABELS[currentQ.skill_tag]}</span>
              {currentItem.isRetry && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-bold text-amber-700">إعادة تثبيت (بعد 3 أسئلة)</span>
                </>
              )}
            </div>
            <span className="font-mono tabular-nums text-[var(--accent-primary)]">+{xpEarned} XP</span>
          </div>

          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-[var(--accent-primary)] transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Rival Live Bar during Daily Challenge */}
        {rivalChallenge && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs">
            <div className="flex items-center gap-2">
              <Swords className="h-4 w-4 text-amber-600" />
              <span className="font-bold text-slate-800">سباق تحدي اليوم ضد {rivalChallenge.rival.name}</span>
            </div>
            <div className="flex items-center gap-4 font-mono font-bold tabular-nums">
              <span className="text-[var(--accent-primary)]">أنت: {firstTryCorrect}</span>
              <span className="text-slate-500">
                {rivalChallenge.rival.name}: {rivalScore}
              </span>
            </div>
          </div>
        )}

        {/* Question Card */}
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          {currentQ.promptAr && (
            <p className="text-sm font-bold text-[var(--accent-text)]">{currentQ.promptAr}</p>
          )}

          {currentQ.type !== 'pronunciation' && (
            <div className="mt-3 flex items-start justify-between gap-3">
              <p
                className="text-lg font-bold leading-relaxed text-slate-900 sm:text-xl"
                dir={currentQ.type === 'tf' || currentQ.type === 'order' ? 'rtl' : 'ltr'}
              >
                {currentQ.prompt}
              </p>
              {currentQ.audioText && (
                <SpeakButton
                  speechId={`quiz-prompt-${currentItem.instanceKey}`}
                  text={currentQ.audioText}
                  lang="auto"
                />
              )}
            </div>
          )}

          {/* Question Input Areas */}
          <div className="mt-5">
            {(currentQ.type === 'mcq' || currentQ.type === 'tf') && currentQ.options && (
              <div className={`grid gap-3 ${currentQ.type === 'tf' ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
                {currentQ.options.map((opt) => {
                  const isSelected = selectedOption === opt;
                  const isAnswer = opt === currentQ.answer;
                  let style = 'border-slate-200 bg-white text-slate-900 hover:border-[var(--accent-primary)]';
                  if (isConfirmed) {
                    if (isAnswer) style = 'border-emerald-500 bg-emerald-50 text-emerald-900';
                    else if (isSelected && !isAnswer) style = 'border-rose-500 bg-rose-50 text-rose-900';
                    else style = 'border-slate-200 bg-slate-50 text-slate-400';
                  } else if (isSelected) {
                    style = 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-text)]';
                  }

                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={isConfirmed}
                      onClick={() => setSelectedOption(opt)}
                      className={`min-h-[48px] rounded-xl border-2 px-4 py-3 text-start text-sm font-bold transition disabled:cursor-not-allowed sm:text-base ${style}`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}

            {(currentQ.type === 'fill' || currentQ.type === 'listen') && (
              <div className="space-y-3">
                {currentQ.type === 'listen' && currentQ.audioText && (
                  <SpeakButton
                    speechId={`quiz-listen-${currentItem.instanceKey}`}
                    text={currentQ.audioText}
                    lang="en"
                    variant="pill"
                    label="اضغط للاستماع للكلمة"
                  />
                )}
                <input
                  dir="ltr"
                  type="text"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  disabled={isConfirmed}
                  value={textAnswer}
                  onChange={(e) => setTextAnswer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isConfirmed && hasUserInput) handleConfirm();
                  }}
                  placeholder="Type the English word here..."
                  className="font-en w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3.5 text-center text-lg font-semibold text-slate-900 outline-none transition focus:border-[var(--accent-primary)] disabled:cursor-not-allowed disabled:bg-slate-100"
                />
              </div>
            )}

            {currentQ.type === 'order' && (
              <div className="space-y-4">
                <div
                  dir="ltr"
                  className="flex min-h-[60px] flex-wrap items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-3"
                >
                  {orderedWords.length === 0 ? (
                    <span className="text-xs text-slate-400">اضغط على الكلمات بالأسفل لتكوين الجملة هنا...</span>
                  ) : (
                    orderedWords.map((item) => (
                      <button
                        key={`${item.word}-${item.idx}`}
                        type="button"
                        disabled={isConfirmed}
                        onClick={() =>
                          setOrderedWords((prev) => prev.filter((x) => x.idx !== item.idx))
                        }
                        className="font-en min-h-[40px] rounded-xl border border-[var(--accent-primary)] bg-white px-3.5 py-2 text-sm font-bold text-slate-900 disabled:cursor-not-allowed disabled:opacity-75"
                      >
                        {item.word}
                      </button>
                    ))
                  )}
                </div>

                <div dir="ltr" className="flex flex-wrap gap-2">
                  {availableOrderWords.map((word, idx) => {
                    const alreadyUsed = orderedWords.some((o) => o.idx === idx);
                    return (
                      <button
                        key={`${word}-${idx}`}
                        type="button"
                        disabled={isConfirmed || alreadyUsed}
                        onClick={() => setOrderedWords((prev) => [...prev, { word, idx }])}
                        className={`font-en min-h-[42px] rounded-xl border px-3.5 py-2 text-sm font-bold transition disabled:cursor-not-allowed ${
                          alreadyUsed
                            ? 'border-slate-200 bg-slate-100 text-slate-300'
                            : 'border-slate-300 bg-white text-slate-800 hover:border-[var(--accent-primary)]'
                        }`}
                      >
                        {word}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {currentQ.type === 'pronunciation' && (
              <PronunciationLab
                targetText={currentQ.prompt}
                targetAr={currentQ.promptAr || ''}
                tip={currentQ.explanation}
                isKids={isKids}
                disabled={isConfirmed}
                onRecorded={handlePronunciationRecorded}
              />
            )}
          </div>

          {/* Feedback Section after Confirm */}
          {isConfirmed && (
            <div
              role="status"
              className={`mt-5 rounded-xl border p-4 ${
                isCurrentCorrect
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                  : 'border-rose-200 bg-rose-50 text-rose-950'
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-extrabold">
                {isCurrentCorrect ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                    <span>ممتاز! إجابة صحيحة (+10 XP)</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 shrink-0 text-rose-600" />
                    <span>
                      الإجابة الصحيحة:{' '}
                      <span className="font-en underline" dir="ltr">
                        {currentQ.answer}
                      </span>
                    </span>
                  </>
                )}
              </div>
              <p className="mt-2 text-xs leading-relaxed opacity-90">{currentQ.explanation}</p>
              {!isCurrentCorrect && (
                <p className="mt-1.5 text-xs font-bold text-rose-700">
                  سيُعاد طرح هذا السؤال عليك بعد 3 أسئلة للتأكد من إتقانه.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Bottom Action Buttons */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {!isConfirmed ? (
            <>
              <button
                type="button"
                disabled={!hasUserInput}
                onClick={handleConfirm}
                className="min-h-[48px] flex-1 rounded-xl bg-[var(--accent-primary)] px-6 py-3 text-sm font-bold text-white transition hover:bg-[var(--accent-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                تأكيد الإجابة
              </button>
              <button
                type="button"
                onClick={handleNextOrSkip}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                <SkipForward className="h-4 w-4" />
                <span>تخطي</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleNextOrSkip}
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-6 py-3 text-sm font-bold text-white transition hover:bg-[var(--accent-primary-hover)]"
            >
              <span>{currentIndex + 1 < queue.length ? 'التالي / متابعة' : 'عرض النتيجة النهائية'}</span>
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
