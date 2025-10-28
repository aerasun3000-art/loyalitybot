import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// API методы для работы с данными

/**
 * Получить информацию о клиенте
 */
export const getClientInfo = async (chatId) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('chat_id', chatId)
    .single()
  
  if (error) {
    console.error('Error fetching client:', error)
    return null
  }
  
  return data
}

/**
 * Получить баланс клиента
 */
export const getClientBalance = async (chatId) => {
  const { data, error } = await supabase
    .from('users')
    .select('balance, name, status')
    .eq('chat_id', chatId)
    .single()
  
  if (error) {
    console.error('Error fetching balance:', error)
    return { balance: 0, name: '', status: 'inactive' }
  }
  
  return data
}

/**
 * Получить историю транзакций клиента
 */
export const getClientTransactions = async (chatId, limit = 50) => {
  const { data, error } = await supabase
    .from('transactions')
    .select(`
      *,
      partner:partners!transactions_partner_chat_id_fkey(name, company_name)
    `)
    .eq('client_chat_id', chatId)
    .order('date_time', { ascending: false })
    .limit(limit)
  
  if (error) {
    console.error('Error fetching transactions:', error)
    return []
  }
  
  return data
}

/**
 * Получить все активные акции
 */
export const getActivePromotions = async () => {
  const today = new Date().toISOString().split('T')[0]
  
  const { data, error } = await supabase
    .from('promotions')
    .select(`
      *,
      partners(name, company_name)
    `)
    .eq('is_active', true)
    .gte('end_date', today)
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching promotions:', error)
    return []
  }
  
  // Переименовываем partners в partner для совместимости с кодом
  return data?.map(promo => ({
    ...promo,
    partner: promo.partners
  })) || []
}

/**
 * Получить все одобренные услуги
 */
export const getApprovedServices = async () => {
  const { data, error } = await supabase
    .from('services')
    .select(`
      *,
      partner:partners!services_partner_chat_id_fkey(name, company_name, city, district)
    `)
    .eq('approval_status', 'Approved')
    .eq('is_active', true)
    .order('price_points', { ascending: true })
  
  if (error) {
    console.error('Error fetching services:', error)
    return []
  }
  
  return data
}

/**
 * Получить услуги с фильтрацией по городу и району
 */
export const getFilteredServices = async (city = null, district = null) => {
  let query = supabase
    .from('services')
    .select(`
      *,
      partner:partners!services_partner_chat_id_fkey(name, company_name, city, district)
    `)
    .eq('approval_status', 'Approved')
    .eq('is_active', true)
  
  // Фильтрация выполняется на стороне клиента после получения данных
  // так как city и district находятся в связанной таблице partners
  
  const { data, error } = await query.order('price_points', { ascending: true })
  
  if (error) {
    console.error('Error fetching filtered services:', error)
    return []
  }
  
  // Применяем фильтры на клиентской стороне
  let filteredData = data || []
  
  if (city) {
    filteredData = filteredData.filter(service => {
      // Показываем услугу если:
      // 1. Город партнера совпадает с выбранным
      // 2. У партнера город = "Все" (работает везде, например онлайн)
      // 3. У партнера нет указанного города (NULL) - работает везде
      return service.partner?.city === city || 
             service.partner?.city === 'Все' || 
             !service.partner?.city
    })
  }
  
  if (district) {
    filteredData = filteredData.filter(service => {
      // Показываем услугу если:
      // 1. Район партнера совпадает с выбранным
      // 2. У партнера район = "Все" (работает во всех районах)
      // 3. У партнера нет указанного района (NULL) - работает везде
      return service.partner?.district === district || 
             service.partner?.district === 'Все' || 
             !service.partner?.district
    })
  }
  
  return filteredData
}

/**
 * Получить список уникальных городов из партнеров
 */
export const getCities = async () => {
  const { data, error } = await supabase
    .from('partners')
    .select('city')
    .not('city', 'is', null)
    .order('city')
  
  if (error) {
    console.error('Error fetching cities:', error)
    return []
  }
  
  // Получаем уникальные города
  const uniqueCities = [...new Set(data.map(item => item.city).filter(Boolean))]
  return uniqueCities
}

