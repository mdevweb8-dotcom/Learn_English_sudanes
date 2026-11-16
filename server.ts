import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const portArgIdx = process.argv.indexOf('--port');
const cliPort = portArgIdx >= 0 ? Number(process.argv[portArgIdx + 1]) : NaN;
const envPort =
  process.env.PORT && process.env.PORT !== process.env.NGINX_PORT
    ? Number(process.env.PORT)
    : 3000;
const PORT = Number.isFinite(cliPort) && cliPort > 0 ? cliPort : envPort;

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

interface ServerQuestion {
  id: string;
  lesson_id: string;
  level_id: string;
  skill_tag: 'vocab' | 'grammar' | 'sentence_building' | 'reading';
  type: 'mcq' | 'tf' | 'order';
  prompt: string;
  promptAr?: string;
  audioText?: string;
  options?: string[];
  wordsToOrder?: string[];
  answer: string;
  explanation: string;
}

const MULTIPLAYER_BANK: Record<string, ServerQuestion[]> = {
  A1: [
    {
      id: 'MP-A1-1',
      lesson_id: 'A1-L1',
      level_id: 'A1',
      skill_tag: 'vocab',
      type: 'mcq',
      prompt: 'Good morning',
      promptAr: 'اختر المعنى العربي الصحيح:',
      audioText: 'Good morning',
      options: ['صباح الخير', 'تصبح على خير', 'مع السلامة', 'شكراً لك'],
      answer: 'صباح الخير',
      explanation: 'Good morning تعني صباح الخير.',
    },
    {
      id: 'MP-A1-2',
      lesson_id: 'A1-L2',
      level_id: 'A1',
      skill_tag: 'grammar',
      type: 'mcq',
      prompt: 'She ____ a diligent student.',
      promptAr: 'أكمل الجملة بالفعل المساعد الصحيح:',
      options: ['is', 'are', 'am', 'be'],
      answer: 'is',
      explanation: 'الضمير She يأخذ الفعل المساعد is.',
    },
    {
      id: 'MP-A1-3',
      lesson_id: 'A1-L3',
      level_id: 'A1',
      skill_tag: 'vocab',
      type: 'tf',
      prompt: 'هل معنى "Library" هو "مكتبة"؟',
      promptAr: 'صح أم خطأ:',
      audioText: 'Library',
      options: ['صح', 'خطأ'],
      answer: 'صح',
      explanation: 'Library تعني مكتبة للقراءة واستعارة الكتب.',
    },
    {
      id: 'MP-A1-4',
      lesson_id: 'A1-L4',
      level_id: 'A1',
      skill_tag: 'sentence_building',
      type: 'order',
      prompt: 'رتب الكلمات: أنا أذهب إلى المدرسة كل يوم',
      promptAr: 'اضغط الكلمات بالترتيب الصحيح:',
      wordsToOrder: ['go', 'I', 'every', 'to', 'school', 'day'],
      answer: 'I go to school every day',
      explanation: 'الفاعل I يليه الفعل go ثم المكان والزمان.',
    },
    {
      id: 'MP-A1-5',
      lesson_id: 'A1-L5',
      level_id: 'A1',
      skill_tag: 'vocab',
      type: 'mcq',
      prompt: 'Breakfast',
      promptAr: 'اختر المعنى الصحيح:',
      audioText: 'Breakfast',
      options: ['وجبة الإفطار', 'وجبة العشاء', 'مشروب بارد', 'سوق الطعام'],
      answer: 'وجبة الإفطار',
      explanation: 'Breakfast تعني وجبة الفطور في الصباح.',
    },
    {
      id: 'MP-A1-6',
      lesson_id: 'A1-L6',
      level_id: 'A1',
      skill_tag: 'grammar',
      type: 'mcq',
      prompt: 'They ____ playing football now.',
      promptAr: 'اختر الصيغة الصحيحة للمضارع المستمر:',
      options: ['are', 'is', 'am', 'was'],
      answer: 'are',
      explanation: 'الضمير الجمع They يأخذ are.',
    },
    {
      id: 'MP-A1-7',
      lesson_id: 'A1-L7',
      level_id: 'A1',
      skill_tag: 'vocab',
      type: 'mcq',
      prompt: 'Friendly',
      promptAr: 'ما معنى هذه الصفة؟',
      audioText: 'Friendly',
      options: ['ودود', 'غاضب', 'بطيء', 'بعيد'],
      answer: 'ودود',
      explanation: 'Friendly تعني شخص لطيف وودود.',
    },
    {
      id: 'MP-A1-8',
      lesson_id: 'A1-L8',
      level_id: 'A1',
      skill_tag: 'reading',
      type: 'mcq',
      prompt: 'Ali wakes up at 6 AM. He drinks tea and reads a book before work.',
      promptAr: 'ماذا يفعل علي قبل العمل؟',
      options: ['يشرب الشاي ويقرأ كتاباً', 'ينام حتى الظهر', 'يلعب كرة القدم', 'يسافر بالقطار'],
      answer: 'يشرب الشاي ويقرأ كتاباً',
      explanation: 'النص يذكر بوضوح أنه يشرب الشاي ويقرأ كتاباً.',
    },
    {
      id: 'MP-A1-9',
      lesson_id: 'A1-L8',
      level_id: 'A1',
      skill_tag: 'vocab',
      type: 'tf',
      prompt: 'هل معنى "Journey" هو "مطبخ"؟',
      promptAr: 'صح أم خطأ:',
      audioText: 'Journey',
      options: ['صح', 'خطأ'],
      answer: 'خطأ',
      explanation: 'Journey تعني رحلة، بينما مطبخ يعني Kitchen.',
    },
    {
      id: 'MP-A1-10',
      lesson_id: 'A1-L8',
      level_id: 'A1',
      skill_tag: 'sentence_building',
      type: 'order',
      prompt: 'رتب الكلمات: الطقس جميل اليوم',
      promptAr: 'اضغط الكلمات بالترتيب الصحيح:',
      wordsToOrder: ['is', 'The', 'today', 'weather', 'nice'],
      answer: 'The weather is nice today',
      explanation: 'The weather is nice today جملة اسمية صحيحة.',
    },
  ],
  A2: [
    {
      id: 'MP-A2-1',
      lesson_id: 'A2-L1',
      level_id: 'A2',
      skill_tag: 'grammar',
      type: 'mcq',
      prompt: 'Yesterday, we ____ our grandparents.',
      promptAr: 'اختر الفعل الماضي الصحيح:',
      options: ['visited', 'visit', 'visiting', 'will visit'],
      answer: 'visited',
      explanation: 'كلمة Yesterday تدل على الماضي البسيط.',
    },
    {
      id: 'MP-A2-2',
      lesson_id: 'A2-L2',
      level_id: 'A2',
      skill_tag: 'vocab',
      type: 'mcq',
      prompt: 'Healthy',
      promptAr: 'اختر المعنى العربي الصحيح:',
      audioText: 'Healthy',
      options: ['صحي', 'مريض', 'مكلف', 'صعب'],
      answer: 'صحي',
      explanation: 'Healthy تعني صحي ومفيد للجسم.',
    },
    {
      id: 'MP-A2-3',
      lesson_id: 'A2-L3',
      level_id: 'A2',
      skill_tag: 'grammar',
      type: 'mcq',
      prompt: 'This book is ____ than that one.',
      promptAr: 'اختر صيغة المقارنة الصحيحة:',
      options: ['more interesting', 'most interesting', 'interesting', 'interestinger'],
      answer: 'more interesting',
      explanation: 'الصفة الطويلة تأخذ more ... than في المقارنة.',
    },
    {
      id: 'MP-A2-4',
      lesson_id: 'A2-L4',
      level_id: 'A2',
      skill_tag: 'sentence_building',
      type: 'order',
      prompt: 'رتب الكلمات: أستطيع التحدث بالإنجليزية جيداً',
      promptAr: 'كوّن الجملة الصحيحة:',
      wordsToOrder: ['speak', 'I', 'well', 'can', 'English'],
      answer: 'I can speak English well',
      explanation: 'can يتبعها الفعل في المصدر speak.',
    },
    {
      id: 'MP-A2-5',
      lesson_id: 'A2-L5',
      level_id: 'A2',
      skill_tag: 'vocab',
      type: 'mcq',
      prompt: 'Appointment',
      promptAr: 'ما معنى هذه الكلمة؟',
      audioText: 'Appointment',
      options: ['موعد محدد', 'إجازة طويلة', 'وجبة خفيفة', 'هاتف ذكي'],
      answer: 'موعد محدد',
      explanation: 'Appointment تعني موعد مثل موعد طبيب أو اجتماع.',
    },
    {
      id: 'MP-A2-6',
      lesson_id: 'A2-L6',
      level_id: 'A2',
      skill_tag: 'vocab',
      type: 'tf',
      prompt: 'هل معنى "Improve" هو "يحسّن أو يطوّر"؟',
      promptAr: 'صح أم خطأ:',
      audioText: 'Improve',
      options: ['صح', 'خطأ'],
      answer: 'صح',
      explanation: 'Improve تعني يحسّن أو يطور.',
    },
    {
      id: 'MP-A2-7',
      lesson_id: 'A2-L7',
      level_id: 'A2',
      skill_tag: 'grammar',
      type: 'mcq',
      prompt: 'We are going to ____ a new project next week.',
      promptAr: 'اختر الفعل المناسب بعد going to:',
      options: ['start', 'started', 'starting', 'starts'],
      answer: 'start',
      explanation: 'بعد going to يأتي الفعل في المصدر دائماً.',
    },
    {
      id: 'MP-A2-8',
      lesson_id: 'A2-L8',
      level_id: 'A2',
      skill_tag: 'reading',
      type: 'mcq',
      prompt: 'Sara saves money every month because she plans to travel next summer.',
      promptAr: 'لماذا تدخر سارة المال؟',
      options: ['لأنها تخطط للسفر الصيف القادم', 'لشراء هاتف فقط', 'لأنها لا تحب العمل', 'لتدفع غرامة'],
      answer: 'لأنها تخطط للسفر الصيف القادم',
      explanation: 'النص يذكر she plans to travel next summer.',
    },
    {
      id: 'MP-A2-9',
      lesson_id: 'A2-L8',
      level_id: 'A2',
      skill_tag: 'vocab',
      type: 'mcq',
      prompt: 'Experience',
      promptAr: 'اختر المعنى الصحيح:',
      audioText: 'Experience',
      options: ['خبرة أو تجربة', 'تذكرة سفر', 'مشكلة طارئة', 'شهادة ميلاد'],
      answer: 'خبرة أو تجربة',
      explanation: 'Experience تعني خبرة عملية أو تجربة.',
    },
    {
      id: 'MP-A2-10',
      lesson_id: 'A2-L8',
      level_id: 'A2',
      skill_tag: 'sentence_building',
      type: 'order',
      prompt: 'رتب الكلمات: هل تحب شرب القهوة؟',
      promptAr: 'كوّن السؤال الصحيح:',
      wordsToOrder: ['you', 'Do', 'coffee', 'like', 'drinking'],
      answer: 'Do you like drinking coffee',
      explanation: 'السؤال في المضارع البسيط يبدأ بـ Do.',
    },
  ],
};

