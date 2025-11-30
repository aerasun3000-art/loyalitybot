import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useLanguageStore from '../store/languageStore';
import { hapticFeedback } from '../utils/telegram';
import { supabase } from '../services/supabase';

// Переводы
const translations = {
  en: {
    badge: '🎁 LIMITED TIME: Early Bird Offer for New York',
    title: '🗽 Exclusive Partner Program',
    subtitle: 'New York Only',
    description: 'Become the exclusive partner for your service type in your district.',
    description2: 'No competition. Maximum revenue. Full control.',
    first20: 'FIRST 20 PARTNERS',
    perMonth: 'per month',
    regular: 'Regular: $99/month',
    save: 'Save $70! 🎉',
    after20: 'AFTER 20 PARTNERS',
    standard: 'Standard pricing',
    slotsRemaining: 'Only {count} Early Bird slots remaining!',
    partnersJoined: '{count} partners already joined',
    claimSpot: '🚀 Claim Your Spot Now',
    learnMore: 'Learn More ↓',
    exclusivityTitle: '👑 What is Exclusive Partnership?',
    exclusivityDesc: "In each of New York's 10 districts, for each of 12 service types, there can be only ONE partner.",
    exclusivityDesc2: 'You become the monopoly in your niche and territory.',
    territoryProtection: 'Territory Protection',
    territoryProtectionDesc: 'No other partner can offer the same service type in your district. You own the market.',
    maxRevenue: 'Maximum Revenue',
    maxRevenueDesc: 'All customers looking for your service in your district will find only you. No competition means higher prices and more clients.',
    revenueShare: 'Revenue Share',
    revenueShareDesc: 'Earn from partners you refer. Build your network and get passive income from their success.',
    masterPartner: 'Master Partner Status',
    masterPartnerDesc: 'Become a Master Partner in your district and coordinate the development of your territory.',
    districtsTitle: '🗺️ 10 Districts of New York',
    servicesTitle: '💅 12 Service Types Available',
    totalPositions: '120 total exclusive positions',
    positionsDesc: '(10 districts × 12 services)',
    eachPosition: 'Each position can have only ONE partner',
    howItWorks: '🔄 How It Works',
    step1Title: 'Choose Your Spot',
    step1Desc: 'Select your district and service type. If available, it\'s yours exclusively.',
    step2Title: 'Early Bird Pricing',
    step2Desc: 'First 20 partners pay only $29/month. After that, it\'s $99/month.',
    step3Title: 'Get Exclusive Rights',
    step3Desc: 'You become the only partner for your service in your district. No competition.',
    step4Title: 'Grow Your Business',
    step4Desc: 'Build your client base, earn revenue share, and become a Master Partner.',
    whyJoin: '✨ Why Join Now?',
    earlyBirdDiscount: 'Early Bird Discount',
    earlyBirdDiscountDesc: 'Save $70 per month if you\'re among the first 20 partners. Limited time offer!',
    exclusiveTerritory: 'Exclusive Territory',
    exclusiveTerritoryDesc: 'No competition in your district for your service type. You own the market.',
    analytics: 'Full Analytics Dashboard',
    analyticsDesc: 'Track your revenue, clients, and performance in real-time.',
    revenueShareProgram: 'Revenue Share Program',
    revenueShareProgramDesc: 'Earn passive income from partners you refer. Build your network.',
    telegramBot: 'Telegram Bot Integration',
    telegramBotDesc: 'Manage your loyalty program directly from Telegram. Easy and convenient.',
    fastSetup: 'Fast Setup',
    fastSetupDesc: 'Get started in 15 minutes. No complex integrations needed.',
    pricingDetails: '💎 Pricing Details',
    earlyBirdPlan: 'Early Bird',
    limited: 'LIMITED',
    premiumPlan: 'Premium',
    exclusiveRights: 'Exclusive territory rights',
    fullAccess: 'Full platform access',
    revenueShareFeature: 'Revenue share program',
    analyticsFeature: 'Analytics dashboard',
    telegramFeature: 'Telegram bot integration',
    support24: '24/7 support',
    onlyFirst20: '⏰ Only for first 20 partners in New York',
    standardPricing: 'Standard pricing after Early Bird slots are filled',
    allFeatures: '✅ All features included in both plans',
    onlyPriceDiff: 'The only difference is the price. Early Bird saves you $70 per month!',
    finalTitle: 'Ready to Claim Your Exclusive Territory?',
    finalDesc: 'Join the first 20 partners and save $70 per month',
    finalDesc2: 'Become the exclusive partner in your district',
    slotsLeft: '{count} Early Bird slots left!',
    dontMiss: 'Don\'t miss your chance to save $70/month',
    applyNow: '🚀 Apply Now - Claim Your Spot',
    noHiddenFees: '✅ No hidden fees • ✅ Cancel anytime • ✅ Full refund if not approved',
    roiCalculator: '💰 ROI Calculator',
    roiCalculatorDesc: 'Calculate how much you can earn with our loyalty program',
    monthlyClients: 'Monthly clients',
    averageCheck: 'Average check',
    currentRetention: 'Current return rate',
    percent: '%',
    yourResults: 'Your Results',
    additionalClients: 'Additional clients per month',
    additionalRevenue: 'Additional revenue per month',
    programCost: 'Program cost',
    monthlyCost: 'per month',
    netProfit: 'Net profit per month',
    roi: 'ROI',
    calculate: 'Calculate',
    retentionIncrease: 'Return rate with program',
    basedOnResearch: 'Based on research: loyalty programs increase customer return by 20-40%',
    additionalProfitHint: 'This is additional profit every month!',
    availabilityMap: '🗺️ Availability Map',
    availabilityMapDesc: 'See which positions are available in real-time',
    available: 'Available',
    taken: 'Taken',
    pending: 'Pending',
    clickToApply: 'Click to apply',
    positionAvailable: 'Position Available',
    positionTaken: 'Position Taken',
    positionPending: 'Under Review',
    showAvailability: 'Show Availability Map',
    hideAvailability: 'Hide Availability Map',
  },
  ru: {
    badge: '🎁 ОГРАНИЧЕННОЕ ВРЕМЯ: Раннее предложение для Нью-Йорка',
    title: '🗽 Эксклюзивная Партнерская Программа',
    subtitle: 'Только Нью-Йорк',
    description: 'Станьте эксклюзивным партнером для вашего вида услуг в вашем районе.',
    description2: 'Без конкуренции. Максимальный доход. Полный контроль.',
    first20: 'ПЕРВЫЕ 20 ПАРТНЕРОВ',
    perMonth: 'в месяц',
    regular: 'Обычно: $99/месяц',
    save: 'Экономия $70! 🎉',
    after20: 'ПОСЛЕ 20 ПАРТНЕРОВ',
    standard: 'Стандартная цена',
    slotsRemaining: '⏰ Осталось только {count} мест по раннему предложению!',
    partnersJoined: '{count} партнеров уже присоединились',
    claimSpot: '🚀 Забронировать место сейчас',
    learnMore: 'Узнать больше ↓',
    exclusivityTitle: '👑 Что такое Эксклюзивное Партнерство?',
    exclusivityDesc: 'В каждом из 10 районов Нью-Йорка, для каждого из 12 видов услуг может быть только ОДИН партнер.',
    exclusivityDesc2: 'Вы становитесь монополистом в своей нише и на своей территории.',
    territoryProtection: 'Защита Территории',
    territoryProtectionDesc: 'Никто другой не может предложить тот же вид услуг в вашем районе. Вы владеете рынком.',
    maxRevenue: 'Максимальный Доход',
    maxRevenueDesc: 'Все клиенты, ищущие вашу услугу в вашем районе, найдут только вас. Нет конкуренции — значит выше цены и больше клиентов.',
    revenueShare: 'Revenue Share',
    revenueShareDesc: 'Зарабатывайте от партнеров, которых вы пригласили. Стройте свою сеть и получайте пассивный доход от их успеха.',
    masterPartner: 'Статус Мастер-Партнера',
    masterPartnerDesc: 'Станьте Мастер-Партнером в своем районе и координируйте развитие своей территории.',
    districtsTitle: '🗺️ 10 Районов Нью-Йорка',
    servicesTitle: '💅 12 Видов Услуг Доступно',
    totalPositions: '120 эксклюзивных позиций всего',
    positionsDesc: '(10 районов × 12 услуг)',
    eachPosition: 'Каждая позиция может иметь только ОДНОГО партнера',
    howItWorks: '🔄 Как Это Работает',
    step1Title: 'Выберите Ваше Место',
    step1Desc: 'Выберите район и вид услуг. Если доступно — оно ваше эксклюзивно.',
    step2Title: 'Раннее Предложение',
    step2Desc: 'Первые 20 партнеров платят только $29/месяц. После этого — $99/месяц.',
    step3Title: 'Получите Эксклюзивные Права',
    step3Desc: 'Вы становитесь единственным партнером для вашей услуги в вашем районе. Без конкуренции.',
    step4Title: 'Развивайте Свой Бизнес',
    step4Desc: 'Стройте клиентскую базу, зарабатывайте revenue share и становитесь Мастер-Партнером.',
    whyJoin: '✨ Почему Стоит Присоединиться Сейчас?',
    earlyBirdDiscount: 'Скидка Раннего Предложения',
    earlyBirdDiscountDesc: 'Экономьте $70 в месяц, если вы среди первых 20 партнеров. Ограниченное предложение!',
    exclusiveTerritory: 'Эксклюзивная Территория',
    exclusiveTerritoryDesc: 'Нет конкуренции в вашем районе для вашего вида услуг. Вы владеете рынком.',
    analytics: 'Полный Аналитический Дашборд',
    analyticsDesc: 'Отслеживайте доход, клиентов и показатели в реальном времени.',
    revenueShareProgram: 'Программа Revenue Share',
    revenueShareProgramDesc: 'Зарабатывайте пассивный доход от партнеров, которых вы пригласили. Стройте свою сеть.',
    telegramBot: 'Интеграция с Telegram Ботом',
    telegramBotDesc: 'Управляйте программой лояльности прямо из Telegram. Легко и удобно.',
    fastSetup: 'Быстрая Настройка',
    fastSetupDesc: 'Начните за 15 минут. Никаких сложных интеграций.',
    pricingDetails: '💎 Детали Ценообразования',
    earlyBirdPlan: 'Раннее Предложение',
    limited: 'ОГРАНИЧЕНО',
    premiumPlan: 'Премиум',
    exclusiveRights: 'Эксклюзивные права на территорию',
    fullAccess: 'Полный доступ к платформе',
    revenueShareFeature: 'Программа revenue share',
    analyticsFeature: 'Аналитический дашборд',
    telegramFeature: 'Интеграция с Telegram ботом',
    support24: 'Поддержка 24/7',
    onlyFirst20: '⏰ Только для первых 20 партнеров в Нью-Йорке',
    standardPricing: 'Стандартная цена после заполнения мест по раннему предложению',
    allFeatures: '✅ Все функции включены в оба тарифа',
    onlyPriceDiff: 'Единственная разница — цена. Раннее предложение экономит вам $70 в месяц!',
    finalTitle: 'Готовы Забронировать Свою Эксклюзивную Территорию?',
    finalDesc: 'Присоединяйтесь к первым 20 партнерам и экономьте $70 в месяц',
    finalDesc2: 'Станьте эксклюзивным партнером в своем районе',
    slotsLeft: '⏰ Осталось {count} мест по раннему предложению!',
    dontMiss: 'Не упустите возможность сэкономить $70/месяц',
    applyNow: '🚀 Подать Заявку - Забронировать Место',
    noHiddenFees: '✅ Без скрытых платежей • ✅ Отмена в любое время • ✅ Полный возврат при отклонении',
    roiCalculator: '💰 Калькулятор Выгоды',
    roiCalculatorDesc: 'Рассчитайте, сколько вы можете заработать с нашей программой лояльности',
    monthlyClients: 'Клиентов в месяц',
    averageCheck: 'Средний чек',
    currentRetention: 'Текущий % возврата клиентов',
    percent: '%',
    yourResults: 'Ваша Выгода',
    additionalClients: 'Дополнительных клиентов в месяц',
    additionalRevenue: 'Дополнительная выручка в месяц',
    programCost: 'Стоимость программы',
    monthlyCost: 'в месяц',
    netProfit: 'Чистая прибыль в месяц',
    roi: 'ROI',
    calculate: 'Рассчитать',
    retentionIncrease: 'Процент возврата с программой',
    basedOnResearch: 'По данным исследований: программы лояльности увеличивают возврат клиентов на 20-40%',
    additionalProfitHint: 'Это дополнительная прибыль каждый месяц!',
    availabilityMap: '🗺️ Карта Доступности',
    availabilityMapDesc: 'Увидьте, какие позиции доступны в реальном времени',
    available: 'Свободно',
    taken: 'Занято',
    pending: 'На рассмотрении',
    clickToApply: 'Нажмите, чтобы подать заявку',
    positionAvailable: 'Позиция Свободна',
    positionTaken: 'Позиция Занята',
    positionPending: 'На Рассмотрении',
    showAvailability: 'Показать Карту Доступности',
    hideAvailability: 'Скрыть Карту Доступности',
  }
};

