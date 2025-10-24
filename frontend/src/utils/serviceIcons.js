/**
 * Иконки и данные для различных типов услуг
 */

export const serviceCategories = {
  // Косметология и красота
  manicure: {
    icon: '💅',
    name: 'Маникюр',
    nameEn: 'Manicure',
    color: 'from-pink-400 to-pink-600'
  },
  hairstyle: {
    icon: '💇‍♀️',
    name: 'Прически',
    nameEn: 'Hairstyle',
    color: 'from-purple-400 to-purple-600'
  },
  massage: {
    icon: '💆‍♀️',
    name: 'Массаж',
    nameEn: 'Massage',
    color: 'from-blue-400 to-blue-600'
  },
  cosmetologist: {
    icon: '🧴',
    name: 'Косметолог',
    nameEn: 'Cosmetologist',
    color: 'from-teal-400 to-teal-600'
  },
  eyebrows: {
    icon: '✨',
    name: 'Брови',
    nameEn: 'Eyebrows',
    color: 'from-amber-400 to-amber-600'
  },
  eyelashes: {
    icon: '👁️',
    name: 'Ресницы',
    nameEn: 'Eyelashes',
    color: 'from-indigo-400 to-indigo-600'
  },
  laser: {
    icon: '💫',
    name: 'Лазерная эпиляция',
    nameEn: 'Laser Hair Removal',
    color: 'from-rose-400 to-rose-600'
  },
  skincare: {
    icon: '🌸',
    name: 'Уход за кожей',
    nameEn: 'Skincare',
    color: 'from-pink-300 to-pink-500'
  },
  makeup: {
    icon: '💄',
    name: 'Визажист',
    nameEn: 'Makeup Artist',
    color: 'from-red-400 to-red-600'
  },
  
  // Дополнительные услуги
  cleaning: {
    icon: '🧹',
    name: 'Уборка',
    nameEn: 'Cleaning',
    color: 'from-green-400 to-green-600'
  },
  repair: {
    icon: '🔧',
    name: 'Ремонт',
    nameEn: 'Repair',
    color: 'from-gray-400 to-gray-600'
  },
  delivery: {
    icon: '🚗',
    name: 'Доставка',
    nameEn: 'Delivery',
    color: 'from-blue-500 to-blue-700'
  },
  fitness: {
    icon: '🏃‍♀️',
    name: 'Фитнес',
    nameEn: 'Fitness',
    color: 'from-orange-400 to-orange-600'
  },
  spa: {
    icon: '🛁',
    name: 'SPA',
    nameEn: 'SPA',
    color: 'from-cyan-400 to-cyan-600'
  },
  yoga: {
    icon: '🧘‍♀️',
    name: 'Йога',
    nameEn: 'Yoga',
    color: 'from-purple-300 to-purple-500'
  },
  nutrition: {
    icon: '🥗',
    name: 'Питание',
    nameEn: 'Nutrition',
    color: 'from-lime-400 to-lime-600'
  },
  psychology: {
    icon: '🧠',
    name: 'Психолог',
    nameEn: 'Psychology',
    color: 'from-violet-400 to-violet-600'
  }
}

/**
 * Получить иконку для услуги по названию или категории
 */
export const getServiceIcon = (serviceName = '', serviceCategory = '') => {
  const searchStr = (serviceName + ' ' + serviceCategory).toLowerCase()
  
  // Косметология
  if (searchStr.includes('маникюр') || searchStr.includes('ногт')) return serviceCategories.manicure.icon
  if (searchStr.includes('прическ') || searchStr.includes('волос') || searchStr.includes('стрижк')) return serviceCategories.hairstyle.icon
  if (searchStr.includes('массаж')) return serviceCategories.massage.icon
  if (searchStr.includes('косметолог') || searchStr.includes('чистка лица')) return serviceCategories.cosmetologist.icon
  if (searchStr.includes('бров')) return serviceCategories.eyebrows.icon
  if (searchStr.includes('реснниц')) return serviceCategories.eyelashes.icon
  if (searchStr.includes('лазер') || searchStr.includes('эпиля')) return serviceCategories.laser.icon
  if (searchStr.includes('уход') || searchStr.includes('кож')) return serviceCategories.skincare.icon
  if (searchStr.includes('визаж') || searchStr.includes('макияж') || searchStr.includes('makeup')) return serviceCategories.makeup.icon
  
  // Дополнительные
  if (searchStr.includes('убор') || searchStr.includes('clean')) return serviceCategories.cleaning.icon
  if (searchStr.includes('ремонт') || searchStr.includes('repair')) return serviceCategories.repair.icon
  if (searchStr.includes('достав') || searchStr.includes('delivery')) return serviceCategories.delivery.icon
  if (searchStr.includes('фитнес') || searchStr.includes('тренир')) return serviceCategories.fitness.icon
  if (searchStr.includes('spa') || searchStr.includes('спа')) return serviceCategories.spa.icon
  if (searchStr.includes('йог')) return serviceCategories.yoga.icon
  if (searchStr.includes('питан') || searchStr.includes('диет')) return serviceCategories.nutrition.icon
  if (searchStr.includes('психол') || searchStr.includes('коуч')) return serviceCategories.psychology.icon
  
  // По умолчанию
  return '✨'
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
    icon: '✨',
    name: 'Услуга',
    nameEn: 'Service',
    color: 'from-orange-400 to-orange-600'
  }
}

/**
 * Список всех доступных иконок для отображения в сетке
 */
export const defaultServiceIcons = [
  serviceCategories.manicure,
  serviceCategories.hairstyle,
  serviceCategories.massage,
  serviceCategories.cosmetologist,
  serviceCategories.eyebrows,
  serviceCategories.eyelashes,
  serviceCategories.laser,
  serviceCategories.makeup,
  serviceCategories.skincare,
  serviceCategories.spa,
  serviceCategories.fitness,
  serviceCategories.yoga,
  serviceCategories.cleaning,
  serviceCategories.repair,
  serviceCategories.delivery,
  serviceCategories.nutrition
]

export default serviceCategories

