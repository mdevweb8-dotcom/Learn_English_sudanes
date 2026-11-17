import type { BadgeDef, CEFRLevelId, Rival, ShopItem } from '../types';

export const RIVALS: Rival[] = [
  {
    id: 'rival-sara',
    name: 'سارة',
    avatarId: 'avatar-sara',
    personality: 'steady',
    personalityLabel: 'مثابرة منتظمة',
    baseDailyRate: 38,
    activeProbability: 0.9,
    weekendBoost: 1.0,
    tagline: 'مثابرة في المراجعة الصباحية',
  },
  {
    id: 'rival-ahmed',
    name: 'أحمد',
    avatarId: 'avatar-ahmed',
    personality: 'sprinter',
    personalityLabel: 'منافس سريع',
    baseDailyRate: 46,
    activeProbability: 0.72,
    weekendBoost: 1.25,
    tagline: 'يتدرب على النطق يومياً',
  },
  {
    id: 'rival-layla',
    name: 'ليلى',
    avatarId: 'avatar-layla',
    personality: 'calm',
    personalityLabel: 'هادئة ومتوازنة',
    baseDailyRate: 30,
    activeProbability: 0.82,
    weekendBoost: 1.1,
    tagline: 'محبة للقراءة والمفردات',
  },
  {
    id: 'rival-omar',
    name: 'عمر',
    avatarId: 'avatar-omar',
    personality: 'sporadic',
    personalityLabel: 'متقطع النشاط',
    baseDailyRate: 34,
    activeProbability: 0.55,
    weekendBoost: 1.45,
    tagline: 'يعشق تحديات السرعة',
  },
  {
    id: 'rival-noor',
    name: 'نور',
    avatarId: 'avatar-noor',
    personality: 'challenger',
    personalityLabel: 'شغوفة بالتحديات',
    baseDailyRate: 42,
    activeProbability: 0.78,
    weekendBoost: 1.15,
    tagline: 'تسعى لإنهاء المستوى بسرعة',
  },
];

export const BADGES: BadgeDef[] = [
  { id: 'first_lesson', title: 'أول درس', description: 'أكملت أول درس بنجاح', icon: 'book' },
  { id: 'streak_7', title: '7 أيام متتالية', description: 'حافظت على سلسلة تعلم لمدة 7 أيام', icon: 'flame' },
  { id: 'pron_10', title: 'نطق ممتاز 10 مرات', description: 'حققت تقييم ممتاز في النطق 10 مرات', icon: 'mic' },
  { id: 'challenge_win', title: 'بطل التحدي', description: 'تفوقت على منافس في تحدي اليوم', icon: 'swords' },
  { id: 'xp_500', title: 'نجم 500 XP', description: 'جمعت 500 نقطة خبرة أو أكثر', icon: 'zap' },
  { id: 'level_A1', title: 'إنهاء A1', description: 'اجتزت المستوى A1 والامتحان النهائي بنجاح', icon: 'award' },
  { id: 'level_A2', title: 'إنهاء A2', description: 'اجتزت المستوى A2 والامتحان النهائي بنجاح', icon: 'award' },
  { id: 'level_B1', title: 'إنهاء B1', description: 'اجتزت المستوى B1 والامتحان النهائي بنجاح', icon: 'award' },
  { id: 'level_B2', title: 'إنهاء B2', description: 'اجتزت المستوى B2 والامتحان النهائي بنجاح', icon: 'award' },
  { id: 'level_C1', title: 'إنهاء C1', description: 'اجتزت المستوى C1 والامتحان النهائي بنجاح', icon: 'award' },
  { id: 'level_C2', title: 'إنهاء C2', description: 'ختمت أعلى مستوى إنجليزي C2 بنجاح', icon: 'crown' },
];

export const SHOP_ITEMS: ShopItem[] = [
  // Themes
  { id: 'theme-ocean', category: 'theme', name: 'ثيم المحيط الأزرق', description: 'التصميم الهادئ الافتراضي للتعلم', cost: 0, value: 'ocean' },
  { id: 'theme-emerald', category: 'theme', name: 'ثيم واحة النيل الأخضر', description: 'ألوان زمردية مريحة للعين', cost: 80, value: 'emerald' },
  { id: 'theme-indigo', category: 'theme', name: 'ثيم النيلي الأكاديمي', description: 'طابع ليلي راقٍ للتركيز العميق', cost: 120, value: 'indigo' },
  { id: 'theme-amber', category: 'theme', name: 'ثيم شمس الصحراء الذهبية', description: 'دفء وإشراق يحفز على الاستمرار', cost: 150, value: 'amber' },

  // Avatars
  { id: 'avatar-scholar', category: 'avatar', name: 'أفاتار الباحث', description: 'رمز قبعة التخرج والكتاب', cost: 0, value: 'avatar-scholar' },
  { id: 'avatar-falcon', category: 'avatar', name: 'أفاتار الصقر الطموح', description: 'رمز السرعة والدقة في الإنجليزية', cost: 90, value: 'avatar-falcon' },
  { id: 'avatar-nile', category: 'avatar', name: 'أفاتار نجمة النيل', description: 'أفاتار ذهبي مميز في الصدارة', cost: 140, value: 'avatar-nile' },
  { id: 'avatar-astronaut', category: 'avatar', name: 'أفاتار رائد الطلاقة', description: 'للمنطلقين نحو العالمية', cost: 200, value: 'avatar-astronaut' },

  // Titles
  { id: 'title-learner', category: 'title', name: 'لقب: متعلم نشيط', description: 'اللقب الأساسي لكل متعلم', cost: 0, value: 'متعلم نشيط' },
  { id: 'title-speaker', category: 'title', name: 'لقب: متحدث واثق', description: 'يظهر بجانب اسمك في لوحة الصدارة', cost: 70, value: 'متحدث واثق' },
  { id: 'title-fluent', category: 'title', name: 'لقب: سفير الطلاقة', description: 'لقب الشرف للمثابرين يومياً', cost: 160, value: 'سفير الطلاقة' },
  { id: 'title-master', category: 'title', name: 'لقب: أستاذ اللغات', description: 'أرفع لقب في Friendly Fluency Hub', cost: 250, value: 'أستاذ اللغات' },
];

export function getLevelRangeBaseXp(levelId: CEFRLevelId): number {
  const map: Record<CEFRLevelId, number> = {
    A1: 40,
    A2: 450,
    B1: 950,
    B2: 1550,
    C1: 2250,
    C2: 3000,
  };
  return map[levelId];
}
