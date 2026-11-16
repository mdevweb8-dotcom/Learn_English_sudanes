import React, { useMemo, useState } from 'react';
import {
  ArrowDownUp,
  CheckCircle2,
  RefreshCw,
  Search,
  Swords,
  Trash2,
  Trophy,
  UserPlus,
  X,
} from 'lucide-react';
import type { AppState, CEFRLevelId, FriendComparison } from '../types';
import { CEFR_ORDER } from '../data/curriculum';
import { getAverageSkillAccuracy, getCurrentStudentLevel } from '../services/storage';
import { AvatarView } from './AvatarView';

interface FriendsComparisonModalProps {
  isOpen: boolean;
  state: AppState;
  onClose: () => void;
  onAddFriendByAnyCode: (code: string) => Promise<{ ok: boolean; message: string }>;
  onRemoveFriend: (codeOrPrivateCode: string) => void;
  onRefreshFriend?: (privateCode: string) => Promise<{ ok: boolean; message: string }>;
  onChallengeFriend?: (privateCode: string) => void;
}

type SortKey = 'xp' | 'level' | 'streak' | 'lessons' | 'accuracy';

interface ComparisonRow {
  id: string;
  isUser: boolean;
  name: string;
  avatarId: string;
  privateCode?: string;
  code: string;
  level: CEFRLevelId;
  unlockedLevels: CEFRLevelId[];
  xp: number;
  streak: number;
  completedLessons: number;
  avgSkill: number;
}