/**
 * Получить список районов для конкретного города
 */
export const getDistrictsByCity = async (city) => {
  if (!city) return []
  
  const { data, error } = await supabase
    .from('partners')
    .select('district')
    .eq('city', city)
    .not('district', 'is', null)
    .order('district')
  
  if (error) {
    console.error('Error fetching districts:', error)
    return []
  }
  
  // Получаем уникальные районы
  const uniqueDistricts = [...new Set(data.map(item => item.district).filter(Boolean))]
  return uniqueDistricts
}

/**
 * Регистрация нового клиента
 */
export const registerClient = async (clientData) => {
  const { data, error } = await supabase
    .from('users')
    .insert([
      {
        chat_id: clientData.chatId,
        phone: clientData.phone,
        name: clientData.name,
        balance: 0,
        status: 'active',
        registered_via: 'web_app',
        reg_date: new Date().toISOString()
      }
    ])
    .select()
    .single()
  
  if (error) {
    console.error('Error registering client:', error)
    throw error
  }
  
  return data
}

/**
 * Создать заявку на партнёрство
 */
export const createPartnerApplication = async (applicationData) => {
  const { data, error } = await supabase
    .from('partner_applications')
    .insert([
      {
        chat_id: applicationData.chatId,
        name: applicationData.name,
        phone: applicationData.phone,
        company_name: applicationData.companyName,
        city: applicationData.city || '',
        district: applicationData.district || '',
        status: 'Pending',
        created_at: new Date().toISOString()
      }
    ])
    .select()
    .single()
  
  if (error) {
    console.error('Error creating partner application:', error)
    throw error
  }
  
  return data
}

/**
 * Получить аналитику клиента
 */
export const getClientAnalytics = async (chatId) => {
  // Получаем базовую информацию
  const clientInfo = await getClientInfo(chatId)
  
  // Получаем статистику транзакций
  const { data: transactions } = await supabase
    .from('transactions')
    .select('operation_type, earned_points, spent_points, total_amount')
    .eq('client_chat_id', chatId)
  
  const totalEarned = transactions
    ?.filter(t => t.operation_type === 'accrual' || t.operation_type === 'enrollment_bonus')
    .reduce((sum, t) => sum + (t.earned_points || 0), 0) || 0
  
  const totalSpent = transactions
    ?.filter(t => t.operation_type === 'redemption')
    .reduce((sum, t) => sum + (t.spent_points || 0), 0) || 0
  
  const totalMoney = transactions
    ?.filter(t => t.operation_type === 'accrual')
    .reduce((sum, t) => sum + (t.total_amount || 0), 0) || 0
  
  return {
    ...clientInfo,
    analytics: {
      totalEarned,
      totalSpent,
      totalMoney,
      transactionCount: transactions?.length || 0
    }
  }
}

/**
 * Получить все опубликованные новости
 */
export const getPublishedNews = async () => {
  const { data, error } = await supabase
    .from('news')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching news:', error)
    return []
  }
  
  return data || []
}

/**
 * Получить новость по ID
 */
export const getNewsById = async (newsId) => {
  const { data, error } = await supabase
    .from('news')
    .select('*')
    .eq('id', newsId)
    .eq('is_published', true)
    .single()
  
  if (error) {
    console.error('Error fetching news by id:', error)
    return null
  }
  
  return data
}

/**
 * Увеличить счетчик просмотров новости
 */
export const incrementNewsViews = async (newsId) => {
  try {
    // Получаем текущее количество просмотров
    const { data: currentNews } = await supabase
      .from('news')
      .select('views_count')
      .eq('id', newsId)
      .single()
    
    if (!currentNews) return false
    
    const newViewsCount = (currentNews.views_count || 0) + 1
    
    // Обновляем счетчик
    const { error } = await supabase
      .from('news')
      .update({ views_count: newViewsCount })
      .eq('id', newsId)
    
    if (error) {
      console.error('Error incrementing views:', error)
      return false
    }
    
    return true
  } catch (error) {
    console.error('Error in incrementNewsViews:', error)
    return false
  }
}

