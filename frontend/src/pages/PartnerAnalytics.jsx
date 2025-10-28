import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import Loader from '../components/Loader';

const PartnerAnalytics = () => {
  const [searchParams] = useSearchParams();
  const partnerId = searchParams.get('partner_id');
  
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState(30); // дней

  useEffect(() => {
    if (partnerId) {
      loadPartnerStats();
    } else {
      setLoading(false);
    }
  }, [partnerId, period]);

  const loadPartnerStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - period);
      
      // Загружаем транзакции партнёра
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('partner_chat_id', partnerId)
        .gte('date_time', startDate.toISOString());
      
      if (txError) throw txError;

      // Загружаем клиентов партнёра
      const { data: clients, error: clientsError } = await supabase
        .from('users')
        .select('*')
        .eq('referral_source', partnerId);
      
      if (clientsError) throw clientsError;

      // Загружаем NPS оценки
      const { data: npsRatings, error: npsError } = await supabase
        .from('nps_ratings')
        .select('rating')
        .eq('partner_chat_id', partnerId)
        .gte('created_at', startDate.toISOString());
      
      if (npsError) throw npsError;

      // Вычисляем метрики
      const totalRevenue = transactions
        ?.filter(t => t.transaction_type === 'accrual')
        .reduce((sum, t) => sum + (t.check_amount || 0), 0) || 0;

      const totalTransactions = transactions?.length || 0;
      const accrualTransactions = transactions?.filter(t => t.transaction_type === 'accrual').length || 0;
      const redemptionTransactions = transactions?.filter(t => t.transaction_type === 'spend').length || 0;

      const totalPointsAccrued = transactions
        ?.filter(t => t.transaction_type === 'accrual')
        .reduce((sum, t) => sum + (t.points_change || 0), 0) || 0;

      const totalPointsRedeemed = transactions
        ?.filter(t => t.transaction_type === 'spend')
        .reduce((sum, t) => sum + Math.abs(t.points_change || 0), 0) || 0;

      const avgCheck = accrualTransactions > 0 ? totalRevenue / accrualTransactions : 0;

      // NPS расчёт
      const promoters = npsRatings?.filter(r => r.rating >= 9).length || 0;
      const passives = npsRatings?.filter(r => r.rating >= 7 && r.rating <= 8).length || 0;
      const detractors = npsRatings?.filter(r => r.rating <= 6).length || 0;
      const totalNPS = npsRatings?.length || 0;
      
      const npsScore = totalNPS > 0 
        ? Math.round(((promoters - detractors) / totalNPS) * 100)
        : 0;

      const avgNPS = totalNPS > 0
        ? (npsRatings.reduce((sum, r) => sum + r.rating, 0) / totalNPS).toFixed(2)
        : 0;

      // Активные клиенты за период
      const uniqueClients = new Set(transactions?.map(t => t.user_chat_id));
      const activeClients = uniqueClients.size;

      const newClients = clients?.filter(c => {
        const regDate = new Date(c.reg_date);
        return regDate >= startDate;
      }).length || 0;

      setStats({
        totalRevenue,
        totalTransactions,
        accrualTransactions,
        redemptionTransactions,
        totalPointsAccrued,
        totalPointsRedeemed,
        avgCheck,
        totalClients: clients?.length || 0,
        activeClients,
        newClients,
        npsScore,
        avgNPS,
        promoters,
        passives,
        detractors,
      });

    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
      setError(error.message || 'Произошла ошибка при загрузке данных');
    } finally {
      setLoading(false);
    }
  };

  if (!partnerId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            ⚠️ Partner ID не указан
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Пожалуйста, откройте дашборд через бота
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <Loader />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
            ⚠️ Ошибка загрузки данных
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {error}
          </p>
          <button 
            onClick={() => loadPartnerStats()}
            className="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            📊 Нет данных
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Данные для этого партнёра пока отсутствуют
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Заголовок */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            📈 Дашборд Партнёра
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            ID: {partnerId}
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
                  ? 'bg-primary-500 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {days === 365 ? 'Год' : `${days} дней`}
            </button>
          ))}
        </div>
      </div>

      {/* Метрики */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {/* Финансовые метрики */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            💰 Финансовые показатели
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              icon="💵"
              title="Общий оборот"
              value={`${stats.totalRevenue.toLocaleString('ru-RU')} ₽`}
              subtitle={`Средний чек: ${stats.avgCheck.toLocaleString('ru-RU', {maximumFractionDigits: 0})} ₽`}
            />
            <MetricCard
              icon="🧾"
              title="Транзакции"
              value={stats.totalTransactions}
              subtitle={`Начислений: ${stats.accrualTransactions} | Списаний: ${stats.redemptionTransactions}`}
            />
            <MetricCard
              icon="💎"
              title="Баллы"
              value={`${stats.totalPointsAccrued.toLocaleString('ru-RU')}`}
              subtitle={`Списано: ${stats.totalPointsRedeemed.toLocaleString('ru-RU')}`}
            />
          </div>
        </div>

        {/* Клиенты */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            👥 Клиентская база
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              icon="👤"
              title="Всего клиентов"
              value={stats.totalClients}
              subtitle="За всё время"
            />
            <MetricCard
              icon="✅"
              title="Активные"
              value={stats.activeClients}
              subtitle={`За ${period} дней`}
            />
            <MetricCard
              icon="🆕"
              title="Новые клиенты"
              value={stats.newClients}
              subtitle={`За ${period} дней`}
            />
          </div>
        </div>

        {/* NPS */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            ⭐ NPS Индекс
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
              <div className="text-center">
                <div className="text-5xl font-bold text-primary-500 mb-2">
                  {stats.npsScore}
                </div>
                <div className="text-lg text-gray-600 dark:text-gray-400">
                  Чистый NPS
                </div>
                <div className="mt-4 text-sm text-gray-500 dark:text-gray-500">
                  Средняя оценка: {stats.avgNPS}
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    🟢 Промоутеры (9-10)
                  </span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    {stats.promoters}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-yellow-600 dark:text-yellow-400 font-medium">
                    🟡 Нейтральные (7-8)
                  </span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    {stats.passives}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-red-600 dark:text-red-400 font-medium">
                    🔴 Детракторы (0-6)
                  </span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    {stats.detractors}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Рекомендации */}
        {stats.npsScore < 0 && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
            <h3 className="text-lg font-bold text-red-900 dark:text-red-200 mb-2">
              ⚠️ Низкий NPS
            </h3>
            <p className="text-red-700 dark:text-red-300">
              Обратите внимание на качество обслуживания. Рекомендуем провести опрос клиентов.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// Компонент карточки метрики
const MetricCard = ({ icon, title, value, subtitle }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
    <div className="flex items-center gap-3 mb-2">
      <span className="text-3xl">{icon}</span>
      <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
        {title}
      </h3>
    </div>
    <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
      {value}
    </div>
    {subtitle && (
      <div className="text-sm text-gray-500 dark:text-gray-500">
        {subtitle}
      </div>
    )}
  </div>
);

export default PartnerAnalytics;

