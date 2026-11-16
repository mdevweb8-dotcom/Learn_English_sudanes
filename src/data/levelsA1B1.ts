import type { CEFRLevelId } from '../types';

export interface RawVocab {
  word: string;
  pos: string;
  ar: string;
  phonetic: string;
  example: string;
  exampleAr: string;
}

export interface RawGrammarQuestion {
  prompt: string;
  promptAr: string;
  options: string[];
  answer: string;
  explanation: string;
}

export interface RawOrderQuestion {
  promptAr: string;
  words: string[];
  answer: string;
  explanation: string;
}

export interface RawReadingQuestion {
  passage: string;
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

export interface RawLessonSeed {
  id: string;
  levelId: CEFRLevelId;
  order: number;
  title: string;
  topic: string;
  grammarTitle: string;
  explanation: string;
  keyPoints: string[];
  pronunciation: { text: string; ar: string; tip: string };
  vocab: RawVocab[];
  grammarQ: RawGrammarQuestion;
  orderQ: RawOrderQuestion;
  readingQ: RawReadingQuestion;
}

export const LEVELS_A1_B1_SEEDS: RawLessonSeed[] = [
  // ==================== A1 (8 Lessons) ====================
  {
    id: 'A1-L1',
    levelId: 'A1',
    order: 1,
    title: 'التحيات والتعريف بالنفس',
    topic: 'اللقاءات الأولى والزمن',
    grammarTitle: 'استخدام الضمير I مع am و You مع are',
    explanation:
      'في الإنجليزية نستخدم "I am" للحديث عن أنفسنا (أنا أكون) و"You are" لمخاطبة شخص آخر. لتحية الناس في الصباح نقول Good morning وفي المساء Good evening.',
    keyPoints: [
      'I am = أنا (تُختصر I’m)',
      'My name is... = اسمي هو...',
      'Good morning / afternoon / evening للتحية حسب الوقت',
    ],
    pronunciation: {
      text: 'Hello, my name is Tariq',
      ar: 'مرحباً، اسمي طارق',
      tip: 'انطق حرف h في Hello بوضوح وارفَع نبرتك بلطف عند الترحيب.',
    },
    vocab: [
      { word: 'Hello', pos: 'Interj', ar: 'مرحباً', phonetic: '/həˈloʊ/', example: 'Hello, nice to meet you.', exampleAr: 'مرحباً، سررت بلقائك.' },
      { word: 'Name', pos: 'N', ar: 'اسم', phonetic: '/neɪm/', example: 'What is your name?', exampleAr: 'ما هو اسمك؟' },
      { word: 'Morning', pos: 'N', ar: 'صباح', phonetic: '/ˈmɔːrnɪŋ/', example: 'Good morning, teacher!', exampleAr: 'صباح الخير يا معلم!' },
      { word: 'Afternoon', pos: 'N', ar: 'بعد الظهر', phonetic: '/ˌæftərˈnuːn/', example: 'I study in the afternoon.', exampleAr: 'أدرس بعد الظهر.' },
      { word: 'Please', pos: 'Adv', ar: 'من فضلك', phonetic: '/pliːz/', example: 'Please sit down.', exampleAr: 'من فضلك اجلس.' },
      { word: 'Thank you', pos: 'Phrase', ar: 'شكراً لك', phonetic: '/ˈθæŋk juː/', example: 'Thank you for your help.', exampleAr: 'شكراً لك على مساعدتك.' },
    ],
    grammarQ: {
      prompt: 'I ___ from Sudan.',
      promptAr: 'اختر الفعل المساعد الصحيح للجملة:',
      options: ['am', 'is', 'are', 'be'],
      answer: 'am',
      explanation: 'الضمير I (أنا) يأخذ دائماً الفعل المساعد am في المضارع.',
    },
    orderQ: {
      promptAr: 'رتّب الكلمات لتكوين جملة تعريف صحيحة:',
      words: ['name', 'My', 'is', 'Sara'],
      answer: 'My name is Sara',
      explanation: 'نبدأ بصفة الملكية My ثم name ثم الفعل is ثم الاسم.',
    },
    readingQ: {
      passage: 'Hello! My name is Omar. Good morning. I am from Khartoum.',
      question: 'أين يسكن أو من أين عمر؟',
      options: ['من الخرطوم', 'من لندن', 'من القاهرة', 'من دبي'],
      answer: 'من الخرطوم',
      explanation: 'الجملة الأخيرة تقول I am from Khartoum أي أنا من الخرطوم.',
    },
  },
  {
    id: 'A1-L2',
    levelId: 'A1',
    order: 2,
    title: 'العائلة والأقرباء',
    topic: 'Family and kindred',
    grammarTitle: 'ضمائر الغائب (He / She) وصفات الملكية',
    explanation:
      'نستخدم He للمذكر المفرد وShe للمؤنث المفرد مع الفعل is. وعند الحديث عن عائلتنا نستخدم my (لي) وhis (له) وher (لها).',
    keyPoints: [
      'He is my father = هو أبي',
      'She is my sister = هي أختي',
      'We are a happy family = نحن عائلة سعيدة',
    ],
    pronunciation: {
      text: 'This is my brother and my sister',
      ar: 'هذا أخي وهذه أختي',
      tip: 'حرف th في This يُنطق كالذال العربية بإخراج طرف اللسان قليلاً.',
    },
    vocab: [
      { word: 'Family', pos: 'N', ar: 'عائلة', phonetic: '/ˈfæməli/', example: 'My family is very kind.', exampleAr: 'عائلتي لطيفة جداً.' },
      { word: 'Father', pos: 'N', ar: 'أب', phonetic: '/ˈfɑːðər/', example: 'My father works hard.', exampleAr: 'أبي يعمل بجد.' },
      { word: 'Mother', pos: 'N', ar: 'أم', phonetic: '/ˈmʌðər/', example: 'My mother cooks well.', exampleAr: 'أمي تطبخ جيداً.' },
      { word: 'Brother', pos: 'N', ar: 'أخ', phonetic: '/ˈbrʌðər/', example: 'My brother plays football.', exampleAr: 'أخي يلعب كرة القدم.' },
      { word: 'Sister', pos: 'N', ar: 'أخت', phonetic: '/ˈsɪstər/', example: 'My sister reads books.', exampleAr: 'أختي تقرأ الكتب.' },
      { word: 'Grandfather', pos: 'N', ar: 'جد', phonetic: '/ˈɡrænfɑːðər/', example: 'My grandfather tells stories.', exampleAr: 'جدي يحكي القصص.' },
    ],
    grammarQ: {
      prompt: 'She ___ my mother.',
      promptAr: 'أكمل الجملة بالفعل الصحيح:',
      options: ['is', 'am', 'are', 'were'],
      answer: 'is',
      explanation: 'الضمير She (هي) للمفرد المؤنث يأخذ الفعل is.',
    },
    orderQ: {
      promptAr: 'رتّب الكلمات لتكوين جملة عن العائلة:',
      words: ['is', 'He', 'brother', 'my'],
      answer: 'He is my brother',
      explanation: 'الترتيب الصحيح: الفاعل He + الفعل is + my brother.',
    },
    readingQ: {
      passage: 'Amina has a big family. Her father is a doctor and her mother is a teacher.',
      question: 'ما هي مهنة أم أمينة؟',
      options: ['معلمة', 'طبيبة', 'مهندسة', 'ممرضة'],
      answer: 'معلمة',
      explanation: 'النص يذكر her mother is a teacher أي أمها معلمة.',
    },
  },
  {
    id: 'A1-L3',
    levelId: 'A1',
    order: 3,
    title: 'الألوان والأدوات المدرسية',
    topic: 'Colours and stationery',
    grammarTitle: 'أدوات النكرة (a / an) قبل المفرد',
    explanation:
      'في الإنجليزية نضع a قبل الاسم المفرد المبدوء بحرف ساكن (a book)، ونضع an قبل الاسم المفرد المبدوء بصوت علة (a, e, i, o, u) مثل an apple.',
    keyPoints: [
      'a pen / a red book = قلم / كتاب أحمر',
      'an eraser / an orange = ممحاة / برتقالة',
      'الصفة تأتي قبل الاسم دائماً: a blue bag',
    ],
    pronunciation: {
      text: 'I have a blue pen and a notebook',
      ar: 'لدي قلم أزرق وكراسة',
      tip: 'تأكد من نطق حرف p في pen بهواء خفيف وليس مثل b.',
    },
    vocab: [
      { word: 'Pen', pos: 'N', ar: 'قلم حبر', phonetic: '/pen/', example: 'Give me a pen, please.', exampleAr: 'أعطني قلماً من فضلك.' },
      { word: 'Pencil', pos: 'N', ar: 'قلم رصاص', phonetic: '/ˈpensəl/', example: 'Write with a pencil.', exampleAr: 'اكتب بقلم رصاص.' },
      { word: 'Book', pos: 'N', ar: 'كتاب', phonetic: '/bʊk/', example: 'This book is useful.', exampleAr: 'هذا الكتاب مفيد.' },
      { word: 'Notebook', pos: 'N', ar: 'كراسة', phonetic: '/ˈnoʊtbʊk/', example: 'Open your notebook.', exampleAr: 'افتح كراستك.' },
      { word: 'Red', pos: 'Adj', ar: 'أحمر', phonetic: '/red/', example: 'She has a red bag.', exampleAr: 'لديها حقيبة حمراء.' },
      { word: 'Green', pos: 'Adj', ar: 'أخضر', phonetic: '/ɡriːn/', example: 'The grass is green.', exampleAr: 'العشب أخضر.' },
    ],
    grammarQ: {
      prompt: 'I see ___ orange pencil on the desk.',
      promptAr: 'اختر أداة النكرة المناسبة:',
      options: ['an', 'a', 'are', 'is'],
      answer: 'an',
      explanation: 'كلمة orange تبدأ بصوت علة (o) لذلك نستخدم معها an.',
    },
    orderQ: {
      promptAr: 'رتّب الكلمات (تذكّر أن الصفة تسبق الاسم):',
      words: ['is', 'It', 'red', 'a', 'book'],
      answer: 'It is a red book',
      explanation: 'في الإنجليزية الصفة red تأتي قبل الاسم book.',
    },
    readingQ: {
      passage: 'Ali puts his ruler, two pencils, and a green notebook inside his school bag.',
      question: 'ما لون كراسة علي؟',
      options: ['خضراء', 'حمراء', 'صفراء', 'زرقاء'],
      answer: 'خضراء',
      explanation: 'النص يقول a green notebook أي كراسة خضراء.',
    },
  },
  {
    id: 'A1-L4',
    levelId: 'A1',
    order: 4,
    title: 'البيت والأثاث وأدوات المطبخ',
    topic: 'House, furniture and kitchen',
    grammarTitle: 'استخدام There is للمفرد و There are للجمع',
    explanation:
      'للتعبير عن وجود شيء في مكان معين نستخدم There is للمفرد وThere are للجمع، مع حروف الجر مثل in (في) وon (على) وunder (تحت).',
    keyPoints: [
      'There is a sofa in the room = توجد أريكة في الغرفة',
      'There are two chairs = يوجد كرسيان',
      'on the table = على الطاولة',
    ],
    pronunciation: {
      text: 'The cup is on the kitchen table',
      ar: 'الكوب على طاولة المطبخ',
      tip: 'حرف ch في kitchen يُنطق مثل (تش) بوضوح.',
    },
    vocab: [
      { word: 'House', pos: 'N', ar: 'بيت', phonetic: '/haʊs/', example: 'Our house has three rooms.', exampleAr: 'بيتنا فيه ثلاث غرف.' },
      { word: 'Kitchen', pos: 'N', ar: 'مطبخ', phonetic: '/ˈkɪtʃɪn/', example: 'Dad is in the kitchen.', exampleAr: 'أبي في المطبخ.' },
      { word: 'Table', pos: 'N', ar: 'طاولة', phonetic: '/ˈteɪbəl/', example: 'Put the plates on the table.', exampleAr: 'ضع الصحون على الطاولة.' },
      { word: 'Chair', pos: 'N', ar: 'كرسي', phonetic: '/tʃer/', example: 'Please bring a chair.', exampleAr: 'من فضلك أحضر كرسياً.' },
      { word: 'Spoon', pos: 'N', ar: 'ملعقة', phonetic: '/spuːn/', example: 'I need a clean spoon.', exampleAr: 'أحتاج ملعقة نظيفة.' },
      { word: 'Window', pos: 'N', ar: 'شباك / نافذة', phonetic: '/ˈwɪndoʊ/', example: 'Open the window, please.', exampleAr: 'افتح النافذة من فضلك.' },
    ],
    grammarQ: {
      prompt: 'There ___ a spoon next to the plate.',
      promptAr: 'اختر الفعل المناسب للمفرد:',
      options: ['is', 'are', 'am', 'have'],
      answer: 'is',
      explanation: 'كلمة a spoon مفردة، لذا نستخدم There is.',
    },
    orderQ: {
      promptAr: 'رتّب الكلمات لتكوين جملة صحيحة:',
      words: ['are', 'There', 'chairs', 'two'],
      answer: 'There are two chairs',
      explanation: 'نبدأ بـ There are لأن chairs جمع.',
    },
    readingQ: {
      passage: 'The living room is bright. There is a big sofa near the window and a small table.',
      question: 'أين توجد الأريكة الكبيرة؟',
      options: ['بالقرب من الشباك', 'في المطبخ', 'خلف الباب', 'في الحديقة'],
      answer: 'بالقرب من الشباك',
      explanation: 'النص يذكر near the window أي بالقرب من الشباك.',
    },
  },
  {
    id: 'A1-L5',
    levelId: 'A1',
    order: 5,
    title: 'المدرسة وجسم الإنسان',
    topic: 'The school and human body',
    grammarTitle: 'جمع الأسماء المنتظمة والشاذة (Tooth / Teeth, Foot / Feet)',
    explanation:
      'أغلب الأسماء تُجمع بإضافة s (مثل book -> books)، لكن بعض الكلمات يتغير شكلها مثل tooth -> teeth وfoot -> feet وchild -> children.',
    keyPoints: [
      'one hand -> two hands (جمع منتظم)',
      'one foot -> two feet (جمع شاذ)',
      'one tooth -> white teeth (أسنان)',
    ],
    pronunciation: {
      text: 'Wash your hands and brush your teeth',
      ar: 'اغسل يديك ونظّف أسنانك',
      tip: 'في كلمة teeth أخرج طرف لسانك عند نطق th الأخيرة (مثل الثاء).',
    },
    vocab: [
      { word: 'Teacher', pos: 'N', ar: 'معلم', phonetic: '/ˈtiːtʃər/', example: 'Our teacher explains clearly.', exampleAr: 'معلمنا يشرح بوضوح.' },
      { word: 'Student', pos: 'N', ar: 'طالب', phonetic: '/ˈstuːdənt/', example: 'Every student has a book.', exampleAr: 'كل طالب لديه كتاب.' },
      { word: 'Head', pos: 'N', ar: 'رأس', phonetic: '/hed/', example: 'Put the hat on your head.', exampleAr: 'ضع القبعة على رأسك.' },
      { word: 'Hand', pos: 'N', ar: 'يد', phonetic: '/hænd/', example: 'Raise your hand to speak.', exampleAr: 'ارفع يدك لتتحدث.' },
      { word: 'Eye', pos: 'N', ar: 'عين', phonetic: '/aɪ/', example: 'Close one eye.', exampleAr: 'أغمض عيناً واحدة.' },
      { word: 'Foot', pos: 'N', ar: 'قدم', phonetic: '/fʊt/', example: 'My right foot hurts.', exampleAr: 'قدمي اليمنى تؤلمني.' },
    ],
    grammarQ: {
      prompt: 'We walk on our two ___.',
      promptAr: 'اختر جمع كلمة foot الصحيح:',
      options: ['feet', 'foots', 'feets', 'foot'],
      answer: 'feet',
      explanation: 'كلمة foot جمعها شاذ وهو feet وليس foots.',
    },
    orderQ: {
      promptAr: 'رتّب الكلمات لتكوين جملة عن المدرسة:',
      words: ['reads', 'The', 'in', 'student', 'library', 'the'],
      answer: 'The student reads in the library',
      explanation: 'الفاعل The student ثم الفعل reads ثم المكان in the library.',
    },
    readingQ: {
      passage: 'Sara is a primary school pupil. She likes Math and English. After school, she does her homework.',
      question: 'ماذا تفعل سارة بعد المدرسة؟',
      options: ['تؤدي واجبها المنزلي', 'تنام مباشرة', 'تذهب للمطار', 'تطبخ العشاء'],
      answer: 'تؤدي واجبها المنزلي',
      explanation: 'الجملة الأخيرة تقول she does her homework.',
    },
  },
  {
    id: 'A1-L6',
    levelId: 'A1',
    order: 6,
    title: 'الوظائف والملابس',
    topic: 'Jobs and clothes',
    grammarTitle: 'المضارع البسيط (Present Simple) مع المهن والروتين',
    explanation:
      'للتحدث عن المهن والحقائق نستخدم المضارع البسيط. نضيف s للفعل إذا كان الفاعل مفرداً غائباً (He/She/It)، مثل: A doctor helps people.',
    keyPoints: [
      'A doctor wears a white coat = الطبيب يرتدي معطفاً أبيض',
      'مع He/She نضيف s للفعل: wears, works',
      'What is your job? = ما هي وظيفتك؟',
    ],
    pronunciation: {
      text: 'The engineer wears a blue jacket',
      ar: 'المهندس يرتدي سترة زرقاء',
      tip: 'حرف j في jacket يُنطق (ج) معطّشة واضحة.',
    },
    vocab: [
      { word: 'Doctor', pos: 'N', ar: 'طبيب', phonetic: '/ˈdɑːktər/', example: 'The doctor works at a hospital.', exampleAr: 'الطبيب يعمل في مستشفى.' },
      { word: 'Engineer', pos: 'N', ar: 'مهندس', phonetic: '/ˌendʒɪˈnɪr/', example: 'My cousin is an engineer.', exampleAr: 'ابن عمي مهندس.' },
      { word: 'Farmer', pos: 'N', ar: 'مزارع', phonetic: '/ˈfɑːrmər/', example: 'The farmer grows wheat.', exampleAr: 'المزارع يزرع القمح.' },
      { word: 'Shirt', pos: 'N', ar: 'قميص', phonetic: '/ʃɜːrt/', example: 'He wears a clean shirt.', exampleAr: 'يرتدي قميصاً نظيفاً.' },
      { word: 'Shoes', pos: 'N', ar: 'حذاء', phonetic: '/ʃuːz/', example: 'These black shoes are new.', exampleAr: 'هذا الحذاء الأسود جديد.' },
      { word: 'Glasses', pos: 'N', ar: 'نظارات', phonetic: '/ˈɡlæsɪz/', example: 'She wears glasses to read.', exampleAr: 'ترتدي نظارات للقراءة.' },
    ],
    grammarQ: {
      prompt: 'A nurse ___ patients in the hospital.',
      promptAr: 'اختر التصريف الصحيح للفعل مع المفرد:',
      options: ['helps', 'help', 'helping', 'to help'],
      answer: 'helps',
      explanation: 'الفاعل A nurse مفرد غائب لذلك نضيف s للفعل ليصبح helps.',
    },
    orderQ: {
      promptAr: 'رتّب الكلمات لتكوين جملة صحيحة:',
      words: ['a', 'wears', 'hat', 'The', 'farmer'],
      answer: 'The farmer wears a hat',
      explanation: 'الفاعل The farmer + الفعل wears + المفعول به a hat.',
    },
    readingQ: {
      passage: 'Khaled is a pilot. He wears a smart suit and flies planes to many countries.',
      question: 'ما هي وظيفة خالد؟',
      options: ['طيار', 'نجار', 'محامٍ', 'سائق حافلة'],
      answer: 'طيار',
      explanation: 'كلمة pilot تعني طيار ويقود الطائرات.',
    },
  },
  {
    id: 'A1-L7',
    levelId: 'A1',
    order: 7,
    title: 'الطعام والفواكه والطلب اللبق',
    topic: 'The food and fruit',
    grammarTitle: 'الأسماء المعدودة وغير المعدودة مع some و would like',
    explanation:
      'نستخدم I would like (أودّ) للطلب بأدب. الأسماء غير المعدودة مثل water وmilk وbread لا تأخذ s الجمع، ونستخدم معها some.',
    keyPoints: [
      'I would like some coffee, please = أود بعض القهوة من فضلك',
      'bread / water / milk لا تُجمع بـ s',
      'apples / bananas أسماء معدودة تُجمع بـ s',
    ],
    pronunciation: {
      text: 'I would like some bread and tea',
      ar: 'أود بعض الخبز والشاي',
      tip: 'حرف l في would صامت ولا يُنطق (تُنطق وُد).',
    },
    vocab: [
      { word: 'Water', pos: 'N', ar: 'ماء', phonetic: '/ˈwɔːtər/', example: 'Drink cold water.', exampleAr: 'اشرب ماءً بارداً.' },
      { word: 'Bread', pos: 'N', ar: 'خبز', phonetic: '/bred/', example: 'The bread is warm.', exampleAr: 'الخبز دافئ.' },
      { word: 'Banana', pos: 'N', ar: 'موز', phonetic: '/bəˈnænə/', example: 'I eat a banana every morning.', exampleAr: 'آكل موزة كل صباح.' },
      { word: 'Orange', pos: 'N', ar: 'برتقال', phonetic: '/ˈɔːrɪndʒ/', example: 'Fresh orange juice is sweet.', exampleAr: 'عصير البرتقال الطازج حلو.' },
      { word: 'Breakfast', pos: 'N', ar: 'فطور', phonetic: '/ˈbrekfəst/', example: 'We eat breakfast at eight.', exampleAr: 'نتناول الفطور في الثامنة.' },
      { word: 'Coffee', pos: 'N', ar: 'قهوة', phonetic: '/ˈkɔːfi/', example: 'Sudanese coffee has ginger.', exampleAr: 'القهوة السودانية بها زنجبيل.' },
    ],
    grammarQ: {
      prompt: 'Can I have ___ water, please?',
      promptAr: 'اختر الكلمة المناسبة للطلب اللبق:',
      options: ['some', 'a', 'many', 'two'],
      answer: 'some',
      explanation: 'كلمة water غير معدودة، لذا نستخدم معها some في الطلب.',
    },
    orderQ: {
      promptAr: 'رتّب الكلمات للطلب في المقهى:',
      words: ['like', 'would', 'I', 'tea', 'some'],
      answer: 'I would like some tea',
      explanation: 'الترتيب المهذب للطلب هو: I would like + الاسم.',
    },
    readingQ: {
      passage: 'For breakfast, Nadia drinks milk and eats cheese with fresh bread and dates.',
      question: 'ماذا تشرب نادية في الفطور؟',
      options: ['الحليب', 'القهوة', 'العصير', 'الشاي'],
      answer: 'الحليب',
      explanation: 'النص يقول Nadia drinks milk أي تشرب الحليب.',
    },
  },
  {
    id: 'A1-L8',
    levelId: 'A1',
    order: 8,
    title: 'المواصلات والأماكن في المدينة',
    topic: 'Transports and places',
    grammarTitle: 'حروف الجر للمواصلات (by) والأماكن (to / at)',
    explanation:
      'نستخدم حرف الجر by قبل وسائل المواصلات بدون أداة (by bus, by train, by car)، بينما نستخدم on foot للمشي على الأقدام.',
    keyPoints: [
      'by bus / by car / by plane = بالحافلة / بالسيارة / بالطائرة',
      'go to the airport / hospital = يذهب إلى المطار / المستشفى',
      'on foot = سيراً على الأقدام',
    ],
    pronunciation: {
      text: 'We go to the airport by taxi',
      ar: 'نذهب إلى المطار بسيارة الأجرة',
      tip: 'حرف t في taxi واضح، وby تأتي قبل وسيلة النقل مباشرة.',
    },
    vocab: [
      { word: 'Bus', pos: 'N', ar: 'حافلة / بص', phonetic: '/bʌs/', example: 'The bus arrives early.', exampleAr: 'الحافلة تصل مبكراً.' },
      { word: 'Train', pos: 'N', ar: 'قطار', phonetic: '/treɪn/', example: 'The train is fast.', exampleAr: 'القطار سريع.' },
      { word: 'Airport', pos: 'N', ar: 'مطار', phonetic: '/ˈerpɔːrt/', example: 'Meet me at the airport.', exampleAr: 'قابلني في المطار.' },
      { word: 'Hospital', pos: 'N', ar: 'مستشفى', phonetic: '/ˈhɑːspɪtəl/', example: 'The hospital is near the park.', exampleAr: 'المستشفى قريب من الحديقة.' },
      { word: 'Market', pos: 'N', ar: 'سوق', phonetic: '/ˈmɑːrkɪt/', example: 'She buys fruit from the market.', exampleAr: 'تشتري الفاكهة من السوق.' },
      { word: 'Street', pos: 'N', ar: 'شارع', phonetic: '/striːt/', example: 'Look left before crossing the street.', exampleAr: 'انظر يساراً قبل عبور الشارع.' },
    ],
    grammarQ: {
      prompt: 'I travel to work ___ bus every day.',
      promptAr: 'اختر حرف الجر الصحيح مع وسيلة النقل:',
      options: ['by', 'in', 'on', 'at'],
      answer: 'by',
      explanation: 'نستخدم by قبل وسائل المواصلات عند عدم وجود a أو the.',
    },
    orderQ: {
      promptAr: 'رتّب الكلمات لتكوين جملة عن التنقل:',
      words: ['goes', 'to', 'She', 'market', 'the'],
      answer: 'She goes to the market',
      explanation: 'الفاعل She + الفعل goes + حرف الجر to + المكان the market.',
    },
    readingQ: {
      passage: 'Tariq lives in a quiet town. He takes the train to the university every morning.',
      question: 'كيف يذهب طارق إلى الجامعة؟',
      options: ['بالقطار', 'بالدراجة', 'بالطائرة', 'سيراً على الأقدام'],
      answer: 'بالقطار',
      explanation: 'الجملة الثانية توضح He takes the train أي يأخذ القطار.',
    },
  },

  // ==================== A2 (8 Lessons) ====================
  {
    id: 'A2-L1',
    levelId: 'A2',
    order: 1,
    title: 'الحيوانات والطبيعة والمقارنة',
    topic: 'Animals and nature',
    grammarTitle: 'صفات المقارنة (-er + than)',
    explanation:
      'لمقارنة شيئين بصفة قصيرة نضيف er للصفة ثم كلمة than، مثل: A giraffe is taller than a lion. وإذا انتهت الصفة بحرف ساكن مسبوق بعلة نضاعف الساكن مثل bigger.',
    keyPoints: [
      'tall -> taller than = أطول من',
      'fast -> faster than = أسرع من',
      'big -> bigger than = أكبر من',
    ],
    pronunciation: {
      text: 'The giraffe is taller than the lion',
      ar: 'الزرافة أطول من الأسد',
      tip: 'حرف g في giraffe يُنطق مثل (ج) معطّشة.',
    },
    vocab: [
      { word: 'Lion', pos: 'N', ar: 'أسد', phonetic: '/ˈlaɪən/', example: 'The lion is strong.', exampleAr: 'الأسد قوي.' },
      { word: 'Giraffe', pos: 'N', ar: 'زرافة', phonetic: '/dʒəˈræf/', example: 'A giraffe has a long neck.', exampleAr: 'الزرافة لها رقبة طويلة.' },
      { word: 'Camel', pos: 'N', ar: 'جمل', phonetic: '/ˈkæməl/', example: 'A camel walks in the desert.', exampleAr: 'الجمل يمشي في الصحراء.' },
      { word: 'Elephant', pos: 'N', ar: 'فيل', phonetic: '/ˈelɪfənt/', example: 'The elephant is huge.', exampleAr: 'الفيل ضخم.' },
      { word: 'River', pos: 'N', ar: 'نهر', phonetic: '/ˈrɪvər/', example: 'The Nile is a great river.', exampleAr: 'النيل نهر عظيم.' },
      { word: 'Butterfly', pos: 'N', ar: 'فراشة', phonetic: '/ˈbʌtərflaɪ/', example: 'Look at that colorful butterfly.', exampleAr: 'انظر إلى تلك الفراشة الملونة.' },
    ],
    grammarQ: {
      prompt: 'An elephant is ___ than a rabbit.',
      promptAr: 'اختر صيغة المقارنة الصحيحة:',
      options: ['bigger', 'big', 'biggest', 'more big'],
      answer: 'bigger',
      explanation: 'الصفة القصيرة big تأخذ er ونضاعف حرف g لتصبح bigger than.',
    },
    orderQ: {
      promptAr: 'رتّب الكلمات لتكوين جملة مقارنة:',
      words: ['faster', 'is', 'A', 'tiger', 'than', 'a', 'turtle'],
      answer: 'A tiger is faster than a turtle',
      explanation: 'الفاعل + is + صفة المقارنة faster + than + الطرف الثاني.',
    },
    readingQ: {
      passage: 'Camels live in hot deserts. They can walk for days without water and carry heavy loads.',
      question: 'أين تعيش الجمال؟',
      options: ['في الصحاري الحارة', 'في القطب الجنوبي', 'في قاع المحيط', 'في الغابات الباردة'],
      answer: 'في الصحاري الحارة',
      explanation: 'النص يذكر Camels live in hot deserts.',
    },
  },
  {
    id: 'A2-L2',
    levelId: 'A2',
    order: 2,
    title: 'الأفعال اليومية والاستطاعة',
    topic: 'Everyday verbs and Can',
    grammarTitle: 'استخدام Can / Cannot للتعبير عن القدرة',
    explanation:
      'نستخدم can متبوعة بالفعل في المصدر بدون أي إضافات للتعبير عن القدرة على فعل شيء، والنفي منها can’t أو cannot.',
    keyPoints: [
      'I can swim = أستطيع السباحة',
      'She can’t drive = هي لا تستطيع القيادة',
      'Can you help me? = هل يمكنك مساعدتي؟',
    ],
    pronunciation: {
      text: 'Can you help me carry this heavy bag?',
      ar: 'هل يمكنك مساعدتي في حمل هذه الحقيبة الثقيلة؟',
      tip: 'في السؤال نرفع النبرة قليلاً في نهاية الجملة.',
    },
    vocab: [
      { word: 'Swim', pos: 'V', ar: 'يسبح', phonetic: '/swɪm/', example: 'Can you swim in the river?', exampleAr: 'هل تستطيع السباحة في النهر؟' },
      { word: 'Climb', pos: 'V', ar: 'يتسلق', phonetic: '/klaɪm/', example: 'Cats can climb trees.', exampleAr: 'القطط تستطيع تسلق الأشجار.' },
      { word: 'Cook', pos: 'V', ar: 'يطبخ', phonetic: '/kʊk/', example: 'He can cook delicious rice.', exampleAr: 'يستطيع طبخ أرز لذيذ.' },
      { word: 'Borrow', pos: 'V', ar: 'يستعير', phonetic: '/ˈbɑːroʊ/', example: 'May I borrow your pen?', exampleAr: 'هل يمكنني استعارة قلمك؟' },
      { word: 'Remember', pos: 'V', ar: 'يتذكر', phonetic: '/rɪˈmembər/', example: 'Always remember new words.', exampleAr: 'تذكّر الكلمات الجديدة دائماً.' },
      { word: 'Explain', pos: 'V', ar: 'يشرح', phonetic: '/ɪkˈspleɪn/', example: 'Please explain this rule.', exampleAr: 'من فضلك اشرح هذه القاعدة.' },
    ],
    grammarQ: {
      prompt: 'She can ___ English very well.',
      promptAr: 'اختر شكل الفعل الصحيح بعد can:',
      options: ['speak', 'speaks', 'speaking', 'spoke'],
      answer: 'speak',
      explanation: 'بعد can يأتي الفعل في المصدر دائماً بدون s أو ing.',
    },
    orderQ: {
      promptAr: 'رتّب الكلمات لتكوين سؤال مهذب:',
      words: ['borrow', 'I', 'Can', 'book', 'your', '?'],
      answer: 'Can I borrow your book ?',
      explanation: 'في السؤال نضع Can أولاً ثم الفاعل I ثم الفعل.',
    },
    readingQ: {
      passage: 'Hassan can fix bicycles and paint walls, but he cannot play the guitar yet.',
      question: 'ما الشيء الذي لا يستطيع حسن فعله بعد؟',
      options: ['العزف على الجيتار', 'إصلاح الدراجات', 'طلاء الجدران', 'القراءة'],
      answer: 'العزف على الجيتار',
      explanation: 'النص يقول he cannot play the guitar yet.',
    },
  },
  {
    id: 'A2-L3',
    levelId: 'A2',
    order: 3,
    title: 'أدوات الاستفهام (How many / How much / How far)',
    topic: 'Asking questions with How',
    grammarTitle: 'الفرق بين How many للعدد و How much للكمية والسعر',
    explanation:
      'من جدول الأسئلة المهم: نستخدم How many مع الأسماء المعدودة في الجمع، وHow much مع غير المعدود أو للسؤال عن السعر، وHow far للمسافة، وHow long للمدة والطول.',
    keyPoints: [
      'How many books? = كم عدد الكتب؟',
      'How much sugar? = كم كمية السكر؟ / كم السعر؟',
      'How far is the station? = كم تبعد المحطة؟',
    ],
    pronunciation: {
      text: 'How much does this ticket cost?',
      ar: 'كم تكلف هذه التذكرة؟',
      tip: 'اربط بين How وmuch بسلاسة، وحرف t في ticket خفيف وواضح.',
    },
    vocab: [
      { word: 'How many', pos: 'Phrase', ar: 'كم العدد', phonetic: '/haʊ ˈmeni/', example: 'How many brothers do you have?', exampleAr: 'كم عدد إخوتك؟' },
      { word: 'How much', pos: 'Phrase', ar: 'كم الكمية / السعر', phonetic: '/haʊ mʌtʃ/', example: 'How much water do we need?', exampleAr: 'كم نحتاج من الماء؟' },
      { word: 'How long', pos: 'Phrase', ar: 'كم الطول / المدة', phonetic: '/haʊ lɔːŋ/', example: 'How long is the lesson?', exampleAr: 'كم مدة الدرس؟' },
      { word: 'How far', pos: 'Phrase', ar: 'كم البعد / المسافة', phonetic: '/haʊ fɑːr/', example: 'How far is the airport?', exampleAr: 'كم يبعد المطار؟' },
      { word: 'Ticket', pos: 'N', ar: 'تذكرة', phonetic: '/ˈtɪkɪt/', example: 'Keep your bus ticket.', exampleAr: 'احتفظ بتذكرة البص.' },
      { word: 'Discount', pos: 'N', ar: 'تخفيض', phonetic: '/ˈdɪskaʊnt/', example: 'Is there a student discount?', exampleAr: 'هل يوجد تخفيض للطلاب؟' },
    ],
    grammarQ: {
      prompt: '___ apples are in the basket?',
      promptAr: 'اختر أداة الاستفهام الصحيحة مع الكلمة المعدودة:',
      options: ['How many', 'How much', 'How long', 'How cold'],
      answer: 'How many',
      explanation: 'كلمة apples اسم معدود في الجمع لذلك نستخدم How many.',
    },
    orderQ: {
      promptAr: 'رتّب الكلمات لتكوين سؤال عن المسافة:',
      words: ['far', 'is', 'How', 'hospital', 'the', '?'],
      answer: 'How far is the hospital ?',
      explanation: 'نبدأ بـ How far ثم الفعل المساعد is ثم الفاعل.',
    },
    readingQ: {
      passage: 'Customer: How much is this warm scarf? Seller: It is ten dollars, with a small discount today.',
      question: 'عن ماذا سأل الزبون؟',
      options: ['عن سعر الوشاح', 'عن عمر البائع', 'عن المسافة للسوق', 'عن حالة الطقس'],
      answer: 'عن سعر الوشاح',
      explanation: 'استخدم الزبون How much للسؤال عن السعر.',
    },
  },
  {
    id: 'A2-L4',
    levelId: 'A2',
    order: 4,
    title: 'كلمات متشابهة في النطق والكتابة',
    topic: 'Similar sounding words',
    grammarTitle: 'التمييز السمعي والكتابي للكلمات المتشابهة',
    explanation:
      'توجد مجموعات كلمات تتشابه في القافية مثل Cat/Mat/Hat وLight/Night/Right وEar/Bear/Wear. معرفة المعنى من سياق الجملة يحميك من اللبس.',
    keyPoints: [
      'Ear (أذن) vs Hear (يسمع) vs Near (قريب)',
      'Right (صحيح/يمين) vs Night (ليل) vs Light (ضوء)',
      'حرف gh في night وlight صامت لا يُنطق',
    ],
    pronunciation: {
      text: 'The bright light shines at night',
      ar: 'الضوء الساطع يشرق في الليل',
      tip: 'في light وnight حرفا gh صامتان تماماً، ننطقها لايت ونايت.',
    },
    vocab: [
      { word: 'Light', pos: 'N', ar: 'ضوء', phonetic: '/laɪt/', example: 'Turn on the light, please.', exampleAr: 'أشعل الضوء من فضلك.' },
      { word: 'Night', pos: 'N', ar: 'ليل', phonetic: '/naɪt/', example: 'Stars appear at night.', exampleAr: 'تظهر النجوم في الليل.' },
      { word: 'Right', pos: 'Adj', ar: 'صحيح / يمين', phonetic: '/raɪt/', example: 'Your answer is right.', exampleAr: 'إجابتك صحيحة.' },
      { word: 'Wear', pos: 'V', ar: 'يرتدي', phonetic: '/wer/', example: 'Wear a coat in winter.', exampleAr: 'ارتدِ معطفاً في الشتاء.' },
      { word: 'Near', pos: 'Prep', ar: 'قريب', phonetic: '/nɪr/', example: 'The pharmacy is near here.', exampleAr: 'الصيدلية قريبة من هنا.' },
      { word: 'Hear', pos: 'V', ar: 'يسمع', phonetic: '/hɪr/', example: 'Can you hear my voice?', exampleAr: 'هل تسمع صوتي؟' },
    ],
    grammarQ: {
      prompt: 'Turn right after the bank; the library is ___ the school.',
      promptAr: 'اختر الكلمة الصحيحة التي تعني قريب من:',
      options: ['near', 'wear', 'hear', 'fear'],
      answer: 'near',
      explanation: 'المعنى المطلوب للمكان هو near (قريب من).',
    },
    orderQ: {
      promptAr: 'رتّب الكلمات لتكوين جملة مفيدة:',
      words: ['hear', 'I', 'your', 'can', 'voice'],
      answer: 'I can hear your voice',
      explanation: 'الفاعل I + الفعل المساعد can + الفعل hear + المفعول به.',
    },
    readingQ: {
      passage: 'At night, Sami turns on the lamp light to read near the window.',
      question: 'متى يُشعل سامي ضوء المصباح؟',
      options: ['في الليل', 'في الصباح', 'عند الظهر', 'في العطلة فقط'],
      answer: 'في الليل',
      explanation: 'النص يبدأ بعبارة At night أي في الليل.',
    },
  },
  {
    id: 'A2-L5',
    levelId: 'A2',
    order: 5,
    title: 'الزمن الماضي البسيط وقصص الأمس',
    topic: 'Yesterday and past events',
    grammarTitle: 'استخدام الماضي البسيط (Past Simple) مع الأفعال المنتظمة والشاذة',
    explanation:
      'للتحدث عن حدث انتهى في الماضي (yesterday, last week) نضيف ed للأفعال المنتظمة (visited, cleaned)، بينما الأفعال الشاذة يتغير شكلها (go -> went, buy -> bought, come -> came).',
    keyPoints: [
      'visit -> visited (فعل منتظم)',
      'go -> went / come -> came (أفعال شاذة)',
      'في السؤال والنفي نستخدم did / didn’t مع المصدر',
    ],
    pronunciation: {
      text: 'Yesterday I visited my uncle in the village',
      ar: 'أمس زرت عمي في القرية',
      tip: 'نهاية ed في visited تُنطق (إد) بوضوح لأن الفعل ينتهي بحرف t.',
    },
    vocab: [
      { word: 'Yesterday', pos: 'Adv', ar: 'البارحة / أمس', phonetic: '/ˈjestərdeɪ/', example: 'I arrived yesterday.', exampleAr: 'وصلت بالأمس.' },
      { word: 'Came', pos: 'V', ar: 'جاء (ماضي come)', phonetic: '/keɪm/', example: 'My friend came early.', exampleAr: 'جاء صديقي مبكراً.' },
      { word: 'Found', pos: 'V', ar: 'وجد (ماضي find)', phonetic: '/faʊnd/', example: 'I found my lost key.', exampleAr: 'وجدت مفتاحي المفقود.' },
      { word: 'Village', pos: 'N', ar: 'قرية', phonetic: '/ˈvɪlɪdʒ/', example: 'The village air is fresh.', exampleAr: 'هواء القرية نقي.' },
      { word: 'Holiday', pos: 'N', ar: 'عطلة', phonetic: '/ˈhɑːlɪdeɪ/', example: 'We enjoyed our holiday.', exampleAr: 'استمتعنا بعطلتنا.' },
      { word: 'Arrive', pos: 'V', ar: 'يصل', phonetic: '/əˈraɪv/', example: 'Did the train arrive on time?', exampleAr: 'هل وصل القطار في الوقت المحدد؟' },
    ],
    grammarQ: {
      prompt: 'Did you ___ your homework yesterday?',
      promptAr: 'اختر شكل الفعل الصحيح بعد Did:',
      options: ['finish', 'finished', 'finishing', 'finishes'],
      answer: 'finish',
      explanation: 'عند وجود Did في السؤال يعود الفعل دائماً إلى صورته الأصلية (المصدر).',
    },
    orderQ: {
      promptAr: 'رتّب الكلمات لتكوين جملة في الماضي:',
      words: ['found', 'She', 'key', 'her', 'yesterday'],
      answer: 'She found her key yesterday',
      explanation: 'الفاعل She + الفعل الماضي found + المفعول به + الظرف الزمني.',
    },
    readingQ: {
      passage: 'Last Friday, Mona went to the museum with her aunt. They saw old coins and took photos.',
      question: 'مع من ذهبت منى إلى المتحف؟',
      options: ['مع عمتها / خالتها', 'مع أخيها', 'بمفردها', 'مع جارتها'],
      answer: 'مع عمتها / خالتها',
      explanation: 'النص يذكر with her aunt أي مع عمتها أو خالتها.',
    },
  },
  {
    id: 'A2-L6',
    levelId: 'A2',
    order: 6,
    title: 'الصحة والصيدلية والطقس',
    topic: 'Health, weather and seasons',
    grammarTitle: 'استخدام should / shouldn’t للنصيحة',
    explanation:
      'نستخدم should لإعطاء نصيحة إيجابية (ينبغي أن) وshouldn’t للنصيحة السلبية، ويأتي بعدها الفعل في المصدر مباشرة.',
    keyPoints: [
      'You should drink warm water = ينبغي أن تشرب ماءً دافئاً',
      'You shouldn’t go out in cold wind = لا ينبغي أن تخرج في البرد',
      'What’s the weather like? = كيف حال الطقس؟',
    ],
    pronunciation: {
      text: 'You should rest when you have a fever',
      ar: 'ينبغي أن ترتاح عندما تصاب بحمى',
      tip: 'حرف l في should صامت لا يُنطق (تُنطق شُد).',
    },
    vocab: [
      { word: 'Fever', pos: 'N', ar: 'حمى', phonetic: '/ˈfiːvər/', example: 'He has a mild fever.', exampleAr: 'لديه حمى خفيفة.' },
      { word: 'Headache', pos: 'N', ar: 'صداع', phonetic: '/ˈhedeɪk/', example: 'I have a headache today.', exampleAr: 'أشعر بصداع اليوم.' },
      { word: 'Medicine', pos: 'N', ar: 'دواء', phonetic: '/ˈmedɪsɪn/', example: 'Take your medicine after lunch.', exampleAr: 'خذ دواءك بعد الغداء.' },
      { word: 'Pharmacy', pos: 'N', ar: 'صيدلية', phonetic: '/ˈfɑːrməsi/', example: 'Buy vitamins from the pharmacy.', exampleAr: 'اشترِ الفيتامينات من الصيدلية.' },
      { word: 'Weather', pos: 'N', ar: 'الطقس', phonetic: '/ˈweðər/', example: 'The weather is sunny today.', exampleAr: 'الطقس مشمس اليوم.' },
      { word: 'Umbrella', pos: 'N', ar: 'مظلة', phonetic: '/ʌmˈbrelə/', example: 'Take an umbrella for the rain.', exampleAr: 'خذ مظلة للمطر.' },
    ],
    grammarQ: {
      prompt: 'You have a cough. You ___ drink cold drinks.',
      promptAr: 'اختر النصيحة المناسبة:',
      options: ['shouldn’t', 'should', 'are', 'have'],
      answer: 'shouldn’t',
      explanation: 'المصاب بالسعال لا ينبغي له شرب المشروبات الباردة، فنستخدم shouldn’t.',
    },
    orderQ: {
      promptAr: 'رتّب الكلمات لتكوين نصيحة صحية:',
      words: ['take', 'should', 'You', 'rest', 'some'],
      answer: 'You should take some rest',
      explanation: 'الفاعل You + should + الفعل take + المفعول به some rest.',
    },
    readingQ: {
      passage: 'In winter, the wind is cold. People wear coats and drink hot soup to stay healthy.',
      question: 'ماذا يشرب الناس في الشتاء ليبقوا بصحة جيدة؟',
      options: ['الحساء الساخن', 'العصير المثلج', 'الماء البارد', 'الآيسكريم'],
      answer: 'الحساء الساخن',
      explanation: 'النص يقول drink hot soup أي يشربون الحساء الساخن.',
    },
  },
  {
    id: 'A2-L7',
    levelId: 'A2',
    order: 7,
    title: 'الهوايات وخطط المستقبل',
    topic: 'Hobbies and future plans',
    grammarTitle: 'المستقبل القريب باستخدام be going to',
    explanation:
      'للتحدث عن خطط ونيّات مستقبلية قررناها مسبقاً نستخدم (am / is / are + going to + المصدر)، مثل: I am going to learn English.',
    keyPoints: [
      'I am going to travel next month = سأسافر الشهر القادم',
      'She is going to practice painting = ستتدرب على الرسم',
      'في وقت الفراغ: in my free time',
    ],
    pronunciation: {
      text: 'I am going to practice English every evening',
      ar: 'سوف أتدرب على الإنجليزية كل مساء',
      tip: 'اربط going to بنعومة واحرص على نطق حرف p في practice بوضوح.',
    },
    vocab: [
      { word: 'Hobby', pos: 'N', ar: 'هواية', phonetic: '/ˈhɑːbi/', example: 'Reading is my favorite hobby.', exampleAr: 'القراءة هي هوايتي المفضلة.' },
      { word: 'Practice', pos: 'V', ar: 'يتدرب', phonetic: '/ˈpræktɪs/', example: 'Practice makes you fluent.', exampleAr: 'التدريب يجعلك طلق اللسان.' },
      { word: 'Travel', pos: 'V', ar: 'يسافر', phonetic: '/ˈtrævəl/', example: 'We love to travel by train.', exampleAr: 'نحب السفر بالقطار.' },
      { word: 'Schedule', pos: 'N', ar: 'جدول مواعيد', phonetic: '/ˈskedʒuːl/', example: 'Check your study schedule.', exampleAr: 'راجع جدول دراستك.' },
      { word: 'Excited', pos: 'Adj', ar: 'متحمس', phonetic: '/ɪkˈsaɪtɪd/', example: 'I am excited about the trip.', exampleAr: 'أنا متحمس للرحلة.' },
      { word: 'Future', pos: 'N', ar: 'مستقبل', phonetic: '/ˈfjuːtʃər/', example: 'Words build your future.', exampleAr: 'الكلمات تبني مستقبلك.' },
    ],
    grammarQ: {
      prompt: 'They ___ going to visit their grandmother tomorrow.',
      promptAr: 'اختر الفعل المساعد المناسب للجمع:',
      options: ['are', 'is', 'am', 'will'],
      answer: 'are',
      explanation: 'الضمير They جمع لذلك يأخذ are مع going to.',
    },
    orderQ: {
      promptAr: 'رتّب الكلمات لتكوين جملة عن خطة مستقبلية:',
      words: ['going', 'We', 'to', 'are', 'study', 'tonight'],
      answer: 'We are going to study tonight',
      explanation: 'الفاعل We + are + going to + الفعل study + الظرف tonight.',
    },
    readingQ: {
      passage: 'Next weekend, Khalid is going to organize his study schedule and practice speaking with friends.',
      question: 'ما هي خطة خالد في عطلة نهاية الأسبوع؟',
      options: ['تنظيم جدوله والتدرب على التحدث', 'شراء سيارة جديدة', 'الذهاب للمستشفى', 'السفر بالطائرة'],
      answer: 'تنظيم جدوله والتدرب على التحدث',
      explanation: 'النص يذكر organize his study schedule and practice speaking.',
    },
  },
  {
    id: 'A2-L8',
    levelId: 'A2',
    order: 8,
    title: 'المحادثات اليومية واختصارات الرسائل',
    topic: 'Everyday expressions & text shortcuts',
    grammarTitle: 'الفرق بين اللغة الرسمية وغير الرسمية في المحادثة',
    explanation:
      'من جدول اختصارات الكلمات: في الرسائل النصية غير الرسمية يستخدم المتحدثون اختصارات مثل BTW (على فكرة) وBRB (سأعود قريباً) وNP (لا مشكلة)، لكننا نستخدم الكلمات الكاملة في الكتابة الرسمية.',
    keyPoints: [
      'BTW = By the way (على فكرة)',
      'BRB = Be right back (سأعود قريباً)',
      'NP = No problem (لا مشكلة) / IDK = I don’t know',
    ],
    pronunciation: {
      text: 'By the way, I am on my way now',
      ar: 'على فكرة، أنا في طريقي الآن',
      tip: 'انتبه لنطق th في the كالذال، وانطق way بمد لطيف.',
    },
    vocab: [
      { word: 'By the way', pos: 'Phrase', ar: 'على فكرة (BTW)', phonetic: '/baɪ ðə weɪ/', example: 'By the way, did you call him?', exampleAr: 'على فكرة، هل اتصلت به؟' },
      { word: 'Message', pos: 'N', ar: 'رسالة', phonetic: '/ˈmesɪdʒ/', example: 'Send me a quick message.', exampleAr: 'أرسل لي رسالة سريعة.' },
      { word: 'Reply', pos: 'V', ar: 'يرد', phonetic: '/rɪˈplaɪ/', example: 'Please reply soon.', exampleAr: 'يرجى الرد قريباً.' },
      { word: 'Actually', pos: 'Adv', ar: 'في الواقع', phonetic: '/ˈæktʃuəli/', example: 'Actually, I agree with you.', exampleAr: 'في الواقع، أنا أتفق معك.' },
      { word: 'Certainly', pos: 'Adv', ar: 'بالتأكيد', phonetic: '/ˈsɜːrtənli/', example: 'Certainly, I can assist you.', exampleAr: 'بالتأكيد، أستطيع مساعدتك.' },
      { word: 'Immediately', pos: 'Adv', ar: 'حالاً / فوراً', phonetic: '/ɪˈmiːdiətli/', example: 'Please check it immediately.', exampleAr: 'يرجى التحقق منه فوراً.' },
    ],
    grammarQ: {
      prompt: 'In formal emails, write "By the way" instead of ___.',
      promptAr: 'ما هو الاختصار غير الرسمي لعبارة By the way؟',
      options: ['BTW', 'BRB', 'NP', 'TYT'],
      answer: 'BTW',
      explanation: 'BTW هو اختصار الحروف الأولى لعبارة By the way.',
    },
    orderQ: {
      promptAr: 'رتّب الكلمات لتكوين جملة مهذبة:',
      words: ['can', 'Certainly,', 'I', 'you', 'help'],
      answer: 'Certainly, I can help you',
      explanation: 'نبدأ بـ Certainly, ثم الفاعل I ثم can ثم الفعل.',
    },
    readingQ: {
      passage: 'Aisha texted her friend: "Omw to the library! Ttyl." She prefers short chat expressions with close friends.',
      question: 'ماذا يعني اختصار Omw في رسالة عائشة؟',
      options: ['في طريقي (On my way)', 'لا أعرف', 'واجب منزلي', 'أراك غداً'],
      answer: 'في طريقي (On my way)',
      explanation: 'Omw اختصار لعبارة On my way أي أنا في طريقي.',
    },
  },

  // ==================== B1 (8 Lessons) ====================
  {
    id: 'B1-L1',
    levelId: 'B1',
    order: 1,
    title: 'العمل والمسؤولية والاجتماعات',
    topic: 'Work and professional life',
    grammarTitle: 'المضارع التام (Present Perfect) للخبرات والإنجازات',
    explanation:
      'نستخدم المضارع التام (have / has + التصريف الثالث) للتحدث عن خبراتنا أو أعمال أُنجزت دون تحديد وقت دقيق، مثل: I have finished the report.',
    keyPoints: [
      'have / has + Past Participle (V3)',
      'already (بالفعل) وrecently (حديثاً) شائعة مع هذا الزمن',
      'He has managed the team = لقد أدار الفريق',
    ],
    pronunciation: {
      text: 'The manager has arranged an important meeting',
      ar: 'رتّب المدير اجتماعاً مهماً',
      tip: 'حرف g في manager يُنطق (ج) معطّشة.',
    },
    vocab: [
      { word: 'Employee', pos: 'N', ar: 'موظف', phonetic: '/ɪmˈplɔɪiː/', example: 'Every employee received training.', exampleAr: 'تلقى كل موظف تدريباً.' },
      { word: 'Manage', pos: 'V', ar: 'يدير', phonetic: '/ˈmænɪdʒ/', example: 'She knows how to manage time.', exampleAr: 'تعرف كيف تدير الوقت.' },
      { word: 'Appointment', pos: 'N', ar: 'موعد', phonetic: '/əˈpɔɪntmənt/', example: 'I booked a morning appointment.', exampleAr: 'حجزت موعداً صباحياً.' },
      { word: 'Prepare', pos: 'V', ar: 'يحضر / يجهز', phonetic: '/prɪˈper/', example: 'Prepare your notes before the meeting.', exampleAr: 'جهّز ملاحظاتك قبل الاجتماع.' },
      { word: 'Recently', pos: 'Adv', ar: 'حديثاً / مؤخراً', phonetic: '/ˈriːsəntli/', example: 'We have recently opened a branch.', exampleAr: 'افتتحنا فرعاً مؤخراً.' },
      { word: 'Company', pos: 'N', ar: 'شركة', phonetic: '/ˈkʌmpəni/', example: 'The company values teamwork.', exampleAr: 'تقدّر الشركة العمل الجماعي.' },
    ],
    grammarQ: {
      prompt: 'She has ___ prepared the presentation.',
      promptAr: 'اختر الظرف المناسب مع المضارع التام:',
      options: ['already', 'yesterday', 'ago', 'tomorrow'],
      answer: 'already',
      explanation: 'كلمة already تأتي بين has والفعل في التصريف الثالث، بينما yesterday للماضي البسيط.',
    },
    orderQ: {
      promptAr: 'رتّب الكلمات لتكوين جملة بالمضارع التام:',
      words: ['finished', 'have', 'We', 'the', 'project'],
      answer: 'We have finished the project',
      explanation: 'الفاعل We + have + التصريف الثالث finished + المفعول به.',
    },
    readingQ: {
      passage: 'Nabil has worked as an accountant for five years. Recently, he started managing a new team of four employees.',
      question: 'منذ متى يعمل نبيل كمحاسب؟',
      options: ['منذ خمس سنوات', 'منذ شهرين', 'منذ الأمس', 'منذ عشر سنوات'],
      answer: 'منذ خمس سنوات',
      explanation: 'النص يذكر for five years أي لمدة خمس سنوات.',
    },
  },
  {
    id: 'B1-L2',
    levelId: 'B1',
    order: 2,
    title: 'التعليم والتطوير والنجاح',
    topic: 'Education and self-development',
    grammarTitle: 'استخدام المصدر (to + verb) و (verb + ing) بعد الأفعال',
    explanation:
      'بعض الأفعال مثل decide وhope وwant يتبعها (to + المصدر)، بينما أفعال مثل enjoy وfinish وavoid يتبعها الفعل مضافاً له (ing).',
    keyPoints: [
      'decide to study = يقرر أن يدرس',
      'enjoy learning = يستمتع بالتعلم',
      'succeed in + V-ing = ينجح في',
    ],
    pronunciation: {
      text: 'She decided to develop her speaking skills',
      ar: 'قررت تطوير مهارات التحدث لديها',
      tip: 'التشديد في develop يكون على المقطع الثاني (دي-فيل-وب).',
    },
    vocab: [
      { word: 'Develop', pos: 'V', ar: 'يطوّر', phonetic: '/dɪˈveləp/', example: 'Read daily to develop your fluency.', exampleAr: 'اقرأ يومياً لتطوير طلاقتك.' },
      { word: 'Decide', pos: 'V', ar: 'يقرر', phonetic: '/dɪˈsaɪd/', example: 'They decided to join the course.', exampleAr: 'قرروا الانضمام للدورة.' },
      { word: 'Succeed', pos: 'V', ar: 'ينجح', phonetic: '/səkˈsiːd/', example: 'Hard work helps you succeed.', exampleAr: 'العمل الجاد يساعدك على النجاح.' },
      { word: 'Research', pos: 'N', ar: 'بحث', phonetic: '/ˈriːsɜːrtʃ/', example: 'She wrote a useful research paper.', exampleAr: 'كتبت ورقة بحثية مفيدة.' },
      { word: 'Skill', pos: 'N', ar: 'مهارة', phonetic: '/skɪl/', example: 'Listening is an essential skill.', exampleAr: 'الاستماع مهارة أساسية.' },
      { word: 'University', pos: 'N', ar: 'جامعة', phonetic: '/ˌjuːnɪˈvɜːrsəti/', example: 'He graduated from university.', exampleAr: 'تخرج من الجامعة.' },
    ],
    grammarQ: {
      prompt: 'I really enjoy ___ new English vocabulary every morning.',
      promptAr: 'اختر الصيغة الصحيحة بعد الفعل enjoy:',
      options: ['learning', 'learn', 'to learn', 'learned'],
      answer: 'learning',
      explanation: 'الفعل enjoy يتبعه دائماً الفعل مضافاً إليه ing.',
    },
    orderQ: {
      promptAr: 'رتّب الكلمات لتكوين جملة صحيحة:',
      words: ['decided', 'He', 'study', 'to', 'medicine'],
      answer: 'He decided to study medicine',
      explanation: 'الفعل decided يتبعه to ثم المصدر study.',
    },
    readingQ: {
      passage: 'Students who revise their notes regularly usually understand complex subjects much faster.',
      question: 'ما الذي يساعد الطلاب على فهم المواد المعقدة أسرع؟',
      options: ['مراجعة ملاحظاتهم بانتظام', 'تجاهل التمارين', 'الدراسة ليلة الامتحان فقط', 'النوم المتأخر'],
      answer: 'مراجعة ملاحظاتهم بانتظام',
      explanation: 'النص يذكر revise their notes regularly أي مراجعة الملاحظات بانتظام.',
    },
  },
  {
    id: 'B1-L3',
    levelId: 'B1',
    order: 3,
    title: 'التسوق الذكي وجودة الخدمات',
    topic: 'Shopping and customer service',
    grammarTitle: 'المبني للمجهول البسيط (Passive Voice) في المضارع والماضي',
    explanation:
      'نستخدم المبني للمجهول عندما يكون الفعل أهم من الفاعل: (am/is/are/was/were + التصريف الثالث)، مثل: The package was delivered today.',
    keyPoints: [
      'is made of = مصنوع من',
      'was delivered = تم توصيله',
      'guarantee + receipt = ضمان + إيصال',
    ],
    pronunciation: {
      text: 'Please keep your receipt for the guarantee',
      ar: 'يرجى الاحتفاظ بالإيصال للضمان',
      tip: 'حرف p في كلمة receipt صامت لا يُنطق (تُنطق رِسيت).',
    },
    vocab: [
      { word: 'Customer', pos: 'N', ar: 'زبون', phonetic: '/ˈkʌstəmər/', example: 'The customer asked for a receipt.', exampleAr: 'طلب الزبون إيصالاً.' },
      { word: 'Quality', pos: 'N', ar: 'جودة', phonetic: '/ˈkwɑːləti/', example: 'This fabric has high quality.', exampleAr: 'هذا القماش ذو جودة عالية.' },
      { word: 'Receipt', pos: 'N', ar: 'إيصال / فاتورة', phonetic: '/rɪˈsiːt/', example: 'Show the receipt to exchange items.', exampleAr: 'أظهر الإيصال لاستبدال الأغراض.' },
      { word: 'Deliver', pos: 'V', ar: 'يوصّل', phonetic: '/dɪˈlɪvər/', example: 'They deliver orders within two days.', exampleAr: 'يوصلون الطلبات خلال يومين.' },
      { word: 'Replace', pos: 'V', ar: 'يستبدل', phonetic: '/rɪˈpleɪs/', example: 'Can I replace this broken charger?', exampleAr: 'هل يمكنني استبدال هذا الشاحن المكسور؟' },
      { word: 'Guarantee', pos: 'N', ar: 'ضمان', phonetic: '/ˌɡærənˈtiː/', example: 'The phone comes with a one-year guarantee.', exampleAr: 'الهاتف يأتي بضمان سنة واحدة.' },
    ],
    grammarQ: {
      prompt: 'All online orders ___ delivered within 24 hours.',
      promptAr: 'أكمل صيغة المبني للمجهول للجمع:',
      options: ['are', 'is', 'has', 'did'],
      answer: 'are',
      explanation: 'الفاعل orders جمع في الحقيقة العامة، فنستخدم are + delivered.',
    },
    orderQ: {
      promptAr: 'رتّب الكلمات لتكوين جملة عن التسوق:',
      words: ['was', 'delivered', 'The', 'package', 'early'],
      answer: 'The package was delivered early',
      explanation: 'المفعول به يصبح فاعلاً The package + was delivered + early.',
    },
    readingQ: {
      passage: 'If an item has a flaw, customers can replace it within fourteen days by showing their original receipt.',
      question: 'ما الشرط لاستبدال المنتج المعيب خلال 14 يوماً؟',
      options: ['إظهار الإيصال الأصلي', 'دفع غرامة مالية', 'الانتظار شهراً كاملاً', 'شراء منتج آخر'],
      answer: 'إظهار الإيصال الأصلي',
      explanation: 'النص يقول by showing their original receipt.',
    },
  },
  {
    id: 'B1-L4',
    levelId: 'B1',
    order: 4,
    title: 'التقنية والإنترنت والبرمجيات',
    topic: 'Technology and online safety',
    grammarTitle: 'الجملة الشرطية الأولى (First Conditional: If + Present, will)',
    explanation:
      'نستخدم الشرط الأول للحديث عن نتائج محتملة في المستقبل: إذا حدث الشرط في المضارع البسيط، فستحدث النتيجة باستخدام will + المصدر.',
    keyPoints: [
      'If you use a strong password, your account will be safe.',
      'never share personal passwords = لا تشارك كلمات المرور',
      'download / upload = تنزيل / رفع',
    ],
    pronunciation: {
      text: 'If you update the software, it will run faster',
      ar: 'إذا حدّثت البرمجيات، فستعمل بشكل أسرع',
      tip: 'انطق t في software بنعومة، وركز على تشديد fast في faster.',
    },
    vocab: [
      { word: 'Password', pos: 'N', ar: 'كلمة السر', phonetic: '/ˈpæswɜːrd/', example: 'Never share your password.', exampleAr: 'لا تشارك كلمة سرك أبداً.' },
      { word: 'Software', pos: 'N', ar: 'برمجيات', phonetic: '/ˈsɔːftwer/', example: 'Install the latest software update.', exampleAr: 'ثبّت أحدث تحديث للبرمجيات.' },
      { word: 'Download', pos: 'V', ar: 'ينزّل / يحمّل', phonetic: '/ˈdaʊnloʊd/', example: 'Download lessons for offline study.', exampleAr: 'حمّل الدروس للدراسة بدون نت.' },
      { word: 'Website', pos: 'N', ar: 'موقع إلكتروني', phonetic: '/ˈwebsaɪt/', example: 'This website teaches English well.', exampleAr: 'هذا الموقع يعلم الإنجليزية جيداً.' },
      { word: 'Solution', pos: 'N', ar: 'حل', phonetic: '/səˈluːʃən/', example: 'We found a smart solution.', exampleAr: 'وجدنا حلاً ذكياً.' },
      { word: 'Complicated', pos: 'Adj', ar: 'معقّد', phonetic: '/ˈkɑːmplɪkeɪtɪd/', example: 'The settings are not complicated.', exampleAr: 'الإعدادات ليست معقدة.' },
    ],
    grammarQ: {
      prompt: 'If you download this level, you ___ study offline anytime.',
      promptAr: 'اختر جواب الشرط الصحيح:',
      options: ['will', 'would', 'did', 'were'],
      answer: 'will',
      explanation: 'مع الشرط الأول (فعل الشرط مضارع download) نستخدم will في جواب الشرط.',
    },
    orderQ: {
      promptAr: 'رتّب الكلمات لتكوين جملة شرطية:',
      words: ['will', 'it', 'You', 'find', 'useful'],
      answer: 'You will find it useful',
      explanation: 'الفاعل You + will + الفعل find + it useful.',
    },
    readingQ: {
      passage: 'Online learning platforms allow students in remote areas to download lessons and practice even with weak internet.',
      question: 'ما الفائدة التي تقدمها منصات التعلم للمناطق ذات الإنترنت الضعيف؟',
      options: ['تحميل الدروس والتدرب دون انقطاع', 'شراء أجهزة جديدة', 'إغلاق الحسابات', 'منع الاختبارات'],
      answer: 'تحميل الدروس والتدرب دون انقطاع',
      explanation: 'النص يذكر download lessons and practice even with weak internet.',
    },
  },
  {
    id: 'B1-L5',
    levelId: 'B1',
    order: 5,
    title: 'المجتمع والقانون والتعاون',
    topic: 'Community and shared responsibility',
    grammarTitle: 'أفعال الإلزام (Must / Have to)',
    explanation:
      'نستخدم must للتعبير عن التزام شخصي أو قاعدة صارمة، وhave to لالتزام خارجي أو قانوني. وفي النفي mustn’t تعني ممنوع، أما don’t have to فتعني غير ضروري.',
    keyPoints: [
      'must = يجب (إلزام قوي)',
      'mustn’t = ممنوع تماماً',
      'don’t have to = لست مضطراً (اختياري)',
    ],
    pronunciation: {
      text: 'Everyone must respect traffic rules',
      ar: 'يجب على الجميع احترام قواعد المرور',
      tip: 'حرف t الأول في mustn’t صامت، بينما في must يُنطق بوضوح قبل respect.',
    },
    vocab: [
      { word: 'Law', pos: 'N', ar: 'قانون', phonetic: '/lɔː/', example: 'The law protects citizens.', exampleAr: 'القانون يحمي المواطنين.' },
      { word: 'Support', pos: 'V', ar: 'يدعم', phonetic: '/səˈpɔːrt/', example: 'Neighbors support each other.', exampleAr: 'الجيران يدعمون بعضهم.' },
      { word: 'Respect', pos: 'V', ar: 'يحترم', phonetic: '/rɪˈspekt/', example: 'Always respect other opinions.', exampleAr: 'احترم آراء الآخرين دائماً.' },
      { word: 'Majority', pos: 'N', ar: 'أغلبية', phonetic: '/məˈdʒɔːrəti/', example: 'The majority voted yes.', exampleAr: 'الأغلبية صوتت بنعم.' },
      { word: 'Neighbor', pos: 'N', ar: 'جار', phonetic: '/ˈneɪbər/', example: 'Our neighbor is very helpful.', exampleAr: 'جارنا متعاون جداً.' },
      { word: 'Necessary', pos: 'Adj', ar: 'ضروري', phonetic: '/ˈnesəseri/', example: 'Clean water is necessary for life.', exampleAr: 'الماء النظيف ضروري للحياة.' },
    ],
    grammarQ: {
      prompt: 'You ___ drive fast near a primary school; it is dangerous.',
      promptAr: 'اختر أداة المنع المناسبة:',
      options: ['mustn’t', 'don’t have to', 'can', 'should'],
      answer: 'mustn’t',
      explanation: 'القيادة السريعة قرب المدرسة ممنوعة وخطيرة فنستخدم mustn’t.',
    },
    orderQ: {
      promptAr: 'رتّب الكلمات لتكوين جملة عن القواعد:',
      words: ['must', 'We', 'the', 'follow', 'rules'],
      answer: 'We must follow the rules',
      explanation: 'الفاعل We + must + الفعل follow + المفعول به the rules.',
    },
    readingQ: {
      passage: 'A strong community grows when neighbors support each other and respect shared public spaces like parks and libraries.',
      question: 'متى ينمو المجتمع القوي حسب النص؟',
      options: ['عندما يدعم الجيران بعضهم ويحترمون المرافق العامة', 'عندما يتجاهل الناس القوانين', 'عندما تغلق المكتبات', 'عندما يعيش الجميع بعيداً'],
      answer: 'عندما يدعم الجيران بعضهم ويحترمون المرافق العامة',
      explanation: 'النص يوضح أن التعاون بين الجيران واحترام المرافق أساس المجتمع القوي.',
    },
  },
  {
    id: 'B1-L6',
    levelId: 'B1',
    order: 6,
    title: 'الرحلات والتجارب الثقافية',
    topic: 'Travel experiences and culture',
    grammarTitle: 'الماضي المستمر (Past Continuous) مع while و when',
    explanation:
      'نستخدم الماضي المستمر (was / were + V-ing) لوصف حدث كان مستمراً في الماضي عندما قطعه حدث آخر قصير بالماضي البسيط.',
    keyPoints: [
      'While I was walking, I met my friend.',
      'was مع المفرد (I, He, She, It) وwere مع الجمع (We, You, They)',
      'customs = تقاليد / tourist = سائح',
    ],
    pronunciation: {
      text: 'While we were traveling, we met friendly tourists',
      ar: 'بينما كنا نسافر، التقينا بسياح ودودين',
      tip: 'حرف h في While صامت في أغلب اللهجات؛ انطقها وايل.',
    },
    vocab: [
      { word: 'Tourist', pos: 'N', ar: 'سائح', phonetic: '/ˈtʊrɪst/', example: 'Many tourists visit the pyramids.', exampleAr: 'كثير من السياح يزورون الأهرامات.' },
      { word: 'Customs', pos: 'N', ar: 'تقاليد / عادات', phonetic: '/ˈkʌstəmz/', example: 'Every country has unique customs.', exampleAr: 'لكل بلد تقاليده الفريدة.' },
      { word: 'Opportunity', pos: 'N', ar: 'فرصة', phonetic: '/ˌɑːpərˈtuːnəti/', example: 'Travel is a great learning opportunity.', exampleAr: 'السفر فرصة رائعة للتعلم.' },
      { word: 'Foreign', pos: 'Adj', ar: 'أجنبي', phonetic: '/ˈfɔːrən/', example: 'Learning a foreign language opens doors.', exampleAr: 'تعلم لغة أجنبية يفتح الأبواب.' },
      { word: 'Reserve', pos: 'V', ar: 'يحجز', phonetic: '/rɪˈzɜːrv/', example: 'Reserve a hotel room early.', exampleAr: 'احجز غرفة فندق مبكراً.' },
      { word: 'Continent', pos: 'N', ar: 'قارة', phonetic: '/ˈkɑːntɪnənt/', example: 'Africa is a rich continent.', exampleAr: 'أفريقيا قارة غنية.' },
    ],
    grammarQ: {
      prompt: 'While I ___ waiting at the station, the train arrived.',
      promptAr: 'اختر الفعل المساعد المناسب للماضي المستمر:',
      options: ['was', 'were', 'am', 'did'],
      answer: 'was',
      explanation: 'الضمير I يأخذ was في الماضي المستمر.',
    },
    orderQ: {
      promptAr: 'رتّب الكلمات لتكوين جملة عن السفر:',
      words: ['were', 'They', 'in', 'exploring', 'the', 'museum'],
      answer: 'They were exploring in the museum',
      explanation: 'الفاعل They + were + exploring + المكان.',
    },
    readingQ: {
      passage: 'During their trip to Meroe, the students learned about ancient Sudanese history and hospitable local customs.',
      question: 'ماذا تعلّم الطلاب خلال رحلتهم إلى مروي؟',
      options: ['التاريخ السوداني القديم والعادات المضيافة', 'صناعة السفن الحديثة', 'اللغة اليابانية', 'قوانين كرة السلة'],
      answer: 'التاريخ السوداني القديم والعادات المضيافة',
      explanation: 'النص يذكر ancient Sudanese history and hospitable local customs.',
    },
  },
  {
    id: 'B1-L7',
    levelId: 'B1',
    order: 7,
    title: 'حل المشكلات واتخاذ القرار',
    topic: 'Problem solving and opinions',
    grammarTitle: 'الروابط المنطقية (Although / Because / Therefore)',
    explanation:
      'لربط الأفكار نستخدم because لبيان السبب، وalthough للتناقض (بالرغم من)، وtherefore للنتيجة (لذلك).',
    keyPoints: [
      'because + سبب (لأن)',
      'although + جملة تناقض (بالرغم من)',
      'Consider all options = ضع كل الخيارات في الاعتبار',
    ],
    pronunciation: {
      text: 'Although the task was difficult, we found a solution',
      ar: 'بالرغم من أن المهمة كانت صعبة، وجدنا حلاً',
      tip: 'الحرفان gh في Although صامتان (أول-ذو).',
    },
    vocab: [
      { word: 'Consider', pos: 'V', ar: 'يأخذ بعين الاعتبار', phonetic: '/kənˈsɪdər/', example: 'Consider the cost before deciding.', exampleAr: 'ضع التكلفة في الاعتبار قبل القرار.' },
      { word: 'Suggest', pos: 'V', ar: 'يقترح', phonetic: '/səˈdʒest/', example: 'I suggest we start early.', exampleAr: 'أقترح أن نبدأ مبكراً.' },
      { word: 'Mistake', pos: 'N', ar: 'خطأ / غلطة', phonetic: '/mɪˈsteɪk/', example: 'Every mistake teaches us something.', exampleAr: 'كل خطأ يعلمنا شيئاً.' },
      { word: 'Effort', pos: 'N', ar: 'مجهود', phonetic: '/ˈefərt/', example: 'Success requires steady effort.', exampleAr: 'النجاح يتطلب مجهوداً مستمراً.' },
      { word: 'Serious', pos: 'Adj', ar: 'جاد / خطير', phonetic: '/ˈsɪriəs/', example: 'We need a serious plan.', exampleAr: 'نحتاج خطة جادة.' },
      { word: 'Result', pos: 'N', ar: 'نتيجة', phonetic: '/rɪˈzʌlt/', example: 'Great effort brings good results.', exampleAr: 'المجهود الكبير يأتي بنتائج طيبة.' },
    ],
    grammarQ: {
      prompt: 'We stayed inside ___ the sandstorm was strong.',
      promptAr: 'اختر الرابط السببي الصحيح:',
      options: ['because', 'although', 'unless', 'whereas'],
      answer: 'because',
      explanation: 'العاصفة الرملية هي السبب في البقاء بالداخل، فنستخدم because.',
    },
    orderQ: {
      promptAr: 'رتّب الكلمات لتكوين اقتراح واضح:',
      words: ['we', 'I', 'suggest', 'again', 'try'],
      answer: 'I suggest we try again',
      explanation: 'الفاعل I + الفعل suggest + الجملة المقترحة we try again.',
    },
    readingQ: {
      passage: 'When facing a difficult problem, do not panic. Analyze the mistake, ask for advice, and test one step at a time.',
      question: 'ما هي الخطوة الأولى الموصى بها عند مواجهة مشكلة صعبة؟',
      options: ['عدم الذعر وتحليل الخطأ', 'ترك العمل نهائياً', 'إلقاء اللوم على الآخرين', 'الاستسلام فوراً'],
      answer: 'عدم الذعر وتحليل الخطأ',
      explanation: 'النص ينصح بـ do not panic ثم analyze the mistake.',
    },
  },
  {
    id: 'B1-L8',
    levelId: 'B1',
    order: 8,
    title: 'الإعلام والمعلومات والثقة بالنفس',
    topic: 'Media, facts and confidence',
    grammarTitle: 'الكلام المنقول (Reported Speech) البسيط',
    explanation:
      'عند نقل كلام شخص آخر باستخدام said that أو told me that، نرجع زمن الفعل خطوة للماضي عادةً (is -> was, can -> could) ونغيّر الضمائر حسب المتحدث.',
    keyPoints: [
      'He said, "I am ready." -> He said that he was ready.',
      'tell + شخص + that (told me that)',
      'say + that (said that)',
    ],
    pronunciation: {
      text: 'The expert explained that practice improves fluency',
      ar: 'أوضح الخبير أن التدريب يحسّن الطلاقة',
      tip: 'اربط الكلمات بنبرة واثقة وشدّد على fluency.',
    },
    vocab: [
      { word: 'Fact', pos: 'N', ar: 'حقيقة', phonetic: '/fækt/', example: 'Check the facts before sharing news.', exampleAr: 'تحقق من الحقائق قبل نشر الأخبار.' },
      { word: 'Expert', pos: 'N', ar: 'خبير', phonetic: '/ˈekspɜːrt/', example: 'Ask an expert for guidance.', exampleAr: 'اسأل خبيراً للإرشاد.' },
      { word: 'Fluent', pos: 'Adj', ar: 'طلق اللسان', phonetic: '/ˈfluːənt/', example: 'She is fluent in Arabic and English.', exampleAr: 'هي طلقة في العربية والإنجليزية.' },
      { word: 'Improve', pos: 'V', ar: 'يحسّن / يتحسن', phonetic: '/ɪmˈpruːv/', example: 'Your pronunciation will improve fast.', exampleAr: 'سيتحسن نطقك بسرعة.' },
      { word: 'Newspaper', pos: 'N', ar: 'جريدة', phonetic: '/ˈnuːzpeɪpər/', example: 'He reads the morning newspaper.', exampleAr: 'يقرأ الجريدة الصباحية.' },
      { word: 'Introduce', pos: 'V', ar: 'يقدّم', phonetic: '/ˌɪntrəˈduːs/', example: 'Let me introduce the next speaker.', exampleAr: 'دعني أقدّم المتحدث التالي.' },
    ],
    grammarQ: {
      prompt: 'Sara told me that she ___ studying for the B1 exam.',
      promptAr: 'اختر الفعل المناسب في الكلام المنقول:',
      options: ['was', 'is', 'will', 'are'],
      answer: 'was',
      explanation: 'في الكلام المنقول بعد told me that نستخدم الماضي was.',
    },
    orderQ: {
      promptAr: 'رتّب الكلمات لتكوين جملة عن الطلاقة:',
      words: ['improves', 'Daily', 'your', 'practice', 'fluency'],
      answer: 'Daily practice improves your fluency',
      explanation: 'الفاعل المركب Daily practice + الفعل improves + المفعول به.',
    },
    readingQ: {
      passage: 'Reading short articles every day builds confidence. When learners recognize common words, they speak more smoothly.',
      question: 'ما أثر قراءة المقالات القصيرة يومياً؟',
      options: ['تبني الثقة وتحسن سلاسة التحدث', 'تزيد الملل', 'تقلل المفردات', 'تمنع الاستماع'],
      answer: 'تبني الثقة وتحسن سلاسة التحدث',
      explanation: 'النص يذكر builds confidence وspeak more smoothly.',
    },
  },
];
