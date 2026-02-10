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
    color: 'from-rose-400 to-amber-400',
    emoji: '💅',
    displayOrder: 1,
    isMainPage: true
  },
  brow_design: {
    code: 'brow_design',
    icon: 'brow_design',
    name: 'Коррекция и окрашивание бровей',
    nameEn: 'Brow Design',
    color: 'from-amber-400 to-pink-300',
    emoji: '👁️',
    displayOrder: 2,
    isMainPage: true
  },
  hair_salon: {
    code: 'hair_salon',
    icon: 'hair_salon',
    name: 'Парикмахерские услуги',
    nameEn: 'Hair Salon Services',
    color: 'from-pink-300 to-amber-400',
    emoji: '💇‍♀️',
    displayOrder: 3,
    isMainPage: true
  },
  hair_removal: {
    code: 'hair_removal',
    icon: 'hair_removal',
    name: 'Депиляция',
    nameEn: 'Hair Removal',
    color: 'from-amber-400 to-rose-400',
    emoji: '⚡',
    displayOrder: 4,
    isMainPage: true
  },
  facial_aesthetics: {
    code: 'facial_aesthetics',
    icon: 'facial_aesthetics',
    name: 'Косметология',
    nameEn: 'Facial Aesthetics',
    color: 'from-rose-400 to-rose-600',
    emoji: '✨',
    displayOrder: 5,
    isMainPage: true
  },
  lash_services: {
    code: 'lash_services',
    icon: 'lash_services',
    name: 'Наращивание и ламинирование ресниц',
    nameEn: 'Lash Services',
    color: 'from-pink-300 to-amber-400',
    emoji: '👀',
    displayOrder: 6,
    isMainPage: true
  },
  massage_therapy: {
    code: 'massage_therapy',
    icon: 'massage_therapy',
    name: 'Массаж',
    nameEn: 'Massage Therapy',
    color: 'from-amber-400 to-pink-300',
    emoji: '💆‍♀️',
    displayOrder: 7,
    isMainPage: true
  },
  makeup_pmu: {
    code: 'makeup_pmu',
    icon: 'makeup_pmu',
    name: 'Визаж и перманент',
    nameEn: 'Make-up & PMU',
    color: 'from-rose-400 to-amber-400',
    emoji: '💄',
    displayOrder: 8,
    isMainPage: true
  },
  body_wellness: {
    code: 'body_wellness',
    icon: 'body_wellness',
    name: 'Телесная терапия',
    nameEn: 'Body Wellness',
    color: 'from-amber-400 to-pink-50',
    emoji: '🌸',
    displayOrder: 9,
    isMainPage: false
  },
  nutrition_coaching: {
    code: 'nutrition_coaching',
    icon: 'nutrition_coaching',
    name: 'Нутрициология и питание',
    nameEn: 'Nutrition Coaching',
    color: 'from-amber-300 to-amber-400',
    emoji: '🍎',
    displayOrder: 10,
    isMainPage: false
  },
  mindfulness_coaching: {
    code: 'mindfulness_coaching',
    icon: 'mindfulness_coaching',
    name: 'Ментальное здоровье',
    nameEn: 'Mindfulness & Coaching',
    color: 'from-pink-300 to-rose-400',
    emoji: '🧠',
    displayOrder: 11,
    isMainPage: false
  },
  image_consulting: {
    code: 'image_consulting',
    icon: 'image_consulting',
    name: 'Стиль',
    nameEn: 'Image Consulting',
    color: 'from-pink-50 to-amber-300',
    emoji: '👗',
    displayOrder: 12,
    isMainPage: false
  },
  
  // Самопознание (Self-discovery)
  astrology: {
    code: 'astrology',
    icon: 'mindfulness_coaching',
    name: 'Астрология',
    nameEn: 'Astrology',
    color: 'from-indigo-500 to-indigo-700',
    emoji: '🔮',
    displayOrder: 13,
    isMainPage: false
  },
  numerology: {
    code: 'numerology',
    icon: 'mindfulness_coaching',
    name: 'Нумерология',
    nameEn: 'Numerology',
    color: 'from-purple-500 to-purple-700',
    emoji: '🔢',
    displayOrder: 14,
    isMainPage: false
  },
  psychology_coaching: {
    code: 'psychology_coaching',
    icon: 'mindfulness_coaching',
    name: 'Психология и коучинг',
    nameEn: 'Psychology & Coaching',
    color: 'from-pink-300 to-rose-400',
    emoji: '🧠',
    displayOrder: 15,
    isMainPage: false
  },
  meditation_spirituality: {
    code: 'meditation_spirituality',
    icon: 'mindfulness_coaching',
    name: 'Медитации и духовные практики',
    nameEn: 'Meditation & Spirituality',
    color: 'from-emerald-500 to-emerald-700',
    emoji: '🧘‍♀️',
    displayOrder: 16,
    isMainPage: false
  },
  
  // Старые категории для обратной совместимости
  manicure: {
    code: 'nail_care',
    icon: 'nail_care',
    name: 'Ногтевой сервис',
    nameEn: 'Nail Care',
    color: 'from-rose-400 to-amber-400',
    emoji: '💅'
  },
  hairstyle: {
    code: 'hair_salon',
    icon: 'hair_salon',
    name: 'Парикмахерские услуги',
    nameEn: 'Hair Salon Services',
    color: 'from-pink-300 to-amber-400',
    emoji: '💇‍♀️'
  },
  massage: {
    code: 'massage_therapy',
    icon: 'massage_therapy',
    name: 'Массаж',
    nameEn: 'Massage Therapy',
    color: 'from-amber-400 to-pink-300',
    emoji: '💆‍♀️'
  },
  cosmetologist: {
    code: 'facial_aesthetics',
    icon: 'facial_aesthetics',
    name: 'Косметология',
    nameEn: 'Facial Aesthetics',
    color: 'from-rose-400 to-rose-600',
    emoji: '✨'
  },
  eyebrows: {
    code: 'brow_design',
    icon: 'brow_design',
    name: 'Коррекция и окрашивание бровей',
    nameEn: 'Brow Design',
    color: 'from-amber-400 to-pink-300',
    emoji: '👁️'
  },
  eyelashes: {
    code: 'lash_services',
    icon: 'lash_services',
    name: 'Наращивание и ламинирование ресниц',
    nameEn: 'Lash Services',
    color: 'from-pink-300 to-amber-400',
    emoji: '👀'
  },
  laser: {
    code: 'hair_removal',
    icon: 'hair_removal',
    name: 'Депиляция',
    nameEn: 'Hair Removal',
    color: 'from-amber-400 to-rose-400',
    emoji: '⚡'
  },
  makeup: {
    code: 'makeup_pmu',
    icon: 'makeup_pmu',
    name: 'Визаж и перманент',
    nameEn: 'Make-up & PMU',
    color: 'from-rose-400 to-amber-400',
    emoji: '💄'
  },
  skincare: {
    code: 'facial_aesthetics',
    icon: 'facial_aesthetics',
    name: 'Уход за кожей',
    nameEn: 'Skincare',
    color: 'from-rose-400 to-rose-600',
    emoji: '✨'
  },
  cleaning: {
    code: 'cleaning',
    icon: 'cleaning',
    name: 'Уборка и клининг',
    nameEn: 'Cleaning Services',
    color: 'from-amber-400 to-pink-300',
    emoji: '🧹'
  },
  repair: {
    code: 'repair',
    icon: 'repair',
    name: 'Ремонт',
    nameEn: 'Repair Services',
    color: 'from-pink-300 to-amber-400',
    emoji: '🔧'
  },
  delivery: {
    code: 'delivery',
    icon: 'delivery',
    name: 'Доставка',
    nameEn: 'Delivery',
    color: 'from-amber-300 to-amber-400',
    emoji: '🚚'
  },
  fitness: {
    code: 'fitness',
    icon: 'fitness',
    name: 'Фитнес',
    nameEn: 'Fitness',
    color: 'from-amber-400 to-pink-300',
    emoji: '🏃‍♀️'
  },
  spa: {
    code: 'spa',
    icon: 'spa',
    name: 'SPA',
    nameEn: 'SPA',
    color: 'from-pink-50 to-amber-300',
    emoji: '🛁'
  },
  yoga: {
    code: 'yoga',
    icon: 'yoga',
    name: 'Йога',
    nameEn: 'Yoga',
    color: 'from-pink-300 to-amber-400',
    emoji: '🧘‍♀️'
  },
  nutrition: {
    code: 'nutrition_coaching',
    icon: 'nutrition_coaching',
    name: 'Питание',
    nameEn: 'Nutrition',
    color: 'from-amber-300 to-amber-400',
    emoji: '🥗'
  },
  psychology: {
    code: 'mindfulness_coaching',
    icon: 'mindfulness_coaching',
    name: 'Психолог',
    nameEn: 'Psychology',
    color: 'from-pink-300 to-rose-400',
    emoji: '🧠'
  },
  
  // Категории для Education (Образование)
  education: {
    code: 'education',
    icon: 'education',
    name: 'Образование',
    nameEn: 'Education',
    color: 'from-blue-500 to-blue-700',
    emoji: '📚'
  },
  language_school: {
    code: 'language_school',
    icon: 'language_school',
    name: 'Языковая школа',
    nameEn: 'Language School',
    color: 'from-blue-400 to-blue-600',
    emoji: '🌍'
  },
  training: {
    code: 'training',
    icon: 'training',
    name: 'Тренинги и курсы',
    nameEn: 'Training & Courses',
    color: 'from-indigo-500 to-indigo-700',
    emoji: '📝'
  },
  online_education: {
    code: 'online_education',
    icon: 'online_education',
    name: 'Онлайн-образование',
    nameEn: 'Online Education',
    color: 'from-purple-500 to-purple-700',
    emoji: '💻'
  },
  
  // Категории для Food & Beverage (Еда и напитки)
  restaurant: {
    code: 'restaurant',
    icon: 'restaurant',
    name: 'Ресторан',
    nameEn: 'Restaurant',
    color: 'from-orange-500 to-orange-700',
    emoji: '🍽️'
  },
  cafe: {
    code: 'cafe',
    icon: 'cafe',
    name: 'Кафе',
    nameEn: 'Cafe',
    color: 'from-amber-500 to-amber-700',
    emoji: '☕'
  },
  food_delivery: {
    code: 'food_delivery',
    icon: 'food_delivery',
    name: 'Доставка еды',
    nameEn: 'Food Delivery',
    color: 'from-red-500 to-red-700',
    emoji: '🍕'
  },
  bakery: {
    code: 'bakery',
    icon: 'bakery',
    name: 'Пекарня',
    nameEn: 'Bakery',
    color: 'from-yellow-500 to-yellow-700',
    emoji: '🥐'
  },
  bar: {
    code: 'bar',
    icon: 'bar',
    name: 'Бар',
    nameEn: 'Bar',
    color: 'from-purple-600 to-purple-800',
    emoji: '🍸'
  },
  
  // Категории для Sports & Fitness (Спорт и фитнес)
  sports: {
    code: 'sports',
    icon: 'sports',
    name: 'Спорт',
    nameEn: 'Sports',
    color: 'from-green-500 to-green-700',
    emoji: '⚽'
  },
  swimming: {
    code: 'swimming',
    icon: 'swimming',
    name: 'Плавание',
    nameEn: 'Swimming',
    color: 'from-cyan-500 to-cyan-700',
    emoji: '🏊'
  },
  
  // Категории для Entertainment (Развлечения)
  entertainment: {
    code: 'entertainment',
    icon: 'entertainment',
    name: 'Развлечения',
    nameEn: 'Entertainment',
    color: 'from-pink-500 to-pink-700',
    emoji: '🎉'
  },
  cinema: {
    code: 'cinema',
    icon: 'cinema',
    name: 'Кино',
    nameEn: 'Cinema',
    color: 'from-gray-600 to-gray-800',
    emoji: '🎬'
  },
  events: {
    code: 'events',
    icon: 'events',
    name: 'Мероприятия',
    nameEn: 'Events',
    color: 'from-violet-500 to-violet-700',
    emoji: '🎭'
  },
  gaming: {
    code: 'gaming',
    icon: 'gaming',
    name: 'Игры',
    nameEn: 'Gaming',
    color: 'from-emerald-500 to-emerald-700',
    emoji: '🎮'
  },
  music: {
    code: 'music',
    icon: 'music',
    name: 'Музыка',
    nameEn: 'Music',
    color: 'from-rose-500 to-rose-700',
    emoji: '🎵'
  },
  
  // Категории для Retail (Розничная торговля)
  retail: {
    code: 'retail',
    icon: 'retail',
    name: 'Розничная торговля',
    nameEn: 'Retail',
    color: 'from-teal-500 to-teal-700',
    emoji: '🛍️'
  },
  fashion: {
    code: 'fashion',
    icon: 'fashion',
    name: 'Мода и одежда',
    nameEn: 'Fashion',
    color: 'from-fuchsia-500 to-fuchsia-700',
    emoji: '👗'
  },
  cosmetics_shop: {
    code: 'cosmetics_shop',
    icon: 'cosmetics_shop',
    name: 'Магазин косметики',
    nameEn: 'Cosmetics Shop',
    color: 'from-pink-400 to-pink-600',
    emoji: '💄'
  },
  electronics: {
    code: 'electronics',
    icon: 'electronics',
    name: 'Электроника',
    nameEn: 'Electronics',
    color: 'from-slate-500 to-slate-700',
    emoji: '📱'
  },
  gift_shop: {
    code: 'gift_shop',
    icon: 'gift_shop',
    name: 'Подарки',
    nameEn: 'Gift Shop',
    color: 'from-red-400 to-red-600',
    emoji: '🎁'
  },
  
  // Категории для Healthcare (Здравоохранение)
  healthcare: {
    code: 'healthcare',
    icon: 'healthcare',
    name: 'Здравоохранение',
    nameEn: 'Healthcare',
    color: 'from-sky-500 to-sky-700',
    emoji: '🏥'
  },
  dental: {
    code: 'dental',
    icon: 'dental',
    name: 'Стоматология',
    nameEn: 'Dental',
    color: 'from-cyan-400 to-cyan-600',
    emoji: '🦷'
  },
  veterinary: {
    code: 'veterinary',
    icon: 'veterinary',
    name: 'Ветеринария',
    nameEn: 'Veterinary',
    color: 'from-lime-500 to-lime-700',
    emoji: '🐾'
  },
  pharmacy: {
    code: 'pharmacy',
    icon: 'pharmacy',
    name: 'Аптека',
    nameEn: 'Pharmacy',
    color: 'from-green-400 to-green-600',
    emoji: '💊'
  },
  
  // Категории для Services (Услуги)
  photography: {
    code: 'photography',
    icon: 'photography',
    name: 'Фотография',
    nameEn: 'Photography',
    color: 'from-gray-500 to-gray-700',
    emoji: '📷'
  },
  legal: {
    code: 'legal',
    icon: 'legal',
    name: 'Юридические услуги',
    nameEn: 'Legal Services',
    color: 'from-blue-600 to-blue-800',
    emoji: '⚖️'
  },
  accounting: {
    code: 'accounting',
    icon: 'accounting',
    name: 'Бухгалтерские услуги',
    nameEn: 'Accounting',
    color: 'from-emerald-600 to-emerald-800',
    emoji: '📊'
  },
  
  // Категории для Travel & Tourism (Путешествия)
  travel: {
    code: 'travel',
    icon: 'travel',
    name: 'Путешествия',
    nameEn: 'Travel',
    color: 'from-sky-400 to-sky-600',
    emoji: '✈️'
  },
  hotel: {
    code: 'hotel',
    icon: 'hotel',
    name: 'Отель',
    nameEn: 'Hotel',
    color: 'from-amber-600 to-amber-800',
    emoji: '🏨'
  },
  tours: {
    code: 'tours',
    icon: 'tours',
    name: 'Туры',
    nameEn: 'Tours',
    color: 'from-green-600 to-green-800',
    emoji: '🗺️'
  },
  
  // Категории для Automotive & Pets (Авто и животные)
  car_service: {
    code: 'car_service',
    icon: 'car_service',
    name: 'Автосервис',
    nameEn: 'Car Service',
    color: 'from-gray-600 to-gray-800',
    emoji: '🔧'
  },
  car_rental: {
    code: 'car_rental',
    icon: 'car_rental',
    name: 'Аренда авто',
    nameEn: 'Car Rental',
    color: 'from-blue-500 to-blue-700',
    emoji: '🚗'
  },
  pet_services: {
    code: 'pet_services',
    icon: 'pet_services',
    name: 'Услуги для животных',
    nameEn: 'Pet Services',
    color: 'from-orange-400 to-orange-600',
    emoji: '🐶'
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
  if (searchStr.includes('ресниц') || searchStr.includes('ламинирован')) {
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
    color: 'from-amber-400 to-pink-300'
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

/**
 * Группы категорий услуг и товаров
 * Используются для отображения на главной странице
 */
export const categoryGroups = [
  {
    id: 'beauty_wellness',
    code: 'beauty_wellness',
    name: 'Красота и здоровье',
    nameEn: 'Beauty & Wellness',
    emoji: '💄',
    icon: 'beauty',
    categories: [
      'nail_care', 'brow_design', 'hair_salon', 'hair_removal',
      'facial_aesthetics', 'lash_services', 'massage_therapy', 'makeup_pmu',
      'body_wellness', 'nutrition_coaching', 'mindfulness_coaching', 'image_consulting'
    ],
    displayOrder: 1,
    avgDuration: '60 min'
  },
  {
    id: 'self_discovery',
    code: 'self_discovery',
    name: 'Самопознание',
    nameEn: 'Self-Discovery',
    emoji: '🔮',
    icon: 'beauty',
    categories: [
      'astrology',
      'numerology',
      'psychology_coaching',
      'meditation_spirituality'
    ],
    displayOrder: 11,
    avgDuration: '60 min'
  },
  {
    id: 'food_beverage',
    code: 'food_beverage',
    name: 'Еда и напитки',
    nameEn: 'Food & Beverage',
    emoji: '🍽️',
    icon: 'food',
    categories: ['restaurant', 'cafe', 'food_delivery', 'bakery', 'bar'],
    displayOrder: 2,
    avgDuration: '20 min'
  },
  {
    id: 'education',
    code: 'education',
    name: 'Образование',
    nameEn: 'Education',
    emoji: '📚',
    icon: 'education',
    categories: ['education', 'language_school', 'training', 'online_education'],
    displayOrder: 3,
    avgDuration: '2 часа'
  },
  {
    id: 'retail',
    code: 'retail',
    name: 'Розничная торговля',
    nameEn: 'Retail',
    emoji: '🛍️',
    icon: 'retail',
    categories: ['retail', 'fashion', 'cosmetics_shop', 'electronics', 'gift_shop'],
    displayOrder: 4,
    avgDuration: '15 min'
  },
  {
    id: 'sports_fitness',
    code: 'sports_fitness',
    name: 'Спорт и фитнес',
    nameEn: 'Sports & Fitness',
    emoji: '🏋️',
    icon: 'fitness',
    categories: ['fitness', 'yoga', 'sports', 'swimming'],
    displayOrder: 5,
    avgDuration: '90 min'
  },
  {
    id: 'entertainment',
    code: 'entertainment',
    name: 'Развлечения',
    nameEn: 'Entertainment',
    emoji: '🎬',
    icon: 'entertainment',
    categories: ['entertainment', 'cinema', 'events', 'gaming', 'music'],
    displayOrder: 6,
    avgDuration: '2 часа'
  },
  {
    id: 'healthcare',
    code: 'healthcare',
    name: 'Здравоохранение',
    nameEn: 'Healthcare',
    emoji: '🏥',
    icon: 'healthcare',
    categories: ['healthcare', 'dental', 'veterinary', 'pharmacy'],
    displayOrder: 7,
    avgDuration: '30 min'
  },
  {
    id: 'services',
    code: 'services',
    name: 'Услуги',
    nameEn: 'Services',
    emoji: '🧹',
    icon: 'services',
    categories: ['cleaning', 'repair', 'photography', 'legal', 'accounting'],
    displayOrder: 8,
    avgDuration: '1 час'
  },
  {
    id: 'travel_tourism',
    code: 'travel_tourism',
    name: 'Путешествия и туризм',
    nameEn: 'Travel & Tourism',
    emoji: '✈️',
    icon: 'travel',
    categories: ['travel', 'hotel', 'tours'],
    displayOrder: 9,
    avgDuration: '1 день'
  },
  {
    id: 'automotive_pets',
    code: 'automotive_pets',
    name: 'Авто и животные',
    nameEn: 'Automotive & Pets',
    emoji: '🚗',
    icon: 'automotive',
    categories: ['car_service', 'car_rental', 'pet_services'],
    displayOrder: 10,
    avgDuration: '2 часа'
  }
]

/**
 * Получить все группы категорий
 */
export const getAllCategoryGroups = () => {
  return categoryGroups.sort((a, b) => (a.displayOrder || 999) - (b.displayOrder || 999))
}

/**
 * Получить группу категорий по коду
 */
export const getCategoryGroupByCode = (code) => {
  return categoryGroups.find(group => group.code === code || group.id === code) || null
}

/**
 * Получить категории по группе
 * @param {string} groupCode - код группы (beauty, food, education, retail, sports_fitness, entertainment, healthcare, services)
 * @returns {Array} массив категорий для этой группы
 */
export const getCategoriesByGroup = (groupCode) => {
  // Маппинг из упрощенных кодов партнерской формы в коды categoryGroups
  const groupMapping = {
    'beauty': 'beauty_wellness',
    'food': 'food_beverage',
    'education': 'education',
    'retail': 'retail',
    'sports_fitness': 'sports_fitness',
    'entertainment': 'entertainment',
    'healthcare': 'healthcare',
    'services': 'services',
    'travel': 'travel_tourism',
    'automotive': 'automotive_pets',
    'self_discovery': 'self_discovery'
  }
  
  const mappedCode = groupMapping[groupCode] || groupCode
  const group = categoryGroups.find(g => g.code === mappedCode || g.id === mappedCode)
  
  if (!group) return []
  
  // Возвращаем категории из serviceCategories по кодам из группы
  return group.categories
    .map(code => serviceCategories[code])
    .filter(Boolean)
}

export default serviceCategories

