/**
 * Иконки и данные для различных типов услуг
 * Используются профессиональные линейные иконки в luxury стиле
 */

export const serviceCategories = {
  // Основные 12 категорий услуг (первые 8 отображаются на главной)
  nail_care: {
    code: 'nail_care',
    icon: 'nail_care',
    name: 'Ногтевой сервис',
    nameEn: 'Nail Care',
    color: 'from-jewelry-burgundy to-jewelry-gold',
    emoji: '💅',
    displayOrder: 1,
    isMainPage: true
  },
  brow_design: {
    code: 'brow_design',
    icon: 'brow_design',
    name: 'Коррекция и окрашивание бровей',
    nameEn: 'Brow Design',
    color: 'from-jewelry-gold to-jewelry-brown-light',
    emoji: '👁️',
    displayOrder: 2,
    isMainPage: true
  },
  hair_salon: {
    code: 'hair_salon',
    icon: 'hair_salon',
    name: 'Парикмахерские услуги',
    nameEn: 'Hair Salon Services',
    color: 'from-jewelry-brown-light to-jewelry-gold',
    emoji: '💇‍♀️',
    displayOrder: 3,
    isMainPage: true
  },
  hair_removal: {
    code: 'hair_removal',
    icon: 'hair_removal',
    name: 'Депиляция',
    nameEn: 'Hair Removal',
    color: 'from-jewelry-gold to-jewelry-burgundy',
    emoji: '⚡',
    displayOrder: 4,
    isMainPage: true
  },
  facial_aesthetics: {
    code: 'facial_aesthetics',
    icon: 'facial_aesthetics',
    name: 'Косметология',
    nameEn: 'Facial Aesthetics',
    color: 'from-jewelry-burgundy to-jewelry-brown-dark',
    emoji: '✨',
    displayOrder: 5,
    isMainPage: true
  },
  lash_services: {
    code: 'lash_services',
    icon: 'lash_services',
    name: 'Наращивание и ламинирование ресниц',
    nameEn: 'Lash Services',
    color: 'from-jewelry-brown-light to-jewelry-gold',
    emoji: '👀',
    displayOrder: 6,
    isMainPage: true
  },
  massage_therapy: {
    code: 'massage_therapy',
    icon: 'massage_therapy',
    name: 'Массаж',
    nameEn: 'Massage Therapy',
    color: 'from-jewelry-gold to-jewelry-brown-light',
    emoji: '💆‍♀️',
    displayOrder: 7,
    isMainPage: true
  },
  makeup_pmu: {
    code: 'makeup_pmu',
    icon: 'makeup_pmu',
    name: 'Визаж и перманент',
    nameEn: 'Make-up & PMU',
    color: 'from-jewelry-burgundy to-jewelry-gold',
    emoji: '💄',
    displayOrder: 8,
    isMainPage: true
  },
  body_wellness: {
    code: 'body_wellness',
    icon: 'body_wellness',
    name: 'Телесная терапия',
    nameEn: 'Body Wellness',
    color: 'from-jewelry-gold to-jewelry-cream',
    emoji: '🌸',
    displayOrder: 9,
    isMainPage: false
  },
  nutrition_coaching: {
    code: 'nutrition_coaching',
    icon: 'nutrition_coaching',
    name: 'Нутрициология и питание',
    nameEn: 'Nutrition Coaching',
    color: 'from-jewelry-gold-light to-jewelry-gold',
    emoji: '🍎',
    displayOrder: 10,
    isMainPage: false
  },
  mindfulness_coaching: {
    code: 'mindfulness_coaching',
    icon: 'mindfulness_coaching',
    name: 'Ментальное здоровье',
    nameEn: 'Mindfulness & Coaching',
    color: 'from-jewelry-brown-light to-jewelry-burgundy',
    emoji: '🧠',
    displayOrder: 11,
    isMainPage: false
  },
  image_consulting: {
    code: 'image_consulting',
    icon: 'image_consulting',
    name: 'Стиль',
    nameEn: 'Image Consulting',
    color: 'from-jewelry-cream to-jewelry-gold-light',
    emoji: '👗',
    displayOrder: 12,
    isMainPage: false
  },
  
  // Старые категории для обратной совместимости
  manicure: {
    code: 'nail_care',
    icon: 'nail_care',
    name: 'Ногтевой сервис',
    nameEn: 'Nail Care',
    color: 'from-jewelry-burgundy to-jewelry-gold',
    emoji: '💅'
  },
  hairstyle: {
    code: 'hair_salon',
    icon: 'hair_salon',
    name: 'Парикмахерские услуги',
    nameEn: 'Hair Salon Services',
    color: 'from-jewelry-brown-light to-jewelry-gold',
    emoji: '💇‍♀️'
  },
  massage: {
    code: 'massage_therapy',
    icon: 'massage_therapy',
    name: 'Массаж',
    nameEn: 'Massage Therapy',
    color: 'from-jewelry-gold to-jewelry-brown-light',
    emoji: '💆‍♀️'
  },
  cosmetologist: {
    code: 'facial_aesthetics',
    icon: 'facial_aesthetics',
    name: 'Косметология',
    nameEn: 'Facial Aesthetics',
    color: 'from-jewelry-burgundy to-jewelry-brown-dark',
    emoji: '✨'
  },
  eyebrows: {
    code: 'brow_design',
    icon: 'brow_design',
    name: 'Коррекция и окрашивание бровей',
    nameEn: 'Brow Design',
    color: 'from-jewelry-gold to-jewelry-brown-light',
    emoji: '👁️'
  },
  eyelashes: {
    code: 'lash_services',
    icon: 'lash_services',
    name: 'Наращивание и ламинирование ресниц',
    nameEn: 'Lash Services',
    color: 'from-jewelry-brown-light to-jewelry-gold',
    emoji: '👀'
  },
  laser: {
    code: 'hair_removal',
    icon: 'hair_removal',
    name: 'Депиляция',
    nameEn: 'Hair Removal',
    color: 'from-jewelry-gold to-jewelry-burgundy',
    emoji: '⚡'
  },
  makeup: {
    code: 'makeup_pmu',
    icon: 'makeup_pmu',
    name: 'Визаж и перманент',
    nameEn: 'Make-up & PMU',
    color: 'from-jewelry-burgundy to-jewelry-gold',
    emoji: '💄'
  },
  skincare: {
    code: 'facial_aesthetics',
    icon: 'facial_aesthetics',
    name: 'Уход за кожей',
    nameEn: 'Skincare',
    color: 'from-jewelry-burgundy to-jewelry-brown-dark',
    emoji: '✨'
  },
  cleaning: {
    code: 'cleaning',
    icon: 'cleaning',
    name: 'Уборка и клининг',
    nameEn: 'Cleaning Services',
    color: 'from-jewelry-gold to-jewelry-brown-light',
    emoji: '🧹'
  },
  repair: {
    code: 'repair',
    icon: 'repair',
    name: 'Ремонт',
    nameEn: 'Repair Services',
    color: 'from-jewelry-brown-light to-jewelry-gold',
    emoji: '🔧'
  },
  delivery: {
    code: 'delivery',
    icon: 'delivery',
    name: 'Доставка',
    nameEn: 'Delivery',
    color: 'from-jewelry-gold-light to-jewelry-gold',
    emoji: '🚚'
  },
  fitness: {
    code: 'fitness',
    icon: 'fitness',
    name: 'Фитнес',
    nameEn: 'Fitness',
    color: 'from-jewelry-gold to-jewelry-brown-light',
    emoji: '🏃‍♀️'
  },
  spa: {
    code: 'spa',
    icon: 'spa',
    name: 'SPA',
    nameEn: 'SPA',
    color: 'from-jewelry-cream to-jewelry-gold-light',
    emoji: '🛁'
  },
  yoga: {
    code: 'yoga',
    icon: 'yoga',
    name: 'Йога',
    nameEn: 'Yoga',
    color: 'from-jewelry-brown-light to-jewelry-gold',
    emoji: '🧘‍♀️'
  },
  nutrition: {
    code: 'nutrition_coaching',
    icon: 'nutrition_coaching',
    name: 'Питание',
    nameEn: 'Nutrition',
    color: 'from-jewelry-gold-light to-jewelry-gold',
    emoji: '🥗'
  },
  psychology: {
    code: 'mindfulness_coaching',
    icon: 'mindfulness_coaching',
    name: 'Психолог',
    nameEn: 'Psychology',
    color: 'from-jewelry-brown-light to-jewelry-burgundy',
    emoji: '🧠'
  }
}

