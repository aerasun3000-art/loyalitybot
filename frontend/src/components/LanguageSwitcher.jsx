import useLanguageStore from '../store/languageStore'
import { hapticFeedback } from '../utils/telegram'

const LanguageSwitcher = ({ className = '' }) => {
  const { language, toggleLanguage } = useLanguageStore()

  const handleToggle = () => {
    hapticFeedback('light')
    toggleLanguage()
  }

  return (
    <button
      onClick={handleToggle}
      className={`flex items-center gap-2 bg-white rounded-full px-3 py-2 shadow-sm ${className}`}
    >
      <span className="text-lg">{language === 'ru' ? '🇷🇺' : '🇬🇧'}</span>
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        className="text-gray-600"
      >
        <path
          d="M4 6L8 10L12 6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </button>
  )
}

export default LanguageSwitcher

