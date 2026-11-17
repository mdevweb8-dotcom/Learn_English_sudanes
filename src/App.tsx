import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  Coins,
  Copy,
  DownloadCloud,
  Flame,
  Globe,
  GraduationCap,
  HelpCircle,
  Home,
  Lock,
  Settings,
  Sparkles,
  Swords,
  Table2,
  Trophy,
  Unlock,
  UploadCloud,
  Users,
  Wifi,
  Zap,
} from 'lucide-react';
import type {
  AppState,
  CEFRLevelId,
  FriendComparison,
  Lesson,
  MatchRecord,
  PeerInfo,
  Rival,
  SavedWord,
  ShopItem,
  VocabItem,
} from './types';
import {
  CEFR_LEVELS,
  CEFR_ORDER,
  getAdaptiveReviewQuestions,
  getFinalExamQuestions,
  getLessonById,
} from './data/curriculum';
import { RIVALS } from './data/gamification';
import {
  createInitialState,
  exportProgressJSON,
  generateSixDigitCode,
  getAverageSkillAccuracy,
  getCurrentStudentLevel,
  getOfflineCachedLevelIds,
  getTodayISO,
  getYesterdayISO,
  loadStateFromIndexedDB,
  loadStateFromLocal,
  parseFriendInviteCode,
  peerToFriendComparison,
  persistState,
  removeOfflineLevelBundle,
  saveOfflineLevelBundle,
} from './services/storage';
import {
  computeRivalStandings,
  detectRankCrossing,
  simulateManualRivalStep,
  syncAndAdvanceRivals,
} from './services/rivals';
import { recordVocabOutcome, seedLessonVocabSeen } from './services/srs';
import { initNativeCapacitor, sendNativeNotification, triggerHaptic } from './services/native';
import { realtimeClient, type RealtimeState } from './services/realtime';
import { AvatarView } from './components/AvatarView';
import { LessonWorkspace } from './components/LessonWorkspace';
import { QuizEngine, type QuizSessionOutcome } from './components/QuizEngine';
import { AnalyticsView } from './components/AnalyticsView';
import { LeaderboardView } from './components/LeaderboardView';
import { GamificationView } from './components/GamificationView';
import { AITeacherModal } from './components/AITeacherModal';
import { OfflineStatusNotice, PWAInstallButton } from './components/PWAInstallBanner';
import { SpeechErrorBanner } from './components/SpeakButton';
import { IncomingChallengeBanner, MultiplayerHubModal } from './components/MultiplayerHubModal';
import { FriendsComparisonModal } from './components/FriendsComparisonModal';
import type { PronunciationResult } from './components/PronunciationLab';

type NavTab = 'home' | 'levels' | 'analytics' | 'leaderboard' | 'shop' | 'settings';

interface ToastMessage {
  id: number;
  tone: 'info' | 'success' | 'warning';
  text: string;
}