/**
 * Получить код категории для услуги по названию или категории
 * Возвращает код категории (например, 'nail_care', 'hair_salon')
 */
export const getServiceIcon = (serviceName = '', serviceCategory = '') => {
  if (!serviceName || typeof serviceName !== 'string') {
    return null
  }
  
  const searchStr = (serviceName + ' ' + serviceCategory).toLowerCase().trim()
  
  // Новые категории (основные 12)
  if (searchStr.includes('маникюр') || searchStr.includes('ногт')) {
    return 'nail_care'
  }
  if (searchStr.includes('бров')) {
    return 'brow_design'
  }
  if (searchStr.includes('прическ') || searchStr.includes('волос') || searchStr.includes('стрижк')) {
    return 'hair_salon'
  }
  if (searchStr.includes('лазер') || searchStr.includes('эпиля') || searchStr.includes('депиля')) {
    return 'hair_removal'
  }
  if (searchStr.includes('косметолог') || searchStr.includes('чистка лица') || searchStr.includes('эстетик')) {
    return 'facial_aesthetics'
  }
  if (searchStr.includes('реснниц') || searchStr.includes('ламинирован')) {
    return 'lash_services'
  }
  if (searchStr.includes('массаж')) {
    return 'massage_therapy'
  }
  if (searchStr.includes('визаж') || searchStr.includes('макияж') || searchStr.includes('makeup') || searchStr.includes('перманент') || searchStr.includes('pmu')) {
    return 'makeup_pmu'
  }
  if (searchStr.includes('телесн') || searchStr.includes('body') || searchStr.includes('wellness')) {
    return 'body_wellness'
  }
  if (searchStr.includes('питан') || searchStr.includes('диет') || searchStr.includes('нутрициолог')) {
    return 'nutrition_coaching'
  }
  if (searchStr.includes('психол') || searchStr.includes('коуч') || searchStr.includes('ментальн')) {
    return 'mindfulness_coaching'
  }
  if (searchStr.includes('стиль') || searchStr.includes('image') || searchStr.includes('консульт')) {
    return 'image_consulting'
  }
  
  // Старые категории для обратной совместимости
  if (searchStr.includes('уход') || searchStr.includes('кож')) {
    return 'facial_aesthetics' // Косметология
  }
  
  // По умолчанию
  return null
}