function getQuestionsForLevel(levelId: string): ServerQuestion[] {
  const base = MULTIPLAYER_BANK[levelId] || MULTIPLAYER_BANK.A1;
  const extra = levelId === 'A1' ? MULTIPLAYER_BANK.A2 : MULTIPLAYER_BANK.A1;
  const combined = [...base];
  for (const q of extra) {
    if (combined.length >= 10) break;
    if (!combined.some((x) => x.id === q.id)) combined.push(q);
  }
  return combined.slice(0, 10).sort(() => Math.random() - 0.5);
}

const BAD_WORDS = [
  'idiot',
  'stupid',
  'dumb',
  'shut up',
  'loser',
  'fool',
  'fuck',
  'shit',
  'bitch',
  'asshole',
  'bastard',
  'crap',
  'damn',
  'wtf',
  'حمار',
  'غبي',
  'تافه',
  'كلب',
  'أحمق',
  'حقير',
  'وسخ',
  'قذر',
  'لعنة',
  'عاهر',
  'شرموط',
];

function filterProfanity(input: string): string {
  let text = input.trim().slice(0, 200);
  for (const bad of BAD_WORDS) {
    const escaped = bad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(escaped, 'gi'), '***');
  }
  return text;
}

function normalizeIp(req: http.IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  const raw =
    (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') ||
    req.socket.remoteAddress ||
    'local';
  if (raw === '::1' || raw === '127.0.0.1' || raw === '::ffff:127.0.0.1') {
    return 'local-wifi-lan';
  }
  const clean = raw.replace(/^::ffff:/, '');
  // Group IPv4 devices on same /24 LAN subnet
  if (/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(clean)) {
    const parts = clean.split('.');
    return `lan-${parts[0]}.${parts[1]}.${parts[2]}`;
  }
  // Group IPv6 devices on same /48 home/router prefix
  if (clean.includes(':')) {
    const segs = clean.split(':').slice(0, 3).join(':');
    return `v6-${segs}`;
  }
  return clean;
}

interface ClientRecord {
  ws: WebSocket | null;
  privateCode: string;
  name: string;
  avatarId: string;
  levelId: string;
  xp: number;
  streak: number;
  completedLessons: number;
  avgSkill: number;
  unlockedLevels: string[];
  status: 'online' | 'in_game';
  networkKey: string;
  roomId: string | null;
  lastSeen: number;
}

interface PendingInvite {
  inviteId: string;
  fromCode: string;
  fromName: string;
  fromAvatar: string;
  toCode: string;
  mode: 'wifi' | 'online';
  useTimer: boolean;
  timerSeconds: number;
  levelId: string;
  createdAt: number;
  expiresAt: number;
  timeoutHandle: ReturnType<typeof setTimeout>;
}

interface RoomMember {
  privateCode: string;
  name: string;
  avatarId: string;
  status: 'online' | 'in_game';
  side: 'A' | 'B';
  isLeader: boolean;
  score: number;
  answeredCount: number;
}

interface RoomState {
  roomId: string;
  teamCode: string;
  teamName: string;
  mode: 'wifi' | 'online';
  format: '1v1' | '2v2' | '3v3' | '4v4';
  leaderCode: string;
  useTimer: boolean;
  timerSeconds: number;
  members: RoomMember[];
  joinRequests: Array<{
    requestId: string;
    privateCode: string;
    name: string;
    avatarId: string;
    side: 'A' | 'B';
  }>;
  status: 'waiting' | 'playing' | 'finished';
  questions: ServerQuestion[];
  startedAt?: number;
  endedAt?: number;
  chatExpiresAt?: number;
  pausedByDisconnect?: boolean;
  disconnectedPlayerName?: string;
}

interface RoomChatMessage {
  id: string;
  roomId: string;
  channel: 'team' | 'all' | 'private';
  senderCode: string;
  senderName: string;
  senderSide?: 'A' | 'B';
  recipientCode?: string;
  text: string;
  timestamp: string;
}

const clientsByCode = new Map<string, ClientRecord>();
const codeBySocket = new Map<WebSocket, string>();
const invitesById = new Map<string, PendingInvite>();
const roomsById = new Map<string, RoomState>();
const roomMessages = new Map<string, RoomChatMessage[]>();
const pendingHttpEvents = new Map<string, unknown[]>();

// Expire HTTP-only heartbeat clients that haven't pinged for > 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [code, rec] of clientsByCode.entries()) {
    if (!rec.ws && now - rec.lastSeen > 120_000) {
      if (rec.roomId) removeMemberFromRoom(code);
      clientsByCode.delete(code);
      pendingHttpEvents.delete(code);
    }
  }
}, 45_000);

