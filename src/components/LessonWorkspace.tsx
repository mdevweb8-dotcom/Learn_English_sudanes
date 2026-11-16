import React, { useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  HelpCircle,
  Mic,
  Sparkles,
} from 'lucide-react';
import type { Lesson, LessonQuestion, VocabItem } from '../types';
import { getLessonQuestionsStrict } from '../data/curriculum';
import { PronunciationLab, type PronunciationResult } from './PronunciationLab';
import { QuizEngine, type QuizSessionOutcome } from './QuizEngine';
import { SpeakButton } from './SpeakButton';

type LessonTab = 'grammar' | 'vocab' | 'pronunciation' | 'quiz';

interface LessonWorkspaceProps {
  lesson: Lesson;
  bestScore?: number;
  isKids: boolean;
  savedWordIds: string[];
  onToggleSaveWord: (vocab: VocabItem, lessonId: string) => void;
  onBack: () => void;
  onAskTeacher: (topicOrWord: string) => void;
  onRecordPronunciation: (lessonId: string, result: PronunciationResult) => void;
  onLessonQuizComplete: (lesson: Lesson, outcome: QuizSessionOutcome) => void;
}

export const LessonWorkspace: React.FC<LessonWorkspaceProps> = ({
  lesson,
  bestScore,
  isKids,
  savedWordIds,
  onToggleSaveWord,
  onBack,
  onAskTeacher,
  onRecordPronunciation,
  onLessonQuizComplete,
}) => {
  const [activeTab, setActiveTab] = useState<LessonTab>('grammar');
  const [quizOpen, setQuizOpen] = useState(false);
  const [lastPronFeedback, setLastPronFeedback] = useState<PronunciationResult | null>(null);

  const strictQuestions: LessonQuestion[] = getLessonQuestionsStrict(lesson.id);

  const tabs: Array<{ id: LessonTab; label: string; icon: React.ReactNode }> = [
    { id: 'grammar', label: 'الشرح والقواعد', icon: <BookOpen className="h-4 w-4" /> },
    { id: 'vocab', label: `المفردات (${lesson.vocabulary.length})`, icon: <Sparkles className="h-4 w-4" /> },
    { id: 'pronunciation', label: 'تحدث / Pronunciation', icon: <Mic className="h-4 w-4" /> },
    { id: 'quiz', label: `التمارين والاختبار (${strictQuestions.length})`, icon: <ClipboardCheck className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
          >
            <ArrowRight className="h-4 w-4" />
            <span>العودة للدروس</span>
          </button>

          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
              <span>المستوى {lesson.levelId}</span>
              <span aria-hidden="true">·</span>
              <span>الدرس {lesson.order}</span>
              <span aria-hidden="true">·</span>
              <span>{lesson.topic}</span>
              {bestScore !== undefined && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-bold text-emerald-700">أفضل نتيجة: {bestScore}%</span>
                </>
              )}
            </div>
            <h2 className="mt-0.5 text-lg font-extrabold text-slate-900 sm:text-xl">{lesson.title}</h2>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onAskTeacher(`${lesson.title} (${lesson.grammarTitle})`)}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--accent-soft)] px-4 py-2 text-sm font-bold text-[var(--accent-text)] transition hover:opacity-90"
        >
          <HelpCircle className="h-4 w-4" />
          <span className="whitespace-nowrap">اسأل المعلم عن هذا الدرس</span>
        </button>
      </div>

      {/* Horizontal Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition ${
                active
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab.icon}
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Grammar & Explanation */}
      {activeTab === 'grammar' && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <p className="text-xs font-semibold text-[var(--accent-text)]">شرح القاعدة الأساسية</p>
              <h3 className="font-en mt-0.5 text-lg font-bold text-slate-900" dir="ltr">
                {lesson.grammarTitle}
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SpeakButton
                speechId={`grammar-ar-${lesson.id}`}
                text={lesson.explanation}
                lang="ar"
                variant="pill"
                label="استمع للشرح"
              />
              <button
                type="button"
                onClick={() => onAskTeacher(lesson.grammarTitle)}
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                <HelpCircle className="h-4 w-4 text-[var(--accent-primary)]" />
                <span>اشرح القاعدة بالسوداني</span>
              </button>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-slate-700 sm:text-base">{lesson.explanation}</p>

          <div className="space-y-2.5 pt-2">
            <h4 className="text-sm font-bold text-slate-900">أهم النقاط والتطبيق العملي:</h4>
            <ul className="space-y-2">
              {lesson.keyPoints.map((pt, i) => (
                <li
                  key={i}
                  className="flex items-start justify-between gap-2.5 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-800"
                >
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
                    <span className="leading-relaxed">{pt}</span>
                  </div>
                  <SpeakButton speechId={`kp-${lesson.id}-${i}`} text={pt} lang="auto" size="sm" />
                </li>
              ))}
            </ul>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('vocab')}
              className="min-h-[44px] rounded-xl bg-[var(--accent-primary)] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--accent-primary-hover)]"
            >
              التالي: مفردات الدرس
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: Vocabulary (with Save Word + Normal & Slow Pronunciation buttons) */}
      {activeTab === 'vocab' && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {lesson.vocabulary.map((v) => {
              const isSaved = savedWordIds.includes(v.id);
              return (
                <div
                  key={v.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-en text-xl font-bold text-slate-900" dir="ltr">
                            {v.word}
                          </h3>
                          <span className="font-mono text-xs text-slate-400">({v.pos})</span>
                        </div>
                        <p className="mt-1 text-base font-bold text-[var(--accent-text)]">{v.ar}</p>
                        <p className="mt-0.5 text-xs text-slate-500">النطق: {v.phonetic}</p>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <SpeakButton speechId={`vocab-word-${v.id}`} text={v.word} lang="en" />
                        <SpeakButton
                          speechId={`vocab-word-slow-${v.id}`}
                          text={v.word}
                          lang="en"
                          slow
                          label={`نطق بطيء لـ ${v.word}`}
                        />
                        <button
                          type="button"
                          onClick={() => onAskTeacher(v.word)}
                          className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50"
                          aria-label={`اسأل المعلم عن ${v.word}`}
                        >
                          <HelpCircle className="h-5 w-5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 rounded-xl bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-en text-sm font-semibold text-slate-800" dir="ltr">
                          {v.example}
                        </p>
                        <SpeakButton
                          speechId={`vocab-ex-${v.id}`}
                          text={v.example}
                          lang="en"
                          size="sm"
                        />
                      </div>
                      <p className="mt-1 text-xs text-slate-600">{v.exampleAr}</p>
                    </div>
                  </div>

                  {/* Save to Vocabulary Log Button */}
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => onToggleSaveWord(v, lesson.id)}
                      className={`inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                        isSaved
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {isSaved ? (
                        <>
                          <BookmarkCheck className="h-4 w-4 text-emerald-600" />
                          <span>محفوظة في سجل المفردات ✓</span>
                        </>
                      ) : (
                        <>
                          <Bookmark className="h-4 w-4" />
                          <span>حفظ الكلمة للمراجعة</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setActiveTab('pronunciation')}
              className="min-h-[44px] rounded-xl bg-[var(--accent-primary)] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--accent-primary-hover)]"
            >
              التالي: اختبار النطق
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: Pronunciation */}
      {activeTab === 'pronunciation' && (
        <div className="space-y-4">
          <PronunciationLab
            targetText={lesson.pronunciationTarget.text}
            targetAr={lesson.pronunciationTarget.ar}
            tip={lesson.pronunciationTarget.tip}
            isKids={isKids}
            onRecorded={(res) => {
              setLastPronFeedback(res);
              onRecordPronunciation(lesson.id, res);
            }}
          />

          {lastPronFeedback && (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
              تم تسجيل نتيجة نطقك (<span className="font-bold text-slate-900">{lastPronFeedback.score}/100</span> —{' '}
              <span className="font-bold">{lastPronFeedback.feedback}</span>) في ملفك لتحسين المراجعة الذكية.
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setActiveTab('quiz')}
              className="min-h-[44px] rounded-xl bg-[var(--accent-primary)] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--accent-primary-hover)]"
            >
              التالي: اختبار الدرس النهائي
            </button>
          </div>
        </div>
      )}

      {/* Tab 4: Lesson Quiz & Exercises */}
      {activeTab === 'quiz' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <h3 className="text-lg font-extrabold text-slate-900">التمارين والاختبار النهائي للدرس</h3>
          <p className="mt-1.5 text-sm text-slate-600">
            يتضمن هذا الاختبار <span className="font-mono font-bold tabular-nums">{strictQuestions.length}</span> أسئلة
            مرتبطة حصرياً بهذا الدرس (مفردات، قواعد، استماع، بناء جمل، قراءة، ونطق). درجة النجاح المطلوبة{' '}
            <span className="font-mono font-bold tabular-nums">70%</span>.
          </p>

          <ul className="mt-4 space-y-2 text-xs text-slate-600">
            <li>• تُقفل الاختيارات فور الضغط على &ldquo;تأكيد الإجابة&rdquo; لمنع التكرار الخاطئ.</li>
            <li>• أي سؤال تخطئ فيه يظهر حله فوراً ويُعاد طرحه بعد 3 أسئلة لتثبيت المعلومة.</li>
            <li>• كل إجابة صحيحة = +10 XP، وإتمام الدرس = +50 XP إضافية!</li>
          </ul>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setQuizOpen(true)}
              className="min-h-[48px] flex-1 rounded-xl bg-[var(--accent-primary)] px-6 py-3 text-sm font-bold text-white transition hover:bg-[var(--accent-primary-hover)]"
            >
              {bestScore !== undefined ? 'إعادة اختبار الدرس لتحسين الدرجة' : 'ابدأ اختبار الدرس الآن'}
            </button>
          </div>
        </div>
      )}

      {quizOpen && (
        <QuizEngine
          title={`اختبار: ${lesson.title}`}
          subtitle={`المستوى ${lesson.levelId} · الدرس ${lesson.order}`}
          questions={strictQuestions}
          passThreshold={70}
          isKids={isKids}
          onAskTeacher={onAskTeacher}
          onClose={() => setQuizOpen(false)}
          onComplete={(outcome) => {
            setQuizOpen(false);
            onLessonQuizComplete(lesson, outcome);
          }}
        />
      )}
    </div>
  );
};
