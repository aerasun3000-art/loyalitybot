import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Глобальное хранилище для языка приложения
 */
const useLanguageStore = create(
  persist(
    (set) => ({
      language: 'ru', // По умолчанию русский
      
      // Установить язык
      setLanguage: (lang) => set({ language: lang }),
      
      // Переключить язык
      toggleLanguage: () => set((state) => ({
        language: state.language === 'ru' ? 'en' : 'ru'
      })),
    }),
    {
      name: 'loyalitybot-language', // Ключ в localStorage
    }
  )
)

export default useLanguageStore