// ============================================
// РАСШИРЕННАЯ АНАЛИТИКА ДЛЯ ПАРТНЕРОВ
// ============================================

/**
 * Получить расширенную статистику партнера
 * @param {string} partnerChatId - ID партнера
 * @param {number} periodDays - Период в днях (7, 30, 90, 365)
 * @returns {Promise<Object>} Детальная статистика
 */
export const getAdvancedPartnerStats = async (partnerChatId, periodDays = 30) => {
  try {
    const now = new Date()
    const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000)
    
    // Получаем всех клиентов партнера
    const { data: allClients, error: clientsError } = await supabase
      .from('users')
      .select('chat_id, reg_date')
      .eq('referral_source', partnerChatId)
    
    if (clientsError) throw clientsError
    
    const totalClients = allClients?.length || 0
    const newClients = allClients?.filter(c => 
      c.reg_date && new Date(c.reg_date) >= periodStart
    ).length || 0
    
    // Получаем транзакции за период
    const { data: transactions, error: txnError } = await supabase
      .from('transactions')
      .select('*')
      .eq('partner_chat_id', partnerChatId)
      .gte('date_time', periodStart.toISOString())
    
    if (txnError) throw txnError
    
    // Анализ транзакций
    const stats = {
      period_days: periodDays,
      total_clients: totalClients,
      new_clients: newClients,
      active_clients: 0,
      returning_clients: 0,
      
      total_revenue: 0,
      avg_check: 0,
      avg_ltv: 0,
      
      total_transactions: transactions?.length || 0,
      accrual_transactions: 0,
      redemption_transactions: 0,
      total_points_accrued: 0,
      total_points_redeemed: 0,
      
      avg_frequency: 0,
      churn_rate: 0,
      
      avg_nps: 0,
      nps_score: 0,
      promoters: 0,
      passives: 0,
      detractors: 0,
      
      registration_to_first_purchase: 0,
      repeat_purchase_rate: 0
    }
    
    if (!transactions || transactions.length === 0) {
      return stats
    }
    
    // Подсчет метрик
    const accrualAmounts = []
    const activeClientsSet = new Set()
    const clientTransactionCounts = {}
    const clientRevenues = {}
    
    transactions.forEach(txn => {
      const clientId = txn.client_chat_id
      activeClientsSet.add(clientId)
      clientTransactionCounts[clientId] = (clientTransactionCounts[clientId] || 0) + 1
      
      if (txn.operation_type === 'accrual') {
        stats.accrual_transactions++
        const amount = parseFloat(txn.total_amount) || 0
        stats.total_revenue += amount
        accrualAmounts.push(amount)
        stats.total_points_accrued += txn.earned_points || 0
        clientRevenues[clientId] = (clientRevenues[clientId] || 0) + amount
      } else if (txn.operation_type === 'redemption') {
        stats.redemption_transactions++
        stats.total_points_redeemed += txn.spent_points || 0
      } else if (txn.operation_type === 'enrollment_bonus') {
        stats.total_points_accrued += txn.earned_points || 0
      }
    })
    
    stats.active_clients = activeClientsSet.size
    stats.returning_clients = Object.values(clientTransactionCounts).filter(count => count > 1).length
    
    // Средний чек
    if (accrualAmounts.length > 0) {
      stats.avg_check = parseFloat((accrualAmounts.reduce((a, b) => a + b, 0) / accrualAmounts.length).toFixed(2))
    }
    
    // Средний LTV
    const revenueValues = Object.values(clientRevenues)
    if (revenueValues.length > 0) {
      stats.avg_ltv = parseFloat((revenueValues.reduce((a, b) => a + b, 0) / revenueValues.length).toFixed(2))
    }
    
    // Средняя частота
    if (stats.active_clients > 0) {
      stats.avg_frequency = parseFloat((stats.total_transactions / stats.active_clients).toFixed(2))
    }
    
    // Churn rate
    if (totalClients > 0) {
      const inactiveClients = totalClients - stats.active_clients
      stats.churn_rate = parseFloat(((inactiveClients / totalClients) * 100).toFixed(2))
    }
    
    // NPS метрики
    const { data: npsRatings } = await supabase
      .from('nps_ratings')
      .select('rating')
      .eq('partner_chat_id', partnerChatId)
      .gte('created_at', periodStart.toISOString())
    
    if (npsRatings && npsRatings.length > 0) {
      const ratings = npsRatings.map(r => r.rating)
      stats.avg_nps = parseFloat((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2))
      stats.promoters = ratings.filter(r => r >= 9).length
      stats.passives = ratings.filter(r => r === 7 || r === 8).length
      stats.detractors = ratings.filter(r => r <= 6).length
      
      const totalRatings = ratings.length
      stats.nps_score = Math.round(((stats.promoters - stats.detractors) / totalRatings) * 100)
    }
    
    // Конверсии
    const clientsWithPurchases = Object.keys(clientRevenues).length
    if (totalClients > 0) {
      stats.registration_to_first_purchase = parseFloat(((clientsWithPurchases / totalClients) * 100).toFixed(2))
    }
    if (clientsWithPurchases > 0) {
      stats.repeat_purchase_rate = parseFloat(((stats.returning_clients / clientsWithPurchases) * 100).toFixed(2))
    }
    
    return stats
    
  } catch (error) {
    console.error('Error fetching advanced partner stats:', error)
    return null
  }
}

