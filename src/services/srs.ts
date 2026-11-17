import type {
  CEFRLevelId,
  Lesson,
  LessonQuestion,
  QuestionTargetWord,
  VocabItem,
  VocabMasteryStage,
  WordMasteryRecord,
} from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;
const RETRY_SOON_MS = 2 * 60 * 1000; // Wrong words become due quickly for reinforcement

export function makeWordKey(word: string): string {
  return word.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function vocabToTargetWord(
  v: VocabItem,
  lessonId: string,
  levelId: CEFRLevelId,
): QuestionTargetWord {
  return {
    vocabId: v.id,
    word: v.word,
    ar: v.ar,
    example: v.example,
    exampleAr: v.exampleAr,
    phonetic: v.phonetic,
    pos: v.pos,
    lessonId,
    levelId,
  };
}

export function seedLessonVocabSeen(
  vocabProgress: Record<string, WordMasteryRecord>,
  lesson: Lesson,
  nowMs: number = Date.now(),
): Record<string, WordMasteryRecord> {
  const next = { ...vocabProgress };
  const nowIso = new Date(nowMs).toISOString();
  const initialDueIso = new Date(nowMs + 12 * 60 * 60 * 1000).toISOString();

  for (const v of lesson.vocabulary) {
    const key = makeWordKey(v.word);
    if (!next[key]) {
      next[key] = {
        wordKey: key,
        vocabId: v.id,
        word: v.word,
        ar: v.ar,
        example: v.example,
        exampleAr: v.exampleAr,
        phonetic: v.phonetic,
        pos: v.pos,
        levelId: lesson.levelId,
        lessonId: lesson.id,
        seenCount: 1,
        correctCount: 0,
        wrongCount: 0,
        consecutiveCorrect: 0,
        easeFactor: 2.5,
        intervalDays: 0,
        mastery: 'new',
        lastReviewedAt: nowIso,
        nextReviewAt: initialDueIso,
        lastResult: 'correct',
      };
    }
  }
  return next;
}

export function recordVocabOutcome(
  vocabProgress: Record<string, WordMasteryRecord>,
  target: QuestionTargetWord,
  correct: boolean,
  nowMs: number = Date.now(),
): Record<string, WordMasteryRecord> {
  const key = makeWordKey(target.word);
  if (!key) return vocabProgress;

  const existing = vocabProgress[key];
  const nowIso = new Date(nowMs).toISOString();

  const baseEase = existing?.easeFactor ?? 2.5;
  const prevInterval = existing?.intervalDays ?? 0;
  const prevConsecutive = existing?.consecutiveCorrect ?? 0;

  let nextEase = baseEase;
  let nextIntervalDays = prevInterval;
  let nextConsecutive = prevConsecutive;
  let mastery: VocabMasteryStage = existing?.mastery ?? 'new';
  let nextReviewMs = nowMs;

  if (correct) {
    nextConsecutive = prevConsecutive + 1;
    nextEase = Math.min(2.8, Math.max(1.3, Number((baseEase + 0.08).toFixed(2))));
    if (nextConsecutive === 1) {
      nextIntervalDays = 1;
      mastery = 'learning';
    } else if (nextConsecutive === 2) {
      nextIntervalDays = 3;
      mastery = 'reviewing';
    } else {
      nextIntervalDays = Math.max(6, Math.round(Math.max(3, prevInterval) * nextEase));
      mastery = 'mastered';
    }
    nextReviewMs = nowMs + nextIntervalDays * DAY_MS;
  } else {
    nextConsecutive = 0;
    nextEase = Math.max(1.3, Number((baseEase - 0.2).toFixed(2)));
    nextIntervalDays = 0;
    mastery = 'learning';
    nextReviewMs = nowMs + RETRY_SOON_MS;
  }

  const updatedRecord: WordMasteryRecord = {
    wordKey: key,
    vocabId: target.vocabId ?? existing?.vocabId,
    word: target.word,
    ar: target.ar,
    example: target.example || existing?.example || '',
    exampleAr: target.exampleAr || existing?.exampleAr || '',
    phonetic: target.phonetic ?? existing?.phonetic,
    pos: target.pos ?? existing?.pos,
    levelId: target.levelId,
    lessonId: target.lessonId,
    seenCount: (existing?.seenCount ?? 0) + 1,
    correctCount: (existing?.correctCount ?? 0) + (correct ? 1 : 0),
    wrongCount: (existing?.wrongCount ?? 0) + (correct ? 0 : 1),
    consecutiveCorrect: nextConsecutive,
    easeFactor: nextEase,
    intervalDays: nextIntervalDays,
    mastery,
    lastReviewedAt: nowIso,
    nextReviewAt: new Date(nextReviewMs).toISOString(),
    lastResult: correct ? 'correct' : 'wrong',
  };

  return {
    ...vocabProgress,
    [key]: updatedRecord,
  };
}

export function getDueSrsVocab(
  vocabProgress: Record<string, WordMasteryRecord>,
  nowMs: number = Date.now(),
  unlockedLevels?: CEFRLevelId[],
  limit = 12,
): WordMasteryRecord[] {
  const records = Object.values(vocabProgress).filter((rec) => {
    if (unlockedLevels && unlockedLevels.length > 0 && !unlockedLevels.includes(rec.levelId)) {
      return false;
    }
    const dueMs = Date.parse(rec.nextReviewAt);
    return rec.lastResult === 'wrong' || (!Number.isNaN(dueMs) && dueMs <= nowMs);
  });

  records.sort((a, b) => {
    // Prioritize words answered wrong recently, then lowest consecutiveCorrect, then oldest due date
    if (a.lastResult !== b.lastResult) return a.lastResult === 'wrong' ? -1 : 1;
    if (a.wrongCount !== b.wrongCount) return b.wrongCount - a.wrongCount;
    if (a.consecutiveCorrect !== b.consecutiveCorrect) return a.consecutiveCorrect - b.consecutiveCorrect;
    return Date.parse(a.nextReviewAt) - Date.parse(b.nextReviewAt);
  });

  return records.slice(0, limit);
}

export function getWeakSrsVocab(
  vocabProgress: Record<string, WordMasteryRecord>,
  unlockedLevels?: CEFRLevelId[],
  limit = 12,
): WordMasteryRecord[] {
  const records = Object.values(vocabProgress).filter((rec) => {
    if (unlockedLevels && unlockedLevels.length > 0 && !unlockedLevels.includes(rec.levelId)) {
      return false;
    }
    return rec.wrongCount > 0 || rec.mastery !== 'mastered';
  });

  records.sort((a, b) => {
    const aWeakScore = a.wrongCount * 3 - a.consecutiveCorrect * 2;
    const bWeakScore = b.wrongCount * 3 - b.consecutiveCorrect * 2;
    if (aWeakScore !== bWeakScore) return bWeakScore - aWeakScore;
    return a.seenCount - b.seenCount;
  });

  return records.slice(0, limit);
}

export function summarizeVocabProgress(
  vocabProgress: Record<string, WordMasteryRecord>,
  nowMs: number = Date.now(),
): {
  total: number;
  newCount: number;
  learningCount: number;
  reviewingCount: number;
  masteredCount: number;
  weakCount: number;
  dueCount: number;
} {
  const all = Object.values(vocabProgress);
  let newCount = 0;
  let learningCount = 0;
  let reviewingCount = 0;
  let masteredCount = 0;
  let weakCount = 0;
  let dueCount = 0;

  for (const r of all) {
    if (r.mastery === 'new') newCount++;
    else if (r.mastery === 'learning') learningCount++;
    else if (r.mastery === 'reviewing') reviewingCount++;
    else if (r.mastery === 'mastered') masteredCount++;

    if (r.wrongCount > 0 && r.mastery !== 'mastered') weakCount++;
    const dueMs = Date.parse(r.nextReviewAt);
    if (r.lastResult === 'wrong' || (!Number.isNaN(dueMs) && dueMs <= nowMs)) {
      dueCount++;
    }
  }

  return {
    total: all.length,
    newCount,
    learningCount,
    reviewingCount,
    masteredCount,
    weakCount,
    dueCount,
  };
}

function deterministicShuffle<T>(items: T[], seedStr: string): T[] {
  const arr = [...items];
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  for (let i = arr.length - 1; i > 0; i--) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    const j = Math.abs(h) % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function buildSrsPracticeQuestions(
  records: WordMasteryRecord[],
  vocabPool: Array<{ word: string; ar: string; example?: string }>,
  prefix = 'SRS',
): LessonQuestion[] {
  const uniqueAr = Array.from(new Set(vocabPool.map((v) => v.ar).filter(Boolean)));
  const uniqueEn = Array.from(new Set(vocabPool.map((v) => v.word).filter(Boolean)));

  return records.map((rec, idx) => {
    const targetWord: QuestionTargetWord = {
      vocabId: rec.vocabId,
      word: rec.word,
      ar: rec.ar,
      example: rec.example,
      exampleAr: rec.exampleAr,
      phonetic: rec.phonetic,
      pos: rec.pos,
      lessonId: rec.lessonId,
      levelId: rec.levelId,
    };

    const mode = idx % 3;
    if (mode === 1 && rec.example && new RegExp(`\\b${rec.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(rec.example)) {
      const escaped = rec.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const masked = rec.example.replace(new RegExp(escaped, 'i'), '____');
      return {
        id: `${prefix}-FILL-${rec.wordKey}-${idx}`,
        lesson_id: rec.lessonId,
        level_id: rec.levelId,
        skill_tag: 'vocab',
        type: 'fill',
        prompt: masked.includes('____') ? masked : `${rec.example} (____)`,
        promptAr: `مراجعة متباعدة — أكمل الفراغ (المعنى: ${rec.ar}):`,
        audioText: rec.example,
        answer: rec.word,
        explanation: `الكلمة المستحقة للمراجعة هي "${rec.word}" (${rec.ar}).`,
        targetWord,
      };
    }

    if (mode === 2) {
      const enDistractors = deterministicShuffle(
        uniqueEn.filter((w) => w.toLowerCase() !== rec.word.toLowerCase()),
        `${prefix}-en-${rec.wordKey}-${idx}`,
      ).slice(0, 3);
      const options = deterministicShuffle(
        [rec.word, ...enDistractors],
        `${prefix}-enopts-${rec.wordKey}-${idx}`,
      );
      return {
        id: `${prefix}-AR2EN-${rec.wordKey}-${idx}`,
        lesson_id: rec.lessonId,
        level_id: rec.levelId,
        skill_tag: 'vocab',
        type: 'mcq',
        prompt: rec.ar,
        promptAr: 'مراجعة متباعدة — اختر الكلمة الإنجليزية المطابقة للمعنى:',
        audioText: rec.word,
        options,
        answer: rec.word,
        explanation: `المعنى "${rec.ar}" يقابله "${rec.word}". مثال: ${rec.example}`,
        targetWord,
      };
    }

    const arDistractors = deterministicShuffle(
      uniqueAr.filter((a) => a !== rec.ar),
      `${prefix}-ar-${rec.wordKey}-${idx}`,
    ).slice(0, 3);
    const options = deterministicShuffle(
      [rec.ar, ...arDistractors],
      `${prefix}-aropts-${rec.wordKey}-${idx}`,
    );

    return {
      id: `${prefix}-MCQ-${rec.wordKey}-${idx}`,
      lesson_id: rec.lessonId,
      level_id: rec.levelId,
      skill_tag: 'vocab',
      type: 'mcq',
      prompt: rec.word,
      promptAr: 'مراجعة متباعدة — اختر المعنى العربي الصحيح:',
      audioText: rec.word,
      options,
      answer: rec.ar,
      explanation: `كلمة "${rec.word}" تعني "${rec.ar}". مثال: ${rec.example}`,
      targetWord,
    };
  });
}
