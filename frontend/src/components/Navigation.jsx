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
    {
      path: '/history',
      labelKey: 'nav_activity',
      icon: (active) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor"
            strokeWidth={active ? "2" : "1.5"} strokeLinecap="round" strokeLinejoin="round"
            fill={active ? "currentColor" : "none"} fillOpacity={active ? "0.1" : "0"} />
          <path d="M12 8V12L15 15" stroke="currentColor"
            strokeWidth={active ? "2" : "1.5"} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      path: '/community',
      labelKey: 'nav_earn',
      icon: (active) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
            stroke="currentColor" strokeWidth={active ? "2" : "1.5"} strokeLinecap="round" strokeLinejoin="round"
            fill={active ? "currentColor" : "none"} fillOpacity={active ? "0.15" : "0"} />
        </svg>
      )
    },
    {
      path: '/promotions',
      labelKey: 'nav_promotions',
      icon: (active) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="5" y="8" width="14" height="12" rx="1" stroke="currentColor"
            strokeWidth={active ? "2" : "1.5"} strokeLinecap="round" strokeLinejoin="round"
            fill={active ? "currentColor" : "none"} fillOpacity={active ? "0.1" : "0"} />
          <rect x="5" y="6" width="14" height="3" rx="1" stroke="currentColor"
            strokeWidth={active ? "2" : "1.5"} strokeLinecap="round" strokeLinejoin="round"
            fill={active ? "currentColor" : "none"} fillOpacity={active ? "0.15" : "0"} />
          <path d="M12 6V20" stroke="currentColor" strokeWidth={active ? "2" : "1.5"} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 12H19" stroke="currentColor" strokeWidth={active ? "2" : "1.5"} strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="2" fill="currentColor" fillOpacity={active ? "1" : "0.7"} />
        </svg>
      )
    },
    {
      path: '/profile',
      labelKey: 'nav_profile',
      icon: (active) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="3" stroke="currentColor"
            strokeWidth={active ? "2" : "1.5"} strokeLinecap="round" strokeLinejoin="round"
            fill={active ? "currentColor" : "none"} fillOpacity={active ? "0.1" : "0"} />
          <path d="M6 21C6 17 8.5 14 12 14C15.5 14 18 17 18 21" stroke="currentColor"
            strokeWidth={active ? "2" : "1.5"} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    }
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 shadow-[0_-6px_12px_-8px_rgba(0,0,0,0.25)] z-50 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-bg-color) 85%, transparent)', borderTop: '1px solid color-mix(in srgb, var(--tg-theme-hint-color) 20%, transparent)' }}
    >
      <div className="flex items-center justify-around h-16 max-w-screen-xl mx-auto px-2">
        {navItems.map((item) => {
          const active = isActive(item.path)
          return (
            <button
              key={item.path}
              onClick={() => handleNavigation(item.path)}
              className="relative flex flex-col items-center justify-center min-w-[60px] h-full"
              style={{ color: active ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-hint-color)' }}
            >
              <div>
                {item.icon(active)}
              </div>
              <span className={`text-xs mt-1 font-medium ${active ? 'font-semibold' : ''}`}>
                {t(item.labelKey)}
              </span>
              {active && (
                <div className="absolute bottom-0 h-0.5 w-12 rounded-full"
                  style={{ backgroundColor: 'var(--tg-theme-button-color)' }} />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export default Navigation