/**
 * Получить статистику партнера по периодам (для графиков)
 * @param {string} partnerChatId - ID партнера
 * @param {string} startDate - Начало периода (ISO format)
 * @param {string} endDate - Конец периода (ISO format)
 * @returns {Promise<Object>} Данные по дням
 */
export const getPartnerStatsByPeriod = async (partnerChatId, startDate, endDate) => {
  try {
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('partner_chat_id', partnerChatId)
      .gte('date_time', startDate)
      .lte('date_time', endDate)
      .order('date_time', { ascending: true })
    
    if (error) throw error
    
    // Группируем по дням
    const dailyData = {}
    const allClients = new Set()
    
    transactions?.forEach(txn => {
      const date = new Date(txn.date_time).toISOString().split('T')[0]
      
      if (!dailyData[date]) {
        dailyData[date] = {
          date,
          revenue: 0,
          transactions: 0,
          clients: new Set(),
          points_accrued: 0
        }
      }
      
      dailyData[date].transactions++
      dailyData[date].clients.add(txn.client_chat_id)
      allClients.add(txn.client_chat_id)
      
      if (txn.operation_type === 'accrual') {
        dailyData[date].revenue += parseFloat(txn.total_amount) || 0
      }
      
      if (txn.operation_type === 'accrual' || txn.operation_type === 'enrollment_bonus') {
        dailyData[date].points_accrued += txn.earned_points || 0
      }
    })
    
    // Преобразуем в массив для графиков
    const dailyStats = Object.values(dailyData)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(day => ({
        date: day.date,
        revenue: parseFloat(day.revenue.toFixed(2)),
        transactions: day.transactions,
        unique_clients: day.clients.size,
        points_accrued: day.points_accrued
      }))
    
    // Итоговые показатели
    const totals = {
      revenue: parseFloat(dailyStats.reduce((sum, day) => sum + day.revenue, 0).toFixed(2)),
      transactions: transactions?.length || 0,
      unique_clients: allClients.size,
      points_accrued: dailyStats.reduce((sum, day) => sum + day.points_accrued, 0)
    }
    
    return {
      period: { start: startDate, end: endDate },
      daily_stats: dailyStats,
      totals
    }
    
  } catch (error) {
    console.error('Error fetching partner stats by period:', error)
    return null
  }
}

/**
 * Получить когортный анализ клиентов партнера
 * @param {string} partnerChatId - ID партнера
 * @returns {Promise<Object>} Когортные данные
 */
