import { useState } from 'react';
import useLanguageStore from '../store/languageStore';
import { hapticFeedback } from '../utils/telegram';

const translations = {
  en: {
    title: '💰 Partner Income Model',
    subtitle: 'Real Example: Psychologist Partner',
    back: '← Back to Partner Page',
    scenario: 'Scenario',
    scenarioDesc: 'A psychologist partner builds their business and network',
    assumptions: 'Assumptions',
    personalIncome: 'Personal Income: 50% from transactions',
    clientBase: 'Client Base: 20 clients',
    clientSpend: 'Each client spends: $200/month minimum',
    partnerBase: 'Each partner has: 50 clients',
    recruitment: 'Recruitment commission: Recurring monthly for 1 year',
    timeline: 'Timeline',
    month1: 'Month 1',
    month2: 'Month 2',
    month3: 'Month 3',
    month4_7: 'Months 4-7',
    month8_19: 'Months 8-19',
    yearTotal: 'Year Total',
    incomeBreakdown: 'Income Breakdown',
    personalIncomeLabel: 'Personal Income',
    revenueShareLabel: 'Revenue Share',
    recruitmentLabel: 'Recruitment',
    totalIncome: 'Total Income',
    monthlyIncome: 'Monthly Income',
    networkStructure: 'Network Structure',
    level1: 'Level 1',
    level2: 'Level 2',
    level3: 'Level 3',
    partners: 'Partners',
    clients: 'Clients',
    systemRevenue: 'System Revenue',
    keyMetrics: 'Key Metrics',
    avgMonthly: 'Average Monthly (from month 8)',
    annualTotal: 'Annual Total',
    growth: 'Growth',
    networkGrowth: 'Network Growth',
    incomeGrowth: 'Income Growth',
    systemGrowth: 'System Revenue Growth',
    details: 'Details',
    month1Details: 'Starting: 20 clients, building base',
    month2Details: 'Invites 2 partners (Partner B & C)',
    month3Details: 'Revenue Share activated, receiving from 2 partners',
    month4_7Details: 'Partners B & C invite 2 partners each (4 new partners)',
    month8_19Details: '4 partners invite 2 partners each (8 new partners)',
    yearDetails: 'Total: $33,085.80 in first year',
    structure: 'Structure',
    partnerA: 'Partner A (You)',
    partnerB: 'Partner B',
    partnerC: 'Partner C',
    seeMore: 'See Full Details',
    download: 'Download PDF'
  },
  ru: {
    title: '💰 Модель Доходов Партнера',
    subtitle: 'Реальный Пример: Партнер-Психолог',
    back: '← Назад к странице партнера',
    scenario: 'Сценарий',
    scenarioDesc: 'Партнер-психолог строит свой бизнес и сеть',
    assumptions: 'Предположения',
    personalIncome: 'Личный доход: 50% от транзакций',
    clientBase: 'Клиентская база: 20 клиентов',
    clientSpend: 'Каждый клиент тратит: минимум $200/месяц',
    partnerBase: 'У каждого партнера: 50 клиентов',
    recruitment: 'Комиссия за рекрутинг: Рекуррентная, ежемесячно в течение года',
    timeline: 'Временная шкала',
    month1: 'Месяц 1',
    month2: 'Месяц 2',
    month3: 'Месяц 3',
    month4_7: 'Месяцы 4-7',
    month8_19: 'Месяцы 8-19',
    yearTotal: 'Итого за год',
    incomeBreakdown: 'Разбивка Доходов',
    personalIncomeLabel: 'Личный доход',
    revenueShareLabel: 'Revenue Share',
    recruitmentLabel: 'Рекрутинг',
    totalIncome: 'Общий доход',
    monthlyIncome: 'Ежемесячный доход',
    networkStructure: 'Структура Сети',
    level1: 'Уровень 1',
    level2: 'Уровень 2',
    level3: 'Уровень 3',
    partners: 'Партнеры',
    clients: 'Клиенты',
    systemRevenue: 'Доход системы',
    keyMetrics: 'Ключевые Показатели',
    avgMonthly: 'Среднемесячный (с 8 месяца)',
    annualTotal: 'Итого за год',
    growth: 'Рост',
    networkGrowth: 'Рост Сети',
    incomeGrowth: 'Рост Дохода',
    systemGrowth: 'Рост Дохода Системы',
    details: 'Детали',
    month1Details: 'Старт: 20 клиентов, формирование базы',
    month2Details: 'Приглашает 2 партнеров (Партнер Б & В)',
    month3Details: 'Revenue Share активирован, получение от 2 партнеров',
    month4_7Details: 'Партнеры Б & В приглашают по 2 партнера (4 новых партнера)',
    month8_19Details: '4 партнера приглашают по 2 партнера (8 новых партнеров)',
    yearDetails: 'Итого: $33,085.80 в первый год',
    structure: 'Структура',
    partnerA: 'Партнер А (Вы)',
    partnerB: 'Партнер Б',
    partnerC: 'Партнер В',
    seeMore: 'Смотреть Полные Детали',
    download: 'Скачать PDF'
  }
};

