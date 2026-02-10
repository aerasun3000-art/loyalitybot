import React from 'react'

/**
 * @deprecated Legacy карусель новостей.
 * Новый дизайн использует `NewsCarouselNeo` (см. HomeMini/Home).
 */
/**
 * Горизонтальный список новостей с карточками 280x150.
 *
 * items: [{ id, title, imageUrl }]
 */
const DEFAULT_ITEMS = [
  {
    id: '1',
    title: 'Morning Fuel Special – двойные баллы за кофе',
    imageUrl: '/bg/sample-news-1.jpg',
  },
  {
    id: '2',
    title: 'Новая студия в вашем районе присоединилась к программе',
    imageUrl: '/bg/sample-news-2.jpg',
  },
]

const NewsCarousel = ({
  items = DEFAULT_ITEMS,
  onSelect,
}) => {
  const handleClick = (item) => {
    if (onSelect) onSelect(item)
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => handleClick(item)}
          className="
            relative
            flex-shrink-0
            w-[280px] h-[150px]
            rounded-xl
            overflow-hidden
            bg-tg-secondary-bg
            text-left
            active:scale-[0.98]
            transition-transform
          "
        >
          {/* Фоновое изображение */}
          {item.imageUrl && (
            <img
              src={item.imageUrl}
              alt={item.title}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
          )}

          {/* Градиент поверх картинки для читабельности текста */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/35 to-black/10" />

          {/* Текст */}
          <div className="relative z-10 h-full flex items-end p-3">
            <p className="text-sm font-medium text-white line-clamp-2">
              {item.title}
            </p>
          </div>
        </button>
      ))}
    </div>
  )
}

export default NewsCarousel

