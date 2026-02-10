import React from 'react'
import { Star, ChevronRight } from 'lucide-react'

/**
 * Новая карточка лояльности в стиле макета.
 *
 * Пока используется только в экспериментальном HomeMini и работает на мок‑данных.
 * Позже сюда можно пробросить реальные balance / nextTierPoints / currentTier.
 */
const LoyaltyCard = ({
  balance,
  nextTierPoints,
  currentTier,
  nextTierName = 'Gold',
  t,
  lang = 'ru',
}) => {
  const safeNextTier = typeof nextTierPoints === 'number' && nextTierPoints > 0 ? nextTierPoints : 0
  const remaining = safeNextTier > 0 ? Math.max(0, safeNextTier - balance) : 0
  const rawProgress = safeNextTier > 0 ? (balance / safeNextTier) * 100 : 0
  const progress = Math.max(0, Math.min(100, rawProgress))

  // Основной цвет берем из Telegram темы (fallback — Sakura deep).
  const primary = 'var(--tg-theme-button-color, rgb(var(--sakura-deep)))'
  // Вторичный цвет для градиента — осветлённая версия основного.
  const gradientMid = 'color-mix(in srgb, var(--tg-theme-button-color, rgb(var(--sakura-deep))) 70%, rgb(var(--sakura-mid)))'
  const gradientEnd = 'color-mix(in srgb, var(--tg-theme-button-color, rgb(var(--sakura-deep))) 50%, rgb(var(--sakura-mid)))'
  const locale = lang === 'ru' ? 'ru-RU' : 'en-US'
  const formatNumber = (value) => value.toLocaleString(locale)

  return (
    <div
      className="
        relative overflow-hidden p-6 rounded-3xl shadow-lg
        transition-transform active:scale-[0.98] cursor-pointer
        text-white
      "
      style={{
        backgroundImage: `linear-gradient(135deg, ${primary} 0%, ${gradientMid} 50%, ${gradientEnd} 100%)`,
      }}
    >
      {/* Декоративные круги на фоне */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
      <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-black/15 rounded-full blur-xl" />

      <div className="relative z-10">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-white/70 text-sm font-medium uppercase tracking-wider">
              {t ? t('loyalty_card_balance_label') : 'Ваш баланс'}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-4xl font-bold italic tracking-tight">
                {formatNumber(balance)}
              </span>
              <Star className="w-8 h-8 fill-sakura-gold text-sakura-gold" />
            </div>
          </div>
          <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/30 text-xs font-semibold">
            {currentTier}
          </div>
        </div>

        <div className="mt-8">
          <div className="flex justify-between text-xs mb-2 text-white/80">
            <span>{t ? t('loyalty_card_progress_label') : 'Прогресс до награды'}</span>
            <span>{Math.round(progress)}%</span>
          </div>

          {/* Прогресс-бар (Glassmorphism) */}
          <div className="h-2.5 w-full bg-black/20 rounded-full overflow-hidden backdrop-blur-sm border border-white/10">
            <div
              className="h-full bg-gradient-to-r from-sakura-gold to-sakura-accent rounded-full shadow-[0_0_10px_rgba(184,134,11,0.5)]"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex justify-between items-center mt-4">
            <p className="text-xs text-white/70">
              {remaining > 0
                ? t
                  ? t('loyalty_card_to_next_level', {
                      remaining: formatNumber(remaining),
                      tier: nextTierName,
                    })
                  : `Еще ${formatNumber(remaining)} баллов до уровня ${nextTierName}`
                : t
                  ? t('loyalty_card_level_reached', { tier: nextTierName })
                  : `Вы достигли уровня ${nextTierName}`}
            </p>
            <ChevronRight className="w-4 h-4 text-white/50" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoyaltyCard

