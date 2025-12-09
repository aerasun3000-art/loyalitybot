/**
 * Утилита для определения валюты по городу партнера
 */

// Города США (используют USD)
const US_CITIES = [
  'New York',
  'Los Angeles',
  'Bay Area',
  'Chicago',
  'Miami',
  'Boston',
  'Seattle',
  'San Francisco',
  'Washington',
  'Dallas',
  'Houston',
  'Atlanta',
  'Phoenix',
  'Detroit',
  'Philadelphia'
]

// Маппинг городов на валюты
const CITY_TO_CURRENCY = {
  // США - доллары
  'New York': 'USD',
  'Los Angeles': 'USD',
  'Bay Area': 'USD',
  'Chicago': 'USD',
  'Miami': 'USD',
  'Boston': 'USD',
  'Seattle': 'USD',
  'San Francisco': 'USD',
  'Washington': 'USD',
  'Dallas': 'USD',
  'Houston': 'USD',
  'Atlanta': 'USD',
  'Phoenix': 'USD',
  'Detroit': 'USD',
  'Philadelphia': 'USD',
  
  // Онлайн/Все - доллары
  'Online': 'USD',
  'Все': 'USD',
  
  // Российские города - рубли (если нужно будет вернуть)
  'Москва': 'RUB',
  'Санкт-Петербург': 'RUB',
  'Новосибирск': 'RUB',
  'Екатеринбург': 'RUB',
  'Казань': 'RUB',
  'Нижний Новгород': 'RUB',
  
  // Другие страны (можно расширить)
  'London': 'GBP',
  'Paris': 'EUR',
  'Berlin': 'EUR',
  'Madrid': 'EUR',
  'Rome': 'EUR',
  'Amsterdam': 'EUR',
  'Dubai': 'AED',
  'Tokyo': 'JPY',
  'Singapore': 'SGD',
  'Sydney': 'AUD',
  'Toronto': 'CAD',
  'Mexico City': 'MXN'
}

// Маппинг валют на символы
const CURRENCY_SYMBOLS = {
  'USD': '$',
  'RUB': '₽',
  'EUR': '€',
  'GBP': '£',
  'AED': 'د.إ',
  'JPY': '¥',
  'SGD': 'S$',
  'AUD': 'A$',
  'CAD': 'C$',
  'MXN': '$'
}

// Маппинг валют на локали
const CURRENCY_LOCALES = {
  'USD': 'en-US',
  'RUB': 'ru-RU',
  'EUR': 'de-DE',
  'GBP': 'en-GB',
  'AED': 'ar-AE',
  'JPY': 'ja-JP',
  'SGD': 'en-SG',
  'AUD': 'en-AU',
  'CAD': 'en-CA',
  'MXN': 'es-MX'
}

/**
 * Определяет валюту по городу партнера
 * @param {string|null|undefined} city - Город партнера
 * @returns {string} Код валюты (USD, RUB, EUR и т.д.)
 */
export const getCurrencyByCity = (city) => {
  if (!city) {
    // По умолчанию USD для онлайн/неизвестных
    return 'USD'
  }
  
  // Проверяем точное совпадение
  if (CITY_TO_CURRENCY[city]) {
    return CITY_TO_CURRENCY[city]
  }
  
  // Проверяем, является ли город из США (по началу названия или содержит US города)
  const cityLower = city.toLowerCase()
  const isUSCity = US_CITIES.some(usCity => 
    cityLower.includes(usCity.toLowerCase()) || 
    usCity.toLowerCase().includes(cityLower)
  )
  
  if (isUSCity) {
    return 'USD'
  }
  
  // Онлайн/Все - доллары
  if (city === 'Все' || city === 'Online' || city === 'All') {
    return 'USD'
  }
  
  // По умолчанию USD
  return 'USD'
}

/**
 * Получает символ валюты
 * @param {string} currency - Код валюты
 * @returns {string} Символ валюты
 */
export const getCurrencySymbol = (currency) => {
  return CURRENCY_SYMBOLS[currency] || '$'
}

/**
 * Получает локаль для форматирования валюты
 * @param {string} currency - Код валюты
 * @returns {string} Локаль
 */
export const getCurrencyLocale = (currency) => {
  return CURRENCY_LOCALES[currency] || 'en-US'
}

/**
 * Форматирует сумму в валюту
 * @param {number} value - Сумма
 * @param {string|null|undefined} city - Город партнера (опционально)
 * @param {string} currency - Код валюты (опционально, если не указан, определяется по городу)
 * @returns {string} Отформатированная сумма
 */
export const formatCurrency = (value, city = null, currency = null) => {
  const finalCurrency = currency || getCurrencyByCity(city)
  const locale = getCurrencyLocale(finalCurrency)
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: finalCurrency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

/**
 * Форматирует сумму с символом валюты (простой вариант)
 * @param {number} value - Сумма
 * @param {string|null|undefined} city - Город партнера (опционально)
 * @param {string} currency - Код валюты (опционально)
 * @returns {string} Отформатированная сумма с символом
 */
export const formatCurrencySimple = (value, city = null, currency = null) => {
  const finalCurrency = currency || getCurrencyByCity(city)
  const symbol = getCurrencySymbol(finalCurrency)
  
  // Для USD используем стандартный формат
  if (finalCurrency === 'USD') {
    return `${symbol}${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }
  
  // Для других валют используем форматирование
  return formatCurrency(value, city, finalCurrency)
}











