/**
 * Конфигурация шаблонов страниц партнёров
 * 
 * Три шаблона: booking, menu, catalog
 * Каждый состоит из модулей, которые можно включать/выключать
 */

// Маппинг category_group → шаблон
export const TEMPLATE_MAP = {
  // BOOKING (записаться на время)
  'beauty': 'booking',
  'self_discovery': 'booking',
  'fitness': 'booking',
  'education': 'booking',
  'healthcare': 'booking',
  'entertainment': 'booking',
  'influencer': 'booking',
  'activity': 'booking',
  
  // MENU (выбрать из меню)
  'food': 'menu',
  
  // CATALOG (каталог товаров/услуг)
  'retail': 'catalog',
  'services': 'catalog',
  'travel': 'catalog',
  'automotive': 'catalog',
}

// Дефолтные конфигурации модулей по category_group
export const DEFAULT_MODULE_CONFIG = {
  beauty: {
    template: 'booking',
    modules: {
      specialists: true,
      portfolio: true,
      schedule: false,
      tags: true,
      about: false,
    },
    cta: {
      primary: 'external_booking',
      secondary: 'message',
    },
  },
  self_discovery: {
    template: 'booking',
    modules: {
      specialists: true,
      portfolio: true,
      schedule: false,
      tags: true,
      about: true,
    },
    cta: {
      primary: 'external_booking',
      secondary: 'message',
    },
  },
  fitness: {
    template: 'booking',
    modules: {
      specialists: true,
      portfolio: false,
      schedule: true,
      tags: true,
      about: false,
    },
    cta: {
      primary: 'external_booking',
      secondary: 'message',
    },
  },
  education: {
    template: 'booking',
    modules: {
      specialists: true,
      portfolio: false,
      schedule: true,
      tags: true,
      about: true,
    },
    cta: {
      primary: 'external_booking',
      secondary: 'message',
    },
  },
  healthcare: {
    template: 'booking',
    modules: {
      specialists: true,
      portfolio: false,
      schedule: true,
      tags: true,
      about: false,
    },
    cta: {
      primary: 'external_booking',
      secondary: 'call',
    },
  },
  entertainment: {
    template: 'booking',
    modules: {
      specialists: false,
      portfolio: true,
      schedule: true,
      tags: true,
      about: false,
    },
    cta: {
      primary: 'external_booking',
      secondary: 'message',
    },
  },
  influencer: {
    template: 'booking',
    modules: {
      specialists: false,
      portfolio: true,
      schedule: false,
      tags: false,
      about: true,
    },
    cta: {
      primary: 'contact',
      secondary: 'website',
    },
  },
  activity: {
    template: 'booking',
    modules: {
      specialists: true,
      portfolio: true,
      schedule: true,
      tags: true,
      about: false,
    },
    cta: {
      primary: 'external_booking',
      secondary: 'message',
    },
  },
  food: {
    template: 'menu',
    modules: {
      portfolio: true,
      tags: true,
      about: false,
    },
    cta: {
      primary: 'qr_order',
      secondary: 'external_booking', // для бронирования столика
    },
  },
  retail: {
    template: 'catalog',
    modules: {
      tags: true,
      about: true,
    },
    cta: {
      primary: 'contact',
      secondary: 'website',
    },
  },
  services: {
    template: 'catalog',
    modules: {
      tags: true,
      about: true,
    },
    cta: {
      primary: 'contact',
      secondary: 'call',
    },
  },
  travel: {
    template: 'catalog',
    modules: {
      tags: true,
      about: true,
    },
    cta: {
      primary: 'contact',
      secondary: 'website',
    },
  },
  automotive: {
    template: 'catalog',
    modules: {
      tags: true,
      about: true,
    },
    cta: {
      primary: 'contact',
      secondary: 'call',
    },
  },
}

