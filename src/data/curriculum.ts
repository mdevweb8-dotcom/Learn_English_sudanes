import type { CEFRLevel, CEFRLevelId, Lesson, LessonQuestion, SkillTag } from '../types';
import { LEVELS_A1_B1_SEEDS, type RawLessonSeed } from './levelsA1B1';
import { LEVELS_B2_C2_SEEDS } from './levelsB2C2';

export const CEFR_ORDER: CEFRLevelId[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export const SKILL_LABELS: Record<SkillTag, string> = {
  vocab: 'المفردات',
  grammar: 'القواعد',
  pronunciation: 'النطق',
  listening: 'الاستماع',
  sentence_building: 'إنشاء الجمل',
  reading: 'القراءة',
};

const LEVEL_META: Record<CEFRLevelId, { name: string; nameEn: string; description: string }> = {
  A1: {
    name: 'المبتدئ الأول',
    nameEn: 'Beginner',
    description: 'التحيات، العائلة، الألوان، البيت، المدرسة، الطعام، والمواصلات اليومية.',
  },
  A2: {
    name: 'الأساسي',
    nameEn: 'Elementary',
    description: 'المقارنات، القدرة، أدوات الاستفهام، الماضي البسيط، الصحة، وخطط المستقبل.',
  },
  B1: {
    name: 'المتوسط',
    nameEn: 'Intermediate',
    description: 'العمل، التعليم، التسوق، التقنية، المجتمع، الرحلات، وحل المشكلات.',
  },
  B2: {
    name: 'فوق المتوسط',
    nameEn: 'Upper-Intermediate',
    description: 'المفردات الأكاديمية، الاستنتاج، الاقتصاد، التنظيم، وتحليل الحجج.',
  },
  C1: {
    name: 'المتقدم',
    nameEn: 'Advanced',
    description: 'المساءلة، الدقة اللغوية، التفكيك النقدي، التفاوت الاجتماعي، والبلاغة.',
  },
  C2: {
    name: 'الإتقان الكامل',
    nameEn: 'Mastery',
    description: 'الفرضيات الشمولية، الاستدلال الضمني، المفارقات، الاستدامة، والموثوقية.',
  },
};

function buildQuestionsFromSeed(seed: RawLessonSeed): LessonQuestion[] {
  const v0 = seed.vocab[0];
  const v1 = seed.vocab[1] ?? seed.vocab[0];
  const v2 = seed.vocab[2] ?? seed.vocab[0];
  const v3 = seed.vocab[3] ?? seed.vocab[1] ?? seed.vocab[0];
  const v4 = seed.vocab[4] ?? seed.vocab[2] ?? seed.vocab[0];

  const distractorPool = seed.vocab.map((v) => v.ar);

  const mcqOptions = Array.from(new Set([v0.ar, v1.ar, v2.ar, v3.ar]));
  while (mcqOptions.length < 4 && distractorPool.length > 0) {
    const candidate = distractorPool[mcqOptions.length % distractorPool.length];
    if (!mcqOptions.includes(candidate)) mcqOptions.push(candidate);
    else break;
  }

  return [
    {
      id: `${seed.id}-Q1`,
      lesson_id: seed.id,
      level_id: seed.levelId,
      skill_tag: 'vocab',
      type: 'mcq',
      prompt: v0.word,
      promptAr: 'اختر المعنى العربي الصحيح للكلمة:',
      audioText: v0.word,
      options: mcqOptions,
      answer: v0.ar,
      explanation: `كلمة "${v0.word}" تعني "${v0.ar}". مثال: ${v0.example}`,
    },
    {
      id: `${seed.id}-Q2`,
      lesson_id: seed.id,
      level_id: seed.levelId,
      skill_tag: 'vocab',
      type: 'tf',
      prompt: `هل معنى "${v1.word}" هو "${v2.ar}"؟`,
      promptAr: 'تحقق من صحة المعنى (صح أم خطأ):',
      audioText: v1.word,
      options: ['صح', 'خطأ'],
      answer: v1.ar === v2.ar ? 'صح' : 'خطأ',
      explanation: `المعنى الصحيح لكلمة "${v1.word}" هو "${v1.ar}" وليس "${v2.ar}".`,
    },
    {
      id: `${seed.id}-Q3`,
      lesson_id: seed.id,
      level_id: seed.levelId,
      skill_tag: 'grammar',
      type: 'mcq',
      prompt: seed.grammarQ.prompt,
      promptAr: seed.grammarQ.promptAr,
      options: seed.grammarQ.options,
      answer: seed.grammarQ.answer,
      explanation: seed.grammarQ.explanation,
    },
    {
      id: `${seed.id}-Q4`,
      lesson_id: seed.id,
      level_id: seed.levelId,
      skill_tag: 'listening',
      type: 'listen',
      prompt: 'استمع للنطق ثم اكتب الكلمة الإنجليزية الصحيحة',
      promptAr: `المعنى بالعربية: ${v3.ar}`,
      audioText: v3.word,
      answer: v3.word,
      explanation: `الكلمة المنطوقة هي "${v3.word}" ومعناها "${v3.ar}".`,
    },
    {
      id: `${seed.id}-Q5`,
      lesson_id: seed.id,
      level_id: seed.levelId,
      skill_tag: 'sentence_building',
      type: 'order',
      prompt: seed.orderQ.promptAr,
      promptAr: 'اضغط على الكلمات بالترتيب الصحيح لبناء الجملة:',
      wordsToOrder: seed.orderQ.words,
      answer: seed.orderQ.answer,
      explanation: seed.orderQ.explanation,
    },
    {
      id: `${seed.id}-Q6`,
      lesson_id: seed.id,
      level_id: seed.levelId,
      skill_tag: 'reading',
      type: 'mcq',
      prompt: seed.readingQ.passage,
      promptAr: seed.readingQ.question,
      options: seed.readingQ.options,
      answer: seed.readingQ.answer,
      explanation: seed.readingQ.explanation,
    },
    {
      id: `${seed.id}-Q7`,
      lesson_id: seed.id,
      level_id: seed.levelId,
      skill_tag: 'vocab',
      type: 'fill',
      prompt: v4.example.replace(new RegExp(v4.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '____'),
      promptAr: `أكمل الفراغ بالكلمة المناسبة (معناها: ${v4.ar}):`,
      audioText: v4.example,
      answer: v4.word,
      explanation: `الكلمة الناقصة هي "${v4.word}" (${v4.ar}).`,
    },
    {
      id: `${seed.id}-Q8`,
      lesson_id: seed.id,
      level_id: seed.levelId,
      skill_tag: 'pronunciation',
      type: 'pronunciation',
      prompt: seed.pronunciation.text,
      promptAr: `انطق الجملة التالية بصوت واضح (${seed.pronunciation.ar})`,
      audioText: seed.pronunciation.text,
      answer: seed.pronunciation.text,
      explanation: seed.pronunciation.tip,
    },
  ];
}

const ALL_SEEDS: RawLessonSeed[] = [...LEVELS_A1_B1_SEEDS, ...LEVELS_B2_C2_SEEDS];

export const ALL_LESSONS: Lesson[] = ALL_SEEDS.map((seed) => ({
  id: seed.id,
  levelId: seed.levelId,
  order: seed.order,
  title: seed.title,
  topic: seed.topic,
  grammarTitle: seed.grammarTitle,
  explanation: seed.explanation,
  keyPoints: seed.keyPoints,
  vocabulary: seed.vocab.map((v, idx) => ({ ...v, id: `${seed.id}-V${idx + 1}` })),
  pronunciationTarget: seed.pronunciation,
  questions: buildQuestionsFromSeed(seed),
}));

export const CEFR_LEVELS: CEFRLevel[] = CEFR_ORDER.map((id) => ({
  id,
  ...LEVEL_META[id],
  lessons: ALL_LESSONS.filter((l) => l.levelId === id).sort((a, b) => a.order - b.order),
}));

export function getLessonById(lessonId: string): Lesson | undefined {
  return ALL_LESSONS.find((l) => l.id === lessonId);
}

export function getLessonQuestionsStrict(lessonId: string): LessonQuestion[] {
  const lesson = getLessonById(lessonId);
  if (!lesson) return [];
  // Strict filtering: question.lesson_id == current_lesson_id only
  return lesson.questions.filter((q) => q.lesson_id === lessonId);
}

export function getFinalExamQuestions(levelId: CEFRLevelId): LessonQuestion[] {
  const level = CEFR_LEVELS.find((l) => l.id === levelId);
  if (!level) return [];

  const nonPron: LessonQuestion[] = [];
  const pron: LessonQuestion[] = [];

  for (const lesson of level.lessons) {
    for (const q of lesson.questions) {
      if (q.skill_tag === 'pronunciation') pron.push(q);
      else nonPron.push(q);
    }
  }

  // Pick 17 diverse non-pronunciation + 3 pronunciation = 20 questions
  const pickedNonPron: LessonQuestion[] = [];
  const desiredSkills: SkillTag[] = ['vocab', 'grammar', 'listening', 'sentence_building', 'reading'];
  let idx = 0;
  while (pickedNonPron.length < 17 && idx < 100) {
    const targetSkill = desiredSkills[idx % desiredSkills.length];
    const candidate = nonPron.find(
      (q) => q.skill_tag === targetSkill && !pickedNonPron.some((p) => p.id === q.id),
    );
    if (candidate) pickedNonPron.push(candidate);
    else {
      const anyRemaining = nonPron.find((q) => !pickedNonPron.some((p) => p.id === q.id));
      if (anyRemaining) pickedNonPron.push(anyRemaining);
      else break;
    }
    idx++;
  }

  const pickedPron = pron.slice(0, 3);
  return [...pickedNonPron, ...pickedPron].slice(0, 20);
}

export function getAdaptiveReviewQuestions(
  unlockedLevelIds: CEFRLevelId[],
  completedLessons: Record<string, number>,
  currentLessonId: string,
  skills: Record<SkillTag, { correct: number; attempts: number }>,
): { questions: LessonQuestion[]; weakestSkills: SkillTag[]; focusNote: string } {
  // Only draw from unlocked/studied lessons — never future locked lessons!
  const studiedLessons = ALL_LESSONS.filter(
    (l) => unlockedLevelIds.includes(l.levelId) && (completedLessons[l.id] !== undefined || l.id === currentLessonId),
  );
  const safeLessons = studiedLessons.length > 0 ? studiedLessons : [ALL_LESSONS[0]];
  const pool = safeLessons.flatMap((l) => l.questions);

  const skillScores = (Object.keys(SKILL_LABELS) as SkillTag[]).map((tag) => {
    const stat = skills[tag];
    const pct = stat && stat.attempts > 0 ? Math.round((stat.correct / stat.attempts) * 100) : 70;
    return { tag, pct };
  });

  skillScores.sort((a, b) => a.pct - b.pct);
  const weakestSkills: SkillTag[] = [skillScores[0].tag, skillScores[1].tag];
  const pronPct = skillScores.find((s) => s.tag === 'pronunciation')?.pct ?? 70;

  const selected: LessonQuestion[] = [];
  const pushUnique = (q: LessonQuestion | undefined) => {
    if (q && !selected.some((s) => s.id === q.id)) {
      selected.push(q);
    }
  };

  let focusNote = `تركيز تلقائي على أضعف مهارتين: ${SKILL_LABELS[weakestSkills[0]]} و${SKILL_LABELS[weakestSkills[1]]}.`;

  // Rule 1: If pronunciation < 50%, dedicate 60% (6 out of 10) to pronunciation exercises
  if (pronPct < 50) {
    focusNote = 'نطقك يحتاج دفعة إضافية (< 50%): خصصنا 60% من مراجعة اليوم لتمارين النطق!';
    const pronPool = pool.filter((q) => q.skill_tag === 'pronunciation');
    for (let i = 0; i < 6 && i < pronPool.length; i++) {
      pushUnique(pronPool[i]);
    }
    // If studied lessons had fewer than 6 pronunciation items, synthesize pronunciation drills from studied vocabulary
    const vocabItems = safeLessons.flatMap((l) =>
      l.vocabulary.map((v) => ({ lessonId: l.id, levelId: l.levelId, vocab: v })),
    );
    let vIdx = 0;
    while (selected.length < 6 && vIdx < vocabItems.length) {
      const item = vocabItems[vIdx++];
      pushUnique({
        id: `ADAPT-PRON-${item.vocab.id}`,
        lesson_id: item.lessonId,
        level_id: item.levelId,
        skill_tag: 'pronunciation',
        type: 'pronunciation',
        prompt: item.vocab.example,
        promptAr: `تدرّب على نطق الجملة (${item.vocab.exampleAr})`,
        audioText: item.vocab.example,
        answer: item.vocab.example,
        explanation: `تدريب إضافي على كلمة ${item.vocab.word} (${item.vocab.ar}).`,
      });
    }
  }

  // Rule 2: If weak in sentence_building, focus on word ordering & building
  if (weakestSkills.includes('sentence_building')) {
    const orderPool = pool.filter((q) => q.skill_tag === 'sentence_building');
    for (const q of orderPool) {
      if (selected.length >= 8) break;
      pushUnique(q);
    }
    if (pronPct >= 50) {
      focusNote = 'ركزنا مراجعة اليوم على ترتيب الكلمات وبناء الجمل لتقوية مهارتك في الصياغة.';
    }
  }

  // Rule 3: If weak in grammar, focus on grammar of the current lesson only
  if (weakestSkills.includes('grammar')) {
    const currentGrammar = getLessonQuestionsStrict(currentLessonId).filter((q) => q.skill_tag === 'grammar');
    for (const q of currentGrammar) {
      if (selected.length >= 10) break;
      pushUnique(q);
    }
    if (pronPct >= 50 && !weakestSkills.includes('sentence_building')) {
      focusNote = 'ركزنا المراجعة على قواعد درسك الحالي لتثبيتها قبل الانتقال.';
    }
  }

  // Fill remaining up to 10 from the two weakest skills first, then general studied pool
  const weakPool = pool.filter((q) => weakestSkills.includes(q.skill_tag));
  for (const q of weakPool) {
    if (selected.length >= 10) break;
    pushUnique(q);
  }
  for (const q of pool) {
    if (selected.length >= 10) break;
    pushUnique(q);
  }

  return { questions: selected.slice(0, 10), weakestSkills, focusNote };
}

export function getLocalSudaneseExplanation(query: string, levelId: CEFRLevelId): string {
  const clean = query.trim().toLowerCase();
  const matchedVocab = ALL_LESSONS.flatMap((l) => l.vocabulary).find(
    (v) => v.word.toLowerCase() === clean || clean.includes(v.word.toLowerCase()),
  );

  if (matchedVocab) {
    return `أهلاً بيك يا بطل! كلمة "${matchedVocab.word}" (${matchedVocab.pos}) معناها بالبسيط "${matchedVocab.ar}".
نطقها التقريبي: ${matchedVocab.phonetic}.
بنستعملها في جملة زي:
"${matchedVocab.example}"
ومعناها: ${matchedVocab.exampleAr}.
نصيحة سريعة: كرّر الجملة دي بصوت عالي مرتين عشان تثبت معاك في مستواك (${levelId})!`;
  }

  const matchedLesson = ALL_LESSONS.find(
    (l) => l.title.includes(query) || l.grammarTitle.toLowerCase().includes(clean),
  );
  if (matchedLesson) {
    return `شوف يا زولي، درس "${matchedLesson.title}" ساهل جداً:
${matchedLesson.explanation}
أهم نقاط تحفظها:
• ${matchedLesson.keyPoints.join('\n• ')}`;
  }

  return `مرحباً بيك في المعلم المحلي (وضع بدون نت)!
سألت عن: "${query}" (مستوى ${levelId}).
عشان تفهم أي كلمة إنجليزية بسرعة:
1) شوف نوعها في الجملة (فعل، اسم، ولا صفة).
2) اسمع نطقها بزر السماعة 🔊 ورددها مع جملة قصيرة من يومك.
3) لو إنت متصل بالنت، حيشرح ليك المعلم الذكي بالتفصيل بالسوداني!`;
}

export function getMultiplayerQuestionSet(levelId: CEFRLevelId = 'A1', count = 10): LessonQuestion[] {
  const level = CEFR_LEVELS.find((l) => l.id === levelId) || CEFR_LEVELS[0];
  const pool = level.lessons.flatMap((l) =>
    l.questions.filter((q) => q.type !== 'pronunciation' && q.type !== 'listen'),
  );
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

