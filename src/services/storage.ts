import { CEFR_LEVELS } from '../data/curriculum';
import type { AppState, CEFRLevel, CEFRLevelId, FriendComparison, PeerInfo, SkillTag } from '../types';

export const STORAGE_KEY = 'ffh_state_v1';
const DB_NAME = 'ffh_offline_db';
const DB_VERSION = 1;
const STORE_STATE = 'user_state';
const STORE_LEVELS = 'offline_levels';

export function generateSixDigitCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function getTodayISO(): string {
  return new Date().toLocaleDateString('en-CA');
}

export function getYesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString('en-CA');
}

export function createInitialState(): AppState {
  const emptySkill = () => ({ correct: 0, attempts: 0, recentCorrect: 0, recentAttempts: 0 });
  return {
    profile: {
      name: 'متعلم طموح',
      title: 'متعلم نشيط',
      avatarId: 'avatar-scholar',
      mode: 'adults',
      theme: 'ocean',
      privateCode: generateSixDigitCode(),
      lanServerUrl: '',
    },
    settings: {
      voiceChatEnabled: true,
      chatSoundEnabled: true,
    },
    xp: 0,
    coins: 50,
    streak: 0,
    lastStudyDate: '',
    dailyXp: 0,
    dailyDate: getTodayISO(),
    dailyChallengeDoneDate: '',
    smartReviewDoneDate: '',
    completedLessons: {},
    completedLevelExams: {} as Record<CEFRLevelId, number>,
    unlockedLevels: ['A1'],
    offlineLevels: [],
    skills: {
      vocab: emptySkill(),
      grammar: emptySkill(),
      pronunciation: emptySkill(),
      listening: emptySkill(),
      sentence_building: emptySkill(),
      reading: emptySkill(),
    },
    pronunciationHistory: [],
    excellentPronunciations: 0,
    challengesWon: 0,
    badges: [],
    ownedItems: ['theme-ocean', 'avatar-scholar', 'title-learner'],
    lastRankOrder: [],
    rivalDailyOffsetDate: '',
    rivalXpOverrides: {},
    rivalStates: {},
    rivalLastTickAt: 0,
    vocabProgress: {},
    friends: [],
    savedWords: [],
    matchHistory: [],
    updatedAt: Date.now(),
  };
}

function hydrateState(base: AppState, parsed: Partial<AppState>): AppState {
  const mergedProfile = {
    ...base.profile,
    ...(parsed.profile || {}),
  };
  if (!mergedProfile.privateCode || !/^\d{6}$/.test(mergedProfile.privateCode)) {
    mergedProfile.privateCode = generateSixDigitCode();
  }
  return {
    ...base,
    ...parsed,
    profile: mergedProfile,
    settings: { ...base.settings, ...(parsed.settings || {}) },
    skills: { ...base.skills, ...(parsed.skills || {}) },
    rivalStates:
      parsed.rivalStates && typeof parsed.rivalStates === 'object' ? parsed.rivalStates : base.rivalStates,
    rivalLastTickAt:
      typeof parsed.rivalLastTickAt === 'number' ? parsed.rivalLastTickAt : base.rivalLastTickAt,
    vocabProgress:
      parsed.vocabProgress && typeof parsed.vocabProgress === 'object'
        ? parsed.vocabProgress
        : base.vocabProgress,
    savedWords: Array.isArray(parsed.savedWords) ? parsed.savedWords : base.savedWords,
    matchHistory: Array.isArray(parsed.matchHistory) ? parsed.matchHistory : base.matchHistory,
  };
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_STATE)) {
        db.createObjectStore(STORE_STATE);
      }
      if (!db.objectStoreNames.contains(STORE_LEVELS)) {
        db.createObjectStore(STORE_LEVELS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function loadStateFromLocal(): AppState {
  const base = createInitialState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(base));
      return base;
    }
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const hydrated = hydrateState(base, parsed);
    if (!parsed.profile?.privateCode) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(hydrated));
    }
    return hydrated;
  } catch {
    return base;
  }
}

export async function loadStateFromIndexedDB(): Promise<AppState | null> {
  try {
    const db = await openDB();
    const res = await new Promise<Partial<AppState> | null>((resolve) => {
      const tx = db.transaction(STORE_STATE, 'readonly');
      const req = tx.objectStore(STORE_STATE).get('main');
      req.onsuccess = () => resolve((req.result as Partial<AppState>) || null);
      req.onerror = () => resolve(null);
    });
    if (!res) return null;
    return hydrateState(createInitialState(), res);
  } catch {
    return null;
  }
}

export async function persistState(state: AppState): Promise<void> {
  const withTimestamp: AppState = { ...state, updatedAt: Date.now() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(withTimestamp));
  } catch {
    // Ignore quota error
  }
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_STATE, 'readwrite');
      tx.objectStore(STORE_STATE).put(withTimestamp, 'main');
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore IndexedDB error
  }
}