export const FriendsComparisonModal: React.FC<FriendsComparisonModalProps> = ({
  isOpen,
  state,
  onClose,
  onAddFriendByAnyCode,
  onRemoveFriend,
  onRefreshFriend,
  onChallengeFriend,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<'ALL' | CEFRLevelId>('ALL');
  const [sortBy, setSortBy] = useState<SortKey>('xp');
  const [sortAsc, setSortAsc] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [adding, setAdding] = useState(false);
  const [refreshingCode, setRefreshingCode] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const userLevel = getCurrentStudentLevel(state);
  const userLessonsDone = Object.values(state.completedLessons).filter((v) => v >= 70).length;
  const userAccuracy = getAverageSkillAccuracy(state);

  const allRows: ComparisonRow[] = useMemo(() => {
    const me: ComparisonRow = {
      id: 'self-user',
      isUser: true,
      name: state.profile.name,
      avatarId: state.profile.avatarId,
      privateCode: state.profile.privateCode,
      code: state.profile.privateCode,
      level: userLevel,
      unlockedLevels: state.unlockedLevels,
      xp: state.xp,
      streak: state.streak,
      completedLessons: userLessonsDone,
      avgSkill: userAccuracy,
    };

    const friendRows: ComparisonRow[] = state.friends.map((f: FriendComparison) => {
      const idx = Math.max(0, CEFR_ORDER.indexOf(f.level || 'A1'));
      const inferredUnlocked =
        f.unlockedLevels && f.unlockedLevels.length > 0
          ? f.unlockedLevels
          : CEFR_ORDER.slice(0, idx + 1);
      return {
        id: f.code,
        isUser: false,
        name: f.name,
        avatarId: f.avatarId || 'avatar-scholar',
        privateCode: f.privateCode,
        code: f.code,
        level: f.level,
        unlockedLevels: inferredUnlocked,
        xp: f.xp,
        streak: f.streak,
        completedLessons: f.completedLessons,
        avgSkill: f.avgSkill,
      };
    });

    return [me, ...friendRows];
  }, [
    state.profile.name,
    state.profile.avatarId,
    state.profile.privateCode,
    state.unlockedLevels,
    state.xp,
    state.streak,
    state.friends,
    userLevel,
    userLessonsDone,
    userAccuracy,
  ]);

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = allRows.filter((row) => {
      if (levelFilter !== 'ALL' && row.level !== levelFilter) return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        (row.privateCode && row.privateCode.includes(q)) ||
        row.code.toLowerCase().includes(q)
      );
    });

    const compareVal = (a: ComparisonRow, b: ComparisonRow): number => {
      switch (sortBy) {
        case 'level':
          return CEFR_ORDER.indexOf(a.level) - CEFR_ORDER.indexOf(b.level);
        case 'streak':
          return a.streak - b.streak;
        case 'lessons':
          return a.completedLessons - b.completedLessons;
        case 'accuracy':
          return a.avgSkill - b.avgSkill;
        case 'xp':
        default:
          return a.xp - b.xp;
      }
    };

    return [...list].sort((a, b) => {
      const diff = compareVal(a, b);
      if (diff === 0) return b.xp - a.xp;
      return sortAsc ? diff : -diff;
    });
  }, [allRows, searchQuery, levelFilter, sortBy, sortAsc]);

  if (!isOpen) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCode.trim();
    if (!trimmed) return;
    setAdding(true);
    setStatusMsg(null);
    const res = await onAddFriendByAnyCode(trimmed);
    setAdding(false);
    setStatusMsg({ ok: res.ok, text: res.message });
    if (res.ok) setNewCode('');
  };

  const handleRefresh = async (privateCode: string) => {
    if (!onRefreshFriend) return;
    setRefreshingCode(privateCode);
    const res = await onRefreshFriend(privateCode);
    setRefreshingCode(null);
    setStatusMsg({ ok: res.ok, text: res.message });
  };

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortAsc((v) => !v);
    } else {
      setSortBy(key);
      setSortAsc(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="friends-compare-title"
    >
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <h2 id="friends-compare-title" className="text-base font-extrabold text-slate-900 sm:text-lg">
                جدول المقارنة المفصل لمستويات وتقدم الأصدقاء
              </h2>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500 tabular-nums">
                <span>الأصدقاء المضافون: {state.friends.length}</span>
                <span aria-hidden="true">·</span>
                <span>مستواك الحالي: {userLevel}</span>
                <span aria-hidden="true">·</span>
                <span>نقاطك: {state.xp} XP</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق جدول المقارنة"
            className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {/* Add Friend Form (Supports both 6-digit private code & FFH- invite code) */}
          <form
            onSubmit={handleAdd}
            className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 sm:p-4"
          >
            <label htmlFor="modal-add-friend-code" className="block text-xs font-bold text-slate-800">
              إضافة صديق جديد للمقارنة (أدخل رقمه الخاص من 6 أرقام أو كود التقدم FFH-):
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                id="modal-add-friend-code"
                type="text"
                dir="ltr"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="مثال: 482910 أو FFH-eyJ2..."
                className="font-mono min-h-[44px] min-w-[200px] flex-1 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-900 outline-none focus:border-[var(--accent-primary)]"
              />
              <button
                type="submit"
                disabled={adding || !newCode.trim()}
                className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--accent-primary-hover)] disabled:opacity-50"
              >
                <UserPlus className="h-4 w-4" />
                <span>{adding ? 'جاري البحث والإضافة...' : 'إضافة صديق'}</span>
              </button>
            </div>
            {statusMsg && (
              <p className={`mt-2 text-xs font-bold ${statusMsg.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
                {statusMsg.text}
              </p>
            )}
          </form>

          {/* Search, Level Filter, & Sort Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث بالاسم أو الرقم الخاص..."
                aria-label="بحث في جدول الأصدقاء"
                className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-white pl-3 pr-9 text-xs font-semibold text-slate-900 outline-none focus:border-[var(--accent-primary)]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
                {(['ALL', ...CEFR_ORDER] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setLevelFilter(lvl)}
                    className={`min-h-[34px] rounded-lg px-2.5 text-xs font-bold transition ${
                      levelFilter === lvl
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {lvl === 'ALL' ? 'الكل' : lvl}
                  </button>
                ))}
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                aria-label="ترتيب الجدول حسب"
                className="min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:border-[var(--accent-primary)]"
              >
                <option value="xp">الترتيب: نقاط XP</option>
                <option value="level">الترتيب: المستوى CEFR</option>
                <option value="lessons">الترتيب: الدروس المكتملة</option>
                <option value="streak">الترتيب: السلسلة اليومية</option>
                <option value="accuracy">الترتيب: متوسط الدقة</option>
              </select>

              <button
                type="button"
                onClick={() => setSortAsc((v) => !v)}
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                <ArrowDownUp className="h-3.5 w-3.5" />
                <span>{sortAsc ? 'تصاعدي' : 'تنازلي'}</span>
              </button>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[760px] border-collapse text-start text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="px-3 py-3 text-center font-extrabold">#</th>
                  <th className="px-3 py-3 text-start font-extrabold">المتعلم / الصديق</th>
                  <th className="px-3 py-3 text-start font-extrabold">
                    <button type="button" onClick={() => toggleSort('level')} className="hover:text-slate-900">
                      المستوى ومسار A1–C2
                    </button>
                  </th>
                  <th className="px-3 py-3 text-start font-extrabold">
                    <button type="button" onClick={() => toggleSort('xp')} className="hover:text-slate-900">
                      النقاط (XP)
                    </button>
                  </th>
                  <th className="px-3 py-3 text-start font-extrabold">
                    <button type="button" onClick={() => toggleSort('lessons')} className="hover:text-slate-900">
                      الدروس المكتملة
                    </button>
                  </th>
                  <th className="px-3 py-3 text-start font-extrabold">
                    <button type="button" onClick={() => toggleSort('streak')} className="hover:text-slate-900">
                      السلسلة
                    </button>
                  </th>
                  <th className="px-3 py-3 text-start font-extrabold">
                    <button type="button" onClick={() => toggleSort('accuracy')} className="hover:text-slate-900">
                      الدقة
                    </button>
                  </th>
                  <th className="px-3 py-3 text-end font-extrabold">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAndSorted.map((row, idx) => {
                  const xpDiff = row.xp - state.xp;
                  const lessonPct = Math.min(100, Math.round((row.completedLessons / 48) * 100));

                  return (
                    <tr
                      key={row.id}
                      className={row.isUser ? 'bg-[var(--accent-soft)]/50' : 'bg-white hover:bg-slate-50/70'}
                    >
                      <td className="px-3 py-3 text-center font-mono font-extrabold tabular-nums text-slate-700">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2.5">
                          <AvatarView avatarId={row.avatarId} size={36} />
                          <div>
                            <p className="font-extrabold text-slate-900">
                              {row.name}{' '}
                              {row.isUser && <span className="text-[var(--accent-text)]">(أنت)</span>}
                            </p>
                            <p className="font-mono text-[11px] text-slate-500">
                              {row.privateCode ? `الرقم الخاص: #${row.privateCode}` : 'مضاف بكود المشاركة'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-en text-sm font-extrabold text-slate-900">{row.level}</span>
                          <div className="flex items-center gap-1" dir="ltr">
                            {CEFR_ORDER.map((lvl) => {
                              const unlocked = row.unlockedLevels.includes(lvl);
                              return (
                                <span
                                  key={lvl}
                                  title={`${lvl}: ${unlocked ? 'مفتوح' : 'مقفل'}`}
                                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                                    unlocked
                                      ? 'bg-[var(--accent-primary)] text-white'
                                      : 'bg-slate-100 text-slate-400'
                                  }`}
                                >
                                  {lvl}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 tabular-nums">
                        <div className="font-mono text-sm font-extrabold text-slate-900">{row.xp} XP</div>
                        {!row.isUser && (
                          <div
                            className={`text-[11px] font-bold ${
                              xpDiff > 0
                                ? 'text-amber-700'
                                : xpDiff < 0
                                  ? 'text-emerald-700'
                                  : 'text-slate-500'
                            }`}
                          >
                            {xpDiff > 0
                              ? `يتفوق عليك بـ +${xpDiff} XP`
                              : xpDiff < 0
                                ? `أنت متفوق بـ +${Math.abs(xpDiff)} XP`
                                : 'متعادل معك'}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 tabular-nums">
                        <div className="flex items-center justify-between gap-2 font-mono font-bold text-slate-800">
                          <span>{row.completedLessons}/48</span>
                          <span className="text-[11px] text-slate-500">{lessonPct}%</span>
                        </div>
                        <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-[var(--accent-primary)]"
                            style={{ width: `${lessonPct}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-3 font-mono font-bold tabular-nums text-orange-700">
                        {row.streak} يوم
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1 font-mono font-extrabold tabular-nums text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {row.avgSkill}%
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {!row.isUser && (
                          <div className="flex items-center justify-end gap-1.5">
                            {row.privateCode && onChallengeFriend && (
                              <button
                                type="button"
                                onClick={() => {
                                  onClose();
                                  onChallengeFriend(row.privateCode!);
                                }}
                                title="تحدي هذا الصديق"
                                className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-[var(--accent-primary)] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[var(--accent-primary-hover)]"
                              >
                                <Swords className="h-3.5 w-3.5" />
                                <span>تحدي</span>
                              </button>
                            )}
                            {row.privateCode && onRefreshFriend && (
                              <button
                                type="button"
                                disabled={refreshingCode === row.privateCode}
                                onClick={() => handleRefresh(row.privateCode!)}
                                title="تحديث بيانات الصديق من الشبكة"
                                className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                              >
                                <RefreshCw
                                  className={`h-3.5 w-3.5 ${
                                    refreshingCode === row.privateCode ? 'animate-spin' : ''
                                  }`}
                                />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onRemoveFriend(row.privateCode || row.code)}
                              title="حذف الصديق"
                              aria-label={`حذف ${row.name}`}
                              className="grid h-8 w-8 place-items-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {state.friends.length === 0 && (
            <p className="text-center text-xs text-slate-500">
              أضف أول صديق عبر رقمه الخاص المكون من 6 أرقام أو كود المشاركة أعلاه لتبدأ المقارنة التفصيلية!
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
