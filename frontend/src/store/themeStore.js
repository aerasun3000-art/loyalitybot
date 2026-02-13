import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getColorScheme } from '../utils/telegram'

// Тёмная тема — значения CSS-переменных для принудительного override Telegram SDK
const DARK_THEME_VARS = {
  '--tg-theme-bg-color': '#1B0C1A',
  '--tg-theme-text-color': '#ffffff',
  '--tg-theme-hint-color': '#A090A3',
  '--tg-theme-link-color': '#D4899B',
  '--tg-theme-button-color': '#D4899B',
  '--tg-theme-button-text-color': '#ffffff',
  '--tg-theme-secondary-bg-color': '#2D222F',
}

function applyTheme(theme) {
  document.documentElement.className = theme
  const root = document.documentElement
  if (theme === 'dark') {
    // Ставим inline-стили чтобы перебить Telegram SDK
    Object.entries(DARK_THEME_VARS).forEach(([key, value]) => {
      root.style.setProperty(key, value)
    })
  } else {
    // Убираем наши override — пусть Telegram SDK или CSS :root управляют
    Object.keys(DARK_THEME_VARS).forEach((key) => {
      root.style.removeProperty(key)
    })
  }
}

/**
 * Глобальное хранилище для темы приложения
 */
const useThemeStore = create(
  persist(
    (set) => ({
      // По умолчанию используем тему из Telegram
      theme: getColorScheme() || 'light',

      // Установить тему
      setTheme: (newTheme) => {
        applyTheme(newTheme)
        set({ theme: newTheme })
      },

      // Переключить тему
      toggleTheme: () => set((state) => {
        const newTheme = state.theme === 'light' ? 'dark' : 'light'
        applyTheme(newTheme)
        return { theme: newTheme }
      }),
    }),
    {
      name: 'loyalitybot-theme',
      onRehydrateStorage: () => (state) => {
        // После восстановления темы из localStorage — применяем к DOM
        if (state?.theme) {
          applyTheme(state.theme)
        }
      },
    }
  )
)

export default useThemeStore

