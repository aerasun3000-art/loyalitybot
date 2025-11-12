import { useLocation, useNavigate } from 'react-router-dom'
import { hapticFeedback } from '../utils/telegram'
import { useTranslation } from '../utils/i18n'
import useLanguageStore from '../store/languageStore'

const Navigation = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { language } = useLanguageStore()
  const { t } = useTranslation(language)

  const handleNavigation = (path) => {
    hapticFeedback('light')
    navigate(path)
  }

  const isActive = (path) => location.pathname === path

  const navItems = [
    {
      path: '/',
      labelKey: 'nav_home',
      icon: (active) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 12L12 3L21 12M12 21V12"
            stroke="currentColor"
            strokeWidth={active ? "2" : "1.5"}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {active && (
            <circle cx="12" cy="12" r="1.5" fill="currentColor" />
          )}
        </svg>
      )
    },
    // Activity -> история
    {
      path: '/history',
      labelKey: 'nav_activity',
      icon: (active) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle
            cx="12"
            cy="12"
            r="9"
            stroke="currentColor"
            strokeWidth={active ? "2" : "1.5"}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={active ? "currentColor" : "none"}
            fillOpacity={active ? "0.1" : "0"}
          />
          <path
            d="M12 8V12L15 15"
            stroke="currentColor"
            strokeWidth={active ? "2" : "1.5"}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    },
    // Community -> новости
    {
      path: '/news',
      labelKey: 'nav_community',
      icon: (active) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect
            x="3"
            y="4"
            width="18"
            height="16"
            rx="2"
            stroke="currentColor"
            strokeWidth={active ? "2" : "1.5"}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={active ? "currentColor" : "none"}
            fillOpacity={active ? "0.1" : "0"}
          />
          <path
            d="M8 10H16M8 14H16M8 6H16"
            stroke="currentColor"
            strokeWidth={active ? "2" : "1.5"}
            strokeLinecap="round"
          />
        </svg>
      )
    },
    // Message -> акции
    {
      path: '/promotions',
      labelKey: 'nav_message',
      icon: (active) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2L2 7L12 12L22 7L12 2Z"
            stroke="currentColor"
            strokeWidth={active ? "2" : "1.5"}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={active ? "currentColor" : "none"}
            fillOpacity={active ? "0.1" : "0"}
          />
          <path
            d="M2 17L12 22L22 17M2 12L12 17L22 12"
            stroke="currentColor"
            strokeWidth={active ? "2" : "1.5"}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    },
    // Account -> профиль
    {
      path: '/profile',
      labelKey: 'nav_profile',
      icon: (active) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle
            cx="12"
            cy="8"
            r="3"
            stroke="currentColor"
            strokeWidth={active ? "2" : "1.5"}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={active ? "currentColor" : "none"}
            fillOpacity={active ? "0.1" : "0"}
          />
          <path
            d="M6 21C6 17 8.5 14 12 14C15.5 14 18 17 18 21"
            stroke="currentColor"
            strokeWidth={active ? "2" : "1.5"}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    }
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-sakura-surface/85 border-t border-sakura-border/50 shadow-[0_-6px_12px_-8px_rgba(0,0,0,0.25)] z-50 backdrop-blur-md">
      <div className="flex items-center justify-around h-16 max-w-screen-xl mx-auto px-2">
        {navItems.map((item) => {
          const active = isActive(item.path)
          return (
            <button
              key={item.path}
              onClick={() => handleNavigation(item.path)}
              className={`relative flex flex-col items-center justify-center min-w-[60px] h-full transition-colors ${
                active ? 'text-sakura-accent' : 'text-jewelry-gray-elegant'
              }`}
            >
              <div className="transition-opacity">
                {item.icon(active)}
              </div>
              <span className={`text-[10px] mt-1 font-medium ${active ? 'font-semibold' : ''}`}>
                {t(item.labelKey)}
              </span>
              {active && (
                <div className="absolute bottom-0 h-0.5 w-12 bg-sakura-accent rounded-full" />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export default Navigation

