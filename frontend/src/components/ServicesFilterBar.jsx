/**
 * Полоса фильтров и сортировки для страницы «Мои мастера»
 */
import { hapticFeedback } from '../utils/telegram'

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
  return (
    <>
      {/* Фильтры */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
        <button
          onClick={() => handleFilterChange('all')}
          title={language === 'ru' ? 'Партнёры без привязки к району' : 'Partners without district'}
          className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap transition-all ${
            filter === 'all'
              ? 'bg-sakura-accent text-white'
              : 'bg-sakura-surface/40 text-sakura-dark border border-sakura-border/50'
          }`}
        >
          {language === 'ru' ? 'Онлайн' : 'Online'}
        </button>
        <button
          onClick={() => handleFilterChange('my_district')}
          className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap transition-all ${
            filter === 'my_district'
              ? 'bg-sakura-accent text-white'
              : 'bg-sakura-surface/40 text-sakura-dark border border-sakura-border/50'
          }`}
        >
          {language === 'ru' ? 'Мой район' : 'My district'}
        </button>
        <button
          onClick={() => handleFilterChange('favorites')}
          className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap transition-all ${
            filter === 'favorites'
              ? 'bg-sakura-accent text-white'
              : 'bg-sakura-surface/40 text-sakura-dark border border-sakura-border/50'
          }`}
        >
          {language === 'ru' ? 'Любимые' : 'Favorites'}
        </button>
        <button
          onClick={() => handleFilterChange('search')}
          className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap transition-all ${
            filter === 'search'
              ? 'bg-sakura-accent text-white'
              : 'bg-sakura-surface/40 text-sakura-dark border border-sakura-border/50'
          }`}
        >
          {language === 'ru' ? 'Поиск по услуге' : 'Search'}
        </button>
      </div>

      {/* Подпись активного фильтра */}
      {filter !== 'none' && (
        <p className="text-xs text-sakura-dark/70 mt-1">
          {language === 'ru' ? 'Сейчас: ' : 'Active: '}
          {filter === 'all' && (language === 'ru' ? 'Онлайн' : 'Online')}
          {filter === 'my_district' && (language === 'ru' ? 'Мой район' : 'My district')}
          {filter === 'favorites' && (language === 'ru' ? 'Любимые' : 'Favorites')}
          {filter === 'search' && (language === 'ru' ? 'Поиск по услуге' : 'Search')}
        </p>
      )}

      {/* Поле поиска */}
      {filter === 'search' && (
        <div className="mt-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={language === 'ru' ? 'Введите название услуги...' : 'Enter service name...'}
            className="w-full px-4 py-2 rounded-lg bg-sakura-surface/20 text-sakura-dark border border-sakura-border/40 placeholder-sakura-dark/60 outline-none focus:border-sakura-accent"
            autoFocus
          />
        </div>
      )}

      {/* Сортировка */}
      {sortedGroupsLength > 0 && (
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="text-xs text-sakura-dark/70">{language === 'ru' ? 'Сортировка:' : 'Sort:'}</span>
          <button
            onClick={() => { hapticFeedback('light'); setSortBy('default') }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${sortBy === 'default' ? 'bg-sakura-accent text-white' : 'bg-sakura-surface/30 text-sakura-dark/80'}`}
          >
            {language === 'ru' ? 'По умолчанию' : 'Default'}
          </button>
          <button
            onClick={() => { hapticFeedback('light'); setSortBy('rating') }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${sortBy === 'rating' ? 'bg-sakura-accent text-white' : 'bg-sakura-surface/30 text-sakura-dark/80'}`}
          >
            {language === 'ru' ? 'По рейтингу' : 'By rating'}
          </button>
          <button
            onClick={() => { hapticFeedback('light'); setSortBy('nps') }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${sortBy === 'nps' ? 'bg-sakura-accent text-white' : 'bg-sakura-surface/30 text-sakura-dark/80'}`}
          >
            NPS
          </button>
        </div>
      )}
    </>
  )
}