const OnePagerPartner = () => {
  const { language, toggleLanguage } = useLanguageStore();
  const [earlyBirdCount, setEarlyBirdCount] = useState(null);
  const [remainingSlots, setRemainingSlots] = useState(null);
  
  const t = (key, params = {}) => {
    let text = translations[language]?.[key] || translations.en[key] || key;
    // Заменяем параметры
    Object.keys(params).forEach(param => {
      text = text.replace(`{${param}}`, params[param]);
    });
    return text;
  };

  useEffect(() => {
    // Здесь можно добавить API вызов для получения актуального количества
    // Пока используем заглушку
    setEarlyBirdCount(0);
    setRemainingSlots(20);
  }, []);

  const handleLanguageToggle = () => {
    hapticFeedback('light');
    toggleLanguage();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sakura-light via-white to-sakura-cream">
      {/* Переключатель языка */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={handleLanguageToggle}
          className="flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg border-2 border-sakura-mid/30 hover:border-sakura-mid transition-colors"
        >
          <span className="text-xl">{language === 'ru' ? '🇷🇺' : '🇬🇧'}</span>
          <span className="font-bold text-sakura-dark">{language === 'ru' ? 'RU' : 'EN'}</span>
        </button>
      </div>

      {/* Герой-секция с ранним предложением */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-sakura-mid to-sakura-dark opacity-10"></div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative">
          <div className="text-center">
            {/* Бейдж раннего предложения */}
            <div className="inline-block mb-6 px-6 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-full font-bold text-lg animate-pulse">
              {t('badge')}
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold text-sakura-dark mb-6">
              {t('title')}
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sakura-mid to-sakura-dark">
                {t('subtitle')}
              </span>
            </h1>
            
            <p className="text-2xl text-sakura-dark/80 mb-8 max-w-3xl mx-auto">
              {t('description')}
              <br />
              <span className="text-xl text-sakura-mid">{t('description2')}</span>
            </p>

            {/* Цены */}
            <div className="flex gap-6 justify-center flex-wrap mb-8">
              <div className="bg-white rounded-2xl p-8 shadow-2xl border-4 border-red-400 transform scale-105">
                <div className="text-sm text-red-600 font-bold mb-2">{t('first20')}</div>
                <div className="text-6xl font-bold text-sakura-dark mb-2">$29</div>
                <div className="text-xl text-gray-600 mb-4">{t('perMonth')}</div>
                <div className="text-sm text-gray-500 line-through mb-2">{t('regular')}</div>
                <div className="text-green-600 font-bold">{t('save')}</div>
              </div>
              
              <div className="bg-white rounded-2xl p-8 shadow-xl border-2 border-gray-300">
                <div className="text-sm text-gray-600 font-bold mb-2">{t('after20')}</div>
                <div className="text-6xl font-bold text-sakura-dark mb-2">$99</div>
                <div className="text-xl text-gray-600 mb-4">{t('perMonth')}</div>
                <div className="text-sm text-gray-500">{t('standard')}</div>
              </div>
            </div>

            {/* Счетчик оставшихся мест */}
            {remainingSlots !== null && remainingSlots > 0 && (
              <div className="bg-yellow-100 border-2 border-yellow-400 rounded-xl p-4 mb-8 inline-block">
                <div className="text-2xl font-bold text-yellow-800">
                  {t('slotsRemaining', { count: remainingSlots })}
                </div>
                <div className="text-lg text-yellow-700 mt-2">
                  {t('partnersJoined', { count: earlyBirdCount || 0 })}
                </div>
              </div>
            )}

            <div className="flex gap-4 justify-center flex-wrap">
              <a 
                href="/partner/apply" 
                className="px-10 py-5 bg-gradient-to-r from-sakura-mid to-sakura-dark text-white rounded-xl font-bold text-xl hover:shadow-2xl transition-all transform hover:scale-105"
              >
                {t('claimSpot')}
              </a>
              <a 
                href="#how-it-works" 
                className="px-10 py-5 bg-white text-sakura-dark rounded-xl font-bold text-xl border-2 border-sakura-mid hover:bg-sakura-light transition-colors"
              >
                {t('learnMore')}
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Что такое эксклюзивность */}
      <div className="bg-white py-16" id="exclusivity">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl md:text-5xl font-bold text-center text-sakura-dark mb-4">
            {t('exclusivityTitle')}
          </h2>
          <p className="text-xl text-center text-gray-600 mb-12 max-w-3xl mx-auto">
            {t('exclusivityDesc')}
            <br />
            <span className="text-lg text-sakura-mid">{t('exclusivityDesc2')}</span>
          </p>
          
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <ExclusivityCard
              icon="🎯"
              title={t('territoryProtection')}
              description={t('territoryProtectionDesc')}
            />
            <ExclusivityCard
              icon="💰"
              title={t('maxRevenue')}
              description={t('maxRevenueDesc')}
            />
            <ExclusivityCard
              icon="📈"
              title={t('revenueShare')}
              description={t('revenueShareDesc')}
            />
            <ExclusivityCard
              icon="🏆"
              title={t('masterPartner')}
              description={t('masterPartnerDesc')}
            />
          </div>

          {/* 10 районов */}
          <div className="bg-gradient-to-r from-sakura-light to-sakura-cream rounded-2xl p-8 mb-8">
            <h3 className="text-3xl font-bold text-center text-sakura-dark mb-6">
              {t('districtsTitle')}
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                'Manhattan Downtown',
                'Manhattan Midtown',
                'Manhattan Upper East',
                'Manhattan Upper West',
                'Brooklyn Downtown',
                'Brooklyn North',
                'Brooklyn South + S.I.',
                'Queens West + Bronx South',
                'Queens East',
                'Brooklyn Central'
              ].map((district, idx) => (
                <div key={idx} className="bg-white rounded-lg p-4 text-center shadow-sm">
                  <div className="text-sm font-bold text-sakura-dark">{district}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 12 видов услуг */}
          <div className="bg-gradient-to-r from-sakura-cream to-sakura-light rounded-2xl p-8">
            <h3 className="text-3xl font-bold text-center text-sakura-dark mb-6">
              {t('servicesTitle')}
            </h3>
            <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[
                { emoji: '💅', name: 'Nail Care' },
                { emoji: '👁️', name: 'Brow Design' },
                { emoji: '💇‍♀️', name: 'Hair Salon' },
                { emoji: '⚡', name: 'Hair Removal' },
                { emoji: '✨', name: 'Facial Aesthetics' },
                { emoji: '👀', name: 'Lash Services' },
                { emoji: '💆‍♀️', name: 'Massage Therapy' },
                { emoji: '💄', name: 'Make-up & PMU' },
                { emoji: '🌸', name: 'Body Wellness' },
                { emoji: '🍎', name: 'Nutrition Coaching' },
                { emoji: '🧠', name: 'Mindfulness & Coaching' },
                { emoji: '👗', name: 'Image Consulting' }
              ].map((service, idx) => (
                <div key={idx} className="bg-white rounded-lg p-4 text-center shadow-sm hover:shadow-md transition-shadow">
                  <div className="text-3xl mb-2">{service.emoji}</div>
                  <div className="text-sm font-medium text-sakura-dark">{service.name}</div>
                </div>
              ))}
            </div>
            <p className="text-center text-gray-600 mt-6">
              <strong>{t('totalPositions')}</strong> {t('positionsDesc')}
              <br />
              <span className="text-sakura-mid">{t('eachPosition')}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Карта доступности - простая визуализация */}
      <div className="bg-white py-16" id="availability">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <SimpleAvailabilityHeatmap t={t} language={language} />
        </div>
      </div>

      {/* Ссылка на полную карту */}
      <div className="bg-gradient-to-r from-sakura-mid/10 to-sakura-dark/10 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <a
            href="/availability-map"
            className="inline-block px-8 py-4 bg-gradient-to-r from-sakura-mid to-sakura-dark text-white rounded-xl font-bold text-lg hover:shadow-xl transition-all transform hover:scale-105"
          >
            🗺️ {language === 'ru' ? 'Открыть Полную Карту Доступности' : 'Open Full Availability Map'}
          </a>
        </div>
      </div>

      {/* Как это работает */}
      <div className="bg-gradient-to-br from-sakura-light to-white py-16" id="how-it-works">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl md:text-5xl font-bold text-center text-sakura-dark mb-12">
            {t('howItWorks')}
          </h2>
          
          <div className="grid md:grid-cols-4 gap-8">
            <StepCard
              number="1"
              title={t('step1Title')}
              description={t('step1Desc')}
            />
            <StepCard
              number="2"
              title={t('step2Title')}
              description={t('step2Desc')}
            />
            <StepCard
              number="3"
              title={t('step3Title')}
              description={t('step3Desc')}
            />
            <StepCard
              number="4"
              title={t('step4Title')}
              description={t('step4Desc')}
            />
          </div>
        </div>
      </div>

      {/* Преимущества */}
      <div className="bg-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl md:text-5xl font-bold text-center text-sakura-dark mb-12">
            {t('whyJoin')}
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <BenefitCard
              icon="🎁"
              title={t('earlyBirdDiscount')}
              description={t('earlyBirdDiscountDesc')}
            />
            <BenefitCard
              icon="👑"
              title={t('exclusiveTerritory')}
              description={t('exclusiveTerritoryDesc')}
            />
            <BenefitCard
              icon="📊"
              title={t('analytics')}
              description={t('analyticsDesc')}
            />
            <BenefitCard
              icon="🤝"
              title={t('revenueShareProgram')}
              description={t('revenueShareProgramDesc')}
            />
            <BenefitCard
              icon="💬"
              title={t('telegramBot')}
              description={t('telegramBotDesc')}
            />
            <BenefitCard
              icon="🚀"
              title={t('fastSetup')}
              description={t('fastSetupDesc')}
            />
          </div>
        </div>
      </div>

      {/* ROI Калькулятор */}
      <div className="bg-gradient-to-br from-sakura-light to-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <ROICalculator t={t} language={language} />
        </div>
      </div>

      {/* Цены детально */}
      <div className="bg-gradient-to-r from-sakura-mid/10 to-sakura-dark/10 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-sakura-dark mb-12">
            {t('pricingDetails')}
          </h2>
          
          <div className="bg-white rounded-2xl p-8 shadow-2xl">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="border-r border-gray-200 pr-8">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">🎁</span>
                  <h3 className="text-2xl font-bold text-sakura-dark">{t('earlyBirdPlan')}</h3>
                  <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">{t('limited')}</span>
                </div>
                <div className="text-5xl font-bold text-sakura-dark mb-2">$29</div>
                <div className="text-lg text-gray-600 mb-6">{t('perMonth')}</div>
                <ul className="space-y-3">
                  <ConditionItem text={t('exclusiveRights')} />
                  <ConditionItem text={t('fullAccess')} />
                  <ConditionItem text={t('revenueShareFeature')} />
                  <ConditionItem text={t('analyticsFeature')} />
                  <ConditionItem text={t('telegramFeature')} />
                  <ConditionItem text={t('support24')} />
                </ul>
                <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="text-sm font-bold text-yellow-800">
                    {t('onlyFirst20')}
                  </div>
                </div>
              </div>
              
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">💎</span>
                  <h3 className="text-2xl font-bold text-sakura-dark">{t('premiumPlan')}</h3>
                </div>
                <div className="text-5xl font-bold text-sakura-dark mb-2">$99</div>
                <div className="text-lg text-gray-600 mb-6">{t('perMonth')}</div>
                <ul className="space-y-3">
                  <ConditionItem text={t('exclusiveRights')} />
                  <ConditionItem text={t('fullAccess')} />
                  <ConditionItem text={t('revenueShareFeature')} />
                  <ConditionItem text={t('analyticsFeature')} />
                  <ConditionItem text={t('telegramFeature')} />
                  <ConditionItem text={t('support24')} />
                </ul>
                <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="text-sm text-gray-600">
                    {t('standardPricing')}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-8 pt-8 border-t border-gray-200">
              <div className="text-center">
                <div className="text-lg font-bold text-sakura-dark mb-2">
                  {t('allFeatures')}
                </div>
                <div className="text-gray-600">
                  {t('onlyPriceDiff')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA финальный */}
      <div className="bg-gradient-to-r from-sakura-mid to-sakura-dark py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-5xl font-bold text-white mb-6">
            {t('finalTitle')}
          </h2>
          <p className="text-2xl text-white/90 mb-8">
            {t('finalDesc')}
            <br />
            <span className="text-xl">{t('finalDesc2')}</span>
          </p>
          
          {remainingSlots !== null && remainingSlots > 0 && (
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 mb-8 inline-block">
              <div className="text-3xl font-bold text-white mb-2">
                {t('slotsLeft', { count: remainingSlots })}
              </div>
              <div className="text-lg text-white/90">
                {t('dontMiss')}
              </div>
            </div>
          )}
          
          <a 
            href="/partner/apply" 
            className="inline-block px-12 py-6 bg-white text-sakura-dark rounded-xl font-bold text-2xl hover:shadow-2xl transition-all transform hover:scale-105"
          >
            {t('applyNow')}
          </a>
          
          <div className="mt-8 text-white/80 text-lg">
            {t('noHiddenFees')}
          </div>
        </div>
      </div>
    </div>
  );
};