/**
 * Получить категорию для услуги
 */
export const getServiceCategory = (serviceName = '') => {
  const searchStr = serviceName.toLowerCase()
  
  for (const [key, category] of Object.entries(serviceCategories)) {
    if (searchStr.includes(category.name.toLowerCase()) || 
        searchStr.includes(category.nameEn.toLowerCase())) {
      return category
    }
  }
  
  return {
    icon: 'default',
    name: 'Услуга',
    nameEn: 'Service',
    color: 'from-jewelry-gold to-jewelry-brown-light'
  }
}

/**
 * Получить список всех категорий услуг (только основные 12)
 */
export const getAllServiceCategories = () => {
  const mainCategories = [
    'nail_care', 'brow_design', 'hair_salon', 'hair_removal',
    'facial_aesthetics', 'lash_services', 'massage_therapy', 'makeup_pmu',
    'body_wellness', 'nutrition_coaching', 'mindfulness_coaching', 'image_consulting'
  ]
  return mainCategories
    .map(code => serviceCategories[code])
    .filter(Boolean)
    .sort((a, b) => (a.displayOrder || 999) - (b.displayOrder || 999))
}

/**
 * Получить категории для главной страницы (первые 8)
 */
export const getMainPageCategories = () => {
  return Object.values(serviceCategories)
    .filter(cat => cat.isMainPage === true)
    .sort((a, b) => (a.displayOrder || 999) - (b.displayOrder || 999))
}

/**
 * Получить категорию по коду business_type
 */
export const getCategoryByCode = (code) => {
  if (!code) return null
  return serviceCategories[code] || null
}

/**
 * Список всех доступных иконок для отображения в сетке (для обратной совместимости)
 */
export const defaultServiceIcons = getMainPageCategories()

export default serviceCategories

