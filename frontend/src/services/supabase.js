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
    filteredData = filteredData.filter(service => 
      service.partner?.city === city
    )
  }
  
  if (district) {
    filteredData = filteredData.filter(service => 
      service.partner?.district === district
    )
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

