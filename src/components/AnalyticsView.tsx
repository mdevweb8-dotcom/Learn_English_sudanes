import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Bookmark,
  CheckCircle2,
  Mic,
  Play,
  Sparkles,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import type { AppState, LessonQuestion, SkillTag } from '../types';
import { ALL_LESSONS, CEFR_LEVELS, SKILL_LABELS, shuffleWithSeed } from '../data/curriculum';
import { getSkillScorePercent } from '../services/storage';
import {
  buildSrsPracticeQuestions,
  getDueSrsVocab,
  getWeakSrsVocab,
  makeWordKey,
  summarizeVocabProgress,
} from '../services/srs';
import { SpeakButton } from './SpeakButton';
import { QuizEngine, type QuizSessionOutcome } from './QuizEngine';

interface AnalyticsViewProps {
  state: AppState;
  currentLessonId: string;
  isKids: boolean;
  onStartSmartReview: () => void;
  onRemoveSavedWord: (wordId: string) => void;
  onPracticeSavedComplete: (outcome: QuizSessionOutcome) => void;
  onAskTeacher: (topic: string) => void;
}

const ALL_SKILLS: SkillTag[] = [
  'vocab',
  'grammar',
  'pronunciation',
  'listening',
  'sentence_building',
  'reading',
];

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  state,
  currentLessonId,
  isKids,
  onStartSmartReview,
  onRemoveSavedWord,
  onPracticeSavedComplete,
  onAskTeacher,
}) => {
  const [subTab, setSubTab] = useState<'skills' | 'vocab_log'>('skills');
  const [practiceMode, setPracticeMode] = useState<'saved' | 'srs' | null>(null);

  const skillRows = ALL_SKILLS.map((tag) => {
    const stat = state.skills[tag];
    const hasAttempts = stat && stat.attempts > 0;
    const pct = hasAttempts ? getSkillScorePercent(state, tag) : 70;
    const isStrength = pct >= 70;
    const needsFocus = hasAttempts && pct < 60;
    return {
      tag,
      label: SKILL_LABELS[tag],
      pct,
      attempts: stat?.attempts || 0,
      correct: stat?.correct || 0,
      hasAttempts,
      isStrength,
      needsFocus,
    };
  });

  const sortedByWeakest = [...skillRows].sort((a, b) => a.pct - b.pct);
  const weakestTwo = sortedByWeakest.slice(0, 2);
  const strongest = [...skillRows].sort((a, b) => b.pct - a.pct)[0];
  const pronStat = state.skills.pronunciation;
  const pronPct = pronStat.attempts > 0 ? Math.round((pronStat.correct / pronStat.attempts) * 100) : 70;
  const pronRecentPct =
    pronStat.recentAttempts > 0 ? Math.round((pronStat.recentCorrect / pronStat.recentAttempts) * 100) : pronPct;

  const positiveBanner = (() => {
    const totalAttempts = skillRows.reduce((s, r) => s + r.attempts, 0);
    if (totalAttempts === 0) {
      return 'ابدأ أول تمرين أو اختبار نطق الآن لنرسم لك خريطة ذكية لنقاط قوتك!';
    }
    if (pronStat.attempts >= 2 && pronRecentPct >= pronPct) {
      const gain = Math.max(12, Math.min(35, pronRecentPct - pronPct + 20));
      return `نطقك تحسن ${gain}% هذا الأسبوع، واصل بهذا الحماس!`;
    }
    if (strongest && strongest.attempts > 0) {
      return `أداؤك في مهارة "${strongest.label}" رائع (${strongest.pct}%)! المراجعة الذكية سترفع بقية مهاراتك بسرعة.`;
    }
    return 'أنت تصنع تقدماً حقيقياً كل يوم — استمر في مراجعة 10 دقائق يومياً!';
  })();

  const currentLessonTitle =
    CEFR_LEVELS.flatMap((l) => l.lessons).find((l) => l.id === currentLessonId)?.title || 'الدرس الحالي';

  const srsSummary = useMemo(() => summarizeVocabProgress(state.vocabProgress), [state.vocabProgress]);

  const unlockedVocabPool = useMemo(
    () => ALL_LESSONS.filter((l) => state.unlockedLevels.includes(l.levelId)).flatMap((l) => l.vocabulary),
    [state.unlockedLevels],
  );

  const srsPracticeQuestions: LessonQuestion[] = useMemo(() => {
    const due = getDueSrsVocab(state.vocabProgress, Date.now(), state.unlockedLevels, 10);
    const weak = due.length < 6 ? getWeakSrsVocab(state.vocabProgress, state.unlockedLevels, 10 - due.length) : [];
    const merged = [...due];
    for (const w of weak) {
      if (!merged.some((m) => m.wordKey === w.wordKey)) merged.push(w);
    }
    return buildSrsPracticeQuestions(merged.slice(0, 10), unlockedVocabPool, 'SRS-LOG');
  }, [state.vocabProgress, state.unlockedLevels, unlockedVocabPool]);

  const savedPracticeQuestions: LessonQuestion[] = useMemo(() => {
    const words = state.savedWords;
    if (words.length === 0) return [];
    const globalArPool = Array.from(
      new Set([...words.map((w) => w.ar), ...unlockedVocabPool.map((v) => v.ar)]),
    );
    const globalEnPool = Array.from(
      new Set([...words.map((w) => w.word), ...unlockedVocabPool.map((v) => v.word)]),
    );

    return words.slice(0, 12).map((w, idx) => {
      const lessonLevelId = ALL_LESSONS.find((l) => l.id === w.lessonId)?.levelId ?? 'A1';
      const targetWord = {
        vocabId: w.id,
        word: w.word,
        ar: w.ar,
        example: w.example,
        exampleAr: w.exampleAr,
        phonetic: w.phonetic,
        pos: w.pos,
        lessonId: w.lessonId,
        levelId: lessonLevelId,
      };
      const mode = idx % 3;
      if (mode === 2) {
        return {
          id: `SAVED-L-${w.id}`,
          lesson_id: w.lessonId,
          level_id: lessonLevelId,
          skill_tag: 'listening',
          type: 'listen',
          prompt: 'استمع للكلمة المحفوظة ثم اكتبها بالإنجليزية',
          promptAr: `المعنى بالعربية: ${w.ar}`,
          audioText: w.word,
          answer: w.word,
          explanation: `الكلمة المحفوظة هي "${w.word}" ومعناها "${w.ar}". مثال: ${w.example}`,
          targetWord,
        };
      }
      if (mode === 1) {
        const distractors = shuffleWithSeed(
          globalEnPool.filter((en) => en.toLowerCase() !== w.word.toLowerCase()),
          `saved-en-${w.id}`,
        ).slice(0, 3);
        const options = shuffleWithSeed([w.word, ...distractors], `saved-en-opts-${w.id}`);
        return {
          id: `SAVED-EN-${w.id}`,
          lesson_id: w.lessonId,
          level_id: lessonLevelId,
          skill_tag: 'vocab',
          type: 'mcq',
          prompt: w.ar,
          promptAr: 'اختر الكلمة الإنجليزية الصحيحة لهذا المعنى:',
          audioText: w.word,
          options,
          answer: w.word,
          explanation: `"${w.word}" (${w.pos}) معناها "${w.ar}". مثال: ${w.example}`,
          targetWord,
        };
      }
      const distractors = shuffleWithSeed(
        globalArPool.filter((a) => a !== w.ar),
        `saved-ar-${w.id}`,
      ).slice(0, 3);
      const options = shuffleWithSeed([w.ar, ...distractors], `saved-ar-opts-${w.id}`);
      return {
        id: `SAVED-Q-${w.id}`,
        lesson_id: w.lessonId,
        level_id: lessonLevelId,
        skill_tag: 'vocab',
        type: 'mcq',
        prompt: w.word,
        promptAr: 'اختر المعنى العربي الصحيح للكلمة المحفوظة:',
        audioText: w.word,
        options,
        answer: w.ar,
        explanation: `"${w.word}" (${w.pos}) معناها "${w.ar}". مثال: ${w.example}`,
        targetWord,
      };
    });
  }, [state.savedWords, unlockedVocabPool]);

  return (
    <div className="space-y-5">
      {/* Sub-navigation between Skill Analytics and Vocabulary Log */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSubTab('skills')}
          className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition ${
            subTab === 'skills'
              ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          <span>تحليل المهارات الذكي</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('vocab_log')}
          className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition ${
            subTab === 'vocab_log'
              ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Bookmark className="h-4 w-4" />
          <span>سجل المفردات المحفوظة ({state.savedWords.length})</span>
        </button>
      </div>

      {subTab === 'vocab_log' ? (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">سجل المفردات المحفوظة (Vocabulary Log)</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                الكلمات التي حفظتها من الدروس مع تعريفاتها، نطق عادي وبطيء، واختبار مخصص للممارسة
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {srsPracticeQuestions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPracticeMode('srs')}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-emerald-600 bg-emerald-50 px-4 py-2 text-xs font-extrabold text-emerald-800 transition hover:bg-emerald-100"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>اختبر الكلمات المستحقة SRS ({srsPracticeQuestions.length})</span>
                </button>
              )}

              {state.savedWords.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPracticeMode('saved')}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-[var(--accent-primary-hover)]"
                >
                  <Play className="h-4 w-4" />
                  <span>اختبر كلماتك المحفوظة ({Math.min(12, state.savedWords.length)})</span>
                </button>
              )}
            </div>
          </div>

          {/* SRS Vocabulary Mastery Overview Strip */}
          {srsSummary.total > 0 && (
            <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-center sm:grid-cols-4">
              <div>
                <div className="font-mono text-lg font-extrabold text-emerald-700 tabular-nums">
                  {srsSummary.masteredCount}
                </div>
                <div className="text-[11px] font-bold text-slate-600">كلمات متقنة</div>
              </div>
              <div>
                <div className="font-mono text-lg font-extrabold text-sky-700 tabular-nums">
                  {srsSummary.reviewingCount + srsSummary.learningCount}
                </div>
                <div className="text-[11px] font-bold text-slate-600">قيد التعلّم والمراجعة</div>
              </div>
              <div>
                <div className="font-mono text-lg font-extrabold text-rose-700 tabular-nums">
                  {srsSummary.weakCount}
                </div>
                <div className="text-[11px] font-bold text-slate-600">تحتاج تقوية</div>
              </div>
              <div>
                <div className="font-mono text-lg font-extrabold text-amber-700 tabular-nums">
                  {srsSummary.dueCount}
                </div>
                <div className="text-[11px] font-bold text-slate-600">مستحقة الآن</div>
              </div>
            </div>
          )}

          {state.savedWords.length === 0 ? (
            <div className="py-10 text-center">
              <Bookmark className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm font-bold text-slate-700">سجل المفردات فارغ حالياً</p>
              <p className="mt-1 text-xs text-slate-500">
                افتح تبويب &ldquo;المفردات&rdquo; داخل أي درس واضغط &ldquo;حفظ الكلمة للمراجعة&rdquo; لإضافتها هنا.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {state.savedWords.map((w) => {
                const srsRec = state.vocabProgress[makeWordKey(w.word)];
                const stageLabel =
                  srsRec?.mastery === 'mastered'
                    ? 'متقنة'
                    : srsRec?.mastery === 'reviewing'
                      ? 'قيد المراجعة'
                      : srsRec?.mastery === 'learning'
                        ? srsRec.wrongCount > 0
                          ? 'تحتاج تقوية'
                          : 'قيد التعلّم'
                        : 'جديدة';
                const stageColor =
                  srsRec?.mastery === 'mastered'
                    ? 'text-emerald-700'
                    : srsRec?.wrongCount
                      ? 'text-rose-700'
                      : 'text-slate-500';
                return (
                <div
                  key={w.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/50 p-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-en text-lg font-extrabold text-slate-900" dir="ltr">
                            {w.word}
                          </h3>
                          <span className="font-mono text-xs text-slate-400">({w.pos})</span>
                          <span className={`text-[11px] font-bold ${stageColor}`}>· {stageLabel}</span>
                        </div>
                        <p className="mt-1 text-sm font-bold text-[var(--accent-text)]">{w.ar}</p>
                        <p className="mt-0.5 text-xs text-slate-500">النطق: {w.phonetic}</p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <SpeakButton speechId={`saved-w-${w.id}`} text={w.word} lang="en" size="sm" />
                        <SpeakButton
                          speechId={`saved-w-slow-${w.id}`}
                          text={w.word}
                          lang="en"
                          slow
                          size="sm"
                        />
                        <button
                          type="button"
                          onClick={() => onRemoveSavedWord(w.id)}
                          aria-label={`إزالة ${w.word} من السجل`}
                          className="grid h-9 w-9 place-items-center rounded-xl border border-rose-200 bg-white text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 rounded-xl border border-slate-200/70 bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-en text-xs font-semibold text-slate-800" dir="ltr">
                          {w.example}
                        </p>
                        <SpeakButton speechId={`saved-ex-${w.id}`} text={w.example} lang="en" size="sm" />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{w.exampleAr}</p>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Positive Smart Encouragement Banner */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-emerald-800">رسالة التتبع الذكي المشجعة</p>
                  <h2 className="mt-0.5 text-base font-extrabold text-emerald-950 sm:text-lg">{positiveBanner}</h2>
                  <p className="mt-1 text-xs text-emerald-800">
                    أضعف مهارتين حالياً للمراجعة المركزة:{' '}
                    <span className="font-bold">{weakestTwo[0].label}</span> و{' '}
                    <span className="font-bold">{weakestTwo[1].label}</span> · درسك النشط: {currentLessonTitle}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onStartSmartReview}
                className="inline-flex min-h-[46px] shrink-0 items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--accent-primary-hover)]"
              >
                <Sparkles className="h-4 w-4" />
                <span className="whitespace-nowrap">ابدأ المراجعة الذكية اليومية (10 أسئلة)</span>
              </button>
            </div>
          </div>

          {/* Adaptive Skill Chart */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-[var(--accent-primary)]" />
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    تحليل المهارات الست (Strengths &amp; Focus Areas)
                  </h3>
                  <p className="text-xs text-slate-500">يتم تحديث الرسم تلقائياً بعد كل سؤال وتمرين نطق</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs font-bold">
                <span className="inline-flex items-center gap-1.5 text-emerald-700">
                  <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> نقطة قوة (≥ 70%)
                </span>
                <span className="inline-flex items-center gap-1.5 text-rose-700">
                  <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" /> تحتاج تركيز (&lt; 60%)
                </span>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                <svg viewBox="0 0 360 210" className="w-full" role="img" aria-label="رسم بياني للمهارات الست">
                  {[25, 50, 75, 100].map((tick) => {
                    const y = 165 - (tick / 100) * 135;
                    return (
                      <g key={tick}>
                        <line x1="34" x2="348" y1={y} y2={y} stroke="#E2E8F0" strokeDasharray="3 3" />
                        <text x="28" y={y + 4} textAnchor="end" fontSize="9" fill="#64748B">
                          {tick}%
                        </text>
                      </g>
                    );
                  })}

                  {skillRows.map((row, idx) => {
                    const barW = 34;
                    const gap = 16;
                    const x = 44 + idx * (barW + gap);
                    const h = Math.max(8, (row.pct / 100) * 135);
                    const y = 165 - h;
                    const fill = row.isStrength ? '#10B981' : row.needsFocus ? '#F43F5E' : '#F59E0B';
                    return (
                      <g key={row.tag}>
                        <rect x={x} y={y} width={barW} height={h} rx="6" fill={fill} />
                        <text
                          x={x + barW / 2}
                          y={y - 5}
                          textAnchor="middle"
                          fontSize="10"
                          fontWeight="700"
                          fill="#0F172A"
                        >
                          {row.pct}%
                        </text>
                        <text x={x + barW / 2} y="185" textAnchor="middle" fontSize="9" fontWeight="600" fill="#334155">
                          {row.label.split(' ')[0]}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              <div className="space-y-2.5">
                {skillRows.map((row) => {
                  const barColor = row.isStrength
                    ? 'bg-emerald-500'
                    : row.needsFocus
                      ? 'bg-rose-500'
                      : 'bg-amber-500';
                  const statusLabel = !row.hasAttempts
                    ? 'بانتظار القياس'
                    : row.isStrength
                      ? 'نقطة قوة'
                      : row.needsFocus
                        ? 'بحاجة لتحسين'
                        : 'جيد ويتطور';
                  const statusColor = !row.hasAttempts
                    ? 'text-slate-500'
                    : row.isStrength
                      ? 'text-emerald-700'
                      : row.needsFocus
                        ? 'text-rose-700'
                        : 'text-amber-700';

                  return (
                    <div key={row.tag} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900">
                          {row.isStrength ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : row.needsFocus ? (
                            <AlertCircle className="h-4 w-4 text-rose-600" />
                          ) : (
                            <TrendingUp className="h-4 w-4 text-amber-500" />
                          )}
                          <span>{row.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${statusColor}`}>{statusLabel}</span>
                          <span className="font-mono font-bold tabular-nums text-slate-800">{row.pct}%</span>
                        </div>
                      </div>
                      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${row.pct}%` }} />
                      </div>
                      {row.hasAttempts && (
                        <p className="mt-1 text-[11px] text-slate-500 tabular-nums">
                          إجابات صحيحة: {row.correct} من {row.attempts} محاولة
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Pronunciation History Log */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Mic className="h-5 w-5 text-[var(--accent-primary)]" />
                <h3 className="text-base font-extrabold text-slate-900">سجل تقييم النطق الشخصي</h3>
              </div>
              <span className="font-mono text-xs font-bold tabular-nums text-slate-500">
                إجمالي التسجيلات: {state.pronunciationHistory.length}
              </span>
            </div>

            {state.pronunciationHistory.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                لم تسجل أي محاولة نطق بعد — افتح قسم &ldquo;تحدث / Pronunciation&rdquo; في أي درس وجرّب صوتك!
              </p>
            ) : (
              <div className="mt-3 divide-y divide-slate-100">
                {state.pronunciationHistory.slice(0, 6).map((rec) => (
                  <div key={rec.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <div>
                      <p className="font-en font-bold text-slate-900" dir="ltr">
                        {rec.target}
                      </p>
                      <p className="text-xs text-slate-500">
                        الدرس: {rec.lessonId} · {rec.selfAssessed ? 'تقييم ذاتي' : `نطقت: "${rec.spoken}"`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <SpeakButton speechId={`hist-${rec.id}`} text={rec.target} lang="en" size="sm" />
                      <span
                        className={`text-xs font-bold ${
                          rec.feedback === 'ممتاز'
                            ? 'text-emerald-700'
                            : rec.feedback === 'جيد'
                              ? 'text-sky-700'
                              : 'text-rose-700'
                        }`}
                      >
                        {rec.feedback}
                      </span>
                      <span className="font-mono font-bold tabular-nums text-slate-900">{rec.score}/100</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {practiceMode && (
        <QuizEngine
          title={practiceMode === 'srs' ? 'مراجعة المفردات المستحقة (SRS)' : 'اختبار الكلمات المحفوظة'}
          subtitle={
            practiceMode === 'srs'
              ? 'تدريب تلقائي على الكلمات التي أخطأت بها أو حان موعد مراجعتها'
              : 'مراجعة مخصصة من سجل مفرداتك'
          }
          questions={practiceMode === 'srs' ? srsPracticeQuestions : savedPracticeQuestions}
          passThreshold={60}
          isKids={isKids}
          onAskTeacher={onAskTeacher}
          onClose={() => setPracticeMode(null)}
          onComplete={(outcome) => {
            setPracticeMode(null);
            onPracticeSavedComplete(outcome);
          }}
        />
      )}
    </div>
  );
};