const PartnerIncomePresentation = () => {
  const { language, toggleLanguage } = useLanguageStore();
  const [activeTab, setActiveTab] = useState('overview');

  const t = (key) => translations[language]?.[key] || translations.en[key] || key;

  const handleLanguageToggle = () => {
    hapticFeedback('light');
    toggleLanguage();
  };

  // Данные для графиков
  const monthlyData = [
    { month: 1, personal: 2000, revenueShare: 0, recruitment: 0, total: 2000 },
    { month: 2, personal: 2000, revenueShare: 0, recruitment: 10.15, total: 2010.15 },
    { month: 3, personal: 2000, revenueShare: 100, recruitment: 10.15, total: 2110.15 },
    { month: 4, personal: 2000, revenueShare: 300, recruitment: 21.75, total: 2321.75 },
    { month: 5, personal: 2000, revenueShare: 300, recruitment: 21.75, total: 2321.75 },
    { month: 6, personal: 2000, revenueShare: 300, recruitment: 21.75, total: 2321.75 },
    { month: 7, personal: 2000, revenueShare: 300, recruitment: 21.75, total: 2321.75 },
    { month: 8, personal: 2000, revenueShare: 600, recruitment: 44.95, total: 2644.95 },
    { month: 9, personal: 2000, revenueShare: 600, recruitment: 44.95, total: 2644.95 },
    { month: 10, personal: 2000, revenueShare: 600, recruitment: 44.95, total: 2644.95 },
    { month: 11, personal: 2000, revenueShare: 600, recruitment: 44.95, total: 2644.95 },
    { month: 12, personal: 2000, revenueShare: 600, recruitment: 44.95, total: 2644.95 },
  ];

  const networkData = [
    { month: 1, partners: 1, clients: 20 },
    { month: 2, partners: 3, clients: 120 },
    { month: 3, partners: 3, clients: 120 },
    { month: 4, partners: 7, clients: 370 },
    { month: 5, partners: 7, clients: 370 },
    { month: 6, partners: 7, clients: 370 },
    { month: 7, partners: 7, clients: 370 },
    { month: 8, partners: 15, clients: 770 },
    { month: 9, partners: 15, clients: 770 },
    { month: 10, partners: 15, clients: 770 },
    { month: 11, partners: 15, clients: 770 },
    { month: 12, partners: 15, clients: 770 },
  ];

  const systemRevenueData = [
    { month: 3, revenue: 2280 },
    { month: 4, revenue: 6280 },
    { month: 5, revenue: 6280 },
    { month: 6, revenue: 6280 },
    { month: 7, revenue: 6280 },
    { month: 8, revenue: 14280 },
    { month: 9, revenue: 14280 },
    { month: 10, revenue: 14280 },
    { month: 11, revenue: 14280 },
    { month: 12, revenue: 14280 },
  ];

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const maxTotal = Math.max(...monthlyData.map(d => d.total));
  const maxPartners = Math.max(...networkData.map(d => d.partners));
  const maxClients = Math.max(...networkData.map(d => d.clients));
  const maxRevenue = Math.max(...systemRevenueData.map(d => d.revenue));

  return (
    <div className="min-h-screen bg-gradient-to-br from-sakura-light via-white to-sakura-cream">
      {/* Header */}
      <div className="bg-white border-b-2 border-sakura-mid/20 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <a
              href="/onepager/partner"
              className="flex items-center gap-2 text-sakura-dark hover:text-sakura-mid transition-colors font-medium"
            >
              <span className="text-xl">←</span>
              <span>{t('back')}</span>
            </a>
            <button
              onClick={handleLanguageToggle}
              className="flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg border-2 border-sakura-mid/30 hover:border-sakura-mid transition-colors"
            >
              <span className="text-xl">{language === 'ru' ? '🇷🇺' : '🇬🇧'}</span>
              <span className="font-bold text-sakura-dark">{language === 'ru' ? 'RU' : 'EN'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-bold text-sakura-dark mb-4">
            {t('title')}
          </h1>
          <p className="text-2xl text-sakura-mid mb-8">
            {t('subtitle')}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 justify-center mb-8 flex-wrap">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-3 rounded-xl font-bold transition-all ${
              activeTab === 'overview'
                ? 'bg-gradient-to-r from-sakura-mid to-sakura-dark text-white shadow-lg'
                : 'bg-white text-sakura-dark border-2 border-sakura-mid/30 hover:border-sakura-mid'
            }`}
          >
            {t('scenario')}
          </button>
          <button
            onClick={() => setActiveTab('income')}
            className={`px-6 py-3 rounded-xl font-bold transition-all ${
              activeTab === 'income'
                ? 'bg-gradient-to-r from-sakura-mid to-sakura-dark text-white shadow-lg'
                : 'bg-white text-sakura-dark border-2 border-sakura-mid/30 hover:border-sakura-mid'
            }`}
          >
            {t('incomeBreakdown')}
          </button>
          <button
            onClick={() => setActiveTab('network')}
            className={`px-6 py-3 rounded-xl font-bold transition-all ${
              activeTab === 'network'
                ? 'bg-gradient-to-r from-sakura-mid to-sakura-dark text-white shadow-lg'
                : 'bg-white text-sakura-dark border-2 border-sakura-mid/30 hover:border-sakura-mid'
            }`}
          >
            {t('networkStructure')}
          </button>
          <button
            onClick={() => setActiveTab('growth')}
            className={`px-6 py-3 rounded-xl font-bold transition-all ${
              activeTab === 'growth'
                ? 'bg-gradient-to-r from-sakura-mid to-sakura-dark text-white shadow-lg'
                : 'bg-white text-sakura-dark border-2 border-sakura-mid/30 hover:border-sakura-mid'
            }`}
          >
            {t('growth')}
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Scenario Description */}
            <div className="bg-white rounded-2xl p-8 shadow-xl border-2 border-sakura-mid/20">
              <h2 className="text-3xl font-bold text-sakura-dark mb-4">
                {t('scenario')}
              </h2>
              <p className="text-lg text-gray-700 mb-6">
                {t('scenarioDesc')}
              </p>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-sakura-light to-white rounded-xl p-6 border border-sakura-mid/20">
                  <h3 className="text-xl font-bold text-sakura-dark mb-4">
                    {t('assumptions')}
                  </h3>
                  <ul className="space-y-3 text-gray-700">
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 text-xl">✓</span>
                      <span>{t('personalIncome')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 text-xl">✓</span>
                      <span>{t('clientBase')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 text-xl">✓</span>
                      <span>{t('clientSpend')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 text-xl">✓</span>
                      <span>{t('partnerBase')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 text-xl">✓</span>
                      <span>{t('recruitment')}</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-gradient-to-br from-sakura-cream to-white rounded-xl p-6 border border-sakura-mid/20">
                  <h3 className="text-xl font-bold text-sakura-dark mb-4">
                    {t('keyMetrics')}
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <div className="text-sm text-gray-600 mb-1">{t('avgMonthly')}</div>
                      <div className="text-3xl font-bold text-sakura-dark">
                        {formatCurrency(2644.95)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">{t('annualTotal')}</div>
                      <div className="text-3xl font-bold text-green-600">
                        {formatCurrency(33085.80)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-white rounded-2xl p-8 shadow-xl border-2 border-sakura-mid/20">
              <h2 className="text-3xl font-bold text-sakura-dark mb-6">
                {t('timeline')}
              </h2>
              <div className="space-y-6">
                <TimelineItem
                  period={t('month1')}
                  income={formatCurrency(2000)}
                  details={t('month1Details')}
                  color="from-blue-400 to-blue-600"
                />
                <TimelineItem
                  period={t('month2')}
                  income={formatCurrency(2010.15)}
                  details={t('month2Details')}
                  color="from-purple-400 to-purple-600"
                />
                <TimelineItem
                  period={t('month3')}
                  income={formatCurrency(2110.15)}
                  details={t('month3Details')}
                  color="from-green-400 to-green-600"
                />
                <TimelineItem
                  period={t('month4_7')}
                  income={formatCurrency(2321.75)}
                  details={t('month4_7Details')}
                  color="from-yellow-400 to-yellow-600"
                />
                <TimelineItem
                  period={t('month8_19')}
                  income={formatCurrency(2644.95)}
                  details={t('month8_19Details')}
                  color="from-red-400 to-red-600"
                />
                <TimelineItem
                  period={t('yearTotal')}
                  income={formatCurrency(33085.80)}
                  details={t('yearDetails')}
                  color="from-sakura-mid to-sakura-dark"
                />
              </div>
            </div>
          </div>
        )}

        {/* Income Breakdown Tab */}
        {activeTab === 'income' && (
          <div className="space-y-8">
            {/* Monthly Income Chart */}
            <div className="bg-white rounded-2xl p-8 shadow-xl border-2 border-sakura-mid/20">
              <h2 className="text-3xl font-bold text-sakura-dark mb-6">
                {t('monthlyIncome')}
              </h2>
              <div className="space-y-4">
                {monthlyData.map((data, idx) => (
                  <div key={idx} className="relative">
                    <div className="flex items-center gap-4 mb-2">
                      <div className="w-20 text-sm font-bold text-sakura-dark">
                        {t('month' + data.month)}
                      </div>
                      <div className="flex-1 relative h-12 bg-gray-100 rounded-lg overflow-hidden">
                        {/* Personal Income */}
                        <div
                          className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-400 to-blue-600"
                          style={{ width: `${(data.personal / maxTotal) * 100}%` }}
                          title={`${t('personalIncomeLabel')}: ${formatCurrency(data.personal)}`}
                        />
                        {/* Revenue Share */}
                        <div
                          className="absolute left-0 top-0 h-full bg-gradient-to-r from-green-400 to-green-600"
                          style={{
                            width: `${(data.revenueShare / maxTotal) * 100}%`,
                            left: `${(data.personal / maxTotal) * 100}%`
                          }}
                          title={`${t('revenueShareLabel')}: ${formatCurrency(data.revenueShare)}`}
                        />
                        {/* Recruitment */}
                        <div
                          className="absolute left-0 top-0 h-full bg-gradient-to-r from-purple-400 to-purple-600"
                          style={{
                            width: `${(data.recruitment / maxTotal) * 100}%`,
                            left: `${((data.personal + data.revenueShare) / maxTotal) * 100}%`
                          }}
                          title={`${t('recruitmentLabel')}: ${formatCurrency(data.recruitment)}`}
                        />
                        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white font-bold text-sm">
                          {formatCurrency(data.total)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex gap-6 justify-center flex-wrap">
                <LegendItem color="from-blue-400 to-blue-600" label={t('personalIncomeLabel')} />
                <LegendItem color="from-green-400 to-green-600" label={t('revenueShareLabel')} />
                <LegendItem color="from-purple-400 to-purple-600" label={t('recruitmentLabel')} />
              </div>
            </div>

            {/* Income Summary */}
            <div className="grid md:grid-cols-3 gap-6">
              <IncomeCard
                title={t('personalIncomeLabel')}
                amount={formatCurrency(24000)}
                description="20 clients × $200 × 50% × 12 months"
                color="from-blue-400 to-blue-600"
              />
              <IncomeCard
                title={t('revenueShareLabel')}
                amount={formatCurrency(8500)}
                description="From 3 levels of network"
                color="from-green-400 to-green-600"
              />
              <IncomeCard
                title={t('recruitmentLabel')}
                amount={formatCurrency(585.80)}
                description="Recurring commissions from network"
                color="from-purple-400 to-purple-600"
              />
            </div>
          </div>
        )}

        {/* Network Structure Tab */}
        {activeTab === 'network' && (
          <div className="space-y-8">
            {/* Network Visualization */}
            <div className="bg-white rounded-2xl p-8 shadow-xl border-2 border-sakura-mid/20">
              <h2 className="text-3xl font-bold text-sakura-dark mb-6">
                {t('networkStructure')}
              </h2>
              <NetworkTree />
            </div>

            {/* Network Growth Chart */}
            <div className="bg-white rounded-2xl p-8 shadow-xl border-2 border-sakura-mid/20">
              <h2 className="text-3xl font-bold text-sakura-dark mb-6">
                {t('networkGrowth')}
              </h2>
              <div className="space-y-4">
                {networkData.map((data, idx) => (
                  <div key={idx} className="relative">
                    <div className="flex items-center gap-4 mb-2">
                      <div className="w-20 text-sm font-bold text-sakura-dark">
                        {t('month' + data.month)}
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-24 text-xs text-gray-600">{t('partners')}:</div>
                          <div className="flex-1 relative h-6 bg-gray-100 rounded overflow-hidden">
                            <div
                              className="absolute left-0 top-0 h-full bg-gradient-to-r from-sakura-mid to-sakura-dark"
                              style={{ width: `${(data.partners / maxPartners) * 100}%` }}
                            />
                            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs font-bold text-sakura-dark">
                              {data.partners}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-24 text-xs text-gray-600">{t('clients')}:</div>
                          <div className="flex-1 relative h-6 bg-gray-100 rounded overflow-hidden">
                            <div
                              className="absolute left-0 top-0 h-full bg-gradient-to-r from-green-400 to-green-600"
                              style={{ width: `${(data.clients / maxClients) * 100}%` }}
                            />
                            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs font-bold text-green-600">
                              {data.clients}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Growth Tab */}
        {activeTab === 'growth' && (
          <div className="space-y-8">
            {/* System Revenue Growth */}
            <div className="bg-white rounded-2xl p-8 shadow-xl border-2 border-sakura-mid/20">
              <h2 className="text-3xl font-bold text-sakura-dark mb-6">
                {t('systemGrowth')}
              </h2>
              <div className="space-y-4">
                {systemRevenueData.map((data, idx) => (
                  <div key={idx} className="relative">
                    <div className="flex items-center gap-4 mb-2">
                      <div className="w-20 text-sm font-bold text-sakura-dark">
                        {t('month' + data.month)}
                      </div>
                      <div className="flex-1 relative h-12 bg-gray-100 rounded-lg overflow-hidden">
                        <div
                          className="absolute left-0 top-0 h-full bg-gradient-to-r from-orange-400 to-orange-600"
                          style={{ width: `${(data.revenue / maxRevenue) * 100}%` }}
                        />
                        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white font-bold text-sm">
                          {formatCurrency(data.revenue)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Income Growth Comparison */}
            <div className="bg-white rounded-2xl p-8 shadow-xl border-2 border-sakura-mid/20">
              <h2 className="text-3xl font-bold text-sakura-dark mb-6">
                {t('incomeGrowth')}
              </h2>
              <div className="space-y-4">
                {monthlyData.map((data, idx) => (
                  <div key={idx} className="relative">
                    <div className="flex items-center gap-4 mb-2">
                      <div className="w-20 text-sm font-bold text-sakura-dark">
                        {t('month' + data.month)}
                      </div>
                      <div className="flex-1 relative h-12 bg-gray-100 rounded-lg overflow-hidden">
                        <div
                          className="absolute left-0 top-0 h-full bg-gradient-to-r from-sakura-mid to-sakura-dark"
                          style={{ width: `${(data.total / maxTotal) * 100}%` }}
                        />
                        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white font-bold text-sm">
                          {formatCurrency(data.total)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper Components
const TimelineItem = ({ period, income, details, color }) => (
  <div className="flex items-start gap-4">
    <div className={`w-4 h-4 rounded-full bg-gradient-to-r ${color} flex-shrink-0 mt-2`} />
    <div className="flex-1">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xl font-bold text-sakura-dark">{period}</h3>
        <div className="text-xl font-bold text-green-600">{income}</div>
      </div>
      <p className="text-gray-600">{details}</p>
    </div>
  </div>
);

const LegendItem = ({ color, label }) => (
  <div className="flex items-center gap-2">
    <div className={`w-4 h-4 rounded bg-gradient-to-r ${color}`} />
    <span className="text-sm text-gray-700">{label}</span>
  </div>
);

const IncomeCard = ({ title, amount, description, color }) => (
  <div className={`bg-gradient-to-br ${color} rounded-xl p-6 text-white`}>
    <h3 className="text-lg font-bold mb-2">{title}</h3>
    <div className="text-3xl font-bold mb-2">{amount}</div>
    <p className="text-sm opacity-90">{description}</p>
  </div>
);

const NetworkTree = () => (
  <div className="flex flex-col items-center space-y-8">
    {/* Level 0 - Partner A */}
    <div className="bg-gradient-to-r from-sakura-mid to-sakura-dark text-white rounded-xl p-6 shadow-lg">
      <div className="text-2xl font-bold">Partner A (You)</div>
      <div className="text-sm opacity-90">20 clients</div>
    </div>

    {/* Level 1 */}
    <div className="flex gap-8">
      <div className="bg-gradient-to-r from-blue-400 to-blue-600 text-white rounded-xl p-4 shadow-md">
        <div className="font-bold">Partner B</div>
        <div className="text-xs opacity-90">50 clients</div>
      </div>
      <div className="bg-gradient-to-r from-purple-400 to-purple-600 text-white rounded-xl p-4 shadow-md">
        <div className="font-bold">Partner C</div>
        <div className="text-xs opacity-90">50 clients</div>
      </div>
    </div>

    {/* Level 2 */}
    <div className="flex gap-4">
      {['B1', 'B2', 'C1', 'C2'].map((name, idx) => (
        <div key={idx} className="bg-gradient-to-r from-green-400 to-green-600 text-white rounded-lg p-3 shadow-sm">
          <div className="font-bold text-sm">Partner {name}</div>
          <div className="text-xs opacity-90">50 clients</div>
        </div>
      ))}
    </div>

    {/* Level 3 */}
    <div className="flex gap-2 flex-wrap justify-center">
      {Array.from({ length: 8 }, (_, idx) => (
        <div key={idx} className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white rounded-lg p-2 shadow-sm">
          <div className="font-bold text-xs">L3-{idx + 1}</div>
          <div className="text-xs opacity-90">50 clients</div>
        </div>
      ))}
    </div>
  </div>
);

export default PartnerIncomePresentation;






