export type CEFRLevelId = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export type SkillTag =
  | 'vocab'
  | 'grammar'
  | 'pronunciation'
  | 'listening'
  | 'sentence_building'
  | 'reading';

export type QuestionType = 'mcq' | 'fill' | 'order' | 'tf' | 'listen' | 'pronunciation';

export type UserMode = 'adults' | 'kids';

export type ThemeId = 'ocean' | 'emerald' | 'indigo' | 'amber';

export interface VocabItem {
  id: string;
  word: string;
  pos: string;
  ar: string;
  phonetic: string;
  example: string;
  exampleAr: string;
}

export interface SavedWord extends VocabItem {
  lessonId: string;
  savedAt: string;
}

export interface QuestionTargetWord {
  word: string;
  ar: string;
  example: string;
  exampleAr: string;
  levelId: CEFRLevelId;
  lessonId: string;
  vocabId?: string;
  phonetic?: string;
  pos?: string;
}

export interface LessonQuestion {
  id: string;
  lesson_id: string;
  level_id: CEFRLevelId;
  skill_tag: SkillTag;
  type: QuestionType;
  prompt: string;
  promptAr?: string;
  audioText?: string;
  options?: string[];
  wordsToOrder?: string[];
  answer: string;
  explanation: string;
  targetWord?: QuestionTargetWord;
}

export type VocabMasteryStage = 'new' | 'learning' | 'reviewing' | 'mastered';

export interface WordMasteryRecord {
  wordKey: string;
  vocabId?: string;
  word: string;
  ar: string;
  example: string;
  exampleAr: string;
  phonetic?: string;
  pos?: string;
  levelId: CEFRLevelId;
  lessonId: string;
  seenCount: number;
  correctCount: number;
  wrongCount: number;
  consecutiveCorrect: number;
  easeFactor: number;
  intervalDays: number;
  mastery: VocabMasteryStage;
  lastReviewedAt: string;
  nextReviewAt: string;
  lastResult: 'correct' | 'wrong';
}

export interface Lesson {
  id: string;
  levelId: CEFRLevelId;
  order: number;
  title: string;
  topic: string;
  grammarTitle: string;
  explanation: string;
  keyPoints: string[];
  vocabulary: VocabItem[];
  pronunciationTarget: {
    text: string;
    ar: string;
    tip: string;
  };
  questions: LessonQuestion[];
}

export interface CEFRLevel {
  id: CEFRLevelId;
  name: string;
  nameEn: string;
  description: string;
  lessons: Lesson[];
}

export interface SkillStat {
  correct: number;
  attempts: number;
  recentCorrect: number;
  recentAttempts: number;
}

export interface PronunciationRecord {
  id: string;
  lessonId: string;
  target: string;
  spoken: string;
  score: number;
  feedback: 'ممتاز' | 'جيد' | 'حاول مرة أخرى';
  selfAssessed?: boolean;
  timestamp: string;
}

export type RivalPersonality = 'steady' | 'sprinter' | 'calm' | 'sporadic' | 'challenger';

export interface Rival {
  id: string;
  name: string;
  avatarId: string;
  personality: RivalPersonality;
  personalityLabel: string;
  baseDailyRate: number;
  activeProbability: number;
  weekendBoost: number;
  tagline: string;
}

export interface RivalProgressState {
  rivalId: string;
  levelId: CEFRLevelId;
  xp: number;
  lessonsCompleted: number;
  skillPct: number;
  streak: number;
  lastGainXp: number;
  isActiveToday: boolean;
  lastActiveDate: string;
  weeklyGainDate: string;
  weeklyGainXp: number;
  dailyGainDate: string;
  dailyGainXp: number;
  lastUpdatedAt: number;
}

export interface RivalStanding {
  id: string;
  name: string;
  avatarId: string;
  xp: number;
  levelId: CEFRLevelId;
  isUser: boolean;
  title?: string;
  tagline?: string;
  personalityLabel?: string;
  lastGainXp?: number;
  isActiveToday?: boolean;
  streak?: number;
  lessonsCompleted?: number;
  skillPct?: number;
}

export interface ShopItem {
  id: string;
  category: 'theme' | 'avatar' | 'title';
  name: string;
  description: string;
  cost: number;
  value: string;
}

