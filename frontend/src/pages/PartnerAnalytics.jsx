import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase, getPartnerInfo, updatePartnerInfo, getPartnerReactivationSettings, updatePartnerReactivationSettings, getReactivationStats, getPartnerCashbackStats } from '../services/supabase';
import { formatCurrencySimple } from '../utils/currency';
import Loader from '../components/Loader';
import { openTelegramLink } from '../utils/telegram';
import { getPartnerCitiesList, getDistrictsByCity } from '../utils/locations';
import { getAllServiceCategories, getCategoriesByGroup } from '../utils/serviceIcons';

const PartnerAnalytics = () => {
  const [searchParams] = useSearchParams();
  const partnerId = searchParams.get('partner_id');
  
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState(30); // дней
  const [cashbackStats, setCashbackStats] = useState(null);
  const [ratedClients, setRatedClients] = useState([]); // Клиенты, которые поставили оценку
  const [partnerCity, setPartnerCity] = useState(null);
  const [partnerData, setPartnerData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [editErrors, setEditErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [cities] = useState(getPartnerCitiesList());
  const [districts, setDistricts] = useState([]);
  const [serviceCategories] = useState(getAllServiceCategories());
  
  // Churn Prevention / Reactivation settings
  const [reactivationSettings, setReactivationSettings] = useState({
    enabled: true,
    min_days: 7,
    coefficient: 2.0,
    cooldown_days: 14,
    message_template: ''
  });
  const [reactivationStats, setReactivationStats] = useState({
    sent: 0,
    failed: 0,
    total: 0,
    returned_clients: 0,
    return_visits: 0,
  });
  const [isEditingReactivation, setIsEditingReactivation] = useState(false);
  const [reactivationFormData, setReactivationFormData] = useState({});
  const [savingReactivation, setSavingReactivation] = useState(false);
  const [reactivationSaveSuccess, setReactivationSaveSuccess] = useState(false);

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
      
      // Загружаем информацию о партнере (для определения валюты)
      const partnerInfo = await getPartnerInfo(partnerId);
      console.log('[PartnerAnalytics] Partner info loaded:', partnerInfo);
      if (partnerInfo) {
        setPartnerData(partnerInfo);
        if (partnerInfo.city) {
        setPartnerCity(partnerInfo.city);
          const districtsForCity = getDistrictsByCity(partnerInfo.city);
          setDistricts(districtsForCity);
        }
      } else {
        console.warn('[PartnerAnalytics] No partner data found for partnerId:', partnerId);
      }
      
      // Загружаем настройки реактивации (Churn Prevention)
      const reactivationSettingsData = await getPartnerReactivationSettings(partnerId);
      setReactivationSettings(reactivationSettingsData);
      
      // Загружаем статистику реактивации за выбранный период
      const reactivationStatsData = await getReactivationStats(partnerId, period);
      setReactivationStats(reactivationStatsData);
      
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

      // Загружаем NPS оценки с данными о клиентах
      const { data: npsRatings, error: npsError } = await supabase
        .from('nps_ratings')
        .select('client_chat_id, rating, created_at, master_name, feedback')
        .eq('partner_chat_id', partnerId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });
      
      if (npsError) throw npsError;

      // Загружаем информацию о клиентах, которые поставили оценку
      let clientsWithRatings = [];
      if (npsRatings && npsRatings.length > 0) {
        const clientChatIds = [...new Set(npsRatings.map(r => r.client_chat_id).filter(Boolean))];
        
        if (clientChatIds.length > 0) {
          const { data: clientsData, error: clientsDataError } = await supabase
            .from('users')
            .select('chat_id, name, phone')
            .in('chat_id', clientChatIds);
          
          if (clientsDataError) {
            console.error('Ошибка загрузки данных клиентов:', clientsDataError);
          } else {
            // Объединяем данные об оценках с данными о клиентах
            clientsWithRatings = npsRatings.map(rating => {
              const client = clientsData?.find(c => c.chat_id === rating.client_chat_id);
              return {
                ...rating,
                clientName: client?.name || 'Неизвестный клиент',
                clientPhone: client?.phone || null,
                clientChatId: rating.client_chat_id
              };
            });
          }
        }
      }
      
      setRatedClients(clientsWithRatings);

      // Загружаем промоутеров среди клиентов партнёра
      const clientIds = clients?.map(c => c.chat_id) || [];
      let totalPromoters = 0;
      if (clientIds.length > 0) {
        const { data: promoters, error: promotersError } = await supabase
          .from('promoters')
          .select('client_chat_id')
          .in('client_chat_id', clientIds)
          .eq('is_active', true);
        
        if (!promotersError && promoters) {
          totalPromoters = promoters.length;
        }
      }

      // Эффективность реактивации: возвраты после сообщений
      try {
        const { data: reactivationEvents, error: reError } = await supabase
          .from('reactivation_events')
          .select('client_chat_id, sent_at, status')
          .eq('partner_chat_id', partnerId)
          .gte('sent_at', startDate.toISOString());

        if (!reError && reactivationEvents && reactivationEvents.length > 0) {
          const lastSentByClient = {};
          reactivationEvents.forEach(ev => {
            if (ev.status !== 'sent' || !ev.client_chat_id || !ev.sent_at) return;
            const cid = ev.client_chat_id;
            const sentAt = new Date(ev.sent_at);
            if (!lastSentByClient[cid] || sentAt > lastSentByClient[cid]) {
              lastSentByClient[cid] = sentAt;
            }
          });

          const returnedClientsSet = new Set();
          let returnVisits = 0;
          const txs = transactions || [];

          Object.entries(lastSentByClient).forEach(([cid, sentAt]) => {
            txs.forEach(t => {
              if (t.client_chat_id === cid && t.date_time) {
                const txnDate = new Date(t.date_time);
                if (txnDate > sentAt) {
                  returnedClientsSet.add(cid);
                  returnVisits += 1;
                }
              }
            });
          });

          setReactivationStats(prev => ({
            ...prev,
            returned_clients: returnedClientsSet.size,
            return_visits: returnVisits,
          }));
        }
      } catch (e) {
        console.error('Ошибка расчёта эффективности реактивации:', e);
      }

      // Вычисляем метрики
      const totalRevenue = transactions
        ?.filter(t => t.operation_type === 'accrual')
        .reduce((sum, t) => sum + (Number(t.total_amount) || 0), 0) || 0;

      const totalTransactions = transactions?.length || 0;
      const accrualTransactions = transactions?.filter(t => t.operation_type === 'accrual').length || 0;
      const redemptionTransactions = transactions?.filter(t => t.operation_type === 'redemption').length || 0;

      const totalPointsAccrued = transactions
        ?.filter(t => t.operation_type === 'accrual' || t.operation_type === 'enrollment_bonus')
        .reduce((sum, t) => sum + (Number(t.earned_points) || 0), 0) || 0;

      const totalPointsRedeemed = transactions
        ?.filter(t => t.operation_type === 'redemption')
        .reduce((sum, t) => sum + (Number(t.spent_points) || 0), 0) || 0;

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
      const uniqueClients = new Set(transactions?.map(t => t.client_chat_id));
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
        totalPromoters,
      });

      // Загружаем статистику кэшбэка и депозита
      const periodKey = period <= 7 ? 'week' : period <= 30 ? 'month' : 'quarter';
      const cbStats = await getPartnerCashbackStats(partnerId, periodKey);
      setCashbackStats(cbStats);

    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
      setError(error.message || 'Произошла ошибка при загрузке данных');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePartnerData = async (e) => {
    e.preventDefault();
    setEditErrors({});
    
    // Валидация
    const newErrors = {};
    if (!editFormData.name?.trim()) {
      newErrors.name = 'Имя обязательно';
    }
    if (!editFormData.phone?.trim()) {
      newErrors.phone = 'Телефон обязателен';
    } else if (!/^\+?[0-9\s\-()]{10,}$/.test(editFormData.phone)) {
      newErrors.phone = 'Неверный формат телефона';
    }
    if (!editFormData.company_name?.trim()) {
      newErrors.company_name = 'Название компании обязательно';
    }
    if (!editFormData.category_group) {
      newErrors.category_group = 'Выберите тип бизнеса';
    }
    // business_type опционален для всех категорий
    if (editFormData.work_mode === 'offline' && !editFormData.city) {
      newErrors.city = 'Город обязателен для оффлайн режима';
    }
    if (editFormData.work_mode === 'offline' && editFormData.city && !editFormData.district) {
      newErrors.district = 'Район обязателен';
    }
    // Для гибридного режима город не обязателен, но если указан - нужен район
    if (editFormData.work_mode === 'hybrid' && editFormData.city && !editFormData.district) {
      newErrors.district = 'Если указан город, выберите район';
    }
    if (editFormData.default_referral_commission_percent < 0 || editFormData.default_referral_commission_percent > 100) {
      newErrors.default_referral_commission_percent = 'Процент должен быть от 0 до 100';
    }
    if (editFormData.username && !/^[a-zA-Z0-9_]{5,32}$/.test(editFormData.username.replace('@', '').trim())) {
      newErrors.username = 'Username должен содержать только буквы, цифры и подчеркивания (5-32 символа)';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setEditErrors(newErrors);
      return;
    }
    
    setSaving(true);
    try {
      const updateData = {
        name: editFormData.name.trim(),
        phone: editFormData.phone.trim(),
        company_name: editFormData.company_name.trim(),
        category_group: editFormData.category_group,
        business_type: editFormData.business_type || null,
        work_mode: editFormData.work_mode,
        city: editFormData.work_mode === 'online' ? 'Online' : (editFormData.city || ''),
        district: editFormData.work_mode === 'online' ? 'All' : (editFormData.district || 'All'),
        username: editFormData.username?.replace('@', '').trim() || null,
        booking_url: editFormData.booking_url?.trim() || null,
        photo_url: editFormData.photo_url?.trim() || null,
        default_referral_commission_percent: parseFloat(editFormData.default_referral_commission_percent) || 10
      };
      
      console.log('[PartnerAnalytics] Saving partner data:', { partnerId, updateData });
      
      const result = await updatePartnerInfo(partnerId, updateData);
      console.log('[PartnerAnalytics] Update result:', result);
      
      if (!result) {
        throw new Error('Данные не были сохранены. Попробуйте еще раз.');
      }
      
      // Обновляем локальные данные
      const updatedPartnerData = await getPartnerInfo(partnerId);
      console.log('[PartnerAnalytics] Reloaded partner data:', updatedPartnerData);
      
      if (!updatedPartnerData) {
        throw new Error('Не удалось загрузить обновленные данные. Обновите страницу.');
      }
      
      setPartnerData(updatedPartnerData);
      if (updatedPartnerData?.city) {
        setPartnerCity(updatedPartnerData.city);
        const districtsForCity = getDistrictsByCity(updatedPartnerData.city);
        setDistricts(districtsForCity);
      }
      
      setIsEditing(false);
      setEditFormData({});
      setEditErrors({});
      setSaveSuccess(true);
      
      // Скрываем сообщение об успехе через 3 секунды
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('[PartnerAnalytics] Error saving partner data:', error);
      const errorMessage = error?.message || error?.error?.message || 'Ошибка при сохранении данных';
      console.error('[PartnerAnalytics] Error details:', {
        message: errorMessage,
        code: error?.code,
        details: error?.details,
        hint: error?.hint
      });
      setEditErrors({ submit: errorMessage });
    } finally {
      setSaving(false);
    }
  };

  if (!partnerId) {
    return (
      <div className="min-h-screen bg-sakura-cream dark:bg-sakura-cream flex items-center justify-center p-4">
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
      <div className="min-h-screen bg-sakura-cream dark:bg-sakura-cream flex items-center justify-center p-4">
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

  // Не блокируем отображение, если нет статистики - показываем данные партнера

  return (
    <div className="min-h-screen bg-sakura-cream dark:bg-sakura-cream">
      {/* Заголовок */}
      <div className="bg-sakura-surface dark:bg-sakura-surface border-b border-sakura-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            📈 Дашборд Партнёра
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            ID: {partnerId}
          </p>
        </div>
      </div>

      {/* Данные партнера */}
      {partnerData && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-sakura-surface dark:bg-sakura-surface rounded-xl shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                📋 Данные партнера
              </h2>
              {!isEditing && (
                <button
                  onClick={() => {
                    setIsEditing(true);
                    setEditFormData({
                      name: partnerData.name || '',
                      phone: partnerData.phone || '',
                      company_name: partnerData.company_name || '',
                      city: partnerData.city || '',
                      district: partnerData.district || '',
                      username: partnerData.username || '',
                      booking_url: partnerData.booking_url || '',
                      photo_url: partnerData.photo_url || '',
                      category_group: partnerData.category_group || '',
                      business_type: partnerData.business_type || '',
                      work_mode: partnerData.work_mode || 'offline',
                      default_referral_commission_percent: partnerData.default_referral_commission_percent || 10
                    });
                    if (partnerData.city) {
                      const districtsForCity = getDistrictsByCity(partnerData.city);
                      setDistricts(districtsForCity);
                    }
                    setSaveSuccess(false);
                    setEditErrors({});
                  }}
                  className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors shadow-md hover:shadow-lg font-medium"
                >
                  ✏️ Редактировать данные
                </button>
              )}
            </div>

            {!isEditing ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Имя</label>
                  <p className="text-gray-900 dark:text-white">{partnerData.name || 'Не указано'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Телефон</label>
                  <p className="text-gray-900 dark:text-white">{partnerData.phone || 'Не указан'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Название компании</label>
                  <p className="text-gray-900 dark:text-white">{partnerData.company_name || 'Не указано'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Тип бизнеса</label>
                  <p className="text-gray-900 dark:text-white">
                    {partnerData.category_group === 'beauty' ? '💄 Красота и здоровье' :
                     partnerData.category_group === 'food' ? '🍔 Еда' :
                     partnerData.category_group === 'education' ? '📚 Образование' :
                     partnerData.category_group === 'retail' ? '🛍️ Розница' :
                     partnerData.category_group === 'sports_fitness' ? '🏋️ Спорт и фитнес' :
                     partnerData.category_group === 'entertainment' ? '🎬 Развлечения' :
                     partnerData.category_group === 'healthcare' ? '🏥 Здравоохранение' :
                     partnerData.category_group === 'services' ? '🧹 Услуги' :
                     partnerData.category_group === 'self_discovery' ? '🔮 Самопознание' :
                     partnerData.category_group === 'influencer' ? '🤳 Блогер' :
                     partnerData.category_group === 'b2b' ? '🏢 B2B' :
                     partnerData.category_group || 'Не указано'}
                  </p>
                </div>
                {partnerData.business_type && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Категория услуг</label>
                    <p className="text-gray-900 dark:text-white">
                      {serviceCategories.find(c => c.code === partnerData.business_type)?.emoji || ''} {serviceCategories.find(c => c.code === partnerData.business_type)?.name || partnerData.business_type}
                    </p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Режим работы</label>
                  <p className="text-gray-900 dark:text-white">
                    {partnerData.work_mode === 'online' ? '🌍 Онлайн' :
                     partnerData.work_mode === 'hybrid' ? '🔄 Гибрид' :
                     partnerData.work_mode === 'offline' ? '📍 Оффлайн' :
                     partnerData.work_mode || 'Не указано'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Город</label>
                  <p className="text-gray-900 dark:text-white">{partnerData.city || 'Не указан'}</p>
                </div>
                {partnerData.district && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Район</label>
                    <p className="text-gray-900 dark:text-white">{partnerData.district}</p>
                  </div>
                )}
                {partnerData.username && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Telegram username</label>
                    <p className="text-gray-900 dark:text-white">@{partnerData.username}</p>
                  </div>
                )}
                {partnerData.booking_url && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Ссылка на бронирование</label>
                    <p className="text-gray-900 dark:text-white">
                      <a href={partnerData.booking_url} target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline">
                        {partnerData.booking_url}
                      </a>
                    </p>
                  </div>
                )}
                {partnerData.photo_url && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Фото для карточек</label>
                    <div className="mt-1">
                      <img
                        src={partnerData.photo_url}
                        alt={partnerData.company_name || 'Фото партнёра'}
                        className="w-16 h-16 rounded-full object-cover border border-sakura-border"
                      />
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Процент комиссии системе</label>
                  <p className="text-gray-900 dark:text-white">{partnerData.default_referral_commission_percent || 10}%</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSavePartnerData} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Имя *
                    </label>
                    <input
                      type="text"
                      value={editFormData.name || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-sakura-border rounded-lg bg-sakura-surface dark:bg-sakura-surface text-sakura-dark dark:text-white"
                      required
                    />
                    {editErrors.name && <p className="text-red-500 text-xs mt-1">{editErrors.name}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Телефон *
                    </label>
                    <input
                      type="tel"
                      value={editFormData.phone || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-sakura-border rounded-lg bg-sakura-surface dark:bg-sakura-surface text-sakura-dark dark:text-white"
                      required
                    />
                    {editErrors.phone && <p className="text-red-500 text-xs mt-1">{editErrors.phone}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Название компании *
                    </label>
                    <input
                      type="text"
                      value={editFormData.company_name || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, company_name: e.target.value })}
                      className="w-full px-3 py-2 border border-sakura-border rounded-lg bg-sakura-surface dark:bg-sakura-surface text-sakura-dark dark:text-white"
                      required
                    />
                    {editErrors.company_name && <p className="text-red-500 text-xs mt-1">{editErrors.company_name}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Тип бизнеса *
                    </label>
                    <select
                      value={editFormData.category_group || ''}
                      onChange={(e) => {
                        setEditFormData({ ...editFormData, category_group: e.target.value, business_type: '' });
                      }}
                      className="w-full px-3 py-2 border border-sakura-border rounded-lg bg-sakura-surface dark:bg-sakura-surface text-sakura-dark dark:text-white"
                      required
                    >
                      <option value="">Выберите тип бизнеса</option>
                      <option value="beauty">💄 Красота и здоровье</option>
                      <option value="food">🍔 Еда (Кафе/Ресторан)</option>
                      <option value="education">📚 Образование</option>
                      <option value="retail">🛍️ Розница (Магазин)</option>
                      <option value="sports_fitness">🏋️ Спорт и фитнес</option>
                      <option value="entertainment">🎬 Развлечения</option>
                      <option value="healthcare">🏥 Здравоохранение</option>
                      <option value="services">🧹 Услуги</option>
                      <option value="self_discovery">🔮 Самопознание</option>
                      <option value="influencer">🤳 Блогер/Инфлюенсер</option>
                      <option value="b2b">🏢 B2B</option>
                    </select>
                    {editErrors.category_group && <p className="text-red-500 text-xs mt-1">{editErrors.category_group}</p>}
                  </div>
                  {editFormData.category_group && editFormData.category_group !== 'influencer' && getCategoriesByGroup(editFormData.category_group).length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Категория услуг
                      </label>
                      <select
                        value={editFormData.business_type || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, business_type: e.target.value })}
                        className="w-full px-3 py-2 border border-sakura-border rounded-lg bg-sakura-surface dark:bg-sakura-surface text-sakura-dark dark:text-white"
                      >
                        <option value="">Выберите категорию услуг</option>
                        {getCategoriesByGroup(editFormData.category_group).map((category) => (
                          <option key={category.code} value={category.code}>
                            {category.emoji} {category.name}
                          </option>
                        ))}
                      </select>
                      {editErrors.business_type && <p className="text-red-500 text-xs mt-1">{editErrors.business_type}</p>}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Режим работы *
                    </label>
                    <select
                      value={editFormData.work_mode || 'offline'}
                      onChange={(e) => setEditFormData({ ...editFormData, work_mode: e.target.value })}
                      className="w-full px-3 py-2 border border-sakura-border rounded-lg bg-sakura-surface dark:bg-sakura-surface text-sakura-dark dark:text-white"
                      required
                    >
                      <option value="offline">📍 Оффлайн (только в своем городе)</option>
                      <option value="online">🌍 Онлайн (всем городам)</option>
                      <option value="hybrid">🔄 Гибрид (онлайн + оффлайн, всем городам)</option>
                    </select>
                    {editErrors.work_mode && <p className="text-red-500 text-xs mt-1">{editErrors.work_mode}</p>}
                  </div>
                  {(editFormData.work_mode === 'offline' || editFormData.work_mode === 'hybrid') && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Город {editFormData.work_mode === 'offline' ? '*' : '(для оффлайн части)'}
                        </label>
                        <select
                          value={editFormData.city || ''}
                          onChange={(e) => {
                            const city = e.target.value;
                            const districtsForCity = getDistrictsByCity(city);
                            setDistricts(districtsForCity);
                            const newDistrict = (districtsForCity.length > 0 && districtsForCity[0].value === 'All') ? 'All' : '';
                            setEditFormData({ ...editFormData, city, district: newDistrict });
                          }}
                          className="w-full px-3 py-2 border border-sakura-border rounded-lg bg-sakura-surface dark:bg-sakura-surface text-sakura-dark dark:text-white"
                          required={editFormData.work_mode === 'offline'}
                        >
                          <option value="">Выберите город</option>
                          {cities.map((city) => (
                            <option key={city.value} value={city.value}>
                              {city.label}
                            </option>
                          ))}
                        </select>
                        {editErrors.city && <p className="text-red-500 text-xs mt-1">{editErrors.city}</p>}
                        {editFormData.work_mode === 'hybrid' && (
                          <p className="text-gray-500 text-xs mt-1">
                            💡 Укажите город для оффлайн части работы
                          </p>
                        )}
                      </div>
                      {editFormData.city && districts.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Район {editFormData.work_mode === 'offline' ? '*' : '(для оффлайн части)'}
                          </label>
                          <select
                            value={editFormData.district || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, district: e.target.value })}
                            className="w-full px-3 py-2 border border-sakura-border rounded-lg bg-sakura-surface dark:bg-sakura-surface text-sakura-dark dark:text-white"
                            required={editFormData.work_mode === 'offline'}
                          >
                            <option value="">Выберите район</option>
                            {districts.map((district) => (
                              <option key={district.value} value={district.value}>
                                {district.label}
                              </option>
                            ))}
                          </select>
                          {editErrors.district && <p className="text-red-500 text-xs mt-1">{editErrors.district}</p>}
                        </div>
                      )}
                    </>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Telegram username (необязательно)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">@</span>
                      <input
                        type="text"
                        value={editFormData.username || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, username: e.target.value.replace('@', '').trim() })}
                        className="w-full pl-8 pr-3 py-2 border border-sakura-border rounded-lg bg-sakura-surface dark:bg-sakura-surface text-sakura-dark dark:text-white"
                        placeholder="vera_yoga03"
                      />
                    </div>
                    {editErrors.username && <p className="text-red-500 text-xs mt-1">{editErrors.username}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Ссылка на бронирование (необязательно)
                    </label>
                    <input
                      type="url"
                      value={editFormData.booking_url || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, booking_url: e.target.value })}
                      className="w-full px-3 py-2 border border-sakura-border rounded-lg bg-sakura-surface dark:bg-sakura-surface text-sakura-dark dark:text-white"
                      placeholder="https://example.com/booking"
                    />
                    {editErrors.booking_url && <p className="text-red-500 text-xs mt-1">{editErrors.booking_url}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      URL фото для карточек (необязательно)
                    </label>
                    <input
                      type="url"
                      value={editFormData.photo_url || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, photo_url: e.target.value })}
                      className="w-full px-3 py-2 border border-sakura-border rounded-lg bg-sakura-surface dark:bg-sakura-surface text-sakura-dark dark:text-white"
                      placeholder="https://example.com/photo.jpg"
                    />
                    <p className="text-gray-500 text-xs mt-1">Ссылка на фото. Будет показано в каталоге услуг вместо иконки категории.</p>
                    {editErrors.photo_url && <p className="text-red-500 text-xs mt-1">{editErrors.photo_url}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Процент комиссии системе *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={editFormData.default_referral_commission_percent || 10}
                        onChange={(e) => setEditFormData({ ...editFormData, default_referral_commission_percent: parseFloat(e.target.value) || 10 })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        required
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">%</span>
                    </div>
                    {editErrors.default_referral_commission_percent && <p className="text-red-500 text-xs mt-1">{editErrors.default_referral_commission_percent}</p>}
                  </div>
                </div>
                {saveSuccess && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mt-4">
                    <p className="text-green-700 dark:text-green-300 text-sm flex items-center gap-2">
                      <span>✅</span>
                      <span>Данные успешно сохранены!</span>
                    </p>
                  </div>
                )}
                {editErrors.submit && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mt-4">
                    <p className="text-red-700 dark:text-red-300 text-sm">{editErrors.submit}</p>
                  </div>
                )}
                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Сохранение...' : '💾 Сохранить'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setEditFormData({});
                      setEditErrors({});
                    }}
                    className="px-6 py-2 bg-sakura-border dark:bg-sakura-border text-sakura-muted rounded-lg hover:bg-sakura-cream dark:hover:bg-sakura-surface transition-colors"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Фильтр по периоду и метрики - только если есть статистика */}
      {stats && (
        <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-2 flex-wrap">
          {[7, 30, 90, 365].map(days => (
            <button
              key={days}
              onClick={() => setPeriod(days)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                period === days
                  ? 'bg-primary-500 text-white'
                  : 'bg-sakura-surface dark:bg-sakura-surface text-sakura-muted hover:bg-sakura-cream dark:hover:bg-sakura-surface'
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
              value={formatCurrencySimple(stats.totalRevenue, partnerCity)}
              subtitle={`Средний чек: ${formatCurrencySimple(stats.avgCheck, partnerCity)}`}
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

        {/* Кэшбэк и депозит */}
        {cashbackStats && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              💳 Кэшбэк и депозит
            </h2>
            {cashbackStats.deposit_balance < 0 && (
              <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-4 flex items-center gap-3">
                <span className="text-xl">⚠️</span>
                <div>
                  <p className="text-red-700 dark:text-red-300 font-medium">Депозит исчерпан</p>
                  <p className="text-red-600 dark:text-red-400 text-sm">
                    Остаток: <strong>{cashbackStats.deposit_balance.toLocaleString('ru-RU')} баллов</strong>. Пополните депозит для продолжения начисления кэшбэка.
                  </p>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <MetricCard
                icon={cashbackStats.deposit_balance >= 0 ? '🟢' : '🔴'}
                title="Депозит"
                value={cashbackStats.deposit_balance.toLocaleString('ru-RU')}
                subtitle="Текущий остаток (баллы)"
              />
              <MetricCard
                icon="🎁"
                title="Выдано кэшбэка"
                value={cashbackStats.total_cashback_amount.toLocaleString('ru-RU')}
                subtitle={`За период (баллы)`}
              />
              <MetricCard
                icon="🧾"
                title="Транзакций"
                value={cashbackStats.transactions_count}
                subtitle="С начислением кэшбэка"
              />
              <MetricCard
                icon="📊"
                title="Средний кэшбэк"
                value={cashbackStats.avg_cashback_per_check.toLocaleString('ru-RU')}
                subtitle="На чек (баллы)"
              />
            </div>
            {cashbackStats.periods && cashbackStats.periods.length > 0 && (
              <div className="bg-sakura-surface dark:bg-sakura-surface rounded-xl p-6 shadow-sm">
                <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-4">Кэшбэк по дням</h3>
                <div className="flex items-end gap-1 h-24 overflow-x-auto">
                  {cashbackStats.periods.map((p) => {
                    const max = Math.max(...cashbackStats.periods.map(x => x.cashback_amount), 1);
                    const pct = Math.round((p.cashback_amount / max) * 100);
                    return (
                      <div key={p.label} className="flex flex-col items-center gap-1 min-w-[32px]" title={`${p.label}: ${p.cashback_amount} баллов`}>
                        <div
                          className="w-6 bg-primary-400 dark:bg-primary-500 rounded-t"
                          style={{ height: `${Math.max(pct, 4)}%` }}
                        />
                        <span className="text-xs text-gray-400 rotate-45 origin-left">{p.label.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

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
            <div className="bg-sakura-surface dark:bg-sakura-surface rounded-xl p-6 shadow-sm">
              <div className="text-center">
                <div className="text-5xl font-bold text-primary-500 mb-2">
                  {stats.npsScore}
                </div>
                <div className="text-lg text-gray-600 dark:text-gray-400">
                  Чистый NPS
                </div>
                <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                  Средняя оценка: {stats.avgNPS}
                </div>
              </div>
            </div>
            <div className="bg-sakura-surface dark:bg-sakura-surface rounded-xl p-6 shadow-sm">
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
                  <div className="flex items-center justify-between pt-2 border-t border-sakura-border">
                  <span className="text-purple-600 dark:text-purple-400 font-medium">
                    👑 Активных промоутеров
                  </span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    {stats.totalPromoters || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Churn Prevention / Реактивация */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              🔄 Авто-реактивация (Churn Prevention)
            </h2>
            {!isEditingReactivation && (
              <button
                onClick={() => {
                  setIsEditingReactivation(true);
                  setReactivationFormData({ ...reactivationSettings });
                  setReactivationSaveSuccess(false);
                }}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors shadow-md hover:shadow-lg font-medium"
              >
                ⚙️ Настроить
              </button>
            )}
          </div>
          
          {/* Статистика реактивации */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <MetricCard
              icon="📤"
              title="Отправлено"
              value={reactivationStats.sent}
              subtitle={`За ${period} дней`}
            />
            <MetricCard
              icon="❌"
              title="Ошибки"
              value={reactivationStats.failed}
              subtitle={`За ${period} дней`}
            />
            <MetricCard
              icon="📊"
              title="Всего попыток"
              value={reactivationStats.total}
              subtitle={`За ${period} дней`}
            />
          </div>
          {typeof reactivationStats.returned_clients === 'number' && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Клиентов, вернувшихся после реактивации: {reactivationStats.returned_clients} (визитов: {reactivationStats.return_visits || 0})
            </p>
          )}
          
          {/* Текущие настройки или форма редактирования */}
          <div className="bg-sakura-surface dark:bg-sakura-surface rounded-xl p-6 shadow-sm">
            {!isEditingReactivation ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Статус</label>
                  <p className="text-gray-900 dark:text-white">
                    {reactivationSettings.enabled ? '✅ Включено' : '⏸️ Выключено'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Минимум дней без визита</label>
                  <p className="text-gray-900 dark:text-white">{reactivationSettings.min_days} дней</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Коэффициент превышения</label>
                  <p className="text-gray-900 dark:text-white">×{reactivationSettings.coefficient}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Cooldown между сообщениями</label>
                  <p className="text-gray-900 dark:text-white">{reactivationSettings.cooldown_days} дней</p>
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Шаблон сообщения</label>
                  <p className="text-gray-900 dark:text-white whitespace-pre-wrap mt-1">
                    {reactivationSettings.message_template || 'Используется шаблон по умолчанию'}
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={async (e) => {
                e.preventDefault();
                setSavingReactivation(true);
                try {
                  await updatePartnerReactivationSettings(partnerId, reactivationFormData);
                  setReactivationSettings(reactivationFormData);
                  setIsEditingReactivation(false);
                  setReactivationSaveSuccess(true);
                } catch (err) {
                  console.error('Error saving reactivation settings:', err);
                } finally {
                  setSavingReactivation(false);
                }
              }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Авто-реактивация
                    </label>
                    <select
                      value={reactivationFormData.enabled ? 'true' : 'false'}
                      onChange={(e) => setReactivationFormData({...reactivationFormData, enabled: e.target.value === 'true'})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="true">✅ Включено</option>
                      <option value="false">⏸️ Выключено</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Минимум дней без визита
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={reactivationFormData.min_days || ''}
                      onChange={(e) => setReactivationFormData({...reactivationFormData, min_days: parseInt(e.target.value) || 7})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Клиент не получит сообщение раньше этого срока</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Коэффициент превышения
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      step="0.1"
                      value={reactivationFormData.coefficient || ''}
                      onChange={(e) => setReactivationFormData({...reactivationFormData, coefficient: parseFloat(e.target.value) || 2.0})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Например, 2.0 = сообщение, если клиент отсутствует в 2 раза дольше обычного</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Cooldown (дней)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={reactivationFormData.cooldown_days || ''}
                      onChange={(e) => setReactivationFormData({...reactivationFormData, cooldown_days: parseInt(e.target.value) || 14})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Минимальный интервал между повторными сообщениями одному клиенту</p>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Шаблон сообщения
                    </label>
                    <textarea
                      rows={6}
                      value={reactivationFormData.message_template ?? ''}
                      onChange={(e) => setReactivationFormData({...reactivationFormData, message_template: e.target.value})}
                      placeholder="Оставьте пустым для шаблона по умолчанию"
                        className="w-full px-3 py-2 border border-sakura-border rounded-lg bg-sakura-surface dark:bg-sakura-surface text-sakura-dark dark:text-white font-mono text-sm"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Плейсхолдеры: {'{client_name}'}, {'{partner_name}'}, {'{offer_text}'}, {'{partner_contact_link}'}. Поддерживается Markdown.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    disabled={savingReactivation}
                    className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
                  >
                    {savingReactivation ? 'Сохранение...' : '💾 Сохранить'}
                  </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingReactivation(false);
                    setReactivationFormData({});
                  }}
                  className="px-6 py-2 bg-sakura-border dark:bg-sakura-border text-sakura-muted rounded-lg hover:bg-sakura-cream dark:hover:bg-sakura-surface transition-colors"
                >
                    Отмена
                  </button>
                </div>
              </form>
            )}
            {reactivationSaveSuccess && !isEditingReactivation && (
              <div className="mt-4 p-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg">
                ✅ Настройки реактивации сохранены
              </div>
            )}
          </div>
        </div>

        {/* Клиенты, которые поставили оценку */}
        {ratedClients.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              💬 Клиенты, которые поставили оценку
            </h2>
            <div className="bg-sakura-surface dark:bg-sakura-surface rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-sakura-border dark:divide-sakura-border">
                  <thead className="bg-sakura-cream dark:bg-sakura-surface">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Клиент
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Оценка
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Отзыв
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Дата
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Действия
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-sakura-surface dark:bg-sakura-surface divide-y divide-sakura-border dark:divide-sakura-border">
                    {ratedClients.map((client, index) => {
                      const ratingColor = 
                        client.rating >= 9 ? 'text-green-600 dark:text-green-400' :
                        client.rating >= 7 ? 'text-yellow-600 dark:text-yellow-400' :
                        'text-red-600 dark:text-red-400';
                      
                      const ratingEmoji = 
                        client.rating >= 9 ? '🟢' :
                        client.rating >= 7 ? '🟡' :
                        '🔴';
                      
                      const date = new Date(client.created_at);
                      const formattedDate = date.toLocaleDateString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      });

                      return (
                        <tr key={index} className="hover:bg-sakura-cream dark:hover:bg-sakura-surface">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {client.clientName}
                            </div>
                            {client.clientPhone && (
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {client.clientPhone}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-lg font-bold ${ratingColor} flex items-center gap-2`}>
                              <span>{ratingEmoji}</span>
                              <span>{client.rating}/10</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 max-w-xs">
                            {client.feedback ? (
                              <span className="italic">«{client.feedback}»</span>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-600">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {formattedDate}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {client.clientChatId && (
                              <button
                                onClick={() => {
                                  openTelegramLink(`tg://user?id=${client.clientChatId}`);
                                }}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                              >
                                <span>💬</span>
                                <span>Написать</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

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
        </>
      )}

      {/* Сообщение, если нет статистики, но есть данные партнера */}
      {!stats && partnerData && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 text-center">
            <h3 className="text-lg font-bold text-blue-900 dark:text-blue-200 mb-2">
              📊 Статистика появится после первых транзакций
            </h3>
            <p className="text-blue-700 dark:text-blue-300">
              Как только у вас появятся клиенты и транзакции, здесь отобразится аналитика.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// Компонент карточки метрики
const MetricCard = ({ icon, title, value, subtitle }) => (
  <div className="bg-sakura-surface dark:bg-sakura-surface rounded-xl p-6 shadow-sm">
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
      <div className="text-sm text-gray-500 dark:text-gray-400">
        {subtitle}
      </div>
    )}
  </div>
);

export default PartnerAnalytics;

