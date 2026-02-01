import { useNavigate } from 'react-router-dom'
import { hapticFeedback } from '../utils/telegram'
import { getAllCategoryGroups } from '../utils/serviceIcons'
import { useTranslation } from '../utils/i18n'
import useLanguageStore from '../store/languageStore'

const AllCategories = () => {
  const navigate = useNavigate()
  const { language } = useLanguageStore()
  const { t } = useTranslation(language)
  const groups = getAllCategoryGroups()

  return (
    <div className="min-h-screen pb-24 relative">
      <div className="absolute inset-0 -z-20">
        <img
          src="/bg/sakura.jpg"
          alt=""
          className="w-full h-full object-cover opacity-85"
        />
      </div>
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-sakura-mid/20 via-sakura-dark/20 to-sakura-deep/30" />

      {/* Header */}
      <div className="sticky top-0 z-20 bg-sakura-deep/90 backdrop-blur-xl border-b border-sakura-border/40">
        <div className="px-4 pt-14 pb-4 flex items-center gap-3">
          <button
            onClick={() => {
              hapticFeedback('light')
              navigate('/')
            }}
            className="p-2 -ml-2 rounded-xl text-white hover:bg-white/10 transition-colors"
            aria-label={language === 'ru' ? 'Назад' : 'Back'}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="text-[22px] font-bold text-white leading-tight">
            {t('categories_page_title')}
          </h1>
        </div>
      </div>

      {/* Grid of all categories */}
      <div className="px-4 pt-6 pb-8">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {groups.map((group) => {
            const displayName = language === 'ru' ? group.name : group.nameEn
            const emoji = group.emoji || '⭐'
            return (
              <div
                key={group.code}
                onClick={() => {
                  hapticFeedback('light')
                  const params = new URLSearchParams()
                  params.set('category_group', group.code)
                  navigate(`/services?${params.toString()}`)
                }}
                className="bg-white rounded-2xl p-3 md:p-4 cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 relative h-28 md:h-32 flex flex-col overflow-hidden shadow-md border border-sakura-border/20"
              >
                <h3 className="font-bold text-sm text-sakura-deep leading-tight pr-12 line-clamp-2">
                  {displayName}
                </h3>
                <div className="absolute bottom-2 right-2 md:bottom-3 md:right-3 text-4xl md:text-5xl">
                  {emoji}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default AllCategories