export async function saveOfflineLevelBundle(levelId: CEFRLevelId): Promise<boolean> {
  const level = CEFR_LEVELS.find((l) => l.id === levelId);
  if (!level) return false;
  try {
    const db = await openDB();
    const bundle: CEFRLevel & { cachedAt: string } = {
      ...level,
      cachedAt: new Date().toISOString(),
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_LEVELS, 'readwrite');
      tx.objectStore(STORE_LEVELS).put(bundle);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return true;
  } catch {
    return false;
  }
}

export async function removeOfflineLevelBundle(levelId: CEFRLevelId): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_LEVELS, 'readwrite');
      tx.objectStore(STORE_LEVELS).delete(levelId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore
  }
}

export async function getOfflineCachedLevelIds(): Promise<CEFRLevelId[]> {
  try {
    const db = await openDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_LEVELS, 'readonly');
      const req = tx.objectStore(STORE_LEVELS).getAllKeys();
      req.onsuccess = () => resolve((req.result as CEFRLevelId[]) || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export function getAverageSkillAccuracy(state: AppState): number {
  const entries = Object.values(state.skills);
  const attempted = entries.filter((e) => e.attempts > 0);
  if (attempted.length === 0) return 75;
  const totalCorrect = attempted.reduce((s, e) => s + e.correct, 0);
  const totalAttempts = attempted.reduce((s, e) => s + e.attempts, 0);
  return totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 75;
}

export function getCurrentStudentLevel(state: AppState): CEFRLevelId {
  const unlocked = state.unlockedLevels;
  return unlocked[unlocked.length - 1] || 'A1';
}

export function generateFriendInviteCode(state: AppState): string {
  const completedCount = Object.values(state.completedLessons).filter((v) => v >= 70).length;
  const payload = {
    v: 1,
    p: state.profile.privateCode,
    av: state.profile.avatarId,
    n: state.profile.name,
    l: getCurrentStudentLevel(state),
    u: state.unlockedLevels,
    x: state.xp,
    s: state.streak,
    c: completedCount,
    a: getAverageSkillAccuracy(state),
  };
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return `FFH-${btoa(bin)}`;
}

export function parseFriendInviteCode(codeInput: string): FriendComparison {
  const trimmed = codeInput.trim();
  if (!trimmed.startsWith('FFH-')) {
    throw new Error('كود الدعوة يجب أن يبدأ بـ FFH- أو أدخل رقم الصديق المكون من 6 أرقام');
  }
  const b64 = trimmed.slice(4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const json = new TextDecoder().decode(bytes);
  const parsed = JSON.parse(json) as {
    v?: number;
    p?: string;
    av?: string;
    n?: string;
    l?: CEFRLevelId;
    u?: CEFRLevelId[];
    x?: number;
    s?: number;
    c?: number;
    a?: number;
  };
  if (parsed.v !== 1 || typeof parsed.n !== 'string' || typeof parsed.x !== 'number') {
    throw new Error('صيغة كود الصديق غير صالحة');
  }
  return {
    code: trimmed,
    privateCode: parsed.p && /^\d{6}$/.test(parsed.p) ? parsed.p : undefined,
    avatarId: parsed.av,
    name: parsed.n.slice(0, 32),
    level: parsed.l || 'A1',
    unlockedLevels: Array.isArray(parsed.u) && parsed.u.length > 0 ? parsed.u : [parsed.l || 'A1'],
    xp: Math.max(0, Math.round(parsed.x)),
    streak: Math.max(0, Math.round(parsed.s || 0)),
    completedLessons: Math.max(0, Math.round(parsed.c || 0)),
    avgSkill: Math.max(0, Math.min(100, Math.round(parsed.a || 0))),
    importedAt: new Date().toISOString(),
  };
}

export function peerToFriendComparison(peer: PeerInfo): FriendComparison {
  return {
    code: `CODE-${peer.privateCode}`,
    privateCode: peer.privateCode,
    avatarId: peer.avatarId,
    name: peer.name,
    level: peer.levelId || 'A1',
    unlockedLevels:
      Array.isArray(peer.unlockedLevels) && peer.unlockedLevels.length > 0
        ? peer.unlockedLevels
        : [peer.levelId || 'A1'],
    xp: Math.max(0, Math.round(peer.xp ?? 0)),
    streak: Math.max(0, Math.round(peer.streak ?? 0)),
    completedLessons: Math.max(0, Math.round(peer.completedLessons ?? 0)),
    avgSkill: Math.max(0, Math.min(100, Math.round(peer.avgSkill ?? 75))),
    importedAt: new Date().toISOString(),
  };
}

export function exportProgressJSON(state: AppState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `friendly-fluency-backup-${getTodayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function getSkillScorePercent(state: AppState, skill: SkillTag): number {
  const stat = state.skills[skill];
  if (!stat || stat.attempts === 0) return 0;
  return Math.round((stat.correct / stat.attempts) * 100);
}