function serializePeer(p: ClientRecord, viewerNetworkKey?: string) {
  return {
    privateCode: p.privateCode,
    name: p.name,
    avatarId: p.avatarId,
    levelId: p.levelId,
    status: p.status,
    sameWifi: viewerNetworkKey ? p.networkKey === viewerNetworkKey : false,
    xp: p.xp,
    streak: p.streak,
    completedLessons: p.completedLessons,
    avgSkill: p.avgSkill,
    unlockedLevels: p.unlockedLevels,
  };
}

function sendToSocket(ws: WebSocket | null | undefined, payload: unknown) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(payload));
}

function sendToCode(code: string, payload: unknown) {
  const client = clientsByCode.get(code);
  if (client?.ws && client.ws.readyState === WebSocket.OPEN) {
    sendToSocket(client.ws, payload);
  } else if (client) {
    const q = pendingHttpEvents.get(code) || [];
    pendingHttpEvents.set(code, [...q.slice(-24), payload]);
  }
}

function broadcastWifiPeersForNetwork(networkKey: string) {
  const netClients = Array.from(clientsByCode.values()).filter((c) => c.networkKey === networkKey);
  for (const viewer of netClients) {
    if (!viewer.ws || viewer.ws.readyState !== WebSocket.OPEN) continue;
    const peers = netClients
      .filter((p) => p.privateCode !== viewer.privateCode)
      .map((p) => serializePeer(p, viewer.networkKey));
    sendToSocket(viewer.ws, { type: 'wifi:peers', peers });
  }
}

function serializeRoom(room: RoomState) {
  return {
    roomId: room.roomId,
    teamCode: room.teamCode,
    teamName: room.teamName,
    mode: room.mode,
    format: room.format,
    leaderCode: room.leaderCode,
    useTimer: room.useTimer,
    timerSeconds: room.timerSeconds,
    members: room.members,
    joinRequests: room.joinRequests,
    status: room.status,
    questions: room.questions,
    startedAt: room.startedAt,
    endedAt: room.endedAt,
    chatExpiresAt: room.chatExpiresAt,
    pausedByDisconnect: room.pausedByDisconnect,
    disconnectedPlayerName: room.disconnectedPlayerName,
  };
}

function broadcastRoom(room: RoomState) {
  const payload = { type: 'room:state', room: serializeRoom(room) };
  for (const m of room.members) {
    sendToCode(m.privateCode, payload);
  }
}

function maxPerSide(format: RoomState['format']): number {
  if (format === '1v1') return 1;
  if (format === '2v2') return 2;
  if (format === '3v3') return 3;
  return 4;
}

function generateTeamCode(): string {
  let code = '';
  do {
    code = `TM-${Math.floor(1000 + Math.random() * 9000)}`;
  } while (Array.from(roomsById.values()).some((r) => r.teamCode === code));
  return code;
}