export const getPartnerCohortAnalysis = async (partnerChatId) => {
  try {
    // Получаем всех клиентов партнера
    const { data: clients, error: clientsError } = await supabase
      .from('users')
      .select('chat_id, reg_date')
      .eq('referral_source', partnerChatId)
    
    if (clientsError) throw clientsError
    
    if (!clients || clients.length === 0) {
      return { cohorts: [] }
    }
    
    // Группируем по месяцам регистрации
    const cohortGroups = {}
    
    clients.forEach(client => {
      if (!client.reg_date) return
      
      const date = new Date(client.reg_date)
      const cohortMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      if (!cohortGroups[cohortMonth]) {
        cohortGroups[cohortMonth] = []
      }
      cohortGroups[cohortMonth].push(client.chat_id)
    })
    
    // Анализируем каждую когорту
    const cohorts = []
    
    for (const [month, clientIds] of Object.entries(cohortGroups)) {
      const { data: cohortTxns } = await supabase
        .from('transactions')
        .select('client_chat_id, total_amount, operation_type')
        .eq('partner_chat_id', partnerChatId)
        .in('client_chat_id', clientIds)
      
      const cohortRevenue = cohortTxns
        ?.filter(t => t.operation_type === 'accrual')
        .reduce((sum, t) => sum + (parseFloat(t.total_amount) || 0), 0) || 0
      
      cohorts.push({
        month,
        clients_count: clientIds.length,
        total_revenue: parseFloat(cohortRevenue.toFixed(2)),
        total_transactions: cohortTxns?.length || 0,
        avg_revenue_per_client: clientIds.length > 0 
          ? parseFloat((cohortRevenue / clientIds.length).toFixed(2)) 
          : 0
      })
    }
    
    // Сортируем по месяцам
    cohorts.sort((a, b) => a.month.localeCompare(b.month))
    
    return { cohorts }
    
  } catch (error) {
    console.error('Error in cohort analysis:', error)
    return { cohorts: [] }
  }
}

/**
 * Получить топ клиентов партнера по LTV
 * @param {string} partnerChatId - ID партнера
 * @param {number} limit - Количество клиентов
 * @returns {Promise<Array>} Массив топ клиентов
 */
export const getTopClientsByLTV = async (partnerChatId, limit = 10) => {
  try {
    // Получаем всех клиентов партнера
    const { data: clients, error: clientsError } = await supabase
      .from('users')
      .select('chat_id, name, phone, balance, status, reg_date')
      .eq('referral_source', partnerChatId)
    
    if (clientsError) throw clientsError
    
    if (!clients || clients.length === 0) {
      return []
    }
    
    // Получаем транзакции для расчета LTV
    const { data: transactions } = await supabase
      .from('transactions')
      .select('client_chat_id, total_amount, operation_type, date_time')
      .eq('partner_chat_id', partnerChatId)
    
    // Считаем LTV для каждого клиента
    const clientLTV = {}
    const clientTxnCount = {}
    
    transactions?.forEach(txn => {
      const clientId = txn.client_chat_id
      
      if (txn.operation_type === 'accrual') {
        clientLTV[clientId] = (clientLTV[clientId] || 0) + (parseFloat(txn.total_amount) || 0)
      }
      clientTxnCount[clientId] = (clientTxnCount[clientId] || 0) + 1
    })
    
    // Объединяем данные клиентов с LTV
    const clientsWithLTV = clients.map(client => ({
      ...client,
      ltv: clientLTV[client.chat_id] || 0,
      transactions_count: clientTxnCount[client.chat_id] || 0,
      avg_check: clientTxnCount[client.chat_id] 
        ? (clientLTV[client.chat_id] || 0) / clientTxnCount[client.chat_id]
        : 0
    }))
    
    // Сортируем по LTV и берем топ
    return clientsWithLTV
      .sort((a, b) => b.ltv - a.ltv)
      .slice(0, limit)
      .map(client => ({
        chat_id: client.chat_id,
        name: client.name,
        phone: client.phone,
        balance: client.balance,
        status: client.status,
        ltv: parseFloat(client.ltv.toFixed(2)),
        transactions_count: client.transactions_count,
        avg_check: parseFloat(client.avg_check.toFixed(2)),
        reg_date: client.reg_date
      }))
    
  } catch (error) {
    console.error('Error fetching top clients:', error)
    return []
  }
}

