import React from 'react'
import { Sparkles, Utensils, Trophy, Heart, ShoppingBag, Coffee } from 'lucide-react'

// Дефолтные категории для нового дизайна (ровно 9 — 3x3)
const DEFAULT_CATEGORIES = [
  {
    id: 1,
    name: 'Красота',
    icon: (className) => <Sparkles className={className} />,
    bgColor: 'bg-pink-100 dark:bg-pink-900/30',
  },
  {
    id: 2,
    name: 'Еда',
    icon: (className) => <Utensils className={className} />,
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
  },
  {
    id: 3,
    name: 'Спорт',
    icon: (className) => <Trophy className={className} />,
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  {
    id: 4,
    name: 'Здоровье',
    icon: (className) => <Heart className={className} />,
    bgColor: 'bg-red-100 dark:bg-red-900/30',
  },
  {
    id: 5,
    name: 'Шопинг',
    icon: (className) => <ShoppingBag className={className} />,
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
  },
  {
    id: 6,
    name: 'Кофе',
    icon: (className) => <Coffee className={className} />,
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
  },
  {
    id: 7,
    name: 'Игры',
    icon: (className) => <Trophy className={className} />,
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
  },
  {
    id: 8,
    name: 'Путешествия',
    icon: (className) => <Sparkles className={className} />,
    bgColor: 'bg-teal-100 dark:bg-teal-900/30',
  },
  {
    id: 9,
    name: 'Еще',
    icon: (className) => <ShoppingBag className={className} />,
    bgColor: 'bg-sakura-cream dark:bg-sakura-dark/40',
  },
]

// Построить категории для грида на основе сервисных тайлов (getServiceTiles)
// Мы используем палитру DEFAULT_CATEGORIES для иконок/фона,
// а подписи берём из данных тайла (shortLabel), если они есть.
export const buildCategoriesFromServiceTiles = (tiles = []) => {
  // Если нет данных — просто показываем дефолтную сетку 3x3
  if (!Array.isArray(tiles) || tiles.length === 0) {
    return DEFAULT_CATEGORIES
  }

  // Мы хотим, чтобы подписи и иконки оставались как в дизайне (Beauty, Food, ...),
  // а клик вёл на реальные категории из getServiceTiles.
  return DEFAULT_CATEGORIES.map((base, index) => {
    const tile = tiles[index]

    if (tile?.code) {
      return {
        ...base,
        serviceCode: tile.code,
      }
    }

    return base
  })
}

/**
 * Новый грид категорий (3x3) в стиле макета.
 * Пока используется только в HomeMini, чтобы не затрагивать текущий дизайн.
 */
const CategoryGridNeo = ({ categories = DEFAULT_CATEGORIES, onSelect }) => {
  const handleClick = (cat) => {
    if (onSelect) onSelect(cat)
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {categories.map((cat) => (
        <button
          key={cat.id}
          type="button"
          onClick={() => handleClick(cat)}
          className="flex flex-col items-center gap-2 transition-transform active:scale-90"
        >
          <div
            className={`w-16 h-16 ${cat.bgColor || 'bg-gray-100 dark:bg-gray-800'} rounded-2xl flex items-center justify-center shadow-sm`}
          >
            {typeof cat.icon === 'function'
              ? cat.icon('w-6 h-6')
              : <span className="text-3xl">{cat.emoji || '⭐'}</span>
            }
          </div>
          <span
            className="text-[13px] font-medium opacity-90"
            style={{ color: 'var(--tg-theme-text-color, #111827)' }}
          >
            {cat.name}
          </span>
        </button>
      ))}
    </div>
  )
}

export default CategoryGridNeo

