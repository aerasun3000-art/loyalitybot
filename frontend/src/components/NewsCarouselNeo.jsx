import React from 'react'

// Мок-данные для экспериментального экрана
const DEFAULT_ITEMS = [
  {
    id: 1,
    title: 'Двойные баллы за кофе',
    image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=500&q=80',
    tag: 'Акция',
  },
  {
    id: 2,
    title: 'Новая коллекция осени',
    image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=500&q=80',
    tag: 'Новинка',
  },
  {
    id: 3,
    title: 'Пригласи друга — получи 500 б.',
    image: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=500&q=80',
    tag: 'Бонус',
  },
]

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=500&q=80'

/**
 * Новый слайдер новостей/акций с карточками 280x160.
 * Пока используется только в HomeMini и новом Home-дизайне.
 */
const NewsCarouselNeo = ({ items = DEFAULT_ITEMS, onItemClick, translating = false }) => {
  const handleClick = (item) => {
    if (onItemClick) onItemClick(item)
  }

  // Если пришёл массив и он не пустой — используем его, иначе дефолтные карточки
  const list = Array.isArray(items) && items.length > 0 ? items : DEFAULT_ITEMS

  const getBadgeClass = (item) => {
    // Акции — акцентная плашка Sakura
    if (item.kind === 'promo' || (item.tag && item.tag.toLowerCase().includes('акц'))) {
      return 'bg-sakura-accent'
    }
    // Новости — средний тон Sakura
    if (item.kind === 'news' || (item.tag && item.tag.toLowerCase().includes('нов'))) {
      return 'bg-sakura-mid'
    }
    // Остальное — также средний тон Sakura
    return 'bg-sakura-mid'
  }

  return (
    <div className="py-2 relative">
      {translating && (
        <div className="absolute top-0 left-0 right-0 h-0.5 z-10 overflow-hidden rounded-full">
          <div className="h-full w-1/3 rounded-full animate-[shimmer_1.5s_infinite]" style={{ backgroundColor: 'var(--tg-theme-button-color, #d4a0b9)' }} />
        </div>
      )}
      <div className="flex gap-4 overflow-x-auto px-0 scrollbar-hide pb-2 snap-x snap-mandatory">
        {list.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handleClick(item)}
            className="
              flex-none
              w-[min(280px,75vw)] h-[160px]
              relative
              rounded-2xl
              overflow-hidden
              shadow-md
              active:scale-[0.98]
              transition-transform
              snap-start
              text-left
            "
          >
            {/* Изображение фона */}
            <img
              src={item.image || FALLBACK_IMAGE}
              alt={item.title}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />

            {/* Градиентный оверлей для читаемости текста */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

            {/* Контент карточки */}
            <div className="absolute bottom-0 left-0 p-4 w-full">
              {item.tag && (
                <span
                  className={`${getBadgeClass(
                    item,
                  )} text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase mb-2 inline-block`}
                >
                  {item.tag}
                </span>
              )}
              <h3 className="text-white font-semibold text-sm leading-tight line-clamp-2">
                {item.title}
              </h3>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// Shimmer animation for translation indicator
const shimmerStyle = document.createElement('style')
shimmerStyle.textContent = `
  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(400%); }
  }
`
if (!document.querySelector('[data-neo-shimmer]')) {
  shimmerStyle.setAttribute('data-neo-shimmer', '')
  document.head.appendChild(shimmerStyle)
}

export default NewsCarouselNeo

