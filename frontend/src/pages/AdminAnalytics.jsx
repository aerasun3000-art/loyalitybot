import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import Loader from '../components/Loader';

const AdminAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [systemStats, setSystemStats] = useState(null);
  const [partnerStats, setPartnerStats] = useState([]);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState(30);

  useEffect(() => {
    loadAdminStats();
  }, [period]);

  const loadAdminStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - period);

      // Загружаем всех партнёров
      const { data: partners, error: partnersError } = await supabase
        .from('partner_applications')
        .select('*')
        .eq('status', 'Approved');
      
      if (partnersError) throw partnersError;

      // Загружаем всех клиентов
      const { data: clients, error: clientsError } = await supabase
        .from('users')
        .select('*');
      
      if (clientsError) throw clientsError;

      // Загружаем все транзакции
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .gte('date_time', startDate.toISOString());
      
      if (txError) throw txError;

      // Загружаем все NPS оценки
      const { data: npsRatings, error: npsError } = await supabase
        .from('nps_ratings')
        .select('*')
        .gte('created_at', startDate.toISOString());
      
      if (npsError) throw npsError;

      // Вычисляем общие метрики системы
      const totalRevenue = transactions
        ?.filter(t => t.operation_type === 'accrual')
        .reduce((sum, t) => sum + (Number(t.total_amount) || 0), 0) || 0;

      const totalTransactions = transactions?.length || 0;
      const totalPointsAccrued = transactions
        ?.filter(t => t.operation_type === 'accrual' || t.operation_type === 'enrollment_bonus')
        .reduce((sum, t) => sum + (Number(t.earned_points) || 0), 0) || 0;

      // NPS расчёт по системе
      const promoters = npsRatings?.filter(r => r.rating >= 9).length || 0;
      const detractors = npsRatings?.filter(r => r.rating <= 6).length || 0;
      const totalNPS = npsRatings?.length || 0;
      
      const systemNPS = totalNPS > 0 
        ? Math.round(((promoters - detractors) / totalNPS) * 100)
        : 0;

      const avgSystemNPS = totalNPS > 0
        ? (npsRatings.reduce((sum, r) => sum + r.rating, 0) / totalNPS).toFixed(2)
        : 0;

      setSystemStats({
        totalPartners: partners?.length || 0,
        totalClients: clients?.length || 0,
        totalRevenue,
        totalTransactions,
        totalPointsAccrued,
        systemNPS,
        avgSystemNPS,
      });

      // Вычисляем метрики для каждого партнёра
      const partnerMetrics = partners?.map(partner => {
        const partnerTransactions = transactions?.filter(
          t => t.partner_chat_id === partner.chat_id
        ) || [];

        const partnerClients = clients?.filter(
          c => c.referral_source === partner.chat_id
        ) || [];

        const partnerNPS = npsRatings?.filter(
          r => r.partner_chat_id === partner.chat_id
        ) || [];

        const revenue = partnerTransactions
          .filter(t => t.operation_type === 'accrual')
          .reduce((sum, t) => sum + (Number(t.total_amount) || 0), 0);

        const npsPromoters = partnerNPS.filter(r => r.rating >= 9).length;
        const npsDetractors = partnerNPS.filter(r => r.rating <= 6).length;
        const npsTotal = partnerNPS.length;
        const nps = npsTotal > 0 
          ? Math.round(((npsPromoters - npsDetractors) / npsTotal) * 100)
          : 0;

        return {
          ...partner,
          revenue,
          transactions: partnerTransactions.length,
          clients: partnerClients.length,
          nps,
        };
      }) || [];

      // Сортируем по обороту
      partnerMetrics.sort((a, b) => b.revenue - a.revenue);
      setPartnerStats(partnerMetrics);

    } catch (error) {
      console.error('Ошибка загрузки админской статистики:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Loader />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Заголовок */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-4xl font-bold mb-2">
            📈 Админский Дашборд
          </h1>
          <p className="text-purple-100">
            Полная аналитика системы лояльности
          </p>
        </div>
      </div>

      {/* Фильтр по периоду */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-2 flex-wrap">
          {[7, 30, 90, 365].map(days => (
            <button
              key={days}
              onClick={() => setPeriod(days)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                period === days
                  ? 'bg-purple-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {days === 365 ? 'Год' : `${days} дней`}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {/* Общие метрики системы */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            🌐 Общие метрики системы
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <AdminMetricCard
              icon="🤝"
              title="Активные партнёры"
              value={systemStats.totalPartners}
              color="blue"
            />
            <AdminMetricCard
              icon="👥"
              title="Всего клиентов"
              value={systemStats.totalClients}
              color="green"
            />
            <AdminMetricCard
              icon="💰"
              title="Общий оборот"
              value={`${systemStats.totalRevenue.toLocaleString('ru-RU')} ₽`}
              color="purple"
            />
            <AdminMetricCard
              icon="🧾"
              title="Транзакции"
              value={systemStats.totalTransactions}
              color="orange"
            />
          </div>
        </div>

        {/* NPS системы */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            ⭐ NPS по платформе
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-sm">
            <div className="text-center">
              <div className={`text-6xl font-bold mb-2 ${
                systemStats.systemNPS > 50 ? 'text-green-500' :
                systemStats.systemNPS > 0 ? 'text-yellow-500' :
                'text-red-500'
              }`}>
                {systemStats.systemNPS}
              </div>
              <div className="text-xl text-gray-600 dark:text-gray-400">
                Средний NPS по платформе
              </div>
              <div className="mt-2 text-sm text-gray-500 dark:text-gray-500">
                Средняя оценка: {systemStats.avgSystemNPS}
              </div>
            </div>
          </div>
        </div>

        {/* Топ партнёров */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            👥 Рейтинг партнёров по обороту
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Партнёр
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Оборот
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Транзакции
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Клиенты
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      NPS
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {partnerStats.map((partner, index) => (
                    <tr key={partner.chat_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {index === 0 && '🥇'}
                          {index === 1 && '🥈'}
                          {index === 2 && '🥉'}
                          {index > 2 && index + 1}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {partner.company_name || partner.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          ID: {partner.chat_id}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900 dark:text-white">
                          {partner.revenue.toLocaleString('ru-RU')} ₽
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {partner.transactions}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {partner.clients}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          partner.nps > 50 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                          partner.nps > 0 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                          'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {partner.nps}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Компонент карточки метрики для админа
const AdminMetricCard = ({ icon, title, value, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
    orange: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
  };

  return (
    <div className={`rounded-xl p-6 border ${colorClasses[color]}`}>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-4xl">{icon}</span>
        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {title}
        </h3>
      </div>
      <div className="text-3xl font-bold text-gray-900 dark:text-white">
        {value}
      </div>
    </div>
  );
};

export default AdminAnalytics;

