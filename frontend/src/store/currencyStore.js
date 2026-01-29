import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Глобальное хранилище для валюты пользователя
 * 
 * Валюта сохраняется в localStorage и синхронизируется с Supabase
 * Поддерживаемые валюты: USD, VND, RUB, KZT
 */

// Курсы валют по умолчанию
const DEFAULT_RATES = {
  USD: 1,
  VND: 25000,
  RUB: 100,
  KZT: 520,
}

const useCurrencyStore = create(
  persist(
    (set, get) => ({
      // Выбранная валюта (по умолчанию USD)
      currency: 'USD',
      
      // Курсы валют (обновляются из БД)
      rates: DEFAULT_RATES,
      
      // Время последнего обновления курсов
      ratesUpdatedAt: null,
      
      // Установить валюту
      setCurrency: (currency) => set({ currency }),
      
      // Обновить курсы валют
      setRates: (rates) => set({ 
        rates: { ...DEFAULT_RATES, ...rates },
        ratesUpdatedAt: Date.now(),
      }),
      
      // Получить курс для валюты
      getRate: (currency) => {
        const { rates } = get()
        return rates[currency] || 1
      },
      
      // Конвертировать баллы в выбранную валюту
      convertPoints: (points) => {
        const { currency, rates } = get()
        if (currency === 'USD') return points
        const rate = rates[currency] || 1
        return Math.round(points * rate)
      },
    }),
    {
      name: 'loyalitybot-currency', // Ключ в localStorage
      partialize: (state) => ({
        currency: state.currency,
        rates: state.rates,
        ratesUpdatedAt: state.ratesUpdatedAt,
      }),
    }
  )
)

export default useCurrencyStore