export interface BadgeDef {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export interface FriendComparison {
  code: string;
  privateCode?: string;
  avatarId?: string;
  name: string;
  level: CEFRLevelId;
  unlockedLevels?: CEFRLevelId[];
  xp: number;
  streak: number;
  completedLessons: number;
  avgSkill: number;
  importedAt: string;
}

export type PresenceStatus = 'online' | 'in_game' | 'offline';
export type ConnectionMode = 'wifi' | 'online';
export type TeamFormat = '1v1' | '2v2' | '3v3' | '4v4';

export interface PeerInfo {
  privateCode: string;
  name: string;
  avatarId: string;
  levelId: CEFRLevelId;
  status: PresenceStatus;
  sameWifi?: boolean;
  xp?: number;
  streak?: number;
  completedLessons?: number;
  avgSkill?: number;
  unlockedLevels?: CEFRLevelId[];
  hostIp?: string;
  httpPort?: number;
  wsPort?: number;
  isHost?: boolean;
}

export interface DiscoveredWifiHost {
  serviceName: string;
  privateCode: string;
  name: string;
  avatarId: string;
  levelId: CEFRLevelId;
  ip: string;
  httpPort: number;
  wsPort: number;
  httpUrl: string;
  wsUrl: string;
  discoveredAt: number;
}

export interface WifiHostStatus {
  active: boolean;
  ip: string;
  httpPort: number;
  wsPort: number;
  httpUrl: string;
  wsUrl: string;
  connectedCount: number;
  serviceName: string;
  error?: string | null;
}

export interface ChallengeInvite {
  inviteId: string;
  fromCode: string;
  fromName: string;
  fromAvatar: string;
  toCode: string;
  mode: ConnectionMode;
  useTimer: boolean;
  timerSeconds: number;
  levelId: CEFRLevelId;
  createdAt: number;
  expiresAt: number;
}

export interface TeamMember {
  privateCode: string;
  name: string;
  avatarId: string;
  status: PresenceStatus;
  side: 'A' | 'B';
  isLeader: boolean;
  score: number;
  answeredCount: number;
}

export interface JoinRequest {
  requestId: string;
  privateCode: string;
  name: string;
  avatarId: string;
  side: 'A' | 'B';
}

export type ChatChannel = 'team' | 'all' | 'private';

export interface ChatMessage {
  id: string;
  roomId: string;
  channel: ChatChannel;
  senderCode: string;
  senderName: string;
  senderSide?: 'A' | 'B';
  recipientCode?: string;
  text: string;
  timestamp: string;
}

export interface TeamRoomState {
  roomId: string;
  teamCode: string;
  teamName: string;
  mode: ConnectionMode;
  format: TeamFormat;
  leaderCode: string;
  useTimer: boolean;
  timerSeconds: number;
  members: TeamMember[];
  joinRequests: JoinRequest[];
  status: 'waiting' | 'playing' | 'finished';
  questions: LessonQuestion[];
  startedAt?: number;
  endedAt?: number;
  chatExpiresAt?: number;
  pausedByDisconnect?: boolean;
  disconnectedPlayerName?: string;
}

export interface MatchRecord {
  id: string;
  date: string;
  format: TeamFormat;
  mode: ConnectionMode;
  teamName: string;
  myTeamScore: number;
  opponentScore: number;
  won: boolean;
}

export interface AppState {
  profile: {
    name: string;
    title: string;
    avatarId: string;
    mode: UserMode;
    theme: ThemeId;
    privateCode: string;
    lanServerUrl: string;
  };
  settings: {
    voiceChatEnabled: boolean;
    chatSoundEnabled: boolean;
  };
  xp: number;
  coins: number;
  streak: number;
  lastStudyDate: string;
  dailyXp: number;
  dailyDate: string;
  dailyChallengeDoneDate: string;
  smartReviewDoneDate: string;
  completedLessons: Record<string, number>;
  completedLevelExams: Record<CEFRLevelId, number>;
  unlockedLevels: CEFRLevelId[];
  offlineLevels: CEFRLevelId[];
  skills: Record<SkillTag, SkillStat>;
  pronunciationHistory: PronunciationRecord[];
  excellentPronunciations: number;
  challengesWon: number;
  badges: string[];
  ownedItems: string[];
  lastRankOrder: string[];
  rivalDailyOffsetDate: string;
  rivalXpOverrides: Record<string, number>;
  rivalStates: Record<string, RivalProgressState>;
  rivalLastTickAt: number;
  vocabProgress: Record<string, WordMasteryRecord>;
  friends: FriendComparison[];
  savedWords: SavedWord[];
  matchHistory: MatchRecord[];
  updatedAt: number;
}