// Базовые категории меню (для food)
export const BASE_MENU_CATEGORIES = [
  { code: 'breakfast', name_ru: 'Завтраки', name_en: 'Breakfast', emoji: '☀️', order: 1 },
  { code: 'lunch', name_ru: 'Обеды', name_en: 'Lunch', emoji: '🍽️', order: 2 },
  { code: 'main', name_ru: 'Основные блюда', name_en: 'Main dishes', emoji: '🍝', order: 3 },
  { code: 'salads', name_ru: 'Салаты', name_en: 'Salads', emoji: '🥗', order: 4 },
  { code: 'soups', name_ru: 'Супы', name_en: 'Soups', emoji: '🍲', order: 5 },
  { code: 'appetizers', name_ru: 'Закуски', name_en: 'Appetizers', emoji: '🥟', order: 6 },
  { code: 'desserts', name_ru: 'Десерты', name_en: 'Desserts', emoji: '🍰', order: 7 },
  { code: 'drinks', name_ru: 'Напитки', name_en: 'Drinks', emoji: '🥤', order: 8 },
  { code: 'alcohol', name_ru: 'Алкоголь', name_en: 'Alcohol', emoji: '🍷', order: 9 },
  { code: 'kids', name_ru: 'Детское меню', name_en: 'Kids menu', emoji: '🧒', order: 10 },
]

// Диетические теги
export const DIETARY_TAGS = [
  { code: 'vegan', name_ru: 'Веганское', name_en: 'Vegan', emoji: '🥬' },
  { code: 'vegetarian', name_ru: 'Вегетарианское', name_en: 'Vegetarian', emoji: '🥕' },
  { code: 'gluten_free', name_ru: 'Без глютена', name_en: 'Gluten-free', emoji: '🌾' },
  { code: 'dairy_free', name_ru: 'Без лактозы', name_en: 'Dairy-free', emoji: '🥛' },
  { code: 'spicy', name_ru: 'Острое', name_en: 'Spicy', emoji: '🌶️' },
  { code: 'kids', name_ru: 'Детское', name_en: 'Kids-friendly', emoji: '🧒' },
  { code: 'halal', name_ru: 'Халяль', name_en: 'Halal', emoji: '☪️' },
  { code: 'kosher', name_ru: 'Кошерное', name_en: 'Kosher', emoji: '✡️' },
  { code: 'sugar_free', name_ru: 'Без сахара', name_en: 'Sugar-free', emoji: '🍬' },
  { code: 'organic', name_ru: 'Органическое', name_en: 'Organic', emoji: '🌿' },
]

// Теги для услуг
export const SERVICE_TAGS = [
  { code: 'for_kids', name_ru: 'Для детей', name_en: 'For kids', emoji: '👶' },
  { code: 'for_men', name_ru: 'Для мужчин', name_en: 'For men', emoji: '👨' },
  { code: 'for_women', name_ru: 'Для женщин', name_en: 'For women', emoji: '👩' },
  { code: 'express', name_ru: 'Экспресс', name_en: 'Express', emoji: '⚡' },
  { code: 'premium', name_ru: 'Премиум', name_en: 'Premium', emoji: '⭐' },
  { code: 'new', name_ru: 'Новинка', name_en: 'New', emoji: '🆕' },
  { code: 'popular', name_ru: 'Популярное', name_en: 'Popular', emoji: '🔥' },
  { code: 'discount', name_ru: 'Со скидкой', name_en: 'Discount', emoji: '💰' },
]

// CTA Actions
export const CTA_ACTIONS = {
  external_booking: {
    label_ru: 'Записаться',
    label_en: 'Book Now',
    icon: '📅',
    type: 'external', // открывает внешнюю ссылку
  },
  qr_order: {
    label_ru: 'Показать QR',
    label_en: 'Show QR',
    icon: '📱',
    type: 'modal', // открывает модалку с QR
  },
  contact: {
    label_ru: 'Связаться',
    label_en: 'Contact',
    icon: '💬',
    type: 'action', // открывает диалог
  },
  message: {
    label_ru: 'Написать',
    label_en: 'Message',
    icon: '💬',
    type: 'telegram', // открывает Telegram чат
  },
  call: {
    label_ru: 'Позвонить',
    label_en: 'Call',
    icon: '📞',
    type: 'tel', // звонок
  },
  website: {
    label_ru: 'Сайт',
    label_en: 'Website',
    icon: '🌐',
    type: 'external', // открывает сайт
  },
}

