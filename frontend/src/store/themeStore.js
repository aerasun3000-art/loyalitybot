import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getColorScheme } from '../utils/telegram'

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
        document.documentElement.className = newTheme
        set({ theme: newTheme })
      },
      
      // Переключить тему
      toggleTheme: () => set((state) => {
        const newTheme = state.theme === 'light' ? 'dark' : 'light'
        document.documentElement.className = newTheme
        return { theme: newTheme }
      }),
    }),
    {
      name: 'loyalitybot-theme',
    }
  )
)

export default useThemeStore

