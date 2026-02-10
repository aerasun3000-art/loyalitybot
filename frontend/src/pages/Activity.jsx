import useLanguageStore from '../store/languageStore'
import { useTranslation } from '../utils/i18n'

function Activity() {
  const { language } = useLanguageStore()
  const { t } = useTranslation(language)

  return (
    <div className="min-h-screen bg-sakura-surface dark:bg-sakura-dark p-4">
      <h1 className="text-xl font-semibold mb-2">{t('nav_history')}</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {/* Placeholder screen for reference tab "Activity" */}
        Coming soon
      </p>
    </div>
  )
}

export default Activity










