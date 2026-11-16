import React, { useState } from 'react';
import { Award, Check, Coins, Crown, Flame, Lock, Mic, ShoppingBag, Swords, Zap, BookOpen } from 'lucide-react';
import type { AppState, ShopItem } from '../types';
import { BADGES, SHOP_ITEMS } from '../data/gamification';
import { AvatarView } from './AvatarView';

interface GamificationViewProps {
  state: AppState;
  onBuyOrEquip: (item: ShopItem) => { ok: boolean; message: string };
}

function renderBadgeIcon(icon: string, unlocked: boolean) {
  const cls = `h-6 w-6 ${unlocked ? 'text-amber-600' : 'text-slate-400'}`;
  if (icon === 'flame') return <Flame className={cls} />;
  if (icon === 'mic') return <Mic className={cls} />;
  if (icon === 'swords') return <Swords className={cls} />;
  if (icon === 'zap') return <Zap className={cls} />;
  if (icon === 'crown') return <Crown className={cls} />;
  if (icon === 'book') return <BookOpen className={cls} />;
  return <Award className={cls} />;
}

export const GamificationView: React.FC<GamificationViewProps> = ({ state, onBuyOrEquip }) => {
  const [shopNotice, setShopNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'theme' | 'avatar' | 'title'>('all');

  const filteredItems =
    categoryFilter === 'all' ? SHOP_ITEMS : SHOP_ITEMS.filter((i) => i.category === categoryFilter);

  const isEquipped = (item: ShopItem) => {
    if (item.category === 'theme') return state.profile.theme === item.value;
    if (item.category === 'avatar') return state.profile.avatarId === item.value;
    if (item.category === 'title') return state.profile.title === item.value;
    return false;
  };

  const handleAction = (item: ShopItem) => {
    const res = onBuyOrEquip(item);
    setShopNotice(res);
  };

  return (
    <div className="space-y-6">
      {/* Badges Showcase */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <Award className="h-5 w-5 text-amber-500" />
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">لوحة الإنجازات والشارات</h2>
              <p className="text-xs text-slate-500">
                حصلت على <span className="font-mono font-bold tabular-nums">{state.badges.length}</span> من{' '}
                <span className="font-mono font-bold tabular-nums">{BADGES.length}</span> شارة
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BADGES.map((badge) => {
            const unlocked = state.badges.includes(badge.id);
            return (
              <div
                key={badge.id}
                className={`flex items-start gap-3 rounded-xl border p-4 transition ${
                  unlocked ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200 bg-slate-50/70 opacity-75'
                }`}
              >
                <div
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
                    unlocked ? 'bg-amber-100' : 'bg-slate-200/70'
                  }`}
                >
                  {unlocked ? renderBadgeIcon(badge.icon, true) : <Lock className="h-5 w-5 text-slate-400" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-extrabold text-slate-900">{badge.title}</h3>
                    <span className={`text-[11px] font-bold ${unlocked ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {unlocked ? 'مفتوحة' : 'مقفولة'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{badge.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Coin Shop */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="h-5 w-5 text-[var(--accent-primary)]" />
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">متجر العملات (ثيمات · أفاتار · ألقاب)</h2>
              <p className="text-xs text-slate-500">اكسب Coins من الدروس والاختبارات وخصص حسابك</p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-sm font-extrabold text-amber-800">
            <Coins className="h-4 w-4 text-amber-600" />
            <span className="font-mono tabular-nums">{state.coins}</span>
            <span>Coins</span>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { id: 'all', label: 'الكل' },
            { id: 'theme', label: 'الثيمات' },
            { id: 'avatar', label: 'الأفاتار' },
            { id: 'title', label: 'الألقاب' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryFilter(cat.id as typeof categoryFilter)}
              className={`min-h-[40px] rounded-xl border px-3.5 py-1.5 text-xs font-bold transition ${
                categoryFilter === cat.id
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {shopNotice && (
          <div
            role="status"
            className={`mt-4 rounded-xl border px-4 py-3 text-xs font-bold ${
              shopNotice.ok
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-800'
            }`}
          >
            {shopNotice.message}
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => {
            const owned = state.ownedItems.includes(item.id) || item.cost === 0;
            const equipped = isEquipped(item);
            const canAfford = state.coins >= item.cost;

            return (
              <div
                key={item.id}
                className={`flex flex-col justify-between rounded-xl border p-4 ${
                  equipped ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)]/40' : 'border-slate-200 bg-white'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      {item.category === 'avatar' ? (
                        <AvatarView avatarId={item.value} size={40} />
                      ) : item.category === 'theme' ? (
                        <span
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200"
                          style={{
                            backgroundColor:
                              item.value === 'emerald'
                                ? '#0F766E'
                                : item.value === 'indigo'
                                  ? '#4338CA'
                                  : item.value === 'amber'
                                    ? '#B45309'
                                    : '#1A6FA0',
                          }}
                        />
                      ) : (
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700">
                          <Crown className="h-5 w-5" />
                        </span>
                      )}
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900">{item.name}</h3>
                        <p className="text-xs text-slate-500">
                          {item.cost === 0 ? 'مجاني' : `${item.cost} Coins`}
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="mt-2.5 text-xs leading-relaxed text-slate-600">{item.description}</p>
                </div>

                <button
                  type="button"
                  disabled={equipped || (!owned && !canAfford)}
                  onClick={() => handleAction(item)}
                  className={`mt-4 inline-flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
                    equipped
                      ? 'bg-emerald-100 text-emerald-800'
                      : owned
                        ? 'border border-[var(--accent-primary)] bg-white text-[var(--accent-text)] hover:bg-[var(--accent-soft)]'
                        : canAfford
                          ? 'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)]'
                          : 'cursor-not-allowed bg-slate-100 text-slate-400'
                  }`}
                >
                  {equipped ? (
                    <>
                      <Check className="h-4 w-4" /> <span>مُفعّل حالياً</span>
                    </>
                  ) : owned ? (
                    <span>تفعيل الآن</span>
                  ) : (
                    <span>شراء بـ {item.cost} Coins</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
