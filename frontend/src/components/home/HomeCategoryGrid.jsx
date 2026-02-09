import { hapticFeedback } from '../../utils/telegram'
import { getAllCategoryGroups } from '../../utils/serviceIcons'

const HomeCategoryGrid = ({ language, t, navigate }) => {
  const filteredGroups = getAllCategoryGroups()
    .filter(group =>
      group.code !== 'travel_tourism' &&
      group.code !== 'automotive_pets' &&
      group.code !== 'healthcare' &&
      group.code !== 'education' &&
      group.code !== 'retail'
    )
    .slice(0, 5)

  const cardsToDisplay = [
    ...filteredGroups.map(group => ({ type: 'category', group })),
    { type: 'more' }
  ]

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-sakura-deep">
          {t('home_services')}
        </h2>
        <button
          onClick={() => navigate('/services')}
          className="flex items-center gap-1"
        >
          <span className="text-sakura-deep font-semibold hover:opacity-80 transition-colors drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]">
            {t('home_see_all')}
          </span>
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {cardsToDisplay.map((item, index) => {
          if (item.type === 'more') {
            return (
              <div
                key="more"
                onClick={() => {
                  hapticFeedback('light')
                  navigate('/categories')
                }}
                className={`fade-in-up delay-${(index + 1) * 100} bg-sakura-deep rounded-2xl p-3 md:p-4 cursor-pointer
                           hover:scale-105 hover:shadow-lg
                           active:scale-95 transition-all duration-200
                           relative h-28 md:h-32 flex flex-col items-center justify-center`}
              >
                <h3 className="font-bold text-lg md:text-xl text-white">
                  {language === 'ru' ? 'Еще' : 'More'}
                </h3>
                <div className="absolute bottom-2 right-2 md:bottom-4 md:right-4 text-white text-3xl md:text-4xl">
                  →
                </div>
              </div>
            )
          }

          const { group } = item
          const displayName = language === 'ru' ? group.name : group.nameEn
          const emojiToDisplay = group.emoji || '⭐'

          return (
            <div
              key={group.code}
              onClick={() => {
                hapticFeedback('light')
                const params = new URLSearchParams()
                params.set('category_group', group.code)
                navigate(`/services?${params.toString()}`)
              }}
              className={`fade-in-up delay-${(index + 1) * 100} bg-white dark:bg-sakura-dark rounded-2xl p-3 md:p-4 cursor-pointer
                         hover:scale-105 hover:shadow-lg
                         active:scale-95 transition-all duration-200
                         relative h-28 md:h-32 flex flex-col overflow-hidden shadow-md`}
            >
              <h3 className="font-bold text-sm md:text-sm text-sakura-deep leading-tight pr-12 md:pr-12 line-clamp-2">
                {displayName}
              </h3>
              <div className="absolute bottom-2 right-2 md:bottom-3 md:right-3 text-4xl md:text-5xl">
                {emojiToDisplay}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

export default HomeCategoryGrid
