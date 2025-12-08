/**
 * Утилита для автоматического перевода текста с помощью AI
 * Использует OpenAI через backend API
 */

// URL API сервера (можно настроить через переменные окружения)
// Для продакшена установите VITE_API_URL в настройках Vercel/Netlify
const getApiBaseUrl = () => {
  // Приоритет 1: переменная окружения
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  
  // Приоритет 2: localhost для разработки
  if (typeof window !== 'undefined' && window.location.origin.includes('localhost')) {
    return 'http://localhost:8001'
  }
  
  // Приоритет 3: попытка определить по текущему домену
  // Если фронтенд на Vercel, бэкенд может быть на Render/Railway
  // Установите VITE_API_URL в настройках Vercel!
  console.warn('⚠️ VITE_API_URL не установлен! Установите переменную окружения в Vercel.')
  console.warn('⚠️ Используется fallback. Переводы могут не работать.')
  
  // Fallback: попробуем использовать тот же домен (если API на том же домене)
  // Или вернем пустую строку, чтобы показать ошибку
  return ''
}

const API_BASE_URL = getApiBaseUrl()

// Кэш переводов для оптимизации (хранится в памяти)
const translationCache = new Map()

/**
 * Генерирует ключ для кэша
 */
const getCacheKey = (text, sourceLang, targetLang) => {
  return `${sourceLang}:${targetLang}:${text}`
}

/**
 * Переводит текст с помощью AI через backend API
 * 
 * @param {string} text - Текст для перевода
 * @param {string} targetLang - Целевой язык ('en', 'ru', и т.д.)
 * @param {string} sourceLang - Исходный язык ('ru', 'en', и т.д.)
 * @param {boolean} useCache - Использовать кэш (по умолчанию true)
 * @returns {Promise<string>} - Переведенный текст
 */
export const translateText = async (
  text,
  targetLang = 'en',
  sourceLang = 'ru',
  useCache = true
) => {
  // Если текст пустой, возвращаем его как есть
  if (!text || !text.trim()) {
    return text
  }

  // Если языки одинаковые, возвращаем оригинал
  if (sourceLang === targetLang) {
    return text
  }

  // Проверяем кэш
  if (useCache) {
    const cacheKey = getCacheKey(text, sourceLang, targetLang)
    const cached = translationCache.get(cacheKey)
    if (cached) {
      return cached
    }
  }

  // Проверяем, что API_BASE_URL установлен
  if (!API_BASE_URL) {
    console.error('❌ API_BASE_URL не установлен! Установите VITE_API_URL в настройках Vercel.')
    return text // Возвращаем оригинал при ошибке конфигурации
  }

  try {
    const url = `${API_BASE_URL}/api/translate`
    console.log('🌐 Translation request:', { url, text: text.substring(0, 50) + '...', targetLang, sourceLang })
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text.trim(),
        target_lang: targetLang,
        source_lang: sourceLang,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMsg = errorData.detail || `Translation failed: ${response.statusText}`
      console.error('❌ Translation API error:', { status: response.status, error: errorMsg, url })
      throw new Error(errorMsg)
    }

    const data = await response.json()

    if (data.success && data.translated_text) {
      const translated = data.translated_text

      // Сохраняем в кэш
      if (useCache) {
        const cacheKey = getCacheKey(text, sourceLang, targetLang)
        translationCache.set(cacheKey, translated)

        // Ограничиваем размер кэша (максимум 1000 записей)
        if (translationCache.size > 1000) {
          const firstKey = translationCache.keys().next().value
          translationCache.delete(firstKey)
        }
      }

      return translated
    } else {
      throw new Error(data.error || 'Translation failed')
    }
  } catch (error) {
    console.error('Translation error:', error)
    // В случае ошибки возвращаем оригинальный текст
    return text
  }
}

/**
 * Переводит массив текстов
 * 
 * @param {string[]} texts - Массив текстов для перевода
 * @param {string} targetLang - Целевой язык
 * @param {string} sourceLang - Исходный язык
 * @returns {Promise<string[]>} - Массив переведенных текстов
 */
export const translateTexts = async (
  texts,
  targetLang = 'en',
  sourceLang = 'ru'
) => {
  if (!Array.isArray(texts) || texts.length === 0) {
    return []
  }

  // Переводим параллельно (с ограничением на количество одновременных запросов)
  const batchSize = 5
  const results = []

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map(text => translateText(text, targetLang, sourceLang))
    )
    results.push(...batchResults)
  }

  return results
}

/**
 * Переводит объект с текстовыми значениями
 * 
 * @param {Object} obj - Объект для перевода
 * @param {string} targetLang - Целевой язык
 * @param {string} sourceLang - Исходный язык
 * @returns {Promise<Object>} - Объект с переведенными значениями
 */
export const translateObject = async (
  obj,
  targetLang = 'en',
  sourceLang = 'ru'
) => {
  if (!obj || typeof obj !== 'object') {
    return obj
  }

  const translated = {}
  const keys = Object.keys(obj)
  const values = Object.values(obj)

  // Переводим все строковые значения
  const translatedValues = await translateTexts(values, targetLang, sourceLang)

  keys.forEach((key, index) => {
    const value = values[index]
    // Переводим только строки, остальное оставляем как есть
    translated[key] = typeof value === 'string' ? translatedValues[index] : value
  })

  return translated
}

/**
 * Очищает кэш переводов
 */
export const clearTranslationCache = () => {
  translationCache.clear()
}

/**
 * Получает размер кэша
 */
export const getCacheSize = () => {
  return translationCache.size
}

/**
 * Хук для использования перевода в React компонентах
 * Автоматически определяет язык из languageStore
 */
export const useAutoTranslate = () => {
  // Импортируем динамически, чтобы избежать циклических зависимостей
  let languageStore = null
  try {
    languageStore = require('../store/languageStore').default
  } catch (e) {
    console.warn('languageStore not found')
  }

  const translate = async (text, targetLang = null, sourceLang = 'ru') => {
    // Если targetLang не указан, используем язык из store
    if (!targetLang && languageStore) {
      const state = languageStore.getState()
      targetLang = state?.language || 'ru'
    }

    // Если целевой язык русский, возвращаем оригинал
    if (targetLang === 'ru' || targetLang === sourceLang) {
      return text
    }

    return await translateText(text, targetLang, sourceLang)
  }

  return { translate }
}

