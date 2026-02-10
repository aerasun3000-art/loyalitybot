/**
 * Компактная полоса фильтров и сортировки для страницы «Мои мастера»
 */
import { hapticFeedback } from '../utils/telegram'

const Pill = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap active:scale-95"
    style={active
      ? { backgroundColor: 'var(--tg-theme-button-color)', color: 'var(--tg-theme-button-text-color, #fff)' }
      : { backgroundColor: 'var(--tg-theme-secondary-bg-color)', color: 'var(--tg-theme-text-color)' }
    }
  >
    {children}
  </button>
)

export default function ServicesFilterBar({
  filter,
  handleFilterChange,
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  sortedGroupsLength,
  language
}) {
  const ru = language === 'ru'

  return (
    <div className="flex flex-col gap-2">
      {/* Фильтры + сортировка — одна горизонтальная полоска */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
        <Pill active={filter === 'all'} onClick={() => handleFilterChange('all')}>
          {ru ? '🌍 Мировой' : '🌍 World'}
        </Pill>
        <Pill active={filter === 'my_district'} onClick={() => handleFilterChange('my_district')}>
          {ru ? '📍 Город' : '📍 City'}
        </Pill>
        <Pill active={filter === 'favorites'} onClick={() => handleFilterChange('favorites')}>
          {ru ? '❤️ Мои' : '❤️ Fav'}
        </Pill>
        <Pill active={filter === 'search'} onClick={() => handleFilterChange('search')}>
          🔍
        </Pill>

        {/* Разделитель */}
        {sortedGroupsLength > 0 && (
          <>
            <div className="w-px shrink-0 my-1" style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 20%, transparent)' }} />
            <Pill active={sortBy === 'rating'} onClick={() => { hapticFeedback('light'); setSortBy(sortBy === 'rating' ? 'default' : 'rating') }}>
              ⭐
            </Pill>
            <Pill active={sortBy === 'nps'} onClick={() => { hapticFeedback('light'); setSortBy(sortBy === 'nps' ? 'default' : 'nps') }}>
              NPS
            </Pill>
          </>
        )}
      </div>

      {/* Поле поиска */}
      {filter === 'search' && (
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={ru ? 'Название услуги...' : 'Service name...'}
          className="w-full px-3 py-2 rounded-xl text-sm outline-none"
          style={{
            backgroundColor: 'var(--tg-theme-secondary-bg-color)',
            color: 'var(--tg-theme-text-color)',
            border: '1px solid color-mix(in srgb, var(--tg-theme-hint-color) 15%, transparent)',
          }}
          autoFocus
        />
      )}
    </div>
  )
}
