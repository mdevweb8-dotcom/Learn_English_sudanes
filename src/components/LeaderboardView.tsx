import React, { useState } from 'react';
import { Copy, Check, RefreshCw, Swords, Trophy, UserPlus, Users } from 'lucide-react';
import type { AppState, RivalStanding } from '../types';
import { generateFriendInviteCode, getCurrentStudentLevel, parseFriendInviteCode } from '../services/storage';
import { AvatarView } from './AvatarView';

interface LeaderboardViewProps {
  state: AppState;
  standings: RivalStanding[];
  onStartDailyChallenge: () => void;
  onSimulateRivalTick: () => void;
  onAddFriendComparison: (code: string) => { ok: boolean; message: string };
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  state,
  standings,
  onStartDailyChallenge,
  onSimulateRivalTick,
  onAddFriendComparison,
}) => {
  const [copied, setCopied] = useState(false);
  const [friendCodeInput, setFriendCodeInput] = useState('');
  const [friendStatus, setFriendStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const currentLevel = getCurrentStudentLevel(state);
  const myInviteCode = generateFriendInviteCode(state);
  const myRank = standings.findIndex((s) => s.isUser) + 1;

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(myInviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  const handleCompareFriend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendCodeInput.trim()) return;
    try {
      parseFriendInviteCode(friendCodeInput);
      const res = onAddFriendComparison(friendCodeInput);
      setFriendStatus(res);
      if (res.ok) setFriendCodeInput('');
    } catch (err) {
      setFriendStatus({
        ok: false,
        message: err instanceof Error ? err.message : 'كود غير صالح',
      });
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

      {/* Real Friends Challenge via Shareable Invite Code */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <Users className="h-5 w-5 text-[var(--accent-primary)]" />
          <div>
            <h3 className="text-base font-extrabold text-slate-900">تحدي الأصدقاء الحقيقيين (بدون سيرفر خارجي)</h3>
            <p className="text-xs text-slate-500">انسخ كود تقدمك وأرسله لصديقك، أو الصق كود صديقك للمقارنة المباشرة</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold text-slate-700">كود التقدم الخاص بك:</p>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                readOnly
                dir="ltr"
                value={myInviteCode}
                aria-label="كود الدعوة الخاص بك"
                className="font-mono min-h-[42px] flex-1 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700"
              />
              <button
                type="button"
                onClick={handleCopyInvite}
                className="inline-flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3.5 py-2 text-xs font-bold text-white"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span>{copied ? 'تم النسخ' : 'نسخ الكود'}</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleCompareFriend} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold text-slate-700">أدخل كود صديقك للمقارنة:</p>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                dir="ltr"
                value={friendCodeInput}
                onChange={(e) => setFriendCodeInput(e.target.value)}
                placeholder="FFH-eyJ2Ijox..."
                className="font-mono min-h-[42px] flex-1 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-[var(--accent-primary)]"
              />
              <button
                type="submit"
                disabled={!friendCodeInput.trim()}
                className="inline-flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100 disabled:opacity-50"
              >
                <UserPlus className="h-4 w-4" />
                <span>مقارنة</span>
              </button>
            </div>
            {friendStatus && (
              <p className={`mt-2 text-xs font-bold ${friendStatus.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
                {friendStatus.message}
              </p>
            )}
          </form>
        </div>

        {state.friends.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-bold text-slate-600">مقارنات الأصدقاء المضافة:</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {state.friends.map((fr) => {
                const userWins = state.xp >= fr.xp;
                return (
                  <div key={fr.code} className="rounded-xl border border-slate-200 bg-white p-3.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-extrabold text-slate-900">{fr.name}</span>
                      <span className={`font-bold ${userWins ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {userWins ? 'أنت متفوق حالياً' : 'صديقك متقدم عليك'}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-slate-600 tabular-nums">
                      <span>المستوى: {fr.level}</span>
                      <span>XP: {fr.xp} (أنت: {state.xp})</span>
                      <span>السلسلة: {fr.streak} يوم</span>
                      <span>الدروس: {fr.completedLessons} · الدقة: {fr.avgSkill}%</span>
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