/**
 * Получить конфигурацию модулей для партнёра
 * Мержит дефолтные настройки с кастомными из ui_config
 * 
 * @param {string} categoryGroup - category_group партнёра
 * @param {object} uiConfig - ui_config партнёра из БД
 * @returns {object} - финальная конфигурация
 */
export const getModuleConfig = (categoryGroup, uiConfig = {}) => {
  const defaultConfig = DEFAULT_MODULE_CONFIG[categoryGroup] || DEFAULT_MODULE_CONFIG['services']
  
  // Мержим дефолтные модули с кастомными
  const modules = {
    ...defaultConfig.modules,
    ...(uiConfig.modules || {}),
  }
  
  // Мержим CTA настройки
  const cta = {
    ...defaultConfig.cta,
    ...(uiConfig.cta || {}),
  }
  
  return {
    template: uiConfig.template || defaultConfig.template,
    modules,
    cta,
    menu_categories: uiConfig.menu_categories || [],
    base_menu_categories: uiConfig.base_menu_categories || [],
    dietary_tags: uiConfig.dietary_tags || [],
  }
}

/**
 * Получить шаблон для category_group
 * 
 * @param {string} categoryGroup - category_group партнёра
 * @returns {string} - название шаблона (booking/menu/catalog)
 */
export const getTemplate = (categoryGroup) => {
  return TEMPLATE_MAP[categoryGroup] || 'catalog'
}

/**
 * Получить локализованное название CTA
 * 
 * @param {string} actionCode - код действия
 * @param {string} language - язык (ru/en)
 * @returns {object} - {label, icon}
 */
export const getCTALabel = (actionCode, language = 'ru') => {
  const action = CTA_ACTIONS[actionCode]
  if (!action) return { label: actionCode, icon: '💬' }
  
  return {
    label: language === 'ru' ? action.label_ru : action.label_en,
    icon: action.icon,
    type: action.type,
  }
}

/**
 * Получить категории меню с локализацией
 * Объединяет базовые и кастомные категории
 * 
 * @param {array} baseCategories - выбранные базовые категории (коды)
 * @param {array} customCategories - кастомные категории партнёра
 * @param {string} language - язык (ru/en)
 * @returns {array} - массив категорий для отображения
 */
export const getMenuCategories = (baseCategories = [], customCategories = [], language = 'ru') => {
  // Базовые категории
  const base = BASE_MENU_CATEGORIES
    .filter(cat => baseCategories.includes(cat.code))
    .map(cat => ({
      code: cat.code,
      name: language === 'ru' ? cat.name_ru : cat.name_en,
      emoji: cat.emoji,
      order: cat.order,
      isCustom: false,
    }))
  
  // Кастомные категории (добавляются в конец)
  const custom = customCategories.map((name, index) => ({
    code: `custom_${index}`,
    name,
    emoji: '📌',
    order: 100 + index,
    isCustom: true,
  }))
  
  return [...base, ...custom].sort((a, b) => a.order - b.order)
}

/**
 * Получить диетические теги с локализацией
 * 
 * @param {array} enabledTags - включенные теги (коды)
 * @param {string} language - язык (ru/en)
 * @returns {array} - массив тегов для отображения
 */
export const getDietaryTags = (enabledTags = [], language = 'ru') => {
  if (enabledTags.length === 0) {
    // Если не указаны, возвращаем все
    return DIETARY_TAGS.map(tag => ({
      code: tag.code,
      name: language === 'ru' ? tag.name_ru : tag.name_en,
      emoji: tag.emoji,
    }))
  }
  
  return DIETARY_TAGS
    .filter(tag => enabledTags.includes(tag.code))
    .map(tag => ({
      code: tag.code,
      name: language === 'ru' ? tag.name_ru : tag.name_en,
      emoji: tag.emoji,
    }))
}

export default {
  TEMPLATE_MAP,
  DEFAULT_MODULE_CONFIG,
  BASE_MENU_CATEGORIES,
  DIETARY_TAGS,
  SERVICE_TAGS,
  CTA_ACTIONS,
  getModuleConfig,
  getTemplate,
  getCTALabel,
  getMenuCategories,
  getDietaryTags,
}
