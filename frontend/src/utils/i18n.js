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
    
    // News Page
    nav_news: 'Новости',
    news_title: 'Новости',
    news_latest: 'Последние новости',
    news_no_items: 'Нет опубликованных новостей',
    news_read_more: 'Читать далее',
    news_views: 'просмотров',
    news_published: 'Опубликовано',
    news_back_to_news: 'Вернуться к новостям',
    
    // Location Selector
    location_select_city: 'Выберите город',
    location_all_cities: '🌍 Все города',
    location_select_district: 'Выберите район',
    location_all_districts: '🌆 Все районы',
    location_back: 'Назад',
    location_services_in: 'Услуги в',
    location_change_location: 'Изменить город/район',
    location_online_everywhere: '🌍 Везде (онлайн)',
    
    // Partner Application Form
    partner_apply_title: 'Стать партнером',
    partner_apply_subtitle: 'Заполните форму для подачи заявки',
    partner_name: 'Ваше имя',
    partner_name_required: 'Укажите ваше имя',
    partner_phone: 'Номер телефона',
    partner_phone_required: 'Укажите номер телефона',
    partner_phone_invalid: 'Неверный формат телефона',
    partner_phone_placeholder: '+7 (900) 123-45-67',
    partner_company: 'Название компании',
    partner_company_required: 'Укажите название компании',
    partner_company_placeholder: 'Салон красоты \'Аврора\'',
    partner_city: 'Город работы',
    partner_city_required: 'Выберите город',
    partner_city_placeholder: 'Выберите город',
    partner_district: 'Район работы',
    partner_district_required: 'Выберите район',
    partner_district_placeholder: 'Выберите район',
    partner_online_hint: 'Отлично для онлайн-консультаций и дистанционных услуг!',
    partner_all_districts_hint: 'Ваши услуги будут видны во всех районах города!',
    partner_location_info: 'Обратите внимание: Выбранная локация определит, где будут видны ваши услуги в приложении.',
    partner_submit: 'Отправить заявку',
    partner_submitting: 'Отправка...',
    partner_success_title: 'Заявка отправлена!',
    partner_success_text: 'Ваша заявка на партнерство принята и ожидает одобрения администратора. Мы уведомим вас о результате в ближайшее время.',
    partner_your_location: 'Ваша локация',
    partner_work_everywhere: 'Работаю везде (онлайн)',
    partner_all_districts: 'все районы',
    partner_redirecting: 'Перенаправление в партнерский бот...',
    partner_footer_text: 'После одобрения заявки вы получите доступ к партнерской панели',
    partner_error: 'Произошла ошибка при отправке заявки. Попробуйте еще раз.',
    
    // Loyalty Progress
    loyalty_level_newbie: 'Новичок',
    loyalty_level_friend: 'Друг',
    loyalty_level_vip: 'VIP',
    loyalty_level_platinum: 'Платина',
    loyalty_to: 'До',
    loyalty_progress: 'Прогресс',
    loyalty_points_to_next: 'баллов до следующего уровня',
    loyalty_max_level: 'Максимальный уровень!',
    loyalty_max_reached: 'Вы достигли максимального уровня!',
    
    // Common
    loading: 'Загрузка',
    loading_data: 'Загрузка данных...',
    loading_promotions: 'Загрузка акций...',
    loading_services: 'Загрузка услуг...',
    loading_history: 'Загрузка истории...',
    loading_profile: 'Загрузка профиля...',
    loading_news: 'Загрузка новостей...',
    error: 'Ошибка',
    error_open_telegram: 'Пожалуйста, откройте приложение через Telegram бота',
    error_something_wrong: 'Что-то пошло не так',
    error_reload: 'Перезагрузить',
    back: 'Назад',
    required_field: '*',
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
    
    // News Page
    nav_news: 'News',
    news_title: 'News',
    news_latest: 'Latest News',
    news_no_items: 'No published news',
    news_read_more: 'Read more',
    news_views: 'views',
    news_published: 'Published',
    news_back_to_news: 'Back to news',
    
    // Location Selector
    location_select_city: 'Select city',
    location_all_cities: '🌍 All cities',
    location_select_district: 'Select district',
    location_all_districts: '🌆 All districts',
    location_back: 'Back',
    location_services_in: 'Services in',
    location_change_location: 'Change city/district',
    location_online_everywhere: '🌍 Everywhere (online)',
    
    // Partner Application Form
    partner_apply_title: 'Become a Partner',
    partner_apply_subtitle: 'Fill out the application form',
    partner_name: 'Your name',
    partner_name_required: 'Please enter your name',
    partner_phone: 'Phone number',
    partner_phone_required: 'Please enter phone number',
    partner_phone_invalid: 'Invalid phone format',
    partner_phone_placeholder: '+1 (555) 123-4567',
    partner_company: 'Company name',
    partner_company_required: 'Please enter company name',
    partner_company_placeholder: 'Beauty Salon \'Aurora\'',
    partner_city: 'Work location (city)',
    partner_city_required: 'Please select a city',
    partner_city_placeholder: 'Select city',
    partner_district: 'Work location (district)',
    partner_district_required: 'Please select a district',
    partner_district_placeholder: 'Select district',
    partner_online_hint: 'Perfect for online consultations and remote services!',
    partner_all_districts_hint: 'Your services will be visible in all districts of the city!',
    partner_location_info: 'Note: The selected location will determine where your services will be visible in the app.',
    partner_submit: 'Submit application',
    partner_submitting: 'Submitting...',
    partner_success_title: 'Application submitted!',
    partner_success_text: 'Your partnership application has been received and is awaiting administrator approval. We will notify you of the result soon.',
    partner_your_location: 'Your location',
    partner_work_everywhere: 'Work everywhere (online)',
    partner_all_districts: 'all districts',
    partner_redirecting: 'Redirecting to partner bot...',
    partner_footer_text: 'After approval, you will get access to the partner panel',
    partner_error: 'An error occurred while submitting the application. Please try again.',
    
    // Loyalty Progress
    loyalty_level_newbie: 'Newbie',
    loyalty_level_friend: 'Friend',
    loyalty_level_vip: 'VIP',
    loyalty_level_platinum: 'Platinum',
    loyalty_to: 'To',
    loyalty_progress: 'Progress',
    loyalty_points_to_next: 'points to next level',
    loyalty_max_level: 'Maximum level!',
    loyalty_max_reached: 'You have reached the maximum level!',
    
    // Common
    loading: 'Loading',
    loading_data: 'Loading data...',
    loading_promotions: 'Loading promotions...',
    loading_services: 'Loading services...',
    loading_history: 'Loading history...',
    loading_profile: 'Loading profile...',
    loading_news: 'Loading news...',
    error: 'Error',
    error_open_telegram: 'Please open the app via Telegram bot',
    error_something_wrong: 'Something went wrong',
    error_reload: 'Reload',
    back: 'Back',
    required_field: '*',
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

