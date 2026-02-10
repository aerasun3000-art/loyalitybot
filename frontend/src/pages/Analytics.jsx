import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getAdvancedPartnerStats,
  getPartnerStatsByPeriod,
  getPartnerCohortAnalysis,
  getTopClientsByLTV,
  getPartnerInfo
} from '../services/supabase'
import { formatCurrency } from '../utils/currency'
import Loader from '../components/Loader'

export default function Analytics() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState(30)
  const [stats, setStats] = useState(null)
  const [dailyStats, setDailyStats] = useState(null)
  const [cohorts, setCohorts] = useState([])
  const [topClients, setTopClients] = useState([])
  const [activeTab, setActiveTab] = useState('overview') // overview, charts, cohorts, clients
  const [partnerCity, setPartnerCity] = useState(null)

  useEffect(() => {
    loadAnalytics()
  }, [selectedPeriod])

  const loadAnalytics = async () => {
    const userData = window.Telegram?.WebApp?.initDataUnsafe?.user
    if (!userData?.id) {
      console.error('User not authenticated')
      return
    }

    const partnerChatId = userData.id.toString()

    try {
      setLoading(true)

      // Загружаем информацию о партнере (для определения валюты)
      const partnerInfo = await getPartnerInfo(partnerChatId)
      if (partnerInfo?.city) {
        setPartnerCity(partnerInfo.city)
      }

      // Загружаем расширенную статистику
      const advancedStats = await getAdvancedPartnerStats(partnerChatId, selectedPeriod)
      setStats(advancedStats)

      // Загружаем данные для графиков (за выбранный период)
      const endDate = new Date()
      const startDate = new Date(endDate.getTime() - selectedPeriod * 24 * 60 * 60 * 1000)
      
      const periodStats = await getPartnerStatsByPeriod(
        partnerChatId,
        startDate.toISOString(),
        endDate.toISOString()
      )
      setDailyStats(periodStats)

      // Загружаем когортный анализ
      const cohortData = await getPartnerCohortAnalysis(partnerChatId)
      setCohorts(cohortData?.cohorts || [])

      // Загружаем топ клиентов
      const topClientsData = await getTopClientsByLTV(partnerChatId, 10)
      setTopClients(topClientsData)

    } catch (error) {
      console.error('Error loading analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrencyValue = (value) => {
    return formatCurrency(value, partnerCity)
  }

  const formatPercent = (value) => {
    return `${value.toFixed(1)}%`
  }

  const getMetricChange = (current, previous) => {
    if (!previous || previous === 0) return null
    const change = ((current - previous) / previous) * 100
    return change
  }

  const MetricCard = ({ title, value, icon, color, change, suffix = '' }) => (
    <div className="bg-sakura-surface rounded-xl p-6 shadow-sm border border-sakura-border">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
        <div className={`p-2 rounded-lg ${color}`}>
          <span className="text-lg leading-none">{icon}</span>
        </div>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {value}{suffix}
          </p>
          {change !== null && change !== undefined && (
            <div className={`flex items-center mt-1 text-sm ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              <span className="mr-1">{change >= 0 ? '▲' : '▼'}</span>
              <span>{Math.abs(change).toFixed(1)}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  const SimpleBarChart = ({ data, dataKey, color = '#3b82f6' }) => {
    if (!data || data.length === 0) return null

    const maxValue = Math.max(...data.map(d => d[dataKey]))

    return (
      <div className="space-y-2">
        {data.map((item, index) => (
          <div key={index} className="flex items-center gap-3">
            <div className="w-24 text-sm text-gray-600 dark:text-gray-400">
              {item.date}
            </div>
            <div className="flex-1 bg-sakura-cream rounded-full h-6 relative">
              <div
                className="h-full rounded-full flex items-center justify-end pr-2"
                style={{
                  width: `${(item[dataKey] / maxValue) * 100}%`,
                  backgroundColor: color,
                  minWidth: item[dataKey] > 0 ? '30px' : '0'
                }}
              >
                <span className="text-xs text-white font-medium">
                  {typeof item[dataKey] === 'number' && dataKey === 'revenue'
                    ? formatCurrencyValue(item[dataKey])
                    : item[dataKey]}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (loading) {
    return <Loader />
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-sakura-cream dark:bg-sakura-dark p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">Недостаточно данных для аналитики</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-sakura-cream dark:bg-sakura-dark pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-sakura-deep to-sakura-mid text-white p-6">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => navigate('/partner')}
            className="text-white/80 hover:text-white mb-4 flex items-center gap-2"
          >
            ← Назад
          </button>
          <h1 className="text-3xl font-bold mb-2">📊 Аналитика</h1>
          <p className="text-white/80">Детальный анализ вашего бизнеса</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Period Selector */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {[7, 30, 90, 365].map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                selectedPeriod === period
                  ? 'bg-sakura-accent text-white'
                  : 'bg-sakura-surface text-sakura-deep hover:bg-sakura-cream'
              }`}
            >
              {period === 7 ? '7 дней' : period === 365 ? 'Весь период' : `${period} дней`}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-sakura-border/30">
          <div className="flex gap-4 overflow-x-auto">
            {[
              { id: 'overview', label: '📈 Обзор' },
              { id: 'charts', label: '📊 Графики' },
              { id: 'cohorts', label: '👥 Когорты' },
              { id: 'clients', label: '⭐ Топ клиенты' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 px-1 border-b-2 font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-sakura-accent text-sakura-accent'
                    : 'border-transparent text-sakura-muted hover:text-sakura-deep'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Оборот"
                value={formatCurrencyValue(stats.total_revenue)}
                icon="💰"
                color="bg-sakura-mid"
              />
              <MetricCard
                title="Средний чек"
                value={formatCurrencyValue(stats.avg_check)}
                icon="📊"
                color="bg-blue-500"
              />
              <MetricCard
                title="Активные клиенты"
                value={stats.active_clients}
                icon="👥"
                color="bg-purple-500"
              />
              <MetricCard
                title="NPS Score"
                value={stats.nps_score}
                icon="⭐"
                color="bg-sakura-gold"
              />
            </div>

            {/* Detailed Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Clients */}
              <div className="bg-sakura-surface rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">👥 Клиенты</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Всего клиентов</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{stats.total_clients}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Новые за период</span>
                    <span className="font-semibold text-green-600">+{stats.new_clients}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Активные</span>
                    <span className="font-semibold text-blue-600">{stats.active_clients}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Повторные покупки</span>
                    <span className="font-semibold text-purple-600">{stats.returning_clients}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-sakura-border">
                    <span className="text-gray-600 dark:text-gray-400">Churn Rate</span>
                    <span className={`font-semibold ${stats.churn_rate > 50 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatPercent(stats.churn_rate)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Financial */}
              <div className="bg-sakura-surface rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">💰 Финансы</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Общий оборот</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(stats.total_revenue)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Средний чек</span>
                    <span className="font-semibold text-blue-600">
                      {formatCurrency(stats.avg_check)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Средний LTV</span>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(stats.avg_ltv)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Транзакций</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{stats.total_transactions}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-sakura-border">
                    <span className="text-gray-600 dark:text-gray-400">Частота покупок</span>
                    <span className="font-semibold text-purple-600">{stats.avg_frequency} транз/клиент</span>
                  </div>
                </div>
              </div>

              {/* Conversion */}
              <div className="bg-sakura-surface rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">🎯 Конверсии</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-600 dark:text-gray-400">Регистрация → Покупка</span>
                      <span className="font-semibold text-blue-600">
                        {formatPercent(stats.registration_to_first_purchase)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${stats.registration_to_first_purchase}%` }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-600 dark:text-gray-400">Повторные покупки</span>
                      <span className="font-semibold text-green-600">
                        {formatPercent(stats.repeat_purchase_rate)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        style={{ width: `${stats.repeat_purchase_rate}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* NPS */}
              <div className="bg-sakura-surface dark:bg-sakura-dark rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">⭐ NPS Индекс</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sakura-muted">Средний NPS</span>
                    <span className="font-semibold text-sakura-deep">{stats.avg_nps.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sakura-muted">Чистый NPS Score</span>
                    <span className={`font-semibold ${stats.nps_score >= 50 ? 'text-sakura-mid' : stats.nps_score >= 0 ? 'text-sakura-gold' : 'text-sakura-accent'}`}>
                      {stats.nps_score}
                    </span>
                  </div>
                  <div className="pt-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-24 text-sm text-gray-600 dark:text-gray-400">🟢 9-10:</span>
                      <div className="flex-1 bg-sakura-cream rounded-full h-6">
                        <div
                          className="bg-sakura-mid h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
                          style={{ width: `${stats.promoters > 0 ? 100 : 0}%`, minWidth: '30px' }}
                        >
                          {stats.promoters}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-24 text-sm text-gray-600 dark:text-gray-400">🟡 7-8:</span>
                      <div className="flex-1 bg-sakura-cream rounded-full h-6">
                        <div
                          className="bg-sakura-gold h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
                          style={{ width: `${stats.passives > 0 ? 70 : 0}%`, minWidth: '30px' }}
                        >
                          {stats.passives}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-24 text-sm text-gray-600 dark:text-gray-400">🔴 0-6:</span>
                      <div className="flex-1 bg-sakura-cream rounded-full h-6">
                        <div
                          className="bg-sakura-accent h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
                          style={{ width: `${stats.detractors > 0 ? 50 : 0}%`, minWidth: '30px' }}
                        >
                          {stats.detractors}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Insights */}
            {(stats.churn_rate > 50 || stats.repeat_purchase_rate < 30 || stats.nps_score > 50) && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-3 text-blue-900 dark:text-blue-100">💡 Рекомендации</h3>
                <ul className="space-y-2 text-blue-800 dark:text-blue-200">
                  {stats.churn_rate > 50 && (
                    <li>⚠️ Высокий отток клиентов ({formatPercent(stats.churn_rate)}) - рекомендуем активировать программу удержания</li>
                  )}
                  {stats.repeat_purchase_rate < 30 && (
                    <li>💡 Низкий процент повторных покупок ({formatPercent(stats.repeat_purchase_rate)}) - создайте акции для возврата клиентов</li>
                  )}
                  {stats.nps_score > 50 && (
                    <li>🌟 Отличный NPS! Клиенты рекомендуют вас - используйте реферальную программу для роста</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Charts Tab */}
        {activeTab === 'charts' && dailyStats && (
          <div className="space-y-6">
            <div className="bg-sakura-surface dark:bg-sakura-dark rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">💰 Оборот по дням</h3>
              <SimpleBarChart data={dailyStats.daily_stats.slice(-14)} dataKey="revenue" color="#10b981" />
            </div>

            <div className="bg-sakura-surface dark:bg-sakura-dark rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">📊 Транзакции по дням</h3>
              <SimpleBarChart data={dailyStats.daily_stats.slice(-14)} dataKey="transactions" color="#3b82f6" />
            </div>

            <div className="bg-sakura-surface dark:bg-sakura-dark rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">👥 Уникальные клиенты по дням</h3>
              <SimpleBarChart data={dailyStats.daily_stats.slice(-14)} dataKey="unique_clients" color="#8b5cf6" />
            </div>
          </div>
        )}

        {/* Cohorts Tab */}
        {activeTab === 'cohorts' && (
          <div className="bg-sakura-surface dark:bg-sakura-dark rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">👥 Когортный анализ</h3>
            {cohorts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                  <tr className="border-b border-sakura-border">
                      <th className="text-left py-3 px-4 text-gray-600 dark:text-gray-400">Месяц</th>
                      <th className="text-right py-3 px-4 text-gray-600 dark:text-gray-400">Клиентов</th>
                      <th className="text-right py-3 px-4 text-gray-600 dark:text-gray-400">Оборот</th>
                      <th className="text-right py-3 px-4 text-gray-600 dark:text-gray-400">Транзакций</th>
                      <th className="text-right py-3 px-4 text-gray-600 dark:text-gray-400">Ср. на клиента</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cohorts.map((cohort, index) => (
                      <tr key={index} className="border-b border-sakura-border">
                        <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{cohort.month}</td>
                        <td className="py-3 px-4 text-right text-gray-700 dark:text-gray-300">{cohort.clients_count}</td>
                        <td className="py-3 px-4 text-right font-medium text-green-600">{formatCurrencyValue(cohort.total_revenue)}</td>
                        <td className="py-3 px-4 text-right text-gray-700 dark:text-gray-300">{cohort.total_transactions}</td>
                        <td className="py-3 px-4 text-right font-medium text-blue-600">{formatCurrencyValue(cohort.avg_revenue_per_client)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center py-8 text-gray-500 dark:text-gray-400">
                Недостаточно данных для когортного анализа
              </p>
            )}
          </div>
        )}

        {/* Top Clients Tab */}
        {activeTab === 'clients' && (
          <div className="bg-sakura-surface dark:bg-sakura-dark rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">⭐ Топ клиенты по LTV</h3>
            {topClients.length > 0 ? (
              <div className="space-y-3">
                {topClients.map((client, index) => (
                  <div
                    key={client.chat_id}
                    className="flex items-center gap-4 p-4 bg-sakura-cream dark:bg-sakura-dark/50 rounded-lg"
                  >
                    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-blue-600 text-white rounded-full font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">{client.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{client.phone}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">{formatCurrencyValue(client.ltv)}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{client.transactions_count} транз.</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-gray-500 dark:text-gray-400">
                Пока нет данных о клиентах
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