function removeMemberFromRoom(code: string, reasonText?: string) {
  const client = clientsByCode.get(code);
  const roomId = client?.roomId;
  if (!roomId) return;
  const room = roomsById.get(roomId);
  if (client) {
    client.roomId = null;
    client.status = 'online';
  }
  if (!room) return;

  const leavingMember = room.members.find((m) => m.privateCode === code);
  room.members = room.members.filter((m) => m.privateCode !== code);

  if (room.members.length === 0) {
    roomsById.delete(room.roomId);
    roomMessages.delete(room.roomId);
    return;
  }

  // Transfer leader if needed
  if (room.leaderCode === code && room.members.length > 0) {
    room.leaderCode = room.members[0].privateCode;
    room.members[0].isLeader = true;
  }

  if (room.status === 'playing') {
    room.pausedByDisconnect = true;
    room.disconnectedPlayerName = leavingMember?.name || 'صديقك';
    for (const m of room.members) {
      sendToCode(m.privateCode, {
        type: 'room:player_left',
        leftCode: code,
        leftName: leavingMember?.name || 'لاعب',
        message: reasonText || (room.format === '1v1' ? 'غادر صديقك اللعبة' : `غادر ${leavingMember?.name || 'لاعب'} اللعبة`),
      });
    }
  }

  broadcastRoom(room);
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.post('/api/teacher', async (req, res) => {
    const query = String(req.body?.query || '').trim();
    const level = String(req.body?.level || 'A1').trim();
    const mode = String(req.body?.mode || 'adults').trim();

    if (!query) {
      res.status(400).json({ error: 'يرجى كتابة كلمة أو جملة أو سؤال للمعلم.' });
      return;
    }

    if (!ai) {
      res.status(503).json({
        error: 'خدمة الذكاء الاصطناعي غير متصلة حالياً، سيتم استخدام الشرح المحلي.',
        offlineFallback: true,
      });
      return;
    }

    try {
      const toneGuide =
        mode === 'kids'
          ? 'خاطب طفلاً سودانياً بأسلوب مرح وبسيط جداً ومشجع.'
          : 'خاطب متعلماً سودانياً بأسلوب واضح ودود، باللهجة السودانية البسيطة المفهومة مع الفصحى الخفيفة.';

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `المستوى الحالي للطالب: ${level}\nسؤال الطالب أو الكلمة المطلوب شرحها: "${query}"`,
        config: {
          systemInstruction: `أنت معلم لغة إنجليزية سوداني خبير وودود في تطبيق Friendly Fluency Hub.
${toneGuide}
اشرح الكلمة أو القاعدة أو الجملة الإنجليزية باللهجة السودانية البسيطة (مثل: "الكلمة دي معناها..."، "بنستعملها لما...") بشكل منظم ومختصر:
1) المعنى بالعربي والسوداني البسيط.
2) النطق التقريبي بحروف عربية واضحة.
3) مثال إنجليزي بسيط مع ترجمته.
4) نصيحة سريعة أو فرق مهم لتثبيت المعلومة.
لا تكتب أكثر من 140 كلمة وكن مشجعاً دائماً.`,
        },
      });

      const answer = response.text?.trim();
      if (!answer) {
        res.status(502).json({ error: 'لم يصل رد من المعلم، حاول مرة أخرى.' });
        return;
      }

      res.json({ answer });
    } catch (err) {
      console.error('Gemini teacher error:', err);
      res.status(500).json({
        error: 'تعذر الاتصال بالمعلم الآن، جرب الشرح المحلي أو أعد المحاولة.',
        offlineFallback: true,
      });
    }
  });

  // Allow CORS for local Wi-Fi / Capacitor clients connecting to LAN IP
  app.use('/api', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, peers: clientsByCode.size, rooms: roomsById.size });
  });

  // HTTP fallback registration & polling for environments where WebSocket is blocked or slow
  app.post('/api/peers/heartbeat', (req, res) => {
    const networkKey = normalizeIp(req);
    const privateCode = String(req.body?.privateCode || '').trim();
    if (!/^\d{6}$/.test(privateCode)) {
      res.status(400).json({ error: 'الرقم الخاص يجب أن يتكون من 6 أرقام.' });
      return;
    }
    const existing = clientsByCode.get(privateCode);
    if (existing && existing.ws && existing.ws.readyState === WebSocket.OPEN && existing.networkKey === networkKey && req.body?.httpOnly) {
      res.status(409).json({
        code: 'CODE_CONFLICT',
        error: 'يوجد جهاز آخر على نفس شبكة الواي فاي يستخدم هذا الرقم الخاص! يرجى تغييره.',
      });
      return;
    }

    const updated: ClientRecord = {
      ws: existing?.ws || null,
      privateCode,
      name: String(req.body?.name || existing?.name || 'متعلم').trim().slice(0, 32),
      avatarId: String(req.body?.avatarId || existing?.avatarId || 'avatar-scholar'),
      levelId: String(req.body?.levelId || existing?.levelId || 'A1'),
      xp: Number(req.body?.xp ?? existing?.xp ?? 0),
      streak: Number(req.body?.streak ?? existing?.streak ?? 0),
      completedLessons: Number(req.body?.completedLessons ?? existing?.completedLessons ?? 0),
      avgSkill: Number(req.body?.avgSkill ?? existing?.avgSkill ?? 75),
      unlockedLevels: Array.isArray(req.body?.unlockedLevels)
        ? req.body.unlockedLevels.map(String)
        : existing?.unlockedLevels || ['A1'],
      status: existing?.roomId ? 'in_game' : 'online',
      networkKey: existing?.ws ? existing.networkKey : networkKey,
      roomId: existing?.roomId || null,
      lastSeen: Date.now(),
    };
    clientsByCode.set(privateCode, updated);

    const events = pendingHttpEvents.get(privateCode) || [];
    pendingHttpEvents.set(privateCode, []);
    res.json({ ok: true, privateCode, networkKey: updated.networkKey, events });
  });

  app.get('/api/peers/wifi', (req, res) => {
    const networkKey = normalizeIp(req);
    const self = String(req.query.self || '').trim();
    const peers = Array.from(clientsByCode.values())
      .filter((p) => p.networkKey === networkKey && p.privateCode !== self)
      .map((p) => serializePeer(p, networkKey));
    res.json({ peers, networkKey });
  });

  app.get('/api/peers/search', (req, res) => {
    const networkKey = normalizeIp(req);
    const self = String(req.query.self || '').trim();
    const q = String(req.query.q || '').trim().toLowerCase();
    const scope = String(req.query.scope || 'all');

    const peers = Array.from(clientsByCode.values())
      .filter((p) => {
        if (p.privateCode === self) return false;
        if (scope === 'wifi' && p.networkKey !== networkKey) return false;
        if (!q) return true;
        return (
          p.privateCode.includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.levelId.toLowerCase() === q
        );
      })
      .slice(0, 30)
      .map((p) => serializePeer(p, networkKey));

    res.json({ peers });
  });

  app.get('/api/peers/lookup/:code', (req, res) => {
    const networkKey = normalizeIp(req);
    const targetCode = String(req.params.code || '').trim();
    const self = String(req.query.self || '').trim();
    if (!/^\d{6}$/.test(targetCode) || (self && targetCode === self)) {
      res.status(400).json({ error: 'أدخل رقماً صحيحاً من 6 أرقام غير رقمك الخاص.' });
      return;
    }
    const target = clientsByCode.get(targetCode);
    res.json({
      peer: target
        ? serializePeer(target, networkKey)
        : {
            privateCode: targetCode,
            name: 'صديق غير متصل',
            avatarId: 'avatar-scholar',
            levelId: 'A1',
            status: 'offline',
          },
    });
  });

  app.post('/api/challenges/send', (req, res) => {
    const fromCode = String(req.body?.fromCode || '').trim();
    const toCode = String(req.body?.toCode || '').trim();
    const mode = req.body?.mode === 'wifi' ? 'wifi' : 'online';
    const useTimer = Boolean(req.body?.useTimer);
    const timerSeconds = Number(req.body?.timerSeconds || 15);

    const sender = clientsByCode.get(fromCode);
    const target = clientsByCode.get(toCode);
    if (!sender) {
      res.status(400).json({ error: 'يرجى الانتظار لحظة حتى يكتمل تسجيل حسابك على الخادم.' });
      return;
    }
    if (!/^\d{6}$/.test(toCode) || toCode === fromCode) {
      res.status(400).json({ error: 'الرقم الخاص غير صالح أو يطابق رقمك.' });
      return;
    }
    if (!target) {
      res.status(404).json({ error: 'الصديق غير متصل حالياً.' });
      return;
    }

    const inviteId = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const createdAt = Date.now();
    const expiresAt = createdAt + 30_000;
    const timeoutHandle = setTimeout(() => {
      const pending = invitesById.get(inviteId);
      if (!pending) return;
      invitesById.delete(inviteId);
      sendToCode(pending.fromCode, { type: 'challenge:expired', inviteId, message: 'لم يتم الرد' });
      sendToCode(pending.toCode, {
        type: 'challenge:expired',
        inviteId,
        message: 'انتهت مهلة طلب التحدي (30 ثانية)',
      });
    }, 30_000);

    const invite: PendingInvite = {
      inviteId,
      fromCode: sender.privateCode,
      fromName: sender.name,
      fromAvatar: sender.avatarId,
      toCode: target.privateCode,
      mode,
      useTimer,
      timerSeconds,
      levelId: sender.levelId,
      createdAt,
      expiresAt,
      timeoutHandle,
    };
    invitesById.set(inviteId, invite);
    const safeInvite = {
      inviteId: invite.inviteId,
      fromCode: invite.fromCode,
      fromName: invite.fromName,
      fromAvatar: invite.fromAvatar,
      toCode: invite.toCode,
      mode: invite.mode,
      useTimer: invite.useTimer,
      timerSeconds: invite.timerSeconds,
      levelId: invite.levelId,
      createdAt: invite.createdAt,
      expiresAt: invite.expiresAt,
    };
    sendToCode(target.privateCode, { type: 'challenge:incoming', invite: safeInvite });
    res.json({ ok: true, invite: safeInvite });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const networkKey = normalizeIp(req);

    ws.on('message', (rawBuf) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(rawBuf));
      } catch {
        return;
      }

      const type = String(msg.type || '');

      if (type === 'register') {
        const privateCode = String(msg.privateCode || '').trim();
        const name = String(msg.name || 'متعلم').trim().slice(0, 32);
        const avatarId = String(msg.avatarId || 'avatar-scholar');
        const levelId = String(msg.levelId || 'A1');
        const xp = Number(msg.xp ?? 0);
        const streak = Number(msg.streak ?? 0);
        const completedLessons = Number(msg.completedLessons ?? 0);
        const avgSkill = Number(msg.avgSkill ?? 75);
        const unlockedLevels = Array.isArray(msg.unlockedLevels)
          ? msg.unlockedLevels.map(String)
          : [levelId];

        if (!/^\d{6}$/.test(privateCode)) {
          sendToSocket(ws, {
            type: 'register:error',
            code: 'INVALID_CODE',
            message: 'الرقم الخاص يجب أن يتكون من 6 أرقام.',
          });
          return;
        }

        const existing = clientsByCode.get(privateCode);
        if (existing && existing.ws && existing.ws !== ws && existing.ws.readyState === WebSocket.OPEN) {
          // Strict rule: two devices on the same network cannot hold identical 6-digit codes
          if (existing.networkKey === networkKey) {
            sendToSocket(ws, {
              type: 'register:error',
              code: 'CODE_CONFLICT',
              message: 'يوجد جهاز آخر على نفس شبكة الواي فاي يستخدم هذا الرقم الخاص! يرجى تغييره.',
            });
            return;
          }
          // Different socket replacing stale session
          try {
            existing.ws.close();
          } catch {
            // Ignore
          }
        }

        const prevCode = codeBySocket.get(ws);
        if (prevCode && prevCode !== privateCode) {
          clientsByCode.delete(prevCode);
        }

        const record: ClientRecord = {
          ws,
          privateCode,
          name,
          avatarId,
          levelId,
          xp: Number.isFinite(xp) ? xp : 0,
          streak: Number.isFinite(streak) ? streak : 0,
          completedLessons: Number.isFinite(completedLessons) ? completedLessons : 0,
          avgSkill: Number.isFinite(avgSkill) ? avgSkill : 75,
          unlockedLevels,
          status: existing?.roomId ? 'in_game' : 'online',
          networkKey,
          roomId: existing?.roomId || null,
          lastSeen: Date.now(),
        };
        clientsByCode.set(privateCode, record);
        codeBySocket.set(ws, privateCode);

        sendToSocket(ws, { type: 'register:ok', privateCode, networkKey });
        broadcastWifiPeersForNetwork(networkKey);

        // If reconnecting into an existing active room, re-sync state & chat history
        if (record.roomId) {
          const room = roomsById.get(record.roomId);
          if (room) {
            room.pausedByDisconnect = false;
            sendToSocket(ws, { type: 'room:state', room: serializeRoom(room) });
            sendToSocket(ws, { type: 'chat:history', messages: roomMessages.get(room.roomId) || [] });
          }
        }
        return;
      }

      const senderCode = codeBySocket.get(ws);
      if (!senderCode) return;
      const sender = clientsByCode.get(senderCode);
      if (!sender) return;
      sender.lastSeen = Date.now();

      if (type === 'discover_wifi') {
        const peers = Array.from(clientsByCode.values())
          .filter((p) => p.networkKey === sender.networkKey && p.privateCode !== senderCode)
          .map((p) => serializePeer(p, sender.networkKey));
        sendToSocket(ws, { type: 'wifi:peers', peers });
        return;
      }

      if (type === 'search_peers') {
        const q = String(msg.query || '').trim().toLowerCase();
        const scope = String(msg.scope || 'all');
        const peers = Array.from(clientsByCode.values())
          .filter((p) => {
            if (p.privateCode === senderCode) return false;
            if (scope === 'wifi' && p.networkKey !== sender.networkKey) return false;
            if (!q) return true;
            return (
              p.privateCode.includes(q) ||
              p.name.toLowerCase().includes(q) ||
              p.levelId.toLowerCase() === q
            );
          })
          .slice(0, 30)
          .map((p) => serializePeer(p, sender.networkKey));
        sendToSocket(ws, { type: 'peers:search_result', peers, query: q, scope });
        return;
      }

      if (type === 'lookup_peer') {
        const targetCode = String(msg.targetCode || '').trim();
        if (!/^\d{6}$/.test(targetCode) || targetCode === senderCode) {
          sendToSocket(ws, {
            type: 'peer:status',
            error: 'أدخل رقماً صحيحاً من 6 أرقام غير رقمك الخاص.',
          });
          return;
        }
        const target = clientsByCode.get(targetCode);
        sendToSocket(ws, {
          type: 'peer:status',
          peer: target
            ? serializePeer(target, sender.networkKey)
            : {
                privateCode: targetCode,
                name: 'صديق غير متصل',
                avatarId: 'avatar-scholar',
                levelId: 'A1',
                status: 'offline',
              },
        });
        return;
      }

      if (type === 'challenge:send') {
        const toCode = String(msg.toCode || '').trim();
        const mode = msg.mode === 'wifi' ? 'wifi' : 'online';
        const useTimer = Boolean(msg.useTimer);
        const timerSeconds = Number(msg.timerSeconds || 15);

        if (!/^\d{6}$/.test(toCode) || toCode === senderCode) {
          sendToSocket(ws, { type: 'challenge:error', message: 'الرقم الخاص غير صالح أو يطابق رقمك.' });
          return;
        }

        const target = clientsByCode.get(toCode);
        if (!target) {
          sendToSocket(ws, { type: 'challenge:error', message: 'الصديق غير متصل حالياً.' });
          return;
        }

        const inviteId = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const createdAt = Date.now();
        const expiresAt = createdAt + 30_000;

        const timeoutHandle = setTimeout(() => {
          const pending = invitesById.get(inviteId);
          if (!pending) return;
          invitesById.delete(inviteId);
          sendToCode(pending.fromCode, {
            type: 'challenge:expired',
            inviteId,
            message: 'لم يتم الرد',
          });
          sendToCode(pending.toCode, {
            type: 'challenge:expired',
            inviteId,
            message: 'انتهت مهلة طلب التحدي (30 ثانية)',
          });
        }, 30_000);

        const invite: PendingInvite = {
          inviteId,
          fromCode: sender.privateCode,
          fromName: sender.name,
          fromAvatar: sender.avatarId,
          toCode: target.privateCode,
          mode,
          useTimer,
          timerSeconds,
          levelId: sender.levelId,
          createdAt,
          expiresAt,
          timeoutHandle,
        };
        invitesById.set(inviteId, invite);

        const safeInvite = {
          inviteId: invite.inviteId,
          fromCode: invite.fromCode,
          fromName: invite.fromName,
          fromAvatar: invite.fromAvatar,
          toCode: invite.toCode,
          mode: invite.mode,
          useTimer: invite.useTimer,
          timerSeconds: invite.timerSeconds,
          levelId: invite.levelId,
          createdAt: invite.createdAt,
          expiresAt: invite.expiresAt,
        };

        sendToSocket(ws, { type: 'challenge:sent', invite: safeInvite });
        sendToCode(target.privateCode, { type: 'challenge:incoming', invite: safeInvite });
        return;
      }

      if (type === 'challenge:respond') {
        const inviteId = String(msg.inviteId || '');
        const accept = Boolean(msg.accept);
        const invite = invitesById.get(inviteId);
        if (!invite || invite.toCode !== senderCode) return;

        clearTimeout(invite.timeoutHandle);
        invitesById.delete(inviteId);

        if (!accept) {
          sendToCode(invite.fromCode, {
            type: 'challenge:declined',
            inviteId,
            message: 'تم رفض التحدي',
          });
          return;
        }

        const challenger = clientsByCode.get(invite.fromCode);
        const acceptor = clientsByCode.get(invite.toCode);
        if (!challenger || !acceptor) return;

        // Clean previous rooms if any
        if (challenger.roomId) removeMemberFromRoom(challenger.privateCode);
        if (acceptor.roomId) removeMemberFromRoom(acceptor.privateCode);

        const roomId = `ROOM-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const questions = getQuestionsForLevel(invite.levelId);
        const room: RoomState = {
          roomId,
          teamCode: generateTeamCode(),
          teamName: `تحدي 1 ضد 1`,
          mode: invite.mode,
          format: '1v1',
          leaderCode: challenger.privateCode,
          useTimer: invite.useTimer,
          timerSeconds: invite.timerSeconds,
          members: [
            {
              privateCode: challenger.privateCode,
              name: challenger.name,
              avatarId: challenger.avatarId,
              status: 'in_game',
              side: 'A',
              isLeader: true,
              score: 0,
              answeredCount: 0,
            },
            {
              privateCode: acceptor.privateCode,
              name: acceptor.name,
              avatarId: acceptor.avatarId,
              status: 'in_game',
              side: 'B',
              isLeader: false,
              score: 0,
              answeredCount: 0,
            },
          ],
          joinRequests: [],
          status: 'playing',
          questions,
          startedAt: Date.now(),
        };

        roomsById.set(roomId, room);
        roomMessages.set(roomId, []);
        challenger.roomId = roomId;
        challenger.status = 'in_game';
        acceptor.roomId = roomId;
        acceptor.status = 'in_game';

        broadcastWifiPeersForNetwork(challenger.networkKey);
        broadcastRoom(room);
        return;
      }

      if (type === 'team:create') {
        if (sender.roomId) removeMemberFromRoom(sender.privateCode);

        const teamName = String(msg.teamName || `فريق ${sender.name}`).trim().slice(0, 30);
        const format = (['1v1', '2v2', '3v3', '4v4'].includes(String(msg.format))
          ? String(msg.format)
          : '2v2') as RoomState['format'];
        const mode = msg.mode === 'wifi' ? 'wifi' : 'online';
        const useTimer = Boolean(msg.useTimer);

        const roomId = `TEAM-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const room: RoomState = {
          roomId,
          teamCode: generateTeamCode(),
          teamName,
          mode,
          format,
          leaderCode: sender.privateCode,
          useTimer,
          timerSeconds: 15,
          members: [
            {
              privateCode: sender.privateCode,
              name: sender.name,
              avatarId: sender.avatarId,
              status: 'online',
              side: 'A',
              isLeader: true,
              score: 0,
              answeredCount: 0,
            },
          ],
          joinRequests: [],
          status: 'waiting',
          questions: [],
        };
        roomsById.set(roomId, room);
        roomMessages.set(roomId, []);
        sender.roomId = roomId;
        broadcastRoom(room);
        return;
      }

      if (type === 'team:join_request') {
        const query = String(msg.codeOrLeader || '').trim().toUpperCase();
        const requestedSide = msg.side === 'B' ? 'B' : 'A';
        const room = Array.from(roomsById.values()).find(
          (r) =>
            r.status === 'waiting' &&
            (r.teamCode.toUpperCase() === query || r.leaderCode === query),
        );
        if (!room) {
          sendToSocket(ws, {
            type: 'team:error',
            message: 'لم يتم العثور على فريق مفتوح بهذا الكود أو رقم القائد.',
          });
          return;
        }
        const sideCount = room.members.filter((m) => m.side === requestedSide).length;
        const limit = maxPerSide(room.format);
        if (sideCount >= limit) {
          sendToSocket(ws, {
            type: 'team:error',
            message: `هذا الفريق ممتلئ بالفعل (الحد الأقصى ${limit} لاعبين في هذا الوضع).`,
          });
          return;
        }
        if (room.members.some((m) => m.privateCode === sender.privateCode)) {
          sendToSocket(ws, { type: 'room:state', room: serializeRoom(room) });
          return;
        }
        if (!room.joinRequests.some((jr) => jr.privateCode === sender.privateCode)) {
          room.joinRequests.push({
            requestId: `JR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            privateCode: sender.privateCode,
            name: sender.name,
            avatarId: sender.avatarId,
            side: requestedSide,
          });
        }
        sendToSocket(ws, {
          type: 'team:notice',
          message: `تم إرسال طلب الانضمام إلى قائد فريق "${room.teamName}" — بانتظار موافقته.`,
        });
        broadcastRoom(room);
        return;
      }

      if (type === 'team:approve_join') {
        const room = sender.roomId ? roomsById.get(sender.roomId) : undefined;
        if (!room || room.leaderCode !== sender.privateCode) return;

        const requestId = String(msg.requestId || '');
        const approve = Boolean(msg.approve);
        const sideOverride = msg.side === 'B' ? 'B' : msg.side === 'A' ? 'A' : undefined;
        const reqItem = room.joinRequests.find((r) => r.requestId === requestId);
        if (!reqItem) return;
        room.joinRequests = room.joinRequests.filter((r) => r.requestId !== requestId);

        if (!approve) {
          sendToCode(reqItem.privateCode, {
            type: 'team:error',
            message: `تم رفض طلب انضمامك إلى فريق "${room.teamName}".`,
          });
          broadcastRoom(room);
          return;
        }

        const joiner = clientsByCode.get(reqItem.privateCode);
        if (!joiner) {
          broadcastRoom(room);
          return;
        }
        const targetSide = sideOverride || reqItem.side;
        const limit = maxPerSide(room.format);
        if (room.members.filter((m) => m.side === targetSide).length >= limit) {
          sendToCode(room.leaderCode, {
            type: 'team:error',
            message: `الفريق ${targetSide === 'A' ? 'الأول' : 'المنافس'} وصل للحد الأقصى (${limit}).`,
          });
          broadcastRoom(room);
          return;
        }

        if (joiner.roomId && joiner.roomId !== room.roomId) {
          removeMemberFromRoom(joiner.privateCode);
        }
        joiner.roomId = room.roomId;
        room.members.push({
          privateCode: joiner.privateCode,
          name: joiner.name,
          avatarId: joiner.avatarId,
          status: 'online',
          side: targetSide,
          isLeader: false,
          score: 0,
          answeredCount: 0,
        });

        broadcastRoom(room);
        sendToCode(joiner.privateCode, {
          type: 'chat:history',
          messages: roomMessages.get(room.roomId) || [],
        });
        return;
      }

      if (type === 'team:set_timer') {
        const room = sender.roomId ? roomsById.get(sender.roomId) : undefined;
        if (!room || room.leaderCode !== sender.privateCode || room.status !== 'waiting') return;
        room.useTimer = Boolean(msg.useTimer);
        broadcastRoom(room);
        return;
      }

      if (type === 'team:switch_side') {
        const room = sender.roomId ? roomsById.get(sender.roomId) : undefined;
        if (!room || room.status !== 'waiting') return;
        const targetCode = String(msg.targetCode || sender.privateCode);
        if (targetCode !== sender.privateCode && room.leaderCode !== sender.privateCode) return;
        const member = room.members.find((m) => m.privateCode === targetCode);
        if (!member) return;
        const nextSide = member.side === 'A' ? 'B' : 'A';
        if (room.members.filter((m) => m.side === nextSide).length >= maxPerSide(room.format)) {
          sendToSocket(ws, { type: 'team:error', message: 'الفريق المقابل ممتلئ لهذا الوضع.' });
          return;
        }
        member.side = nextSide;
        broadcastRoom(room);
        return;
      }

      if (type === 'team:start' || type === 'team:play_again') {
        const room = sender.roomId ? roomsById.get(sender.roomId) : undefined;
        if (!room || room.leaderCode !== sender.privateCode) return;
        if (room.members.length < 2) {
          sendToSocket(ws, { type: 'team:error', message: 'يلزم وجود لاعبين اثنين على الأقل لبدء المباراة.' });
          return;
        }
        const hasA = room.members.some((m) => m.side === 'A');
        const hasB = room.members.some((m) => m.side === 'B');
        if (!hasA || !hasB) {
          sendToSocket(ws, {
            type: 'team:error',
            message: 'يرجى وضع لاعب واحد على الأقل في الفريق المنافس (أو التبديل للفريق ب) قبل البدء.',
          });
          return;
        }

        room.status = 'playing';
        room.pausedByDisconnect = false;
        room.disconnectedPlayerName = undefined;
        room.startedAt = Date.now();
        room.endedAt = undefined;
        room.chatExpiresAt = undefined;
        room.questions = getQuestionsForLevel(sender.levelId);
        for (const m of room.members) {
          m.score = 0;
          m.answeredCount = 0;
          m.status = 'in_game';
          const c = clientsByCode.get(m.privateCode);
          if (c) c.status = 'in_game';
        }
        broadcastWifiPeersForNetwork(sender.networkKey);
        broadcastRoom(room);
        return;
      }

      if (type === 'team:leave') {
        removeMemberFromRoom(sender.privateCode);
        broadcastWifiPeersForNetwork(sender.networkKey);
        return;
      }

      if (type === 'game:answer') {
        const room = sender.roomId ? roomsById.get(sender.roomId) : undefined;
        if (!room || room.status !== 'playing') return;
        const member = room.members.find((m) => m.privateCode === sender.privateCode);
        if (!member) return;

        const isCorrect = Boolean(msg.isCorrect);
        const answeredCount = Math.min(room.questions.length, Number(msg.answeredCount || member.answeredCount + 1));
        member.answeredCount = Math.max(member.answeredCount, answeredCount);
        if (isCorrect) member.score += 1;

        const allDone = room.members.every((m) => m.answeredCount >= room.questions.length);
        if (allDone) {
          room.status = 'finished';
          room.endedAt = Date.now();
          room.chatExpiresAt = Date.now() + 60_000; // Keep chat & voice open for 60s celebration
          for (const m of room.members) {
            m.status = 'online';
            const c = clientsByCode.get(m.privateCode);
            if (c) c.status = 'online';
          }
          broadcastWifiPeersForNetwork(sender.networkKey);
        }
        broadcastRoom(room);
        return;
      }

      if (type === 'chat:send') {
        const room = sender.roomId ? roomsById.get(sender.roomId) : undefined;
        if (!room) return;
        if (room.chatExpiresAt && Date.now() > room.chatExpiresAt) {
          sendToSocket(ws, { type: 'chat:closed', message: 'انتهت مهلة الشات بعد نهاية المباراة (60 ثانية).' });
          return;
        }
        const rawText = String(msg.text || '').trim();
        if (!rawText) return; // Block empty messages

        const cleanText = filterProfanity(rawText);
        const channel = (['team', 'all', 'private'].includes(String(msg.channel))
          ? String(msg.channel)
          : 'all') as 'team' | 'all' | 'private';
        const recipientCode = msg.recipientCode ? String(msg.recipientCode) : undefined;
        const senderMember = room.members.find((m) => m.privateCode === sender.privateCode);

        const chatMsg: RoomChatMessage = {
          id: `MSG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          roomId: room.roomId,
          channel,
          senderCode: sender.privateCode,
          senderName: sender.name,
          senderSide: senderMember?.side,
          recipientCode,
          text: cleanText,
          timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        };

        const history = roomMessages.get(room.roomId) || [];
        const updated = [...history, chatMsg].slice(-50); // Keep last 50 messages per room
        roomMessages.set(room.roomId, updated);

        for (const m of room.members) {
          if (channel === 'team' && m.side !== senderMember?.side) continue;
          if (channel === 'private' && m.privateCode !== sender.privateCode && m.privateCode !== recipientCode) {
            continue;
          }
          sendToCode(m.privateCode, { type: 'chat:message', message: chatMsg });
        }
        return;
      }

      if (type === 'chat:clear') {
        const room = sender.roomId ? roomsById.get(sender.roomId) : undefined;
        if (!room || room.leaderCode !== sender.privateCode) return;
        roomMessages.set(room.roomId, []);
        for (const m of room.members) {
          sendToCode(m.privateCode, { type: 'chat:cleared' });
        }
        return;
      }

      if (type === 'webrtc:signal') {
        const room = sender.roomId ? roomsById.get(sender.roomId) : undefined;
        if (!room) return;
        if (room.chatExpiresAt && Date.now() > room.chatExpiresAt) return;
        const toCode = String(msg.toCode || '');
        if (!room.members.some((m) => m.privateCode === toCode)) return;
        sendToCode(toCode, {
          type: 'webrtc:signal',
          fromCode: sender.privateCode,
          signal: msg.signal,
        });
        return;
      }

      if (type === 'voice:speaking') {
        const room = sender.roomId ? roomsById.get(sender.roomId) : undefined;
        if (!room) return;
        const speaking = Boolean(msg.speaking);
        const talkToAll = Boolean(msg.talkToAll);
        const senderMember = room.members.find((m) => m.privateCode === sender.privateCode);
        for (const m of room.members) {
          if (m.privateCode === sender.privateCode) continue;
          if (!talkToAll && senderMember && m.side !== senderMember.side) continue;
          sendToCode(m.privateCode, {
            type: 'voice:speaking',
            fromCode: sender.privateCode,
            speaking,
          });
        }
      }
    });

    ws.on('close', () => {
      const code = codeBySocket.get(ws);
      codeBySocket.delete(ws);
      if (!code) return;
      const client = clientsByCode.get(code);
      if (!client || client.ws !== ws) return;

      const netKey = client.networkKey;
      if (client.roomId) {
        removeMemberFromRoom(code);
      }
      clientsByCode.delete(code);
      broadcastWifiPeersForNetwork(netKey);
    });
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Friendly Fluency Hub server + WebSocket listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
