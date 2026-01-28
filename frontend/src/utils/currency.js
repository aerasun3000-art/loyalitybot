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
  
  // Вьетнам
  'Nha Trang': 'VND',
  
  // Казахстан
  'Almaty': 'KZT',
  'Astana': 'KZT',
  'Алматы': 'KZT',
  'Астана': 'KZT',
  
  // Киргизия
  'Bishkek': 'KGS',
  'Osh': 'KGS',
  'Бишкек': 'KGS',
  'Ош': 'KGS',
  
  // ОАЭ
  'Dubai': 'AED',
  'Дубай': 'AED',
  
  // Другие страны (опционально)
  'London': 'GBP',
  'Paris': 'EUR',
  'Berlin': 'EUR',
  'Madrid': 'EUR',
  'Rome': 'EUR',
  'Amsterdam': 'EUR',
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
  'VND': '₫',
  'KZT': '₸',
  'KGS': 'сом',
  'AED': 'د.إ',
  'EUR': '€',
  'GBP': '£',
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
  'VND': 'vi-VN',
  'KZT': 'kk-KZ',
  'KGS': 'ky-KG',
  'AED': 'ar-AE',
  'EUR': 'de-DE',
  'GBP': 'en-GB',
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
  
  // Специальная обработка для VND, KZT, KGS (без десятичных знаков)
  const options = {
    style: 'currency',
    currency: finalCurrency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }
  
  // Для AED используем 2 десятичных знака
  if (finalCurrency === 'AED') {
    options.minimumFractionDigits = 2
    options.maximumFractionDigits = 2
  }
  
  return new Intl.NumberFormat(locale, options).format(value)
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

// ============================================
// Мультивалютное отображение цен
// ============================================

// Поддерживаемые валюты для выбора пользователем
export const SUPPORTED_CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar', nameRu: 'Доллар США', flag: '🇺🇸' },
  { code: 'VND', symbol: '₫', name: 'Vietnamese Dong', nameRu: 'Вьетнамский донг', flag: '🇻🇳' },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble', nameRu: 'Российский рубль', flag: '🇷🇺' },
  { code: 'KZT', symbol: '₸', name: 'Kazakhstani Tenge', nameRu: 'Казахстанский тенге', flag: '🇰🇿' },
]

// Курсы по умолчанию (fallback, обновляются из БД)
const DEFAULT_EXCHANGE_RATES = {
  USD: 1,
  VND: 25000,
  RUB: 100,
  KZT: 520,
}

// Кэш курсов валют
let exchangeRatesCache = { ...DEFAULT_EXCHANGE_RATES }
let ratesCacheTimestamp = null

/**
 * Получает курсы валют из Supabase
 * @param {object} supabase - Клиент Supabase
 * @returns {Promise<object>} Объект с курсами валют
 */
export const fetchExchangeRates = async (supabase) => {
  try {
    // Проверяем кэш (5 минут)
    if (ratesCacheTimestamp && Date.now() - ratesCacheTimestamp < 5 * 60 * 1000) {
      return exchangeRatesCache
    }

    const { data, error } = await supabase
      .from('currency_exchange_rates')
      .select('from_currency, to_currency, rate')
      .eq('from_currency', 'USD')
      .in('to_currency', ['VND', 'RUB', 'KZT'])
      .order('effective_from', { ascending: false })

    if (error) {
      console.error('Error fetching exchange rates:', error)
      return exchangeRatesCache
    }

    // Обновляем кэш
    const rates = { USD: 1 }
    data.forEach(row => {
      rates[row.to_currency] = parseFloat(row.rate)
    })

    exchangeRatesCache = { ...DEFAULT_EXCHANGE_RATES, ...rates }
    ratesCacheTimestamp = Date.now()

    return exchangeRatesCache
  } catch (err) {
    console.error('Error in fetchExchangeRates:', err)
    return exchangeRatesCache
  }
}

/**
 * Конвертирует баллы (= USD) в локальную валюту
 * @param {number} points - Количество баллов (= USD)
 * @param {string} currency - Целевая валюта
 * @param {object} rates - Объект с курсами валют
 * @returns {number} Сумма в целевой валюте
 */
export const convertPointsToCurrency = (points, currency, rates = exchangeRatesCache) => {
  if (currency === 'USD') {
    return points
  }
  
  const rate = rates[currency] || DEFAULT_EXCHANGE_RATES[currency] || 1
  const converted = points * rate
  
  // Для VND, KZT, RUB округляем до целых
  if (['VND', 'KZT', 'RUB'].includes(currency)) {
    return Math.round(converted)
  }
  
  return Math.round(converted * 100) / 100
}

/**
 * Форматирует число с разделителями тысяч
 * @param {number} value - Число
 * @param {string} currency - Валюта
 * @returns {string} Отформатированное число
 */
const formatNumber = (value, currency) => {
  if (['VND', 'KZT', 'RUB'].includes(currency)) {
    return Math.round(value).toLocaleString('ru-RU').replace(/,/g, ' ')
  }
  return value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

/**
 * Форматирует цену услуги: показывает в локальной валюте + баллы
 * @param {number} points - Стоимость в баллах (= USD)
 * @param {string} currency - Валюта клиента
 * @param {object} rates - Курсы валют
 * @param {boolean} showPoints - Показывать ли баллы
 * @param {string} language - Язык (ru/en)
 * @returns {string} Отформатированная цена
 */
export const formatPriceWithPoints = (points, currency, rates = exchangeRatesCache, showPoints = true, language = 'ru') => {
  const symbol = getCurrencySymbol(currency)
  const pointsLabel = language === 'ru' ? 'баллов' : 'points'
  
  if (currency === 'USD') {
    const formatted = Number.isInteger(points) ? `$${points}` : `$${points.toFixed(2)}`
    if (showPoints) {
      return `${formatted} (${Math.round(points)} ${pointsLabel})`
    }
    return formatted
  }
  
  const localAmount = convertPointsToCurrency(points, currency, rates)
  const formattedValue = formatNumber(localAmount, currency)
  
  // Формат зависит от валюты
  let priceStr
  if (currency === 'VND') {
    priceStr = `${formattedValue} ${symbol}`
  } else if (currency === 'RUB') {
    priceStr = `${formattedValue} ${symbol}`
  } else if (currency === 'KZT') {
    priceStr = `${formattedValue} ${symbol}`
  } else {
    priceStr = `${symbol}${formattedValue}`
  }
  
  if (showPoints) {
    return `${priceStr} (${Math.round(points)} ${pointsLabel})`
  }
  return priceStr
}

/**
 * Получает текущие курсы из кэша
 * @returns {object} Курсы валют
 */
export const getCachedRates = () => exchangeRatesCache















