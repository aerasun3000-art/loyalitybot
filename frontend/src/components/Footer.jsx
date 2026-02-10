import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../utils/i18n'
import useLanguageStore from '../store/languageStore'
import { hapticFeedback } from '../utils/telegram'

const Footer = () => {
  const navigate = useNavigate()
  const { language } = useLanguageStore()
  const { t } = useTranslation(language)

  const handleNavigation = (path) => {
    hapticFeedback('light')
    navigate(path)
  }

  return (
    <div className="bg-sakura-cream dark:bg-sakura-dark py-6 px-4 mt-8">
      <div className="max-w-4xl mx-auto">
        {/* Legal Links */}
        <div className="flex flex-wrap justify-center gap-4 mb-4 text-sm">
          <button
            onClick={() => handleNavigation('/privacy')}
            className="text-gray-600 dark:text-gray-400 hover:text-luxury-gold dark:hover:text-luxury-gold transition-colors"
          >
            {t('privacy_policy_title')}
          </button>
          <span className="text-gray-400">•</span>
          <button
            onClick={() => handleNavigation('/terms')}
            className="text-gray-600 dark:text-gray-400 hover:text-luxury-gold dark:hover:text-luxury-gold transition-colors"
          >
            {t('terms_of_service_title')}
          </button>
        </div>

        {/* Copyright */}
        <div className="text-center text-xs text-gray-500 dark:text-gray-600">
          <p>© 2025 Mind`N`Beauty. {language === 'ru' ? 'Все права защищены' : 'All rights reserved'}.</p>
        </div>
      </div>
    </div>
  )
}

export default Footer