export default function App() {
  const [state, setState] = useState<AppState>(() => loadStateFromLocal());
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [selectedLevelId, setSelectedLevelId] = useState<CEFRLevelId>(() =>
    getCurrentStudentLevel(loadStateFromLocal()),
  );
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [examLevelId, setExamLevelId] = useState<CEFRLevelId | null>(null);
  const [smartReviewOpen, setSmartReviewOpen] = useState(false);
  const [dailyChallengeRival, setDailyChallengeRival] = useState<Rival | null>(null);
  const [teacherQuery, setTeacherQuery] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [nameInput, setNameInput] = useState(state.profile.name);
  const [realtime, setRealtime] = useState<RealtimeState>(() => realtimeClient.getSnapshot());
  const [multiplayerTab, setMultiplayerTab] = useState<'wifi' | 'online' | 'teams' | null>(null);
  const [friendsModalOpen, setFriendsModalOpen] = useState(false);
  const [copiedPrivateCode, setCopiedPrivateCode] = useState(false);

  const pushToast = (text: string, tone: ToastMessage['tone'] = 'info') => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev.slice(-2), { id, tone, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5200);
  };

  // Apply theme CSS variables
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.profile.theme || 'ocean');
  }, [state.profile.theme]);

  // Hydrate from IndexedDB if newer + initialize Capacitor + daily streak rollover
  useEffect(() => {
    initNativeCapacitor();
    let mounted = true;
    (async () => {
      const idbState = await loadStateFromIndexedDB();
      const cachedOffline = await getOfflineCachedLevelIds();
      if (!mounted) return;

      setState((prev) => {
        const chosen = idbState && idbState.updatedAt > prev.updatedAt ? idbState : prev;
        const today = getTodayISO();
        const yesterday = getYesterdayISO();

        // Check if streak broke from missing a day
        let nextStreak = chosen.streak;
        if (chosen.lastStudyDate && chosen.lastStudyDate !== today && chosen.lastStudyDate !== yesterday) {
          nextStreak = 0;
        }
        const dailyXp = chosen.dailyDate === today ? chosen.dailyXp : 0;
        const hydratedCandidate: AppState = {
          ...chosen,
          streak: nextStreak,
          dailyXp,
          dailyDate: today,
          offlineLevels: cachedOffline.length > 0 ? cachedOffline : chosen.offlineLevels,
        };
        const syncedRivals = syncAndAdvanceRivals(hydratedCandidate, Date.now());

        return {
          ...hydratedCandidate,
          rivalStates: syncedRivals.rivalStates,
          rivalLastTickAt: syncedRivals.rivalLastTickAt,
        };
      });
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Autonomous AI rival progression tick every 60 seconds (idempotent, respects rest days & caps)
  useEffect(() => {
    const timer = setInterval(() => {
      setState((prev) => {
        const synced = syncAndAdvanceRivals(prev, Date.now());
        if (!synced.changed) return prev;
        return {
          ...prev,
          rivalStates: synced.rivalStates,
          rivalLastTickAt: synced.rivalLastTickAt,
        };
      });
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  // Persist dual localStorage + IndexedDB on state updates
  useEffect(() => {
    persistState(state);
    setNameInput(state.profile.name);
  }, [state]);

  const standings = useMemo(() => computeRivalStandings(state), [state]);
  const currentStudentLevel = getCurrentStudentLevel(state);

  // Subscribe to WebSocket multiplayer & presence client
  useEffect(() => {
    return realtimeClient.subscribe((snap) => {
      setRealtime(snap);
    });
  }, []);

  useEffect(() => {
    const passedLessonsCount = Object.values(state.completedLessons).filter((v) => v >= 70).length;
    realtimeClient.connect({
      privateCode: state.profile.privateCode,
      name: state.profile.name,
      avatarId: state.profile.avatarId,
      levelId: currentStudentLevel,
      lanServerUrl: state.profile.lanServerUrl,
      xp: state.xp,
      streak: state.streak,
      completedLessons: passedLessonsCount,
      avgSkill: getAverageSkillAccuracy(state),
      unlockedLevels: state.unlockedLevels,
    });
  }, [
    state.profile.privateCode,
    state.profile.name,
    state.profile.avatarId,
    currentStudentLevel,
    state.profile.lanServerUrl,
    state.xp,
    state.streak,
    state.completedLessons,
    state.skills,
    state.unlockedLevels,
  ]);

  // Detect rank crossing whenever standings change
  useEffect(() => {
    const nextOrder = standings.map((s) => s.id);
    if (state.lastRankOrder.length === 0) {
      setState((prev) => ({ ...prev, lastRankOrder: nextOrder }));
      return;
    }

    const sameOrder =
      state.lastRankOrder.length === nextOrder.length &&
      state.lastRankOrder.every((id, idx) => id === nextOrder[idx]);
    if (sameOrder) return;

    const { overtook, overtakenBy } = detectRankCrossing(state.lastRankOrder, standings);
    for (const rivalName of overtakenBy) {
      const msg = `⚠️ ${rivalName} تجاوزك! ارجع وذاكر درس اليوم`;
      pushToast(msg, 'warning');
      sendNativeNotification('تحديث لوحة الصدارة', msg);
    }
    for (const rivalName of overtook) {
      const msg = `🎉 أحسنت! تجاوزت ${rivalName}!`;
      pushToast(msg, 'success');
      sendNativeNotification('إنجاز في الصدارة', msg);
    }

    setState((prev) => ({ ...prev, lastRankOrder: nextOrder }));
  }, [standings]);

  const isLevelCompleted100 = (levelId: CEFRLevelId, s: AppState = state): boolean => {
    const level = CEFR_LEVELS.find((l) => l.id === levelId);
    if (!level) return false;
    const allLessonsPassed = level.lessons.every((l) => (s.completedLessons[l.id] ?? 0) >= 70);
    const examPassed = (s.completedLevelExams[levelId] ?? 0) >= 70;
    return allLessonsPassed && examPassed;
  };

  const getLevelProgress = (levelId: CEFRLevelId, s: AppState = state) => {
    const level = CEFR_LEVELS.find((l) => l.id === levelId);
    if (!level) return { done: 0, total: 9, pct: 0, examPassed: false, lessonsDone: 0 };
    const lessonsDone = level.lessons.filter((l) => (s.completedLessons[l.id] ?? 0) >= 70).length;
    const examPassed = (s.completedLevelExams[levelId] ?? 0) >= 70;
    const totalSteps = level.lessons.length + 1;
    const doneSteps = lessonsDone + (examPassed ? 1 : 0);
    return {
      done: doneSteps,
      total: totalSteps,
      lessonsDone,
      examPassed,
      pct: Math.round((doneSteps / totalSteps) * 100),
    };
  };

  // Find next lesson to continue on Home screen
  const nextStudyLesson: Lesson = useMemo(() => {
    for (const lvlId of state.unlockedLevels) {
      const lvl = CEFR_LEVELS.find((l) => l.id === lvlId);
      if (!lvl) continue;
      const incomplete = lvl.lessons.find((l) => (state.completedLessons[l.id] ?? 0) < 70);
      if (incomplete) return incomplete;
    }
    const lvl = CEFR_LEVELS.find((l) => l.id === currentStudentLevel) || CEFR_LEVELS[0];
    return lvl.lessons[lvl.lessons.length - 1];
  }, [state.unlockedLevels, state.completedLessons, currentStudentLevel]);

  const applyStudyRewards = (
    prev: AppState,
    outcome: QuizSessionOutcome,
    extraXp: number,
    newBadgeIds: string[] = [],
  ): AppState => {
    const today = getTodayISO();
    const yesterday = getYesterdayISO();

    // Streak update
    let nextStreak = prev.streak;
    if (prev.lastStudyDate !== today) {
      nextStreak = prev.lastStudyDate === yesterday ? prev.streak + 1 : 1;
    }

    // Skill tracking
    const nextSkills = { ...prev.skills };
    for (const ev of outcome.skillEvents) {
      const cur = nextSkills[ev.skill] || { correct: 0, attempts: 0, recentCorrect: 0, recentAttempts: 0 };
      nextSkills[ev.skill] = {
        correct: cur.correct + (ev.correct ? 1 : 0),
        attempts: cur.attempts + 1,
        recentCorrect: cur.recentCorrect + (ev.correct ? 1 : 0),
        recentAttempts: cur.recentAttempts + 1,
      };
    }

    // SRS vocabulary mastery progression
    let nextVocabProgress = prev.vocabProgress;
    if (outcome.vocabEvents && outcome.vocabEvents.length > 0) {
      const nowMs = Date.now();
      for (const ev of outcome.vocabEvents) {
        nextVocabProgress = recordVocabOutcome(nextVocabProgress, ev.targetWord, ev.correct, nowMs);
      }
    }

    // Pronunciation records
    const newPronRecords = outcome.pronunciationRecords.map((r, idx) => ({
      id: `pr-${Date.now()}-${idx}`,
      lessonId: activeLessonId || nextStudyLesson.id,
      target: r.target,
      spoken: r.spoken,
      score: r.score,
      feedback: r.feedback,
      selfAssessed: r.selfAssessed,
      timestamp: new Date().toISOString(),
    }));

    const excellentAdd = outcome.pronunciationRecords.filter((r) => r.feedback === 'ممتاز').length;
    const totalXpGain = outcome.xpEarned + extraXp;
    const nextXp = prev.xp + totalXpGain;
    const nextExcellentPron = prev.excellentPronunciations + excellentAdd;
    const nextChallengesWon = prev.challengesWon + (outcome.beatRival ? 1 : 0);

    const badgeSet = new Set([...prev.badges, ...newBadgeIds]);
    if (Object.keys(prev.completedLessons).length > 0 || extraXp >= 50) badgeSet.add('first_lesson');
    if (nextStreak >= 7) badgeSet.add('streak_7');
    if (nextExcellentPron >= 10) badgeSet.add('pron_10');
    if (nextChallengesWon >= 1) badgeSet.add('challenge_win');
    if (nextXp >= 500) badgeSet.add('xp_500');

    return {
      ...prev,
      xp: nextXp,
      coins: prev.coins + outcome.coinsEarned,
      streak: nextStreak,
      lastStudyDate: today,
      dailyXp: (prev.dailyDate === today ? prev.dailyXp : 0) + totalXpGain,
      dailyDate: today,
      skills: nextSkills,
      vocabProgress: nextVocabProgress,
      pronunciationHistory: [...newPronRecords, ...prev.pronunciationHistory].slice(0, 60),
      excellentPronunciations: nextExcellentPron,
      challengesWon: nextChallengesWon,
      badges: Array.from(badgeSet),
    };
  };

  const handleRecordPronunciation = (lessonId: string, result: PronunciationResult) => {
    setState((prev) => {
      const isPass = result.score >= 50;
      const cur = prev.skills.pronunciation;
      const nextPron = {
        correct: cur.correct + (isPass ? 1 : 0),
        attempts: cur.attempts + 1,
        recentCorrect: cur.recentCorrect + (isPass ? 1 : 0),
        recentAttempts: cur.recentAttempts + 1,
      };
      const nextExcellent = prev.excellentPronunciations + (result.feedback === 'ممتاز' ? 1 : 0);
      const badgeSet = new Set(prev.badges);
      if (nextExcellent >= 10) badgeSet.add('pron_10');

      const record = {
        id: `pr-${Date.now()}`,
        lessonId,
        target: result.target,
        spoken: result.spoken,
        score: result.score,
        feedback: result.feedback,
        selfAssessed: result.selfAssessed,
        timestamp: new Date().toISOString(),
      };

      return {
        ...prev,
        xp: prev.xp + (isPass ? 10 : 2),
        skills: { ...prev.skills, pronunciation: nextPron },
        pronunciationHistory: [record, ...prev.pronunciationHistory].slice(0, 60),
        excellentPronunciations: nextExcellent,
        badges: Array.from(badgeSet),
      };
    });
  };

  const handleLessonQuizComplete = (lesson: Lesson, outcome: QuizSessionOutcome) => {
    const firstPass = outcome.passed && (state.completedLessons[lesson.id] ?? 0) < 70;
    const lessonBonusXp = outcome.passed ? (firstPass ? 50 : 20) : 0;

    setState((prev) => {
      const updated = applyStudyRewards(prev, outcome, lessonBonusXp, ['first_lesson']);
      const prevBest = prev.completedLessons[lesson.id] ?? 0;
      const nextBest = Math.max(prevBest, outcome.scorePercent);
      return {
        ...updated,
        vocabProgress: seedLessonVocabSeen(updated.vocabProgress, lesson),
        completedLessons: {
          ...updated.completedLessons,
          [lesson.id]: nextBest,
        },
      };
    });

    if (outcome.passed) {
      triggerHaptic('success');
      pushToast(
        `🎉 أكملت "${lesson.title}" بنسبة ${outcome.scorePercent}% (+${outcome.xpEarned + lessonBonusXp} XP)!`,
        'success',
      );
    } else {
      pushToast(`حصلت على ${outcome.scorePercent}%. تحتاج 70% فأكثر لاجتياز الدرس!`, 'info');
    }
  };

  const handleLevelExamComplete = (levelId: CEFRLevelId, outcome: QuizSessionOutcome) => {
    const levelIndex = CEFR_ORDER.indexOf(levelId);
    const nextLevelId = levelIndex >= 0 && levelIndex + 1 < CEFR_ORDER.length ? CEFR_ORDER[levelIndex + 1] : null;
    const firstExamPass = outcome.passed && (state.completedLevelExams[levelId] ?? 0) < 70;
    const bonusXp = firstExamPass ? 500 : outcome.passed ? 100 : 0;

    setState((prev) => {
      const nextBest = Math.max(prev.completedLevelExams[levelId] ?? 0, outcome.scorePercent);
      const tempState: AppState = {
        ...prev,
        completedLevelExams: {
          ...prev.completedLevelExams,
          [levelId]: nextBest,
        },
      };

      const canUnlockNext = nextLevelId && isLevelCompleted100(levelId, tempState);
      const nextUnlocked =
        canUnlockNext && !prev.unlockedLevels.includes(nextLevelId)
          ? [...prev.unlockedLevels, nextLevelId]
          : prev.unlockedLevels;

      const updated = applyStudyRewards(
        tempState,
        outcome,
        bonusXp,
        outcome.passed ? [`level_${levelId}`] : [],
      );

      return {
        ...updated,
        unlockedLevels: nextUnlocked,
      };
    });

    setExamLevelId(null);

    if (outcome.passed) {
      triggerHaptic('success');
      pushToast(
        nextLevelId
          ? `🏆 مبروك! أنهيت المستوى ${levelId} (+500 XP + شارة) وانفتح المستوى ${nextLevelId}!`
          : `👑 تهانينا الخالصة! أتممت المستوى النهائي C2 بنجاح!`,
        'success',
      );
    } else {
      pushToast(`الدرجة ${outcome.scorePercent}%. يلزم 70% فأكثر لفتح المستوى التالي.`, 'warning');
    }
  };

  const handleSmartReviewComplete = (outcome: QuizSessionOutcome) => {
    setState((prev) => {
      const updated = applyStudyRewards(prev, outcome, outcome.passed ? 35 : 10);
      return {
        ...updated,
        smartReviewDoneDate: getTodayISO(),
      };
    });
    setSmartReviewOpen(false);
    pushToast(`أتممت المراجعة الذكية اليومية (+${outcome.xpEarned + (outcome.passed ? 35 : 10)} XP)!`, 'success');
  };

  const handleDailyChallengeComplete = (outcome: QuizSessionOutcome) => {
    setState((prev) => {
      const bonus = outcome.beatRival ? 60 : 20;
      const updated = applyStudyRewards(prev, outcome, bonus);
      return {
        ...updated,
        dailyChallengeDoneDate: getTodayISO(),
      };
    });
    setDailyChallengeRival(null);
    if (outcome.beatRival) {
      pushToast(`🎉 فزت في تحدي اليوم ضد ${outcome.rivalName}! (+${outcome.xpEarned + 60} XP)`, 'success');
    } else {
      pushToast(`انتهى التحدي مع ${outcome.rivalName}! حصلت على +${outcome.xpEarned + 20} XP.`, 'info');
    }
  };

  const handleSimulateRivalTick = () => {
    const nowMs = Date.now();
    let notice = '';
    setState((prev) => {
      const res = simulateManualRivalStep(prev, nowMs);
      notice = `⚡ ${res.bumpedRivalName} أنهى جلسة تدريب (+${res.deltaXp} XP)`;
      return {
        ...prev,
        rivalStates: res.rivalStates,
        rivalLastTickAt: nowMs,
      };
    });
    if (notice) {
      pushToast(notice, 'info');
    }
  };

  const handleBuyOrEquipShopItem = (item: ShopItem): { ok: boolean; message: string } => {
    const alreadyOwned = state.ownedItems.includes(item.id) || item.cost === 0;
    if (!alreadyOwned && state.coins < item.cost) {
      return { ok: false, message: `تحتاج ${item.cost - state.coins} Coins إضافية لشراء هذا العنصر.` };
    }

    setState((prev) => {
      const nextOwned = alreadyOwned ? prev.ownedItems : [...prev.ownedItems, item.id];
      const nextCoins = alreadyOwned ? prev.coins : prev.coins - item.cost;
      const nextProfile = { ...prev.profile };
      if (item.category === 'theme') nextProfile.theme = item.value as AppState['profile']['theme'];
      if (item.category === 'avatar') nextProfile.avatarId = item.value;
      if (item.category === 'title') nextProfile.title = item.value;

      return {
        ...prev,
        coins: nextCoins,
        ownedItems: nextOwned,
        profile: nextProfile,
      };
    });

    triggerHaptic('success');
    return {
      ok: true,
      message: alreadyOwned ? `تم تفعيل "${item.name}" بنجاح.` : `مبروك! اشتريت وفعّلت "${item.name}".`,
    };
  };

  const handleToggleOfflineLevel = async (levelId: CEFRLevelId) => {
    const isSaved = state.offlineLevels.includes(levelId);
    if (isSaved) {
      await removeOfflineLevelBundle(levelId);
      setState((prev) => ({
        ...prev,
        offlineLevels: prev.offlineLevels.filter((id) => id !== levelId),
      }));
      pushToast(`تمت إزالة حزمة أوفلاين للمستوى ${levelId}.`, 'info');
    } else {
      const ok = await saveOfflineLevelBundle(levelId);
      if (ok) {
        setState((prev) => ({
          ...prev,
          offlineLevels: Array.from(new Set([...prev.offlineLevels, levelId])),
        }));
        pushToast(`تم حفظ جميع دروس واختبارات المستوى ${levelId} للعمل الكامل بدون إنترنت!`, 'success');
      }
    }
  };

  const upsertFriendComparison = (friend: FriendComparison) => {
    setState((prev) => {
      const filtered = prev.friends.filter((f) => {
        if (friend.privateCode && f.privateCode) {
          return f.privateCode !== friend.privateCode;
        }
        return f.code !== friend.code && f.name !== friend.name;
      });
      return {
        ...prev,
        friends: [friend, ...filtered].slice(0, 20),
      };
    });
  };

  const handleAddFriendFromPeer = (peer: PeerInfo): { ok: boolean; message: string } => {
    if (peer.privateCode === state.profile.privateCode) {
      return { ok: false, message: 'هذا رقمك الخاص! لا يمكنك إضافة نفسك كصديق.' };
    }
    const friend = peerToFriendComparison(peer);
    upsertFriendComparison(friend);
    pushToast(`تمت إضافة "${friend.name}" إلى قائمة الأصدقاء والمقارنة!`, 'success');
    return { ok: true, message: `تمت إضافة "${friend.name}" (${friend.privateCode}) بنجاح!` };
  };

  const handleAddFriendByAnyCode = async (codeInput: string): Promise<{ ok: boolean; message: string }> => {
    const clean = codeInput.trim();
    if (!clean) {
      return { ok: false, message: 'أدخل الرقم الخاص (6 أرقام) أو كود المشاركة FFH-.' };
    }

    if (clean.startsWith('FFH-')) {
      try {
        const friend = parseFriendInviteCode(clean);
        if (friend.privateCode && friend.privateCode === state.profile.privateCode) {
          return { ok: false, message: 'هذا كودك الشخصي! لا يمكنك إضافة نفسك.' };
        }
        upsertFriendComparison(friend);
        pushToast(`تمت إضافة "${friend.name}" للمقارنة!`, 'success');
        return { ok: true, message: `تمت إضافة "${friend.name}" للمقارنة المباشرة!` };
      } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : 'تعذر قراءة كود الصديق.' };
      }
    }

    const sixDigits = clean.replace(/\D/g, '');
    if (sixDigits.length !== 6) {
      return { ok: false, message: 'أدخل رقماً خاصاً صحيحاً من 6 أرقام أو كود FFH- كامل.' };
    }
    if (sixDigits === state.profile.privateCode) {
      return { ok: false, message: 'هذا رقمك الخاص! أدخل رقم صديقك المكون من 6 أرقام.' };
    }

    let peer = realtime.connected ? await realtimeClient.lookupPeer(sixDigits, 'online') : null;
    if ((!peer || peer.status === 'offline') && realtime.wifiConnected) {
      peer = await realtimeClient.lookupPeer(sixDigits, 'wifi');
    }
    if (!peer && !realtime.connected && !realtime.wifiConnected) {
      peer = await realtimeClient.lookupPeer(sixDigits, 'online');
    }
    if (!peer || peer.status === 'offline') {
      return {
        ok: false,
        message:
          'لم يُعثر على صديق متصل بهذا الرقم حالياً. تأكد أن صديقك فتح التطبيق على نفس الواي فاي أو الإنترنت، أو استخدم كود FFH- الأوفلاين.',
      };
    }

    const friend = peerToFriendComparison(peer);
    upsertFriendComparison(friend);
    pushToast(`تمت إضافة "${friend.name}" (${sixDigits}) لقائمة الأصدقاء!`, 'success');
    return {
      ok: true,
      message: `تمت إضافة "${friend.name}" (${sixDigits} · المستوى ${friend.level}) لقائمة الأصدقاء والمقارنة!`,
    };
  };

  const handleRemoveFriend = (codeOrPrivateCode: string) => {
    setState((prev) => ({
      ...prev,
      friends: prev.friends.filter(
        (f) => f.code !== codeOrPrivateCode && f.privateCode !== codeOrPrivateCode,
      ),
    }));
    pushToast('تمت إزالة الصديق من القائمة.', 'info');
  };

  const handleRefreshFriend = async (privateCode: string): Promise<{ ok: boolean; message: string }> => {
    const clean = privateCode.trim();
    if (!/^\d{6}$/.test(clean)) {
      return { ok: false, message: 'لا يوجد رقم خاص من 6 أرقام لتحديث هذا الصديق.' };
    }
    let peer = realtime.connected ? await realtimeClient.lookupPeer(clean, 'online') : null;
    if ((!peer || peer.status === 'offline') && realtime.wifiConnected) {
      peer = await realtimeClient.lookupPeer(clean, 'wifi');
    }
    if (!peer && !realtime.connected && !realtime.wifiConnected) {
      peer = await realtimeClient.lookupPeer(clean, 'online');
    }
    if (!peer || peer.status === 'offline') {
      return { ok: false, message: `الصديق (${clean}) غير متصل حالياً لتحديث إحصائياته.` };
    }
    const updated = peerToFriendComparison(peer);
    upsertFriendComparison(updated);
    return { ok: true, message: `تم تحديث تقدم "${updated.name}" بنجاح.` };
  };

  const handleChallengeSavedFriend = (privateCode: string) => {
    const clean = privateCode.trim();
    if (!/^\d{6}$/.test(clean)) return;
    const preferWifi = realtime.wifiConnected && !realtime.connected;
    const mode = preferWifi ? 'wifi' : 'online';
    setFriendsModalOpen(false);
    setMultiplayerTab(mode);
    void realtimeClient.lookupPeer(clean, mode);
    void realtimeClient.sendChallenge(clean, mode, true);
    pushToast(`تم إرسال طلب التحدي إلى الصديق (${clean})!`, 'info');
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as AppState;
        if (!parsed.unlockedLevels || typeof parsed.xp !== 'number') {
          throw new Error('ملف نسخ احتياطي غير صالح');
        }
        setState(parsed);
        pushToast('تم استعادة تقدمك من الملف الاحتياطي بنجاح.', 'success');
      } catch {
        pushToast('الملف المحدد لا يحتوي على بيانات Friendly Fluency Hub صالحة.', 'warning');
      }
    };
    reader.readAsText(file);
  };

  const handleCopyPrivateCode = async () => {
    try {
      await navigator.clipboard.writeText(state.profile.privateCode);
      setCopiedPrivateCode(true);
      pushToast(`تم نسخ الرقم الخاص: ${state.profile.privateCode}`, 'success');
      setTimeout(() => setCopiedPrivateCode(false), 2000);
    } catch {
      pushToast(`رقمك الخاص هو: ${state.profile.privateCode}`, 'info');
    }
  };

  const handleRegeneratePrivateCode = () => {
    const nextCode = generateSixDigitCode();
    setState((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        privateCode: nextCode,
      },
    }));
    pushToast(`تم توليد رقم خاص جديد: ${nextCode}`, 'success');
  };

  const handleUpdateLanUrl = (url: string) => {
    setState((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        lanServerUrl: url.trim(),
      },
    }));
    pushToast(url.trim() ? 'تم حفظ عنوان السيرفر المحلي على الشبكة.' : 'تمت العودة للاتصال الافتراضي.', 'info');
  };

  const handleToggleSaveWord = (vocab: VocabItem, lessonId: string) => {
    const exists = state.savedWords.some((w) => w.id === vocab.id);
    if (exists) {
      setState((prev) => ({
        ...prev,
        savedWords: prev.savedWords.filter((w) => w.id !== vocab.id),
      }));
      pushToast(`تمت إزالة "${vocab.word}" من سجل المفردات.`, 'info');
      return;
    }

    const entry: SavedWord = {
      ...vocab,
      lessonId,
      savedAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      savedWords: [entry, ...prev.savedWords],
    }));
    pushToast(`تم حفظ "${vocab.word}" في سجل المفردات!`, 'success');
  };

  const handleRemoveSavedWord = (wordId: string) => {
    setState((prev) => ({
      ...prev,
      savedWords: prev.savedWords.filter((w) => w.id !== wordId),
    }));
  };

  const handlePracticeSavedComplete = (outcome: QuizSessionOutcome) => {
    setState((prev) => applyStudyRewards(prev, outcome, outcome.passed ? 25 : 10));
    pushToast(
      `انتهى تدريب المفردات المحفوظة بنتيجة ${outcome.scorePercent}% (+${outcome.xpEarned + (outcome.passed ? 25 : 10)} XP)!`,
      outcome.passed ? 'success' : 'info',
    );
  };

  const handleSaveMatchResult = (record: MatchRecord, xpReward: number, coinsReward: number) => {
    const today = getTodayISO();
    setState((prev) => {
      const nextXp = prev.xp + xpReward;
      const nextChallengesWon = prev.challengesWon + (record.won ? 1 : 0);
      const badgeSet = new Set(prev.badges);
      if (nextChallengesWon >= 1) badgeSet.add('challenge_win');
      if (nextXp >= 500) badgeSet.add('xp_500');

      return {
        ...prev,
        xp: nextXp,
        coins: prev.coins + coinsReward,
        challengesWon: nextChallengesWon,
        dailyXp: (prev.dailyDate === today ? prev.dailyXp : 0) + xpReward,
        dailyDate: today,
        badges: Array.from(badgeSet),
        matchHistory: [record, ...prev.matchHistory].slice(0, 10),
      };
    });
    pushToast(
      record.won
        ? `🏆 فاز فريقك! حصلت على +${xpReward} XP و +${coinsReward} Coins.`
        : `انتهت المباراة! حصلت على +${xpReward} XP و +${coinsReward} Coins.`,
      record.won ? 'success' : 'info',
    );
  };

  const isKids = state.profile.mode === 'kids';
  const activeLesson = activeLessonId ? getLessonById(activeLessonId) : undefined;
  const smartReviewBundle = useMemo(
    () =>
      getAdaptiveReviewQuestions(
        state.unlockedLevels,
        state.completedLessons,
        nextStudyLesson.id,
        state.skills,
        state.vocabProgress,
      ),
    [state.unlockedLevels, state.completedLessons, nextStudyLesson.id, state.skills, state.vocabProgress],
  );

  const dailyChallengeQuestions = useMemo(() => {
    const lvl = CEFR_LEVELS.find((l) => l.id === currentStudentLevel) || CEFR_LEVELS[0];
    const pool = lvl.lessons.flatMap((l) => l.questions.filter((q) => q.type !== 'pronunciation'));
    return pool.slice(0, 10);
  }, [currentStudentLevel]);

  const navItems: Array<{ id: NavTab; label: string; icon: React.ReactNode }> = [
    { id: 'home', label: 'الرئيسية', icon: <Home className="h-5 w-5" /> },
    { id: 'levels', label: 'المستويات', icon: <GraduationCap className="h-5 w-5" /> },
    { id: 'analytics', label: 'تحليلي', icon: <BarChart3 className="h-5 w-5" /> },
    { id: 'leaderboard', label: 'الصدارة', icon: <Trophy className="h-5 w-5" /> },
    { id: 'shop', label: 'الإنجازات والمتجر', icon: <Award className="h-5 w-5" /> },
    { id: 'settings', label: 'الإعدادات', icon: <Settings className="h-5 w-5" /> },
  ];

  const selectedLevelObj = CEFR_LEVELS.find((l) => l.id === selectedLevelId) || CEFR_LEVELS[0];
  const selectedLevelUnlocked = state.unlockedLevels.includes(selectedLevelId);
  const selectedLevelProgress = getLevelProgress(selectedLevelId);
  const allLessonsInSelectedDone = selectedLevelProgress.lessonsDone === selectedLevelObj.lessons.length;

  return (
    <div className={`min-h-screen pb-20 lg:pb-6 ${isKids ? 'bg-[#FFFBF2]' : 'bg-[#F8FAFC]'}`}>
      <OfflineStatusNotice />

      {/* Toast Notifications (Rival Overtook, Rewards) */}
      {toasts.length > 0 && (
        <div className="fixed left-4 right-4 top-4 z-50 mx-auto flex max-w-md flex-col gap-2 sm:left-6 sm:right-auto">
          {toasts.map((t) => (
            <div
              key={t.id}
              role="status"
              className={`rounded-xl border px-4 py-3 text-xs font-extrabold shadow-lg ${
                t.tone === 'warning'
                  ? 'border-amber-300 bg-amber-50 text-amber-950'
                  : t.tone === 'success'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                    : 'border-slate-200 bg-white text-slate-900'
              }`}
            >
              {t.text}
            </div>
          ))}
        </div>
      )}

      <div className="mx-auto flex max-w-7xl gap-6 px-3 pt-4 sm:px-6">
        {/* Desktop Sidebar */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-4 space-y-5 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--accent-primary)] font-en text-base font-extrabold text-white">
                En
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-extrabold text-slate-900">Friendly Fluency Hub</h1>
                <p className="text-xs text-slate-500">إتقان الإنجليزية من A1 إلى C2</p>
              </div>
            </div>

            <nav className="space-y-1.5" aria-label="التنقل الرئيسي">
              {navItems.map((item) => {
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setActiveLessonId(null);
                    }}
                    className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold transition ${
                      active
                        ? 'bg-[var(--accent-primary)] text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {item.icon}
                    <span className="whitespace-nowrap">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setTeacherQuery('')}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-soft)] px-4 py-2.5 text-xs font-extrabold text-[var(--accent-text)] transition hover:opacity-90"
              >
                <HelpCircle className="h-4 w-4" />
                <span>اسأل المعلم (بالسوداني)</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main Column */}
        <main className="min-w-0 flex-1 space-y-5">
          {/* Top Header Bar */}
          <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-5">
            <div className="flex items-center gap-3">
              <AvatarView avatarId={state.profile.avatarId} size={42} />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-extrabold text-slate-900">{state.profile.name}</span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span className="text-xs font-bold text-[var(--accent-text)]">{state.profile.title}</span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span className="text-xs font-bold text-slate-600">المستوى {currentStudentLevel}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs font-bold text-slate-600 tabular-nums">
                  <span className="inline-flex items-center gap-1 text-[var(--accent-primary)]">
                    <Zap className="h-3.5 w-3.5" /> {state.xp} XP
                  </span>
                  <span className="inline-flex items-center gap-1 text-amber-600">
                    <Coins className="h-3.5 w-3.5" /> {state.coins} Coins
                  </span>
                  <span className="inline-flex items-center gap-1 text-orange-600">
                    <Flame className="h-3.5 w-3.5" /> {state.streak} يوم
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setState((prev) => ({
                    ...prev,
                    profile: {
                      ...prev.profile,
                      mode: prev.profile.mode === 'adults' ? 'kids' : 'adults',
                    },
                  }))
                }
                className="min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100"
              >
                {isKids ? 'وضع الأطفال 🎈' : 'وضع الكبار'}
              </button>

              <button
                type="button"
                onClick={() => setTeacherQuery('')}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[var(--accent-soft)] px-3 py-2 text-xs font-bold text-[var(--accent-text)] lg:hidden"
              >
                <HelpCircle className="h-4 w-4" />
                <span>المعلم</span>
              </button>

              <PWAInstallButton />
            </div>
          </header>

          {/* Active Lesson Workspace */}
          {activeLesson ? (
            <LessonWorkspace
              lesson={activeLesson}
              bestScore={state.completedLessons[activeLesson.id]}
              isKids={isKids}
              savedWordIds={state.savedWords.map((w) => w.id)}
              onToggleSaveWord={handleToggleSaveWord}
              onBack={() => setActiveLessonId(null)}
              onAskTeacher={(topic) => setTeacherQuery(topic)}
              onRecordPronunciation={handleRecordPronunciation}
              onLessonQuizComplete={handleLessonQuizComplete}
            />
          ) : (
            <>
              {/* TAB 1: HOME */}
              {activeTab === 'home' && (
                <div className="space-y-5">
                  {/* Hero Continue Lesson */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold text-[var(--accent-text)]">
                          {isKids ? 'هيا نواصل المغامرة اليوم!' : 'متابعة مسارك التعليمي'}
                        </p>
                        <h2 className="mt-1 text-xl font-extrabold text-slate-900 sm:text-2xl">
                          {nextStudyLesson.title}
                        </h2>
                        <p className="mt-1 text-xs text-slate-600 sm:text-sm">
                          المستوى {nextStudyLesson.levelId} · الدرس {nextStudyLesson.order} من 8 · {nextStudyLesson.topic}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('levels');
                          setSelectedLevelId(nextStudyLesson.levelId);
                          setActiveLessonId(nextStudyLesson.id);
                        }}
                        className="min-h-[48px] shrink-0 rounded-xl bg-[var(--accent-primary)] px-6 py-3 text-sm font-bold text-white transition hover:bg-[var(--accent-primary-hover)]"
                      >
                        ابدأ الدرس الآن
                      </button>
                    </div>

                    {/* Level Progress Summary Bar */}
                    <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-4">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                        <span>تقدم المستوى الحالي ({currentStudentLevel})</span>
                        <span className="font-mono tabular-nums">
                          {getLevelProgress(currentStudentLevel).pct}% ({getLevelProgress(currentStudentLevel).lessonsDone}/8 دروس)
                        </span>
                      </div>
                      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-[var(--accent-primary)] transition-all"
                          style={{ width: `${getLevelProgress(currentStudentLevel).pct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Action Cards Grid: Smart Daily Review + Daily Challenge + Ask Teacher */}
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5">
                      <div>
                        <div className="flex items-center gap-2 text-emerald-700">
                          <Sparkles className="h-5 w-5" />
                          <h3 className="text-base font-extrabold text-slate-900">مراجعة ذكية يومية</h3>
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-slate-600">
                          {smartReviewBundle.focusNote}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSmartReviewOpen(true)}
                        className="mt-4 min-h-[44px] w-full rounded-xl border border-[var(--accent-primary)] bg-[var(--accent-soft)] px-4 py-2.5 text-xs font-extrabold text-[var(--accent-text)] hover:opacity-90"
                      >
                        {state.smartReviewDoneDate === getTodayISO()
                          ? 'إعادة المراجعة الذكية (10 أسئلة)'
                          : 'ابدأ مراجعة اليوم (10 أسئلة)'}
                      </button>
                    </div>

                    <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5">
                      <div>
                        <div className="flex items-center gap-2 text-amber-600">
                          <Swords className="h-5 w-5" />
                          <h3 className="text-base font-extrabold text-slate-900">تحدي اليوم</h3>
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-slate-600">
                          سباق من 10 أسئلة ضد منافس عشوائي في مستواك ({currentStudentLevel}). اكسب +60 XP عند الفوز!
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setDailyChallengeRival(RIVALS[Math.floor(Math.random() * RIVALS.length)])
                        }
                        className="mt-4 min-h-[44px] w-full rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-amber-600"
                      >
                        تحدَّ منافساً الآن
                      </button>
                    </div>

                    <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5">
                      <div>
                        <div className="flex items-center gap-2 text-[var(--accent-primary)]">
                          <BookOpen className="h-5 w-5" />
                          <h3 className="text-base font-extrabold text-slate-900">اسأل المعلم</h3>
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-slate-600">
                          شرح أي كلمة إنجليزية أو قاعدة غامضة بالدارجة السودانية السهلة — يعمل بالنت أوفلاين أيضاً.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTeacherQuery('')}
                        className="mt-4 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-extrabold text-slate-800 hover:bg-slate-100"
                      >
                        فتح نافذة المعلم
                      </button>
                    </div>
                  </div>

                  {/* Multiplayer & Private 6-Digit Code Card */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-extrabold text-[var(--accent-text)]">رقمك الخاص الدائم</span>
                          <span
                            className={`rounded-md px-2 py-0.5 text-[11px] font-extrabold ${
                              realtime.connected
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {realtime.connected ? 'متصل بالشبكة' : 'في انتظار الاتصال'}
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2.5">
                          <span className="font-mono text-2xl font-extrabold tracking-widest tabular-nums text-slate-900">
                            {state.profile.privateCode}
                          </span>
                          <button
                            type="button"
                            onClick={handleCopyPrivateCode}
                            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-100"
                          >
                            {copiedPrivateCode ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                            <span>{copiedPrivateCode ? 'تم النسخ' : 'نسخ الرقم'}</span>
                          </button>
                        </div>
                      </div>

                      <p className="max-w-sm text-xs leading-relaxed text-slate-500">
                        شارك هذا الرقم المكون من 6 أرقام مع أصدقائك للتحدي على نفس الواي فاي بدون إنترنت أو اللعب أونلاين
                        والفرق حتى 4 ضد 4.
                      </p>
                    </div>

                    {realtime.codeConflictError && (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-800">
                        <span>{realtime.codeConflictError}</span>
                        <button
                          type="button"
                          onClick={handleRegeneratePrivateCode}
                          className="rounded-lg bg-rose-600 px-3 py-1.5 text-white hover:bg-rose-700"
                        >
                          توليد رقم جديد الآن
                        </button>
                      </div>
                    )}

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <button
                        type="button"
                        onClick={() => setMultiplayerTab('wifi')}
                        className="flex min-h-[54px] items-center justify-center gap-2.5 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-extrabold text-white transition hover:bg-emerald-700"
                      >
                        <Wifi className="h-4 w-4 shrink-0" />
                        <span>اللعب مع أصدقاء الواي فاي</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setMultiplayerTab('online')}
                        className="flex min-h-[54px] items-center justify-center gap-2.5 rounded-xl bg-[var(--accent-primary)] px-4 py-3 text-xs font-extrabold text-white transition hover:bg-[var(--accent-primary-hover)]"
                      >
                        <Globe className="h-4 w-4 shrink-0" />
                        <span>اللعب أونلاين بالرقم الخاص</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setMultiplayerTab('teams')}
                        className="flex min-h-[54px] items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-extrabold text-slate-900 transition hover:bg-slate-100"
                      >
                        <Users className="h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
                        <span>الفرق الجماعية (1v1 - 4v4)</span>
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                      <span className="text-xs font-semibold text-slate-600">
                        أضف أصدقاءك بالرقم الخاص (6 أرقام) وقارن مستوياتهم وتقدمهم معك لحظياً.
                      </span>
                      <button
                        type="button"
                        onClick={() => setFriendsModalOpen(true)}
                        className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-extrabold text-slate-900 transition hover:bg-slate-50"
                      >
                        <Table2 className="h-4 w-4 text-[var(--accent-primary)]" />
                        <span>
                          جدول مقارنة الأصدقاء ({state.friends.length})
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Quick Stats Summary */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-semibold text-slate-500">الدروس المكتملة</p>
                      <p className="font-mono mt-1 text-2xl font-extrabold tabular-nums text-slate-900">
                        {Object.values(state.completedLessons).filter((v) => v >= 70).length}/48
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-semibold text-slate-500">متوسط دقة المهارات</p>
                      <p className="font-mono mt-1 text-2xl font-extrabold tabular-nums text-emerald-600">
                        {getAverageSkillAccuracy(state)}%
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-semibold text-slate-500">نقاط اليوم</p>
                      <p className="font-mono mt-1 text-2xl font-extrabold tabular-nums text-[var(--accent-primary)]">
                        +{state.dailyXp} XP
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-semibold text-slate-500">الشارات المفتوحة</p>
                      <p className="font-mono mt-1 text-2xl font-extrabold tabular-nums text-amber-600">
                        {state.badges.length}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: LEVELS & LESSONS (STRICT LOCKING + OFFLINE DOWNLOAD + 20-Q LEVEL EXAM) */}
              {activeTab === 'levels' && (
                <div className="space-y-5">
                  {/* CEFR Levels Selector Strip */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    {CEFR_LEVELS.map((lvl) => {
                      const unlocked = state.unlockedLevels.includes(lvl.id);
                      const completed = isLevelCompleted100(lvl.id);
                      const prog = getLevelProgress(lvl.id);
                      const selected = selectedLevelId === lvl.id;

                      return (
                        <button
                          key={lvl.id}
                          type="button"
                          onClick={() => setSelectedLevelId(lvl.id)}
                          className={`flex flex-col justify-between rounded-2xl border p-3.5 text-start transition ${
                            selected
                              ? 'border-[var(--accent-primary)] bg-white ring-2 ring-[var(--accent-primary)]/20'
                              : unlocked
                                ? 'border-slate-200 bg-white hover:border-slate-300'
                                : 'border-slate-200 bg-slate-100/80 text-slate-500'
                          }`}
                        >
                          <div className="flex w-full items-center justify-between gap-2">
                            <span className="font-en text-lg font-extrabold text-slate-900">{lvl.id}</span>
                            {completed ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            ) : unlocked ? (
                              <Unlock className="h-4 w-4 text-[var(--accent-primary)]" />
                            ) : (
                              <Lock className="h-4 w-4 text-slate-400" />
                            )}
                          </div>
                          <p className="mt-1 truncate text-xs font-bold text-slate-700">{lvl.name}</p>
                          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                            <div
                              className={`h-full rounded-full ${completed ? 'bg-emerald-500' : 'bg-[var(--accent-primary)]'}`}
                              style={{ width: `${prog.pct}%` }}
                            />
                          </div>
                          <span className="font-mono mt-1 text-[11px] font-semibold tabular-nums text-slate-500">
                            {prog.pct}%
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected Level Detail Panel */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-extrabold text-slate-900 sm:text-xl">
                            المستوى {selectedLevelObj.id} — {selectedLevelObj.name}
                          </h2>
                          <span className="font-en text-xs font-bold text-slate-500">
                            ({selectedLevelObj.nameEn})
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600 sm:text-sm">{selectedLevelObj.description}</p>
                      </div>

                      {selectedLevelUnlocked && (
                        <button
                          type="button"
                          onClick={() => handleToggleOfflineLevel(selectedLevelObj.id)}
                          className={`inline-flex min-h-[42px] items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
                            state.offlineLevels.includes(selectedLevelObj.id)
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100'
                          }`}
                        >
                          <DownloadCloud className="h-4 w-4" />
                          <span>
                            {state.offlineLevels.includes(selectedLevelObj.id)
                              ? 'محفوظ أوفلاين ✓'
                              : 'تحميل المستوى أوفلاين'}
                          </span>
                        </button>
                      )}
                    </div>

                    {/* Strict Locking Gate */}
                    {!selectedLevelUnlocked ? (
                      <div className="my-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
                        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-amber-700">
                          <Lock className="h-7 w-7" />
                        </div>
                        <h3 className="mt-3 text-base font-extrabold text-amber-950">
                          أكمل المستوى الحالي لفتح هذا المستوى
                        </h3>
                        <p className="mt-1.5 text-xs text-amber-800">
                          القاعدة الصارمة: يجب إكمال جميع الدروس الثمانية + اجتياز الاختبار النهائي للمستوى الحالي بنسبة
                          70% فأكثر قبل فتح المستوى {selectedLevelObj.id}.
                        </p>
                        <div className="mx-auto mt-4 max-w-sm">
                          <div className="mb-1 flex justify-between text-xs font-bold text-amber-900">
                            <span>تقدم المستوى {currentStudentLevel}</span>
                            <span className="font-mono tabular-nums">{getLevelProgress(currentStudentLevel).pct}%</span>
                          </div>
                          <div className="h-2.5 w-full overflow-hidden rounded-full bg-amber-200">
                            <div
                              className="h-full rounded-full bg-amber-600"
                              style={{ width: `${getLevelProgress(currentStudentLevel).pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* 8 Lessons Grid */}
                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                          {selectedLevelObj.lessons.map((lesson) => {
                            const best = state.completedLessons[lesson.id];
                            const passed = best !== undefined && best >= 70;
                            return (
                              <div
                                key={lesson.id}
                                className={`flex flex-col justify-between rounded-xl border p-4 transition ${
                                  passed ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-white'
                                }`}
                              >
                                <div>
                                  <div className="flex items-center justify-between gap-2 text-xs font-bold">
                                    <span className="text-slate-500">
                                      الدرس {lesson.order} · {lesson.topic}
                                    </span>
                                    {passed ? (
                                      <span className="inline-flex items-center gap-1 text-emerald-700">
                                        <CheckCircle2 className="h-3.5 w-3.5" /> مكتمل ({best}%)
                                      </span>
                                    ) : best !== undefined ? (
                                      <span className="text-amber-700">آخر نتيجة: {best}%</span>
                                    ) : (
                                      <span className="text-[var(--accent-text)]">جاهز للدراسة</span>
                                    )}
                                  </div>
                                  <h3 className="mt-1.5 text-base font-extrabold text-slate-900">{lesson.title}</h3>
                                  <p className="font-en mt-1 text-xs font-semibold text-slate-500" dir="ltr">
                                    {lesson.grammarTitle}
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => setActiveLessonId(lesson.id)}
                                  className="mt-4 min-h-[42px] w-full rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-xs font-bold text-white transition hover:bg-[var(--accent-primary-hover)]"
                                >
                                  {passed ? 'مراجعة الدرس' : 'فتح الدرس والتمارين'}
                                </button>
                              </div>
                            );
                          })}
                        </div>

                        {/* Level Final Exam Card (20 Questions, >= 70% unlocks next CEFR level) */}
                        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                          <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                              <h3 className="text-base font-extrabold text-slate-900">
                                الاختبار النهائي للمستوى {selectedLevelObj.id} (20 سؤالاً)
                              </h3>
                              <p className="mt-1 text-xs text-slate-600">
                                يجمع 20 سؤالاً متنوعاً (مفردات، قواعد، استماع، إنشاء جمل، قراءة، و3 اختبارات نطق). النجاح
                                بنسبة 70% يفتح المستوى التالي ويمنحك +500 XP وشارة!
                              </p>
                              {state.completedLevelExams[selectedLevelObj.id] !== undefined && (
                                <p className="mt-1.5 text-xs font-bold text-emerald-700 tabular-nums">
                                  أفضل نتيجة في الامتحان النهائي: {state.completedLevelExams[selectedLevelObj.id]}%
                                </p>
                              )}
                            </div>

                            <button
                              type="button"
                              disabled={!allLessonsInSelectedDone}
                              onClick={() => setExamLevelId(selectedLevelObj.id)}
                              className="min-h-[46px] shrink-0 rounded-xl bg-[var(--accent-primary)] px-5 py-2.5 text-xs font-extrabold text-white transition hover:bg-[var(--accent-primary-hover)] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
                            >
                              {allLessonsInSelectedDone
                                ? `ابدأ الامتحان النهائي لـ ${selectedLevelObj.id}`
                                : `أكمل الـ 8 دروس أولاً (${selectedLevelProgress.lessonsDone}/8)`}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: ANALYTICS & VOCABULARY LOG */}
              {activeTab === 'analytics' && (
                <AnalyticsView
                  state={state}
                  currentLessonId={nextStudyLesson.id}
                  isKids={isKids}
                  onStartSmartReview={() => setSmartReviewOpen(true)}
                  onRemoveSavedWord={handleRemoveSavedWord}
                  onPracticeSavedComplete={handlePracticeSavedComplete}
                  onAskTeacher={(topic) => setTeacherQuery(topic)}
                />
              )}

              {/* TAB 4: LEADERBOARD */}
              {activeTab === 'leaderboard' && (
                <LeaderboardView
                  state={state}
                  standings={standings}
                  onStartDailyChallenge={() =>
                    setDailyChallengeRival(RIVALS[Math.floor(Math.random() * RIVALS.length)])
                  }
                  onSimulateRivalTick={handleSimulateRivalTick}
                  onAddFriendComparison={handleAddFriendByAnyCode}
                  onRemoveFriend={handleRemoveFriend}
                  onOpenComparisonModal={() => setFriendsModalOpen(true)}
                  onChallengeFriend={handleChallengeSavedFriend}
                />
              )}

              {/* TAB 5: GAMIFICATION & SHOP */}
              {activeTab === 'shop' && (
                <GamificationView state={state} onBuyOrEquip={handleBuyOrEquipShopItem} />
              )}

              {/* TAB 6: SETTINGS */}
              {activeTab === 'settings' && (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                    <h2 className="text-lg font-extrabold text-slate-900">إعدادات الحساب والنسخ الاحتياطي</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      يُحفظ تقدمك تلقائياً في localStorage و IndexedDB للعمل بدون إنترنت.
                    </p>

                    <div className="mt-5 space-y-4">
                      <div>
                        <label htmlFor="student-name" className="block text-xs font-bold text-slate-700">
                          اسم المتعلم في لوحة الصدارة:
                        </label>
                        <div className="mt-2 flex gap-2">
                          <input
                            id="student-name"
                            type="text"
                            value={nameInput}
                            onChange={(e) => setNameInput(e.target.value)}
                            className="min-h-[44px] flex-1 rounded-xl border border-slate-200 px-3.5 text-sm font-semibold text-slate-900 outline-none focus:border-[var(--accent-primary)]"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const clean = nameInput.trim();
                              if (!clean) return;
                              setState((prev) => ({
                                ...prev,
                                profile: { ...prev.profile, name: clean.slice(0, 28) },
                              }));
                              pushToast('تم تحديث اسمك بنجاح!', 'success');
                            }}
                            className="min-h-[44px] rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-xs font-bold text-white"
                          >
                            حفظ الاسم
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700">
                          الرقم الخاص بك (6 أرقام للتحديات والفرق):
                        </label>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <div className="flex min-h-[44px] items-center rounded-xl border border-slate-200 bg-slate-50 px-4 font-mono text-lg font-extrabold tracking-widest tabular-nums text-slate-900">
                            {state.profile.privateCode}
                          </div>
                          <button
                            type="button"
                            onClick={handleCopyPrivateCode}
                            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50"
                          >
                            {copiedPrivateCode ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                            <span>{copiedPrivateCode ? 'تم النسخ' : 'نسخ الرقم'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleRegeneratePrivateCode}
                            className="min-h-[44px] rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100"
                          >
                            تغيير الرقم الخاص
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3 border-t border-slate-100 pt-4">
                        <h3 className="text-xs font-extrabold text-slate-800">إعدادات الشات والمحادثة الصوتية</h3>
                        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <div>
                            <p className="text-xs font-extrabold text-slate-900">تفعيل الشات الصوتي في الغرف والمباريات</p>
                            <p className="text-[11px] text-slate-500">محادثة صوتية فورية مشفرة بدون تسجيل أو تخزين أي صوت.</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={state.settings.voiceChatEnabled}
                            onChange={(e) =>
                              setState((prev) => ({
                                ...prev,
                                settings: { ...prev.settings, voiceChatEnabled: e.target.checked },
                              }))
                            }
                            className="h-5 w-5 accent-[var(--accent-primary)]"
                          />
                        </label>

                        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <div>
                            <p className="text-xs font-extrabold text-slate-900">تفعيل صوت تنبيه الرسائل الجديدة</p>
                            <p className="text-[11px] text-slate-500">نغمة خفيفة عند وصول رسالة نصية جديدة في الشات.</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={state.settings.chatSoundEnabled}
                            onChange={(e) =>
                              setState((prev) => ({
                                ...prev,
                                settings: { ...prev.settings, chatSoundEnabled: e.target.checked },
                              }))
                            }
                            className="h-5 w-5 accent-[var(--accent-primary)]"
                          />
                        </label>
                      </div>

                      <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4">
                        <button
                          type="button"
                          onClick={() => exportProgressJSON(state)}
                          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100"
                        >
                          <DownloadCloud className="h-4 w-4" />
                          <span>تصدير نسخة احتياطية (JSON)</span>
                        </button>

                        <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100">
                          <UploadCloud className="h-4 w-4" />
                          <span>استيراد نسخة احتياطية</span>
                          <input type="file" accept=".json,application/json" onChange={handleImportJSON} className="hidden" />
                        </label>

                        <button
                          type="button"
                          onClick={() => setResetConfirmOpen(true)}
                          className="min-h-[44px] rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
                        >
                          إعادة ضبط التقدم بالكامل
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Compact Mobile Bottom Navigation Bar */}
      {!activeLesson && (
        <nav
          aria-label="التنقل السفلي"
          className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-slate-200 bg-white/95 px-1 py-1.5 backdrop-blur lg:hidden"
        >
          {navItems.slice(0, 5).map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setActiveLessonId(null);
                }}
                className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[11px] font-bold transition ${
                  active ? 'text-[var(--accent-primary)]' : 'text-slate-500'
                }`}
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setActiveTab('settings');
              setActiveLessonId(null);
            }}
            className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[11px] font-bold transition ${
              activeTab === 'settings' ? 'text-[var(--accent-primary)]' : 'text-slate-500'
            }`}
          >
            <Settings className="h-5 w-5" />
            <span className="truncate">الإعدادات</span>
          </button>
        </nav>
      )}

      {/* Level Final Exam Modal */}
      {examLevelId && (
        <QuizEngine
          title={`الامتحان النهائي للمستوى ${examLevelId}`}
          subtitle="20 سؤالاً شاملاً · درجة النجاح 70% لفتح المستوى التالي"
          questions={getFinalExamQuestions(examLevelId)}
          passThreshold={70}
          isKids={isKids}
          onAskTeacher={(topic) => setTeacherQuery(topic)}
          onClose={() => setExamLevelId(null)}
          onComplete={(outcome) => handleLevelExamComplete(examLevelId, outcome)}
        />
      )}

      {/* Smart Daily Adaptive Review Modal */}
      {smartReviewOpen && (
        <QuizEngine
          title="المراجعة الذكية اليومية"
          subtitle={smartReviewBundle.focusNote}
          questions={smartReviewBundle.questions}
          passThreshold={60}
          isKids={isKids}
          onAskTeacher={(topic) => setTeacherQuery(topic)}
          onClose={() => setSmartReviewOpen(false)}
          onComplete={handleSmartReviewComplete}
        />
      )}

      {/* Daily Challenge vs Random Rival Modal */}
      {dailyChallengeRival && (
        <QuizEngine
          title={`تحدي اليوم ضد ${dailyChallengeRival.name}`}
          subtitle={`سباق 10 أسئلة · المستوى ${currentStudentLevel}`}
          questions={dailyChallengeQuestions}
          passThreshold={60}
          isKids={isKids}
          rivalChallenge={{ rival: dailyChallengeRival, rivalTargetAccuracy: 0.68 }}
          onAskTeacher={(topic) => setTeacherQuery(topic)}
          onClose={() => setDailyChallengeRival(null)}
          onComplete={handleDailyChallengeComplete}
        />
      )}

      {/* AI Teacher Modal */}
      {teacherQuery !== null && (
        <AITeacherModal
          initialQuery={teacherQuery}
          levelId={currentStudentLevel}
          mode={state.profile.mode}
          onClose={() => setTeacherQuery(null)}
        />
      )}

      {/* Reset Confirmation Modal (No window.confirm/alert) */}
      {resetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-extrabold text-slate-900">تأكيد إعادة ضبط التقدم</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              هل أنت متأكد من مسح جميع الدروس والنقاط والشارات والعودة إلى بداية المستوى A1؟
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const fresh = createInitialState();
                  setState(fresh);
                  setSelectedLevelId('A1');
                  setActiveLessonId(null);
                  setResetConfirmOpen(false);
                  pushToast('تمت إعادة ضبط التقدم إلى البداية.', 'info');
                }}
                className="min-h-[44px] flex-1 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white"
              >
                نعم، امسح التقدم
              </button>
              <button
                type="button"
                onClick={() => setResetConfirmOpen(false)}
                className="min-h-[44px] flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Incoming Wi-Fi / Online Challenge Modal */}
      {realtime.incomingInvite && <IncomingChallengeBanner invite={realtime.incomingInvite} />}

      {/* Wi-Fi, Online & Teams Multiplayer Hub */}
      {(multiplayerTab || realtime.room) && (
        <MultiplayerHubModal
          initialTab={
            multiplayerTab ||
            (realtime.room?.format && realtime.room.format !== '1v1'
              ? 'teams'
              : realtime.room?.mode === 'wifi'
                ? 'wifi'
                : 'online')
          }
          state={state}
          realtime={realtime}
          onRegenerateCode={handleRegeneratePrivateCode}
          onUpdateLanUrl={handleUpdateLanUrl}
          onSaveMatchResult={handleSaveMatchResult}
          onAddFriendByAnyCode={handleAddFriendByAnyCode}
          onAddFriendFromPeer={handleAddFriendFromPeer}
          onOpenComparisonModal={() => setFriendsModalOpen(true)}
          onClose={() => setMultiplayerTab(null)}
        />
      )}

      {/* Detailed Friends Levels & Progress Comparison Modal */}
      <FriendsComparisonModal
        isOpen={friendsModalOpen}
        state={state}
        onClose={() => setFriendsModalOpen(false)}
        onAddFriendByAnyCode={handleAddFriendByAnyCode}
        onRemoveFriend={handleRemoveFriend}
        onRefreshFriend={handleRefreshFriend}
        onChallengeFriend={handleChallengeSavedFriend}
      />

      {/* Global Speech Engine Error Banner */}
      <SpeechErrorBanner />
    </div>
  );
}
