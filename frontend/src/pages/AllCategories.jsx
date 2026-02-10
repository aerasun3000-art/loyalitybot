import { useNavigate } from 'react-router-dom'
import { hapticFeedback } from '../utils/telegram'
import { getAllCategoryGroups } from '../utils/serviceIcons'
import { useTranslation } from '../utils/i18n'
import useLanguageStore from '../store/languageStore'
import Layout from '../components/Layout'

const AllCategories = () => {
  const navigate = useNavigate()
  const { language } = useLanguageStore()
  const { t } = useTranslation(language)
  const groups = getAllCategoryGroups()

  return (
    <Layout>
      <div className="max-w-screen-sm mx-auto px-4 flex flex-col gap-4">
        {/* Заголовок */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => {
              hapticFeedback('light')
              navigate(-1)
            }}
            className="p-2 -ml-2 rounded-xl transition-all active:scale-90"
            style={{ color: 'var(--tg-theme-text-color)' }}
            aria-label={language === 'ru' ? 'Назад' : 'Back'}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="text-xl font-bold">{t('categories_page_title')}</h1>
        </div>

        {/* Сетка категорий */}
        <div className="grid grid-cols-2 gap-3 pb-4">
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
                className="rounded-2xl p-3 cursor-pointer active:scale-[0.97] transition-all relative h-24 flex flex-col overflow-hidden"
                style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}
              >
                <h3 className="font-bold text-sm leading-tight pr-10 line-clamp-2">
                  {displayName}
                </h3>
                <div className="absolute bottom-2 right-2 text-3xl">
                  {emoji}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Layout>
  )
}

export default AllCategories
