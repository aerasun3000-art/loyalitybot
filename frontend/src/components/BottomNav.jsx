import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Home, Clock, Gift, Users, UserCircle } from 'lucide-react'
import { hapticFeedback } from '../utils/telegram'
import useLanguageStore from '../store/languageStore'
import { useTranslation } from '../utils/i18n'

/**
 * Нативная нижняя навигация для Telegram Mini App.
 *
 * Фиксирована внизу, использует системные цвета Telegram:
 * - Фон: var(--tg-theme-secondary-bg-color)
 * - Активный элемент: var(--tg-theme-button-color)
 *
 * Подключение в App:
 * <BottomNav />
 */
const BottomNav = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { language } = useLanguageStore()
  const { t } = useTranslation(language)

  const items = [
    { key: 'home', label: t('nav_home'), path: '/', icon: Home },
    { key: 'activity', label: t('nav_activity'), path: '/history', icon: Clock },
    { key: 'gift', label: t('nav_promotions'), path: '/promotions', icon: Gift },
    { key: 'friends', label: t('nav_community'), path: '/community', icon: Users },
    { key: 'profile', label: t('nav_profile'), path: '/profile', icon: UserCircle },
  ]

  const handleClick = (path) => {
    hapticFeedback('light')
    navigate(path)
  }

  const isActive = (path) => location.pathname === path

  return (
    <nav
      className="
        fixed
        bottom-0 left-0 right-0
        z-40
        bg-tg-secondary-bg/90
        backdrop-blur-md
        border-t border-black/5
        pb-[max(env(safe-area-inset-bottom),8px)]
      "
      style={{
        backgroundColor: 'color-mix(in srgb, var(--tg-theme-secondary-bg-color) 92%, transparent)',
      }}
    >
      <div className="max-w-screen-sm mx-auto flex items-center justify-around h-14 px-2">
        {items.map(({ key, label, path, icon: Icon }) => {
          const active = isActive(path)
          return (
            <button
              key={key}
              type="button"
              onClick={() => handleClick(path)}
              className="
                flex flex-col items-center justify-center
                min-w-[56px] h-full
                text-xs
                transition-colors
              "
              style={{
                color: active
                  ? 'var(--tg-theme-button-color)'
                  : 'var(--tg-theme-hint-color)',
              }}
            >
              <Icon
                size={22}
                strokeWidth={active ? 2.4 : 2}
                className="mb-0.5"
              />
              <span className={active ? 'font-semibold' : 'font-medium'}>
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export default BottomNav