// Компонент простой визуализации доступности
const SimpleAvailabilityHeatmap = ({ t, language }) => {
  const navigate = useNavigate();
  const [availability, setAvailability] = useState({});
  const [loading, setLoading] = useState(true);
  const [showMap, setShowMap] = useState(false);

  const DISTRICTS = [
    'Manhattan Downtown',
    'Manhattan Midtown',
    'Manhattan Upper East',
    'Manhattan Upper West',
    'Brooklyn Downtown',
    'Brooklyn North',
    'Brooklyn South + S.I.',
    'Queens West + Bronx South',
    'Queens East',
    'Brooklyn Central'
  ];

  const SERVICES = [
    { id: 'nail_care', emoji: '💅', name: 'Nail Care' },
    { id: 'brow_design', emoji: '👁️', name: 'Brow Design' },
    { id: 'hair_salon', emoji: '💇‍♀️', name: 'Hair Salon' },
    { id: 'hair_removal', emoji: '⚡', name: 'Hair Removal' },
    { id: 'facial_aesthetics', emoji: '✨', name: 'Facial Aesthetics' },
    { id: 'lash_services', emoji: '👀', name: 'Lash Services' },
    { id: 'massage_therapy', emoji: '💆‍♀️', name: 'Massage Therapy' },
    { id: 'makeup_pmu', emoji: '💄', name: 'Make-up & PMU' },
    { id: 'body_wellness', emoji: '🌸', name: 'Body Wellness' },
    { id: 'nutrition_coaching', emoji: '🍎', name: 'Nutrition Coaching' },
    { id: 'mindfulness_coaching', emoji: '🧠', name: 'Mindfulness & Coaching' },
    { id: 'image_consulting', emoji: '👗', name: 'Image Consulting' }
  ];

  useEffect(() => {
    if (showMap) {
      fetchAvailability();
    }
  }, [showMap]);

  const fetchAvailability = async () => {
    try {
      setLoading(true);
      
      // Запрос к Supabase напрямую через REST API
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/partners?select=district,business_type,status&city=eq.New York&district=not.is.null&business_type=not.is.null`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch availability');
      }

      const partners = await response.json();
      
      // Формируем карту доступности
      const availMap = {};
      DISTRICTS.forEach(district => {
        availMap[district] = {};
        SERVICES.forEach(service => {
          const partner = partners.find(
            p => p.district === district && p.business_type === service.id
          );
          
          if (partner) {
            if (partner.status === 'Approved') {
              availMap[district][service.id] = 'taken';
            } else {
              availMap[district][service.id] = 'pending';
            }
          } else {
            availMap[district][service.id] = 'available';
          }
        });
      });

      setAvailability(availMap);
    } catch (error) {
      console.error('Error fetching availability:', error);
      // В случае ошибки показываем все как available
      const availMap = {};
      DISTRICTS.forEach(district => {
        availMap[district] = {};
        SERVICES.forEach(service => {
          availMap[district][service.id] = 'available';
        });
      });
      setAvailability(availMap);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'taken':
        return 'bg-red-100 border-red-400';
      case 'pending':
        return 'bg-yellow-100 border-yellow-400';
      case 'available':
        return 'bg-green-100 border-green-400';
      default:
        return 'bg-gray-100 border-gray-400';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'taken':
        return '✗';
      case 'pending':
        return '⏳';
      case 'available':
        return '✓';
      default:
        return '';
    }
  };

  const handleCellClick = (district, service) => {
    const status = availability[district]?.[service.id];
    if (status === 'available') {
      window.location.href = `/partner/apply?district=${encodeURIComponent(district)}&service=${encodeURIComponent(service.id)}`;
    }
  };

  return (
    <div className="text-center">
      <h2 className="text-4xl md:text-5xl font-bold text-sakura-dark mb-4">
        {t('availabilityMap')}
      </h2>
      <p className="text-lg text-gray-600 mb-6">
        {t('availabilityMapDesc')}
      </p>

      {!showMap ? (
        <button
          onClick={() => setShowMap(true)}
          className="px-8 py-4 bg-gradient-to-r from-sakura-mid to-sakura-dark text-white rounded-xl font-bold text-lg hover:shadow-xl transition-all transform hover:scale-105"
        >
          {t('showAvailability')}
        </button>
      ) : (
        <>
          <button
            onClick={() => setShowMap(false)}
            className="mb-6 px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
          >
            {t('hideAvailability')}
          </button>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-sakura-dark"></div>
              <p className="mt-4 text-gray-600">{language === 'ru' ? 'Загрузка...' : 'Loading...'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto mt-6">
              <div className="inline-block min-w-full">
                {/* Таблица доступности */}
                <div className="inline-block border border-gray-200 rounded-lg overflow-hidden">
                  <table className="min-w-full">
                    <thead>
                      <tr>
                        <th className="bg-gray-50 p-3 text-left font-bold text-sm text-sakura-dark border-b">Район</th>
                        {SERVICES.map(service => (
                          <th
                            key={service.id}
                            className="bg-gray-50 p-2 text-center font-medium text-xs text-sakura-dark border-b"
                            title={service.name}
                          >
                            <div className="text-xl mb-1">{service.emoji}</div>
                            <div className="hidden md:block text-xs">{service.name.split(' ')[0]}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {DISTRICTS.map(district => (
                        <tr key={district} className="hover:bg-gray-50">
                          <td className="p-3 font-bold text-sm text-sakura-dark border-b">
                            <div className="truncate max-w-[150px]">{district}</div>
                          </td>
                          {SERVICES.map(service => {
                            const status = availability[district]?.[service.id] || 'available';
                            const isClickable = status === 'available';
                            
                            return (
                              <td
                                key={service.id}
                                className={`
                                  p-2 border-b
                                  ${getStatusColor(status)}
                                  ${isClickable ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}
                                `}
                                onClick={() => isClickable && handleCellClick(district, service)}
                                title={`${district} - ${service.name}: ${status}`}
                              >
                                <div className="h-10 w-10 rounded-lg flex items-center justify-center mx-auto">
                                  <span className="text-xl">{getStatusIcon(status)}</span>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Легенда */}
          <div className="mt-8 flex flex-wrap gap-6 justify-center text-sm">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-green-100 border-2 border-green-400 rounded"></div>
              <span>{t('available')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-yellow-100 border-2 border-yellow-400 rounded"></div>
              <span>{t('pending')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-red-100 border-2 border-red-400 rounded"></div>
              <span>{t('taken')}</span>
            </div>
          </div>

          <p className="mt-4 text-gray-500 text-sm">
            {t('clickToApply')}
          </p>

          {/* Ссылка на полную карту */}
          <div className="mt-6">
            <button
              onClick={() => navigate('/availability-map')}
              className="inline-block px-6 py-3 bg-gradient-to-r from-sakura-mid to-sakura-dark text-white rounded-lg font-bold hover:shadow-lg transition-all transform hover:scale-105"
            >
              🗺️ {language === 'ru' ? 'Открыть Полную Карту' : 'Open Full Map'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// Компонент ROI Калькулятора
const ROICalculator = ({ t, language }) => {
  const [monthlyClients, setMonthlyClients] = useState(50);
  const [averageCheck, setAverageCheck] = useState(100);
  const [currentRetention, setCurrentRetention] = useState(30);

  const calculateROI = () => {
    // Программа лояльности увеличивает возврат клиентов на 20-40%
    // Используем консервативную оценку в 25%
    const retentionIncrease = 25;
    const newRetention = Math.min(currentRetention + retentionIncrease, 100);
    
    // Текущие повторные клиенты
    const currentRepeatClients = monthlyClients * (currentRetention / 100);
    
    // Новые повторные клиенты с программой
    const newRepeatClients = monthlyClients * (newRetention / 100);
    
    // Дополнительные повторные клиенты
    const additionalRepeatClients = newRepeatClients - currentRepeatClients;
    
    // Дополнительная выручка (дополнительные клиенты × средний чек)
    const additionalRevenue = additionalRepeatClients * averageCheck;
    
    // Стоимость программы (Early Bird)
    const monthlyCost = 29;
    
    // Чистая прибыль
    const netProfit = additionalRevenue - monthlyCost;
    
    // ROI в процентах
    const roi = monthlyCost > 0 ? ((netProfit / monthlyCost) * 100) : 0;
    
    return {
      newRetention: Math.round(newRetention),
      currentRepeatClients: Math.round(currentRepeatClients),
      newRepeatClients: Math.round(newRepeatClients),
      additionalClients: Math.round(additionalRepeatClients),
      additionalRevenue: Math.round(additionalRevenue),
      monthlyCost,
      netProfit: Math.round(netProfit),
      roi: Math.round(roi)
    };
  };

  const roi = calculateROI();

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="bg-white rounded-2xl p-8 shadow-2xl border-2 border-sakura-mid/20">
      <div className="text-center mb-8">
        <h2 className="text-4xl md:text-5xl font-bold text-sakura-dark mb-4">
          {t('roiCalculator')}
        </h2>
        <p className="text-lg text-gray-600">
          {t('roiCalculatorDesc')}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Левая часть - Ввод данных */}
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-sakura-dark mb-2">
              {t('monthlyClients')}
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                max="10000"
                value={monthlyClients}
                onChange={(e) => setMonthlyClients(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full border-2 border-sakura-mid/30 rounded-xl px-4 py-3 text-lg focus:border-sakura-mid focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-sakura-dark mb-2">
              {t('averageCheck')} ($)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-3 text-gray-500">$</span>
              <input
                type="number"
                min="1"
                max="10000"
                value={averageCheck}
                onChange={(e) => setAverageCheck(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full border-2 border-sakura-mid/30 rounded-xl px-4 py-3 pl-8 text-lg focus:border-sakura-mid focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-sakura-dark mb-2">
              {t('currentRetention')} ({t('percent')})
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                value={currentRetention}
                onChange={(e) => setCurrentRetention(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                className="w-full border-2 border-sakura-mid/30 rounded-xl px-4 py-3 text-lg focus:border-sakura-mid focus:outline-none transition-colors"
              />
              <span className="absolute right-4 top-3 text-gray-500">%</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {t('basedOnResearch')}
            </p>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600 mb-2">
              <strong>{t('retentionIncrease')}:</strong> {roi.newRetention}%
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-sakura-mid to-sakura-dark h-full transition-all duration-300"
                style={{ width: `${roi.newRetention}%` }}
              />
            </div>
          </div>
        </div>

        {/* Правая часть - Результаты */}
        <div className="bg-gradient-to-br from-sakura-light to-sakura-cream rounded-xl p-6 space-y-4">
          <h3 className="text-2xl font-bold text-sakura-dark mb-4">
            {t('yourResults')}
          </h3>

          <div className="space-y-3">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-sm text-gray-600 mb-1">
                {t('additionalClients')}
              </div>
              <div className="text-2xl font-bold text-sakura-dark">
                +{roi.additionalClients}
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-sm text-gray-600 mb-1">
                {t('additionalRevenue')}
              </div>
              <div className="text-2xl font-bold text-green-600">
                +{formatCurrency(roi.additionalRevenue)}
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-sm text-gray-600 mb-1">
                {t('programCost')} ({t('monthlyCost')})
              </div>
              <div className="text-2xl font-bold text-sakura-dark">
                {formatCurrency(roi.monthlyCost)}
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4 border-2 border-green-300">
              <div className="text-sm text-green-700 mb-1 font-bold">
                {t('netProfit')}
              </div>
              <div className="text-3xl font-bold text-green-600">
                {formatCurrency(roi.netProfit)}
              </div>
              <div className="text-sm text-green-600 mt-2">
                {t('roi')}: {roi.roi > 0 ? '+' : ''}{roi.roi}%
              </div>
            </div>
          </div>

          {roi.netProfit > 0 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                💡 {t('additionalProfitHint')}
              </p>
            </div>
          )}

          <a 
            href="/partner/apply" 
            className="block w-full mt-6 px-6 py-4 bg-gradient-to-r from-sakura-mid to-sakura-dark text-white rounded-xl font-bold text-center hover:shadow-xl transition-all transform hover:scale-105"
          >
            {t('applyNow')}
          </a>
        </div>
      </div>
    </div>
  );
};

// Вспомогательные компоненты
const BenefitCard = ({ icon, title, description }) => (
  <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-lg transition-shadow border border-sakura-light">
    <div className="text-5xl mb-4">{icon}</div>
    <h3 className="text-xl font-bold text-sakura-dark mb-2">
      {title}
    </h3>
    <p className="text-gray-600">
      {description}
    </p>
  </div>
);

const StepCard = ({ number, title, description }) => (
  <div className="text-center">
    <div className="w-20 h-20 bg-gradient-to-r from-sakura-mid to-sakura-dark rounded-full flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4">
      {number}
    </div>
    <h3 className="text-xl font-bold text-sakura-dark mb-2">
      {title}
    </h3>
    <p className="text-gray-600">
      {description}
    </p>
  </div>
);

const ExclusivityCard = ({ icon, title, description }) => (
  <div className="bg-gradient-to-br from-sakura-light to-white rounded-xl p-6 shadow-sm border border-sakura-mid/20">
    <div className="text-4xl mb-3">{icon}</div>
    <h3 className="text-xl font-bold text-sakura-dark mb-2">
      {title}
    </h3>
    <p className="text-gray-600">
      {description}
    </p>
  </div>
);

const ConditionItem = ({ text }) => (
  <li className="flex items-center gap-2 text-gray-700">
    <span className="text-green-500 text-xl">✅</span>
    <span>{text}</span>
  </li>
);

export default OnePagerPartner;
