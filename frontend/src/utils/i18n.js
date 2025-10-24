/**
 * Простая система многоязычности без дополнительных библиотек
 */

const translations = {
  ru: {
    // Navigation
    nav_home: 'Главная',
    nav_promotions: 'Акции',
    nav_services: 'Услуги',
    nav_history: 'История',
    nav_profile: 'Профиль',
    
    // Home Page
    home_greeting: 'Привет',
    home_balance_text: 'Используйте баллы для получения услуг и скидок!',
    home_points: 'баллов',
    home_services: 'Услуги',
    home_see_all: 'Все',
    home_rewards: 'Награды',
    home_more: 'Ещё ...',
    
    // Promotions Page
    promo_title: 'Акции партнёров',
    promo_all: 'Все',
    promo_active: 'Активные',
    promo_ending: 'Скоро закончатся',
    promo_no_items: 'Нет активных акций',
    promo_details: 'Подробнее',
    promo_until: 'До',
    promo_points: 'баллов',
    promo_last_day: 'Последний день',
    promo_days: 'дн.',
    
    // Services Page
    services_title: 'Услуги',
    services_balance: 'баллов',
    services_all: 'Все',
    services_affordable: 'Доступные',
    services_expensive: 'Копим',
    services_no_items: 'Услуги не найдены',
    services_no_affordable: 'Нет доступных услуг. Копите баллы!',
    services_available: '✓ Доступно',
    services_exchange: 'Обменять',
    services_not_enough: 'Недостаточно баллов',
    services_cancel: 'Отмена',
    services_confirm_exchange: 'Обменять {points} баллов на "{name}"?',
    services_not_enough_alert: 'У вас недостаточно баллов. Нужно {required}, а у вас {current}.',
    
    // History Page
    history_title: 'История',
    history_earned: 'Начислено',
    history_spent: 'Потрачено',
    history_all: 'Все',
    history_accruals: 'Начисления',
    history_redemptions: 'Списания',
    history_no_items: 'История транзакций пуста',
    history_purchase_at: 'Покупка у',
    history_bonus: 'Бонус за регистрацию',
    history_exchange: 'Обмен баллов на услугу',
    history_operation: 'Операция',
    history_today: 'Сегодня',
    history_yesterday: 'Вчера',
    
    // Profile Page
    profile_title: 'Профиль',
    profile_guest: 'Гость',
    profile_phone_empty: 'Телефон не указан',
    profile_member_since: 'С',
    profile_stats: 'Моя статистика',
    profile_balance: 'Баллов на счёте',
    profile_total_earned: 'Всего получено',
    profile_total_spent: 'Потрачено',
    profile_transactions: 'Транзакций',
    profile_language: 'Язык',
    profile_russian: 'Русский',
    profile_english: 'English',
    profile_history: 'История транзакций',
    profile_help: 'Помощь и поддержка',
    profile_about: 'О приложении',
    profile_status: 'Статус',
    profile_active: '✓ Активный',
    profile_inactive: 'Неактивный',
    profile_referral: 'Реферальная программа',
    profile_referral_text: 'Вы были приглашены другом! Приглашайте своих друзей и получайте бонусы.',
    profile_logout: 'Выйти из приложения',
    
    // Common
    loading: 'Загрузка',
    loading_data: 'Загрузка данных...',
    loading_promotions: 'Загрузка акций...',
    loading_services: 'Загрузка услуг...',
    loading_history: 'Загрузка истории...',
    loading_profile: 'Загрузка профиля...',
    error: 'Ошибка',
    error_open_telegram: 'Пожалуйста, откройте приложение через Telegram бота',
    error_something_wrong: 'Что-то пошло не так',
    error_reload: 'Перезагрузить',
    back: 'Назад',
  },
  
  en: {
    // Navigation
    nav_home: 'Home',
    nav_promotions: 'Promotions',
    nav_services: 'Services',
    nav_history: 'History',
    nav_profile: 'Profile',
    
    // Home Page
    home_greeting: 'Hi',
    home_balance_text: 'Use points to get services and discounts!',
    home_points: 'points',
    home_services: 'Services',
    home_see_all: 'See all',
    home_rewards: 'Rewards',
    home_more: 'More ...',
    
    // Promotions Page
    promo_title: 'Partner Promotions',
    promo_all: 'All',
    promo_active: 'Active',
    promo_ending: 'Ending Soon',
    promo_no_items: 'No active promotions',
    promo_details: 'Details',
    promo_until: 'Until',
    promo_points: 'points',
    promo_last_day: 'Last day',
    promo_days: 'days',
    
    // Services Page
    services_title: 'Services',
    services_balance: 'points',
    services_all: 'All',
    services_affordable: 'Affordable',
    services_expensive: 'Saving up',
    services_no_items: 'No services found',
    services_no_affordable: 'No affordable services. Save up points!',
    services_available: '✓ Available',
    services_exchange: 'Exchange',
    services_not_enough: 'Not enough points',
    services_cancel: 'Cancel',
    services_confirm_exchange: 'Exchange {points} points for "{name}"?',
    services_not_enough_alert: 'You don\'t have enough points. Need {required}, you have {current}.',
    
    // History Page
    history_title: 'History',
    history_earned: 'Earned',
    history_spent: 'Spent',
    history_all: 'All',
    history_accruals: 'Credits',
    history_redemptions: 'Debits',
    history_no_items: 'Transaction history is empty',
    history_purchase_at: 'Purchase at',
    history_bonus: 'Registration bonus',
    history_exchange: 'Points exchanged for service',
    history_operation: 'Operation',
    history_today: 'Today',
    history_yesterday: 'Yesterday',
    
    // Profile Page
    profile_title: 'Profile',
    profile_guest: 'Guest',
    profile_phone_empty: 'Phone not specified',
    profile_member_since: 'Since',
    profile_stats: 'My Statistics',
    profile_balance: 'Points balance',
    profile_total_earned: 'Total earned',
    profile_total_spent: 'Spent',
    profile_transactions: 'Transactions',
    profile_language: 'Language',
    profile_russian: 'Русский',
    profile_english: 'English',
    profile_history: 'Transaction history',
    profile_help: 'Help & Support',
    profile_about: 'About',
    profile_status: 'Status',
    profile_active: '✓ Active',
    profile_inactive: 'Inactive',
    profile_referral: 'Referral Program',
    profile_referral_text: 'You were invited by a friend! Invite your friends and get bonuses.',
    profile_logout: 'Logout',
    
    // Common
    loading: 'Loading',
    loading_data: 'Loading data...',
    loading_promotions: 'Loading promotions...',
    loading_services: 'Loading services...',
    loading_history: 'Loading history...',
    loading_profile: 'Loading profile...',
    error: 'Error',
    error_open_telegram: 'Please open the app via Telegram bot',
    error_something_wrong: 'Something went wrong',
    error_reload: 'Reload',
    back: 'Back',
  }
}

// Получить перевод по ключу
export const t = (key, lang = 'ru', replacements = {}) => {
  let text = translations[lang]?.[key] || translations['ru'][key] || key
  
  // Замена плейсхолдеров {key} на значения
  Object.keys(replacements).forEach(replKey => {
    text = text.replace(`{${replKey}}`, replacements[replKey])
  })
  
  return text
}

// Хук для использования переводов
export const useTranslation = (lang = 'ru') => {
  return {
    t: (key, replacements) => t(key, lang, replacements),
    lang
  }
}

export default translations

