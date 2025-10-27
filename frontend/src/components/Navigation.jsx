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
            d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"
            fill={active ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    },
    {
      path: '/promotions',
      labelKey: 'nav_promotions',
      icon: (active) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"
            fill={active ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    },
    {
      path: '/news',
      labelKey: 'nav_news',
      icon: (active) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"
            fill={active ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    },
    {
      path: '/history',
      labelKey: 'nav_history',
      icon: (active) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"
            fill={active ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    },
    {
      path: '/profile',
      labelKey: 'nav_profile',
      icon: (active) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
            fill={active ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    }
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
      <div className="flex items-center justify-around h-16 max-w-screen-xl mx-auto px-2">
        {navItems.map((item) => {
          const active = isActive(item.path)
          return (
            <button
              key={item.path}
              onClick={() => handleNavigation(item.path)}
              className={`flex flex-col items-center justify-center min-w-[60px] h-full transition-all ${
                active ? 'text-pink-500' : 'text-gray-500'
              }`}
            >
              <div className={`transition-transform ${active ? 'scale-110' : 'scale-100'}`}>
                {item.icon(active)}
              </div>
              <span className={`text-[10px] mt-1 font-medium ${active ? 'font-semibold' : ''}`}>
                {t(item.labelKey)}
              </span>
              {active && (
                <div className="absolute bottom-0 h-0.5 w-12 bg-pink-500 rounded-t-full" />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export default Navigation

