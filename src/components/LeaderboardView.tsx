import React, { useMemo, useState } from 'react';
import { Copy, Check, RefreshCw, Search, Swords, Table2, Trash2, Trophy, UserPlus, Users } from 'lucide-react';
import type { AppState, RivalStanding } from '../types';
import { generateFriendInviteCode, getCurrentStudentLevel } from '../services/storage';
import { AvatarView } from './AvatarView';

interface LeaderboardViewProps {
  state: AppState;
  standings: RivalStanding[];
  onStartDailyChallenge: () => void;
  onSimulateRivalTick: () => void;
  onAddFriendComparison: (code: string) => Promise<{ ok: boolean; message: string }>;
  onRemoveFriend: (codeOrPrivateCode: string) => void;
  onOpenComparisonModal: () => void;
  onChallengeFriend?: (privateCode: string) => void;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  state,
  standings,
  onStartDailyChallenge,
  onSimulateRivalTick,
  onAddFriendComparison,
  onRemoveFriend,
  onOpenComparisonModal,
  onChallengeFriend,
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedSixDigit, setCopiedSixDigit] = useState(false);
  const [friendCodeInput, setFriendCodeInput] = useState('');
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [addingFriend, setAddingFriend] = useState(false);
  const [friendStatus, setFriendStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const currentLevel = getCurrentStudentLevel(state);
  const myInviteCode = generateFriendInviteCode(state);
  const myRank = standings.findIndex((s) => s.isUser) + 1;

  const filteredFriends = useMemo(() => {
    const q = friendSearchQuery.trim().toLowerCase();
    if (!q) return state.friends;
    return state.friends.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.privateCode && f.privateCode.includes(q)) ||
        f.code.toLowerCase().includes(q),
    );
  }, [state.friends, friendSearchQuery]);

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(myInviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  const handleCopySixDigit = async () => {
    try {
      await navigator.clipboard.writeText(state.profile.privateCode);
      setCopiedSixDigit(true);
      setTimeout(() => setCopiedSixDigit(false), 2200);
    } catch {
      setCopiedSixDigit(false);
    }
  };

  const handleCompareFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendCodeInput.trim()) return;
    setAddingFriend(true);
    setFriendStatus(null);
    try {
      const res = await onAddFriendComparison(friendCodeInput.trim());
      setFriendStatus(res);
      if (res.ok) setFriendCodeInput('');
    } catch (err) {
      setFriendStatus({
        ok: false,
        message: err instanceof Error ? err.message : 'كود غير صالح',
      });
    } finally {
      setAddingFriend(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Daily Challenge Hero Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700">
              <Swords className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">تحدي اليوم ضد منافس عشوائي</h2>
              <p className="mt-1 text-xs text-slate-600 sm:text-sm">
                سباق من 10 أسئلة في مستواك الحالي (<span className="font-bold">{currentLevel}</span>) ضد أحد المنافسين
                الخمسة (سارة، أحمد، ليلى، عمر، نور).
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onStartDailyChallenge}
            className="inline-flex min-h-[46px] shrink-0 items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--accent-primary-hover)]"
          >
            <Swords className="h-4 w-4" />
            <span className="whitespace-nowrap">ابدأ تحدي اليوم الآن</span>
          </button>
        </div>
      </div>

      {/* Leaderboard Standings */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <Trophy className="h-5 w-5 text-amber-500" />
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                لوحة الصدارة — المستوى {currentLevel} فقط
              </h3>
              <p className="text-xs text-slate-500">
                ترتيبك الحالي: <span className="font-bold text-slate-800">#{myRank}</span> من {standings.length} ·
                المنافسون يتحدونك في مستواك فقط
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onSimulateRivalTick}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>محاكاة تقدم المنافسين اليوم</span>
          </button>
        </div>

        <div className="mt-4 space-y-2.5">
          {standings.map((row, idx) => {
            const rank = idx + 1;
            return (
              <div
                key={row.id}
                className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition ${
                  row.isUser
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)]/60'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg font-mono text-sm font-extrabold tabular-nums ${
                      rank === 1
                        ? 'bg-amber-100 text-amber-800'
                        : rank === 2
                          ? 'bg-slate-200 text-slate-800'
                          : rank === 3
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {rank}
                  </span>
                  <AvatarView avatarId={row.avatarId} size={42} />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-extrabold text-slate-900">
                        {row.name} {row.isUser ? '(أنت)' : ''}
                      </span>
                      {row.title && <span className="text-xs font-semibold text-[var(--accent-text)]">{row.title}</span>}
                    </div>
                    <p className="text-xs text-slate-500">
                      المستوى {row.levelId}
                      {row.tagline ? ` · ${row.tagline}` : ''}
                    </p>
                  </div>
                </div>

                <div className="text-end">
                  <span className="font-mono text-base font-extrabold tabular-nums text-slate-900">{row.xp}</span>
                  <span className="mr-1 text-xs font-bold text-slate-500">XP</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Real Friends Challenge via 6-Digit Private Code or Shareable Code */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <Users className="h-5 w-5 text-[var(--accent-primary)]" />
            <div>
              <h3 className="text-base font-extrabold text-slate-900">الأصدقاء والمقارنة المفصلة</h3>
              <p className="text-xs text-slate-500">
                أضف صديقك برقمه الخاص (6 أرقام) على الواي فاي أو الإنترنت، أو عبر كود التقدم
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenComparisonModal}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-xs font-extrabold text-white hover:bg-[var(--accent-primary-hover)]"
          >
            <Table2 className="h-4 w-4" />
            <span>عرض جدول المقارنة المفصل ({state.friends.length})</span>
          </button>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <p className="text-xs font-bold text-slate-700">رقمك الخاص الدائم (6 أرقام):</p>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="font-mono flex min-h-[40px] flex-1 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-extrabold tracking-widest text-slate-900">
                  {state.profile.privateCode}
                </div>
                <button
                  type="button"
                  onClick={handleCopySixDigit}
                  className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800"
                >
                  {copiedSixDigit ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedSixDigit ? 'تم النسخ' : 'نسخ'}</span>
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-700">أو كود التقدم الأوفلاين (FFH):</p>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  dir="ltr"
                  value={myInviteCode}
                  aria-label="كود الدعوة الخاص بك"
                  className="font-mono min-h-[40px] flex-1 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700"
                />
                <button
                  type="button"
                  onClick={handleCopyInvite}
                  className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3.5 py-2 text-xs font-bold text-white"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  <span>{copied ? 'تم النسخ' : 'نسخ الكود'}</span>
                </button>
              </div>
            </div>
          </div>

          <form onSubmit={handleCompareFriend} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold text-slate-700">
              إضافة صديق عبر الرقم الخاص (6 أرقام) أو كود التقدم:
            </p>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                dir="ltr"
                value={friendCodeInput}
                onChange={(e) => setFriendCodeInput(e.target.value)}
                placeholder="مثال: 482910 أو FFH-eyJ2..."
                className="font-mono min-h-[44px] flex-1 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-[var(--accent-primary)]"
              />
              <button
                type="submit"
                disabled={addingFriend || !friendCodeInput.trim()}
                className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--accent-primary-hover)] disabled:opacity-50"
              >
                <UserPlus className="h-4 w-4" />
                <span>{addingFriend ? 'جاري البحث...' : 'إضافة ومقارنة'}</span>
              </button>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              يعمل في نفس الواي فاي وعبر الإنترنت بالرقم الخاص (6 أرقام)، أو أوفلاين بكود FFH-.
            </p>
            {friendStatus && (
              <p className={`mt-2 text-xs font-bold ${friendStatus.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
                {friendStatus.message}
              </p>
            )}
          </form>
        </div>

        {state.friends.length > 0 && (
          <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-extrabold text-slate-800">
                الأصدقاء المضافون ({filteredFriends.length}/{state.friends.length})
              </p>
              <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={friendSearchQuery}
                  onChange={(e) => setFriendSearchQuery(e.target.value)}
                  placeholder="بحث في الأصدقاء بالاسم أو الرقم..."
                  className="min-h-[38px] w-full rounded-xl border border-slate-200 bg-slate-50 pl-3 pr-8 text-xs text-slate-800 outline-none focus:border-[var(--accent-primary)]"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {filteredFriends.map((fr) => {
                const userWins = state.xp >= fr.xp;
                return (
                  <div key={fr.code} className="rounded-xl border border-slate-200 bg-white p-3.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <AvatarView avatarId={fr.avatarId || 'avatar-scholar'} size={34} />
                        <div>
                          <span className="text-sm font-extrabold text-slate-900">{fr.name}</span>
                          {fr.privateCode && (
                            <p className="font-mono text-[11px] text-slate-500">#{fr.privateCode}</p>
                          )}
                        </div>
                      </div>
                      <span className={`font-bold ${userWins ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {userWins ? 'أنت متفوق حالياً' : 'صديقك متقدم عليك'}
                      </span>
                    </div>
                    <div className="mt-2.5 grid grid-cols-2 gap-2 text-slate-600 tabular-nums">
                      <span>المستوى: {fr.level}</span>
                      <span>XP: {fr.xp} (أنت: {state.xp})</span>
                      <span>السلسلة: {fr.streak} يوم</span>
                      <span>الدروس: {fr.completedLessons}/48 · الدقة: {fr.avgSkill}%</span>
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-2 border-t border-slate-100 pt-2">
                      {fr.privateCode && onChallengeFriend && (
                        <button
                          type="button"
                          onClick={() => onChallengeFriend(fr.privateCode!)}
                          className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-[var(--accent-primary)] px-3 py-1 text-[11px] font-bold text-white"
                        >
                          <Swords className="h-3.5 w-3.5" /> تحدي
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onRemoveFriend(fr.privateCode || fr.code)}
                        aria-label={`حذف ${fr.name}`}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> حذف
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
