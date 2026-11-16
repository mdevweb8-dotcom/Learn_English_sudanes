import { getLevelRangeBaseXp, RIVALS } from '../data/gamification';
import type { AppState, CEFRLevelId, RivalStanding } from '../types';
import { getCurrentStudentLevel, getTodayISO } from './storage';

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Generates simulated daily XP for the 5 fake rivals.
 * Rivals ALWAYS compete within the student's current level only — never higher levels.
 */
export function computeRivalStandings(state: AppState): RivalStanding[] {
  const studentLevel: CEFRLevelId = getCurrentStudentLevel(state);
  const today = getTodayISO();
  const baseLevelXp = getLevelRangeBaseXp(studentLevel);

  const rivalRows: RivalStanding[] = RIVALS.map((rival, idx) => {
    const seed = hashString(`${rival.id}-${today}-${studentLevel}`);
    const dailyDrift = (seed % 36) + 12; // Automatic daily variation
    const spreadOffset = (idx - 2) * 35;
    const override = state.rivalXpOverrides[rival.id] ?? 0;

    // Anchor around the student's current level & XP so competition is exciting and fair
    const anchor = Math.max(baseLevelXp, Math.round(state.xp * 0.92));
    const computedXp = Math.max(15, anchor + spreadOffset + dailyDrift + override);

    return {
      id: rival.id,
      name: rival.name,
      avatarId: rival.avatarId,
      xp: computedXp,
      levelId: studentLevel,
      isUser: false,
      tagline: rival.tagline,
    };
  });

  const userRow: RivalStanding = {
    id: 'user-self',
    name: state.profile.name,
    avatarId: state.profile.avatarId,
    xp: state.xp,
    levelId: studentLevel,
    isUser: true,
    title: state.profile.title,
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

    // Rival used to be ahead (smaller index) and is now behind user
    if (prevRivalIdx < prevUserIdx && nextRivalIdx > nextUserIdx) {
      overtook.push(standing.name);
    }
    // Rival used to be behind (larger index) and is now ahead of user
    if (prevRivalIdx > prevUserIdx && nextRivalIdx < nextUserIdx) {
      overtakenBy.push(standing.name);
    }
  }

  return { overtook, overtakenBy };
}
