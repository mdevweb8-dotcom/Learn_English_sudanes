import { getLevelRangeBaseXp, RIVALS } from '../data/gamification';
import type {
  AppState,
  CEFRLevelId,
  Rival,
  RivalProgressState,
  RivalStanding,
} from '../types';
import { getAverageSkillAccuracy, getCurrentStudentLevel } from './storage';

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_TICK_MS = 10 * 60 * 1000; // 10 minutes cadence for intraday updates
const MAX_CATCHUP_DAYS = 14;

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function deterministicFloat(seed: string): number {
  return (hashString(seed) % 10000) / 10000;
}

export function formatLocalDateISO(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseLocalDateStartMs(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return Date.now();
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

function addDaysISO(isoDate: string, days: number): string {
  const start = parseLocalDateStartMs(isoDate);
  return formatLocalDateISO(start + days * DAY_MS);
}

function getWeekKey(isoDate: string): string {
  const ms = parseLocalDateStartMs(isoDate);
  const d = new Date(ms);
  const dayNum = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - dayNum);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function levelFromRivalXp(xp: number): CEFRLevelId {
  if (xp >= 3000) return 'C2';
  if (xp >= 2250) return 'C1';
  if (xp >= 1550) return 'B2';
  if (xp >= 950) return 'B1';
  if (xp >= 450) return 'A2';
  return 'A1';
}

function computeDailyPlan(rival: Rival, isoDate: string): { isActive: boolean; dailyTargetXp: number; dailyCapXp: number } {
  const dayMs = parseLocalDateStartMs(isoDate);
  const dayOfWeek = new Date(dayMs).getDay();
  const isWeekend = dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0;

  const roll = deterministicFloat(`${rival.id}-active-${isoDate}`);
  const activeChance = Math.min(0.96, rival.activeProbability + (isWeekend ? 0.06 : 0));
  const isActive = roll < activeChance;

  const dailyCapXp = Math.round(rival.baseDailyRate * 1.9);
  if (!isActive) {
    return { isActive: false, dailyTargetXp: 0, dailyCapXp };
  }

  const varianceRoll = deterministicFloat(`${rival.id}-xp-${isoDate}`); // 0..1
  let factor = 0.65 + varianceRoll * 0.7; // 0.65x..1.35x

  if (rival.personality === 'sprinter' && varianceRoll > 0.6) {
    factor *= 1.3;
  } else if (rival.personality === 'sporadic' && varianceRoll > 0.55) {
    factor *= 1.35;
  } else if (rival.personality === 'steady') {
    factor = 0.85 + varianceRoll * 0.3;
  }

  if (isWeekend) {
    factor *= rival.weekendBoost;
  }

  const dailyTargetXp = Math.min(dailyCapXp, Math.max(12, Math.round(rival.baseDailyRate * factor)));
  return { isActive: true, dailyTargetXp, dailyCapXp };
}

export function createInitialRivalStates(
  baseLevel: CEFRLevelId = 'A1',
  nowMs: number = Date.now(),
): Record<string, RivalProgressState> {
  const todayISO = formatLocalDateISO(nowMs);
  const weekKey = getWeekKey(todayISO);
  const levelBase = getLevelRangeBaseXp(baseLevel);

  const states: Record<string, RivalProgressState> = {};
  RIVALS.forEach((rival, idx) => {
    const seed = hashString(`init-${rival.id}`);
    const stagger = (idx * 28 + (seed % 32)) - 20;
    const initialXp = Math.max(25, levelBase + stagger);
    const plan = computeDailyPlan(rival, todayISO);
    const startEarnedToday = plan.isActive ? Math.min(plan.dailyTargetXp, Math.round(plan.dailyTargetXp * 0.35)) : 0;

    states[rival.id] = {
      rivalId: rival.id,
      levelId: levelFromRivalXp(initialXp + startEarnedToday),
      xp: initialXp + startEarnedToday,
      lessonsCompleted: Math.min(48, Math.max(1, Math.floor((initialXp + startEarnedToday) / 65))),
      skillPct: 68 + (seed % 20),
      streak: plan.isActive ? 1 + (idx % 4) : 0,
      lastGainXp: startEarnedToday,
      isActiveToday: plan.isActive,
      lastActiveDate: plan.isActive ? todayISO : '',
      weeklyGainDate: weekKey,
      weeklyGainXp: startEarnedToday,
      dailyGainDate: todayISO,
      dailyGainXp: startEarnedToday,
      lastUpdatedAt: nowMs,
    };
  });
  return states;
}

export function syncAndAdvanceRivals(
  state: AppState,
  nowMs: number = Date.now(),
): {
  rivalStates: Record<string, RivalProgressState>;
  rivalLastTickAt: number;
  changed: boolean;
} {
  const studentLevel = getCurrentStudentLevel(state);
  const existing = state.rivalStates || {};
  const hasAllRivals = RIVALS.every((r) => Boolean(existing[r.id]));

  if (!hasAllRivals) {
    const initialized = createInitialRivalStates(studentLevel, nowMs);
    const merged: Record<string, RivalProgressState> = { ...initialized };
    for (const r of RIVALS) {
      if (existing[r.id]) merged[r.id] = existing[r.id];
    }
    return {
      rivalStates: merged,
      rivalLastTickAt: nowMs,
      changed: true,
    };
  }

  const lastGlobalTick = state.rivalLastTickAt || 0;
  const todayISO = formatLocalDateISO(nowMs);
  const lastGlobalDate = lastGlobalTick > 0 ? formatLocalDateISO(lastGlobalTick) : todayISO;

  // Throttle repeated calls within the same 10-minute window on the same calendar date -> zero double-counting
  if (nowMs - lastGlobalTick < MIN_TICK_MS && lastGlobalDate === todayISO) {
    return {
      rivalStates: existing,
      rivalLastTickAt: lastGlobalTick,
      changed: false,
    };
  }

  const todayStartMs = parseLocalDateStartMs(todayISO);
  const dayProgressFraction = Math.min(1, Math.max(0.05, (nowMs - todayStartMs) / DAY_MS));

  let changed = false;
  const nextStates: Record<string, RivalProgressState> = {};

  for (const rival of RIVALS) {
    const prev = existing[rival.id];
    let cur: RivalProgressState = { ...prev };
    const prevDate = cur.dailyGainDate || formatLocalDateISO(cur.lastUpdatedAt || nowMs);

    // 1. Walk any missed past calendar days up to yesterday (strictly capped to prevent runaway jumps)
    if (prevDate < todayISO) {
      let dayCursor = prevDate;
      let steps = 0;
      while (dayCursor < todayISO && steps < MAX_CATCHUP_DAYS) {
        const plan = computeDailyPlan(rival, dayCursor);
        const weekKey = getWeekKey(dayCursor);
        const weeklyCapXp = Math.round(rival.baseDailyRate * 7 * 1.35);

        if (cur.weeklyGainDate !== weekKey) {
          cur.weeklyGainDate = weekKey;
          cur.weeklyGainXp = 0;
        }
        if (cur.dailyGainDate !== dayCursor) {
          cur.dailyGainDate = dayCursor;
          cur.dailyGainXp = 0;
        }

        if (plan.isActive) {
          const remainingDaily = Math.max(0, plan.dailyTargetXp - cur.dailyGainXp);
          const remainingWeekly = Math.max(0, weeklyCapXp - cur.weeklyGainXp);
          const grant = Math.min(remainingDaily, remainingWeekly);
          if (grant > 0) {
            cur.xp += grant;
            cur.dailyGainXp += grant;
            cur.weeklyGainXp += grant;
            cur.lastGainXp = cur.dailyGainXp;
          }
          if (cur.lastActiveDate !== dayCursor) {
            cur.streak = cur.streak + 1;
            cur.lastActiveDate = dayCursor;
          }
        } else if (dayCursor !== cur.lastActiveDate) {
          // Rest day resets streak cleanly
          cur.streak = 0;
        }

        dayCursor = addDaysISO(dayCursor, 1);
        steps++;
      }

      // Reset daily accumulator cleanly for todayISO
      const todayWeekKey = getWeekKey(todayISO);
      if (cur.weeklyGainDate !== todayWeekKey) {
        cur.weeklyGainDate = todayWeekKey;
        cur.weeklyGainXp = 0;
      }
      cur.dailyGainDate = todayISO;
      cur.dailyGainXp = 0;
      cur.lastGainXp = 0;
      changed = true;
    }

    // 2. Compute intraday target on todayISO (idempotent target ceiling -> zero double-counting)
    const todayPlan = computeDailyPlan(rival, todayISO);
    const weeklyCapXp = Math.round(rival.baseDailyRate * 7 * 1.35);
    const todayWeekKey = getWeekKey(todayISO);
    if (cur.weeklyGainDate !== todayWeekKey) {
      cur.weeklyGainDate = todayWeekKey;
      cur.weeklyGainXp = 0;
    }

    cur.isActiveToday = todayPlan.isActive;
    if (todayPlan.isActive) {
      const targetToday = Math.min(todayPlan.dailyCapXp, Math.round(todayPlan.dailyTargetXp * dayProgressFraction));
      const deltaToday = Math.max(0, targetToday - cur.dailyGainXp);
      const remainingWeekly = Math.max(0, weeklyCapXp - cur.weeklyGainXp);
      const grant = Math.min(deltaToday, remainingWeekly);

      if (grant > 0) {
        cur.xp += grant;
        cur.dailyGainXp += grant;
        cur.weeklyGainXp += grant;
        cur.lastGainXp = cur.dailyGainXp;
        changed = true;
      }
      if (cur.lastActiveDate !== todayISO && cur.dailyGainXp > 0) {
        cur.streak = Math.max(1, cur.streak + 1);
        cur.lastActiveDate = todayISO;
        changed = true;
      }
    } else if (cur.lastGainXp !== 0 || cur.isActiveToday) {
      cur.lastGainXp = 0;
      cur.isActiveToday = false;
    }

    cur.levelId = levelFromRivalXp(cur.xp);
    cur.lessonsCompleted = Math.min(48, Math.max(1, Math.floor(cur.xp / 65)));
    const skillHash = hashString(`${rival.id}-${todayISO}`);
    cur.skillPct = Math.min(96, Math.max(62, 68 + (skillHash % 22)));
    cur.lastUpdatedAt = nowMs;

    nextStates[rival.id] = cur;
  }

  return {
    rivalStates: changed ? nextStates : existing,
    rivalLastTickAt: nowMs,
    changed,
  };
}

export function simulateManualRivalStep(
  state: AppState,
  nowMs: number = Date.now(),
): { rivalStates: Record<string, RivalProgressState>; bumpedRivalName: string; deltaXp: number } {
  const synced = syncAndAdvanceRivals(state, nowMs);
  const currentStates = { ...synced.rivalStates };
  const todayISO = formatLocalDateISO(nowMs);
  const todayWeek = getWeekKey(todayISO);

  const picked = RIVALS[Math.floor(Math.random() * RIVALS.length)];
  const cur = { ...currentStates[picked.id] };

  const dailyCap = Math.round(picked.baseDailyRate * 1.9);
  const weeklyCap = Math.round(picked.baseDailyRate * 7 * 1.35);

  const curDaily = cur.dailyGainDate === todayISO ? cur.dailyGainXp : 0;
  const curWeekly = cur.weeklyGainDate === todayWeek ? cur.weeklyGainXp : 0;

  const rawBump = Math.floor(Math.random() * 26) + 22;
  const grant = Math.max(
    8,
    Math.min(rawBump, Math.max(8, dailyCap - curDaily), Math.max(8, weeklyCap - curWeekly)),
  );

  cur.xp += grant;
  cur.dailyGainDate = todayISO;
  cur.dailyGainXp = curDaily + grant;
  cur.weeklyGainDate = todayWeek;
  cur.weeklyGainXp = curWeekly + grant;
  cur.lastGainXp = grant;
  cur.isActiveToday = true;
  if (cur.lastActiveDate !== todayISO) {
    cur.streak = Math.max(1, cur.streak + 1);
    cur.lastActiveDate = todayISO;
  }
  cur.levelId = levelFromRivalXp(cur.xp);
  cur.lessonsCompleted = Math.min(48, Math.max(1, Math.floor(cur.xp / 65)));
  cur.lastUpdatedAt = nowMs;

  currentStates[picked.id] = cur;
  return {
    rivalStates: currentStates,
    bumpedRivalName: picked.name,
    deltaXp: grant,
  };
}

export function computeRivalStandings(state: AppState): RivalStanding[] {
  const studentLevel: CEFRLevelId = getCurrentStudentLevel(state);
  const hasRivals = RIVALS.every((r) => Boolean(state.rivalStates?.[r.id]));
  const statesMap = hasRivals
    ? state.rivalStates
    : createInitialRivalStates(studentLevel, state.rivalLastTickAt || Date.now());

  const rivalRows: RivalStanding[] = RIVALS.map((rival) => {
    const rs = statesMap[rival.id];
    const override = state.rivalXpOverrides?.[rival.id] ?? 0;
    const totalXp = Math.max(15, (rs?.xp ?? 50) + override);
    return {
      id: rival.id,
      name: rival.name,
      avatarId: rival.avatarId,
      xp: totalXp,
      levelId: rs?.levelId ?? levelFromRivalXp(totalXp),
      isUser: false,
      tagline: rival.tagline,
      personalityLabel: rival.personalityLabel,
      lastGainXp: rs?.lastGainXp ?? 0,
      isActiveToday: rs?.isActiveToday ?? false,
      streak: rs?.streak ?? 0,
      lessonsCompleted: rs?.lessonsCompleted ?? Math.floor(totalXp / 65),
      skillPct: rs?.skillPct ?? 72,
    };
  });

  const userLessons = Object.values(state.completedLessons).filter((v) => v >= 70).length;
  const userRow: RivalStanding = {
    id: 'user-self',
    name: state.profile.name,
    avatarId: state.profile.avatarId,
    xp: state.xp,
    levelId: studentLevel,
    isUser: true,
    title: state.profile.title,
    lastGainXp: state.dailyXp,
    isActiveToday: state.lastStudyDate === formatLocalDateISO(Date.now()),
    streak: state.streak,
    lessonsCompleted: userLessons,
    skillPct: getAverageSkillAccuracy(state),
  };

  return [...rivalRows, userRow].sort((a, b) => b.xp - a.xp);
}

export function detectRankCrossing(
  prevOrder: string[],
  nextStandings: RivalStanding[],
): { overtook: string[]; overtakenBy: string[] } {
  if (!prevOrder || prevOrder.length === 0) {
    return { overtook: [], overtakenBy: [] };
  }
  const prevUserIdx = prevOrder.indexOf('user-self');
  const nextOrder = nextStandings.map((s) => s.id);
  const nextUserIdx = nextOrder.indexOf('user-self');

  if (prevUserIdx === -1 || nextUserIdx === -1) {
    return { overtook: [], overtakenBy: [] };
  }

  const overtook: string[] = [];
  const overtakenBy: string[] = [];

  for (const standing of nextStandings) {
    if (standing.isUser) continue;
    const prevRivalIdx = prevOrder.indexOf(standing.id);
    const nextRivalIdx = nextOrder.indexOf(standing.id);
    if (prevRivalIdx === -1 || nextRivalIdx === -1) continue;

    if (prevRivalIdx < prevUserIdx && nextRivalIdx > nextUserIdx) {
      overtook.push(standing.name);
    }
    if (prevRivalIdx > prevUserIdx && nextRivalIdx < nextUserIdx) {
      overtakenBy.push(standing.name);
    }
  }

  return { overtook, overtakenBy };
}
