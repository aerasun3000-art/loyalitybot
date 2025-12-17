/**
 * Простая система многоязычности без дополнительных библиотек
 */

const translations = {
  ru: {
    // Navigation
    nav_home: 'Главная',
    nav_activity: 'Активность',
    nav_community: 'Сообщество',
    nav_message: 'Сообщения',
    nav_promotions: 'Акции',
    nav_services: 'Услуги',
    nav_history: 'История',
    nav_profile: 'Профиль',
    
    // Home Page
    home_greeting: 'Привет',
    home_balance_text: 'Используйте баллы для получения услуг и скидок!',
    home_points: 'баллов',
    home_points_to_next_reward: 'До следующего вознаграждения осталось {points} {pointsWord}',
    home_points_ready: 'Баллов достаточно для обмена — выберите услугу!',
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
    promo_new: 'НОВАЯ',
    promo_search: 'Поиск акций',
    promo_all_promotions: 'Все акции',
    promo_free: 'Бесплатно',
    promo_promotion: 'Акция',
    
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
    
    // Referral Program (Community Page)
    referral_title: 'Реферальная программа',
    referral_auth_required: 'Пожалуйста, войдите через Telegram бота',
    referral_your_level: 'Ваш уровень',
    referral_level_bronze: 'Бронза',
    referral_level_silver: 'Серебро',
    referral_level_gold: 'Золото',
    referral_level_platinum: 'Платина',
    referral_total: 'Всего',
    referral_active: 'Активных',
    referral_earned: 'Заработано',
    referral_your_link: 'Ваша реферальная ссылка',
    referral_code: 'Реферальный код',
    referral_link: 'Реферальная ссылка',
    referral_link_generating: 'Генерация ссылки...',
    referral_copied: 'Скопировано!',
    referral_copy_link: 'Копировать ссылку',
    referral_code_loading: 'Загрузка реферального кода...',
    referral_how_it_works: 'Как это работает',
    referral_step1_title: 'Пригласите друга',
    referral_step1_desc: 'Отправьте вашу реферальную ссылку другу',
    referral_step2_title: 'Друг регистрируется',
    referral_step2_desc: 'Ваш друг регистрируется по вашей ссылке',
    referral_step3_title: 'Получайте бонусы',
    referral_step3_desc: 'Вы получаете бонусы за регистрацию и покупки друга',
    referral_bonuses: 'Бонусы',
    referral_bonus_registration: 'За регистрацию друга',
    referral_bonus_registration_desc: 'Получите 100 баллов когда друг зарегистрируется',
    referral_bonus_transaction: 'С покупок друга',
    referral_bonus_transaction_desc: 'Получайте 8% от баллов, которые зарабатывает ваш друг',
    referral_bonus_level2: 'За внучатого реферала',
    referral_bonus_level2_desc: '25 баллов за регистрацию + 4% с покупок',
    referral_bonus_level3: 'За правнучатого реферала',
    referral_bonus_level3_desc: '10 баллов за регистрацию + 2% с покупок',
    referral_achievements: 'Достижения',
    referral_achievement: 'Пригласить {count} друзей',
    referral_achievement_bonus: 'Бонус: {bonus} баллов',
    referral_recent_rewards: 'Последние награды',
    referral_reward: 'Реферальная награда',
    
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
    partner_not_connected: 'Данный партнер пока не подключен к системе',
    
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
    
    // Profile Page
    profile_title: 'Профиль',
    profile_guest: 'Гость',
    profile_no_phone: 'Телефон не указан',
    profile_member_since: 'С',
    profile_unknown: 'Неизвестно',
    profile_become_partner: 'Станьте партнером',
    profile_partner_description: 'Предлагайте свои услуги клиентам программы лояльности и расширяйте свой бизнес!',
    profile_partner_button: 'Подать заявку',
    profile_my_stats: 'Моя статистика',
    profile_balance: 'Баллов на счёте',
    profile_earned: 'Всего получено',
    profile_spent: 'Потрачено',
    profile_transactions: 'Транзакций',
    profile_history: 'История транзакций',
    profile_support: 'Помощь и поддержка',
    profile_about: 'О приложении',
    profile_status: 'Статус',
    profile_active: 'Активный',
    profile_inactive: 'Неактивный',
    profile_referral: 'Реферальная программа',
    profile_referral_text: 'Вы были приглашены другом! Приглашайте своих друзей и получайте бонусы.',
    profile_logout: 'Выйти из приложения',
    
    // About Page
    about_title: 'О приложении',
    about_subtitle: 'Программа лояльности нового поколения',
    about_what_is: 'Что такое LoyaltyBot?',
    about_description: 'LoyaltyBot — это современная программа лояльности, которая объединяет клиентов и партнеров. Получайте баллы за покупки, обменивайте их на услуги и наслаждайтесь эксклюзивными привилегиями!',
    about_earn_points: 'Зарабатывайте баллы',
    about_get_rewards: 'Получайте награды',
    about_vip_status: 'VIP статусы',
    about_partners: 'Сеть партнеров',
    about_how_it_works: 'Как это работает?',
    about_step1_title: 'Регистрация',
    about_step1_text: 'Присоединяйтесь через Telegram бота и получите приветственные баллы',
    about_step2_title: 'Накопление баллов',
    about_step2_text: 'Пользуйтесь услугами партнеров и зарабатывайте баллы за каждую покупку',
    about_step3_title: 'Обмен баллов',
    about_step3_text: 'Тратьте накопленные баллы на услуги партнеров или эксклюзивные предложения',
    about_partner_cta: 'Хотите предлагать свои услуги тысячам клиентов? Станьте нашим партнером и расширьте свой бизнес!',
    about_app_info: 'Информация о приложении',
    about_version: 'Версия',
    about_platform: 'Платформа',
    about_support: 'Поддержка',
    about_follow_us: 'Следите за нами',
    
    // Legal Pages
    privacy_policy_title: 'Политика конфиденциальности',
    terms_of_service_title: 'Условия использования',
    legal_back: 'Назад',
    legal_updated: 'Обновлено',
    legal_effective_date: 'Дата вступления в силу',
    
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
    nav_activity: 'Activity',
    nav_community: 'Community',
    nav_message: 'Message',
    nav_promotions: 'Promotions',
    nav_services: 'Services',
    nav_history: 'History',
    nav_profile: 'Profile',
    
    // Home Page
    home_greeting: 'Hi',
    home_balance_text: 'Use points to get services and discounts!',
    home_points: 'points',
    home_points_to_next_reward: '{points} points to the next reward',
    home_points_ready: 'Enough points for a reward — pick a service!',
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
    promo_new: 'NEW',
    promo_search: 'Search promotions',
    promo_all_promotions: 'All promotions',
    promo_free: 'Free',
    promo_promotion: 'Promotion',
    
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
    
    // Referral Program (Community Page)
    referral_title: 'Referral Program',
    referral_auth_required: 'Please login via Telegram bot',
    referral_your_level: 'Your Level',
    referral_level_bronze: 'Bronze',
    referral_level_silver: 'Silver',
    referral_level_gold: 'Gold',
    referral_level_platinum: 'Platinum',
    referral_total: 'Total',
    referral_active: 'Active',
    referral_earned: 'Earned',
    referral_your_link: 'Your Referral Link',
    referral_code: 'Referral Code',
    referral_link: 'Referral Link',
    referral_link_generating: 'Generating link...',
    referral_copied: 'Copied!',
    referral_copy_link: 'Copy Link',
    referral_code_loading: 'Loading referral code...',
    referral_how_it_works: 'How It Works',
    referral_step1_title: 'Invite a Friend',
    referral_step1_desc: 'Send your referral link to a friend',
    referral_step2_title: 'Friend Registers',
    referral_step2_desc: 'Your friend registers using your link',
    referral_step3_title: 'Get Bonuses',
    referral_step3_desc: 'You get bonuses for registration and friend\'s purchases',
    referral_bonuses: 'Bonuses',
    referral_bonus_registration: 'For Friend Registration',
    referral_bonus_registration_desc: 'Get 100 points when friend registers',
    referral_bonus_transaction: 'From Friend\'s Purchases',
    referral_bonus_transaction_desc: 'Get 8% of points your friend earns',
    referral_bonus_level2: 'For Grandchild Referral',
    referral_bonus_level2_desc: '25 points for registration + 4% from purchases',
    referral_bonus_level3: 'For Great-Grandchild Referral',
    referral_bonus_level3_desc: '10 points for registration + 2% from purchases',
    referral_achievements: 'Achievements',
    referral_achievement: 'Invite {count} friends',
    referral_achievement_bonus: 'Bonus: {bonus} points',
    referral_recent_rewards: 'Recent Rewards',
    referral_reward: 'Referral Reward',
    
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
    partner_not_connected: 'This partner is not yet connected to the system',
    
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
    
    // Profile Page
    profile_title: 'Profile',
    profile_guest: 'Guest',
    profile_no_phone: 'No phone specified',
    profile_member_since: 'Since',
    profile_unknown: 'Unknown',
    profile_become_partner: 'Become a Partner',
    profile_partner_description: 'Offer your services to loyalty program clients and grow your business!',
    profile_partner_button: 'Apply Now',
    profile_my_stats: 'My Statistics',
    profile_balance: 'Points Balance',
    profile_earned: 'Total Earned',
    profile_spent: 'Spent',
    profile_transactions: 'Transactions',
    profile_history: 'Transaction History',
    profile_support: 'Help & Support',
    profile_about: 'About',
    profile_status: 'Status',
    profile_active: 'Active',
    profile_inactive: 'Inactive',
    profile_referral: 'Referral Program',
    profile_referral_text: 'You were invited by a friend! Invite your friends and get bonuses.',
    profile_logout: 'Exit App',
    
    // About Page
    about_title: 'About',
    about_subtitle: 'Next Generation Loyalty Program',
    about_what_is: 'What is LoyaltyBot?',
    about_description: 'LoyaltyBot is a modern loyalty program that connects customers and partners. Earn points for purchases, redeem them for services, and enjoy exclusive benefits!',
    about_earn_points: 'Earn Points',
    about_get_rewards: 'Get Rewards',
    about_vip_status: 'VIP Status',
    about_partners: 'Partner Network',
    about_how_it_works: 'How It Works?',
    about_step1_title: 'Registration',
    about_step1_text: 'Join via Telegram bot and receive welcome bonus points',
    about_step2_title: 'Earn Points',
    about_step2_text: 'Use partner services and earn points for every purchase',
    about_step3_title: 'Redeem Points',
    about_step3_text: 'Spend accumulated points on partner services or exclusive offers',
    about_partner_cta: 'Want to offer your services to thousands of customers? Become our partner and grow your business!',
    about_app_info: 'App Information',
    about_version: 'Version',
    about_platform: 'Platform',
    about_support: 'Support',
    about_follow_us: 'Follow Us',
    
    // Legal Pages
    privacy_policy_title: 'Privacy Policy',
    terms_of_service_title: 'Terms of Service',
    legal_back: 'Back',
    legal_updated: 'Updated',
    legal_effective_date: 'Effective Date',
    
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

// Функция для склонения слова "балл" в зависимости от числа
export const declinePoints = (count) => {
  const lastDigit = count % 10
  const lastTwoDigits = count % 100
  
  // Исключения для 11-14
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return 'баллов'
  }
  
  // 1 балл
  if (lastDigit === 1) {
    return 'балл'
  }
  
  // 2, 3, 4 балла
  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'балла'
  }
  
  // 5, 6, 7, 8, 9, 0 баллов
  return 'баллов'
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

/**
 * Автоматический перевод динамического контента (новости, акции, описания услуг)
 * Использует AI перевод через backend API
 * 
 * @param {string} text - Текст для перевода
 * @param {string} lang - Целевой язык
 * @param {string} sourceLang - Исходный язык (по умолчанию 'ru')
 * @returns {Promise<string>} - Переведенный текст
 */
export const translateDynamicContent = async (
  text,
  lang = 'ru',
  sourceLang = 'ru'
) => {
  // Если язык русский или текст пустой, возвращаем оригинал
  if (lang === 'ru' || lang === sourceLang || !text || !text.trim()) {
    return text
  }

  // Динамически импортируем функцию перевода
  try {
    const { translateText } = await import('./translate.js')
    return await translateText(text, lang, sourceLang)
  } catch (error) {
    console.error('Error importing translate utility:', error)
    return text
  }
}

/**
 * Хук для использования переводов с поддержкой автоматического перевода динамического контента
 */
export const useTranslationWithAI = (lang = 'ru') => {
  return {
    t: (key, replacements) => t(key, lang, replacements),
    translateDynamic: (text, sourceLang = 'ru') => translateDynamicContent(text, lang, sourceLang),
    lang
  }
}

export default translations

