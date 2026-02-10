import React from 'react'
import { Star } from 'lucide-react'

/**
 * Градиентная карта лояльности для главного экрана.
 *
 * Пример использования:
 * <LoyaltyGradientCard
 *   points={2450}
 *   progress={0.55}              // от 0 до 1 – прогресс до следующего уровня
 *   nextLevelLabel="До следующего уровня"
 * />
 */
const LoyaltyGradientCard = ({
  points = 2450,
  progress = 0.55,
  nextLevelLabel = 'До следующего уровня',
}) => {
  const clampedProgress = Math.max(0, Math.min(1, progress))
  const progressPercent = Math.round(clampedProgress * 100)

  return (
    <button
      type="button"
      className="
        w-full
        rounded-2xl
        bg-gradient-to-tr from-sakura-deep to-sakura-mid
        text-white
        shadow-xl
        px-4 py-4
        flex flex-col gap-4
        active:scale-[0.98]
        transition-transform
      "
      style={{
        boxShadow: 'var(--card-shadow, 0 12px 35px rgba(15, 23, 42, 0.45))',
      }}
    >
      {/* Верхняя подпись */}
      <div className="text-xs font-medium text-white/80">
        Ваш баланс
      </div>

      {/* Основной блок с количеством баллов */}
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold leading-none">
            {points.toLocaleString('ru-RU')}
          </span>
          <span className="text-xs uppercase tracking-wide text-white/80">
            pts
          </span>
        </div>

        <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-white/15 backdrop-blur-sm">
          <Star className="w-4 h-4 text-sakura-gold" fill="currentColor" />
          <span className="text-[11px] font-medium text-white/90">
            Gold
          </span>
        </div>
      </div>

      {/* Прогресс до следующего уровня */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-white/80">
          <span>{nextLevelLabel}</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-white/20 backdrop-blur-sm overflow-hidden">
          <div
            className="
              h-full
              rounded-full
              bg-gradient-to-r from-white to-white/80
              transition-all
              duration-300
            "
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </button>
  )
}

export default LoyaltyGradientCard

