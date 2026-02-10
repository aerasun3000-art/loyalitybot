import React from 'react'

/**
 * @deprecated Legacy версия сетки категорий (emoji).
 * Используется только для старых макетов; в новом дизайне заменена на `CategoryGridNeo`.
 */
/**
 * Сетка категорий в 3 колонки.
 *
 * По умолчанию использует мок‑данные, но может получать массив categories:
 * [{ id, label, emoji }]
 */
const DEFAULT_CATEGORIES = [
  { id: 'beauty', label: 'Beauty', emoji: '💄' },
  { id: 'food', label: 'Food', emoji: '🍔' },
  { id: 'fitness', label: 'Fitness', emoji: '🏋️' },
  { id: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { id: 'travel', label: 'Travel', emoji: '✈️' },
  { id: 'games', label: 'Games', emoji: '🎮' },
]

const CategoryGrid = ({
  categories = DEFAULT_CATEGORIES,
  onSelect,
}) => {
  const handleClick = (category) => {
    if (onSelect) onSelect(category)
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {categories.map((cat) => (
        <button
          key={cat.id}
          type="button"
          onClick={() => handleClick(cat)}
          className="
            flex flex-col items-center justify-center
            gap-1.5
            text-xs
            active:scale-[0.97]
            transition-transform
          "
        >
          <div
            className="
              w-14 h-14
              rounded-full
              flex items-center justify-center
              bg-tg-secondary-bg
              shadow-sm
            "
            style={{
              backgroundColor:
                'color-mix(in srgb, var(--tg-theme-secondary-bg-color) 92%, #00000008)',
            }}
          >
            <span className="text-xl">
              {cat.emoji}
            </span>
          </div>
          <span className="text-[12px] leading-tight text-center text-tg-text/80">
            {cat.label}
          </span>
        </button>
      ))}
    </div>
  )
}

export default CategoryGrid

