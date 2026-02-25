import { createClient } from '@supabase/supabase-js'
import { getResolvedApiUrl } from '../utils/apiResolver'

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
  // Если chatId null или undefined, возвращаем null
  if (!chatId) {
    return null
  }
  
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('chat_id', chatId)
    .maybeSingle() // Используем maybeSingle вместо single - не падает если нет строк
  
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
  // Если chatId null или undefined, возвращаем дефолтные значения
  if (!chatId) {
    return { balance: 0, name: '', status: 'inactive' }
  }
  
  const { data, error } = await supabase
    .from('users')
    .select('balance, name, status')
    .eq('chat_id', chatId)
    .maybeSingle() // Используем maybeSingle вместо single - не падает если нет строк
  
  if (error) {
    console.error('Error fetching balance:', error)
    return { balance: 0, name: '', status: 'inactive' }
  }
  
  // Если данных нет, возвращаем дефолтные значения
  return data || { balance: 0, name: '', status: 'inactive' }
}

export const getClientKarma = async (chatId) => {
  if (!chatId) return { karmaScore: 50, karmaLevel: 'reliable' }

  const [
    { data: userData },
    { data: npsData },
    { data: referralData },
  ] = await Promise.all([
    supabase.from('users').select('karma_score, karma_level').eq('chat_id', chatId).maybeSingle(),
    supabase.from('nps_ratings').select('rating').eq('client_chat_id', chatId),
    supabase.from('referral_tree').select('total_transactions').eq('referrer_chat_id', chatId).gt('total_transactions', 0),
  ])

  let score = 50

  if (npsData) {
    for (const { rating } of npsData) {
      if (rating >= 9) score += 15
      else if (rating >= 7) score += 5
      else if (rating <= 6) score -= 10
    }
  }

  if (referralData) {
    score += referralData.length * 25
  }

  score = Math.max(0, Math.min(100, score))

  let level = 'sprout'
  if (score > 75) level = 'golden'
  else if (score > 50) level = 'regular'
  else if (score > 25) level = 'reliable'

  if (userData && (userData.karma_score !== score || userData.karma_level !== level)) {
    supabase
      .from('users')
      .update({ karma_score: score, karma_level: level })
      .eq('chat_id', chatId)
      .then(() => {})
  }

  return { karmaScore: score, karmaLevel: level }
}

/**
 * Проверить, что пользователь уже закрыл онбординг («Больше не показывать»)
 * @param {string} chatId - Chat ID пользователя
 * @returns {Promise<boolean>}
 */
export const getOnboardingSeen = async (chatId) => {
  if (!chatId) return false
  const { data, error } = await supabase
    .from('users')
    .select('onboarding_seen')
    .eq('chat_id', chatId)
    .maybeSingle()
  if (error) {
    console.warn('getOnboardingSeen:', error)
    return false
  }
  return !!data?.onboarding_seen
}

/**
 * Сохранить на сервере, что пользователь нажал «Больше не показывать»
 * @param {string} chatId - Chat ID пользователя
 */
export const setOnboardingSeen = async (chatId) => {
  if (!chatId) return
  const { error } = await supabase
    .from('users')
    .update({ onboarding_seen: true })
    .eq('chat_id', chatId)
  if (error) console.warn('setOnboardingSeen:', error)
}

/**
 * Обновить предпочитаемую валюту пользователя
 * @param {string} chatId - Chat ID пользователя
 * @param {string} currencyCode - Код валюты (USD, VND, RUB, KZT)
 */
export const updateUserCurrency = async (chatId, currencyCode) => {
  if (!chatId) return
  const { error } = await supabase
    .from('users')
    .update({ preferred_currency: currencyCode })
    .eq('chat_id', chatId)
  if (error) throw error
}

/**
 * Получить историю транзакций клиента
 */
export const getClientTransactions = async (chatId, limit = 50) => {
  const { data, error } = await supabase
    .from('transactions')
    .select(`
      *,
      partner:partners!transactions_partner_chat_id_fkey(name, company_name, city)
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

const TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum', 'diamond']

/**
 * Получить все активные акции (с фильтрацией по тиру для tier_only)
 * @param {string} userTier - тир пользователя (по умолчанию bronze)
 */
export const getActivePromotions = async (userTier = 'bronze') => {
  const today = new Date().toISOString().split('T')[0]
  const tierIdx = TIER_ORDER.indexOf(userTier)
  const tiersUpToUser = tierIdx >= 0 ? TIER_ORDER.slice(0, tierIdx + 1).join(',') : 'bronze'

  let query = supabase
    .from('promotions')
    .select(`
      *,
      partners(name, company_name, booking_url, google_maps_link, business_type, chat_id)
    `)
    .eq('is_active', true)
    .eq('approval_status', 'Approved')
    .gte('end_date', today)

  // tier_visibility=all — показываем всем; tier_only — только если min_tier <= userTier
  query = query.or(
    `tier_visibility.eq.all,and(tier_visibility.eq.tier_only,min_tier.in.(${tiersUpToUser}))`
  )

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching promotions:', error)
    return []
  }

  return data?.map(promo => ({
    ...promo,
    partner: promo.partners
  })) || []
}

/**
 * Получить акцию по ID (включая min_tier, tier_visibility)
 */
export const getPromotionById = async (id) => {
  const { data, error } = await supabase
    .from('promotions')
    .select(`
      *,
      partners(name, company_name, booking_url, google_maps_link)
    `)
    .eq('id', id)
    .eq('approval_status', 'Approved')
    .single()
  
  if (error) {
    console.error('Error fetching promotion:', error)
    return null
  }
  
  if (!data) {
    return null
  }
  
  // Переименовываем partners в partner для совместимости с кодом
  return {
    ...data,
    partner: data.partners
  }
}

/**
 * Получить активные акции для услуги
 * @param {string} serviceId - UUID услуги
 * @returns {Promise<Array>} Массив акций
 */
export const getPromotionsForService = async (serviceId) => {
  if (!serviceId) return []
  
  try {
    // Используем функцию БД или делаем JOIN через promotion_services
    const { data: promotionServices, error } = await supabase
      .from('promotion_services')
      .select(`
        promotion_id,
        promotions (
          *,
          partners(name, company_name, booking_url, google_maps_link)
        )
      `)
      .eq('service_id', serviceId)
    
    if (error) {
      console.error('Error fetching promotions for service:', error)
      return []
    }
    
    if (!promotionServices || promotionServices.length === 0) {
      return []
    }
    
    // Фильтруем активные одобренные акции
    const today = new Date().toISOString().split('T')[0]
    const activePromotions = promotionServices
      .map(ps => ps.promotions)
      .filter(p => 
        p && 
        p.is_active && 
        (p.approval_status || 'Approved') === 'Approved' &&
        p.start_date <= today && 
        p.end_date >= today
      )
      .map(p => ({
        ...p,
        partner: p.partners
      }))
    
    return activePromotions
  } catch (error) {
    console.error('Error in getPromotionsForService:', error)
    return []
  }
}

/**
 * Получить все одобренные услуги
 */
export const getApprovedServices = async () => {
  // Сначала получаем услуги без join (чтобы избежать ошибки FK)
  const { data: services, error: servicesError } = await supabase
    .from('services')
    .select('*')
    .eq('approval_status', 'Approved')
    .eq('is_active', true)
    .order('price_points', { ascending: true })
  
  if (servicesError) {
    console.error('Error fetching services:', servicesError)
    return []
  }
  
  if (!services || services.length === 0) {
    return []
  }
  
  // Получаем уникальные partner_chat_id
  const partnerIds = [...new Set(services.map(s => s.partner_chat_id).filter(Boolean))]
  
  if (partnerIds.length === 0) {
    return services.map(s => ({ ...s, partner: null }))
  }
  
  // Получаем данные партнёров отдельным запросом
  const { data: partners, error: partnersError } = await supabase
    .from('partners')
    .select('chat_id, name, company_name, city, district, business_type, username, contact_link, google_maps_link, work_mode, category_group, photo_url')
    .in('chat_id', partnerIds)
  
  if (partnersError) {
    console.error('Error fetching partners:', partnersError)
    // Возвращаем услуги без данных партнёров
    return services.map(s => ({ ...s, partner: null }))
  }
  
  // Создаём мапу партнёров для быстрого поиска
  const partnersMap = {}
  if (partners && partners.length > 0) {
    console.log('📊 Partners loaded from DB (getApprovedServices):', partners.length, 'partners')
    partners.forEach(p => {
      // Нормализуем chat_id к строке для корректного сравнения
      const chatIdKey = String(p.chat_id)
      partnersMap[chatIdKey] = p
      console.log(`📋 Partner ${chatIdKey}: username=${p.username}, work_mode=${p.work_mode}, contact_link=${p.contact_link}`)
    })
    
    // Логируем партнёров, которые не были найдены
    const foundChatIds = new Set(partners.map(p => String(p.chat_id)))
    const missingChatIds = partnerIds.filter(id => !foundChatIds.has(String(id)))
    if (missingChatIds.length > 0) {
      console.warn('⚠️ Partners not found in DB (getApprovedServices):', missingChatIds)
    }
  } else {
    console.warn('⚠️ No partners loaded or empty array')
  }
  
  // Объединяем услуги с данными партнёров
  // Нормализуем partner_chat_id к строке для корректного сравнения
  return services.map(service => ({
    ...service,
    partner: partnersMap[String(service.partner_chat_id)] || null
  }))
}

/**
 * Получить все услуги всех партнёров для модератора (без фильтра по approval_status и is_active)
 */
export const getAllServicesForModerator = async () => {
  const { data: services, error: servicesError } = await supabase
    .from('services')
    .select('*')
    .order('price_points', { ascending: true })

  if (servicesError) {
    console.error('Error fetching services for moderator:', servicesError)
    return []
  }

  if (!services || services.length === 0) {
    return []
  }

  const partnerIds = [...new Set(services.map(s => s.partner_chat_id).filter(Boolean))]
  if (partnerIds.length === 0) {
    return services.map(s => ({ ...s, partner: null }))
  }

  const { data: partners, error: partnersError } = await supabase
    .from('partners')
    .select('chat_id, name, company_name, city, district, business_type, username, contact_link, google_maps_link, work_mode, category_group, photo_url')
    .in('chat_id', partnerIds)

  if (partnersError) {
    console.error('Error fetching partners for moderator:', partnersError)
    return services.map(s => ({ ...s, partner: null }))
  }

  const partnersMap = {}
  if (partners && partners.length > 0) {
    partners.forEach(p => {
      partnersMap[String(p.chat_id)] = p
    })
  }

  return services.map(service => ({
    ...service,
    partner: partnersMap[String(service.partner_chat_id)] || null
  }))
}

/**
 * Получить услуги с фильтрацией по городу и району
 */
export const getFilteredServices = async (city = null, district = null, category = null) => {
  // Получаем услуги без join
  let query = supabase
    .from('services')
    .select('*')
    .eq('approval_status', 'Approved')
    .eq('is_active', true)
  
  // Фильтрация по категории выполняется на уровне запроса
  if (category) {
    query = query.eq('category', category)
  }
  
  const { data: services, error: servicesError } = await query.order('price_points', { ascending: true })
  
  if (servicesError) {
    console.error('Error fetching filtered services:', servicesError)
    return []
  }
  
  if (!services || services.length === 0) {
    return []
  }
  
  // Получаем данные партнёров отдельным запросом
  const partnerIds = [...new Set(services.map(s => s.partner_chat_id).filter(Boolean))]
  
  let partnersMap = {}
  if (partnerIds.length > 0) {
    // Преобразуем chat_id в строки для корректного сравнения
    const partnerIdsStr = partnerIds.map(id => String(id))
    
    const { data: partners, error: partnersError } = await supabase
      .from('partners')
      .select('chat_id, name, company_name, city, district, business_type, username, contact_link, booking_url, google_maps_link, work_mode, category_group, photo_url')
      .in('chat_id', partnerIdsStr)
    
    if (!partnersError && partners) {
      console.log('📊 Partners loaded from DB:', partners.length, 'partners')
      partners.forEach(p => {
        // Нормализуем chat_id к строке для корректного сравнения
        const chatIdKey = String(p.chat_id)
        partnersMap[chatIdKey] = p
        console.log(`📋 Partner ${chatIdKey}: username=${p.username}, work_mode=${p.work_mode}, contact_link=${p.contact_link}`)
      })
      
      // Логируем партнёров, которые не были найдены
      const foundChatIds = new Set(partners.map(p => String(p.chat_id)))
      const missingChatIds = partnerIdsStr.filter(id => !foundChatIds.has(id))
      if (missingChatIds.length > 0) {
        console.warn('⚠️ Partners not found in DB:', missingChatIds)
      }
    } else if (partnersError) {
      console.error('❌ Error loading partners:', partnersError)
    }
  }
  
  // Объединяем услуги с данными партнёров
  // Нормализуем partner_chat_id к строке для корректного сравнения
  let filteredData = services.map(service => ({
    ...service,
    partner: partnersMap[String(service.partner_chat_id)] || null
  }))
  
  // Применяем фильтры на клиентской стороне
  if (city) {
    filteredData = filteredData.filter(service => {
      const partner = service.partner
      
      // Если партнёр не найден, показываем услугу (для обратной совместимости)
      // Но логируем для отладки
      if (!partner) {
        console.warn('⚠️ Service without partner data:', {
          serviceId: service.id,
          partner_chat_id: service.partner_chat_id,
          title: service.title
        })
        // Показываем услугу, если партнёр не найден (может быть новый партнёр)
        return true
      }
      
      // Логика фильтрации по work_mode:
      // - online/hybrid: показываем всем городам
      // - offline: показываем только в своем городе
      const workMode = partner.work_mode || 'offline'
      
      if (workMode === 'online' || workMode === 'hybrid') {
        // Онлайн и гибридные партнеры показываются всем городам
        return true
      }
      
      // Для offline партнеров проверяем город
      // Также поддерживаем старую логику для обратной совместимости
      return partner.city === city || 
             partner.city === 'Все' || 
             !partner.city
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
 * Получить список партнёров, которых клиент уже оценил (NPS)
 */
export const getClientRatedPartners = async (clientChatId) => {
  if (!clientChatId) return []

  try {
    const { data, error } = await supabase
      .from('nps_ratings')
      .select('partner_chat_id')
      .eq('client_chat_id', clientChatId)
      .not('partner_chat_id', 'is', null)

    if (error) {
      console.error('Error fetching client rated partners:', error)
      return []
    }

    const uniquePartners = [...new Set((data || []).map(item => item.partner_chat_id).filter(Boolean))]
    return uniquePartners
  } catch (err) {
    console.error('Unexpected error fetching client rated partners:', err)
    return []
  }
}

/**
 * Получить оценки NPS клиента по партнёрам (для отображения в History: «Оценено: N»)
 * @returns {Promise<Object>} Объект { [partner_chat_id]: { rating, feedback } }
 */
export const getClientNpsRatings = async (clientChatId) => {
  if (!clientChatId) return {}
  try {
    const { data, error } = await supabase
      .from('nps_ratings')
      .select('partner_chat_id, rating, feedback')
      .eq('client_chat_id', clientChatId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching client NPS ratings:', error)
      return {}
    }
    const map = {}
    ;(data || []).forEach(row => {
      if (row.partner_chat_id && map[row.partner_chat_id] === undefined) {
        map[row.partner_chat_id] = { rating: row.rating, feedback: row.feedback || '' }
      }
    })
    return map
  } catch (err) {
    console.error('Unexpected error fetching client NPS ratings:', err)
    return {}
  }
}

/**
 * Сохранить или обновить оценку NPS (одна оценка на пару client, partner)
 */
export const upsertNpsRating = async (clientChatId, partnerChatId, rating, feedback = '', masterName = '') => {
  if (!clientChatId || !partnerChatId) {
    throw new Error('client_chat_id and partner_chat_id are required')
  }
  const { data: existingRow } = await supabase
    .from('nps_ratings')
    .select('id')
    .eq('client_chat_id', clientChatId)
    .eq('partner_chat_id', partnerChatId)
    .order('created_at', { ascending: false })
    .limit(1)
  const existing = Array.isArray(existingRow) ? existingRow[0] : existingRow

  const payload = {
    client_chat_id: clientChatId,
    partner_chat_id: partnerChatId,
    rating: Number(rating),
    feedback: feedback || null,
    master_name: masterName || null
  }

  if (existing?.id) {
    const { error } = await supabase
      .from('nps_ratings')
      .update({ rating: payload.rating, feedback: payload.feedback, master_name: payload.master_name })
      .eq('id', existing.id)
    if (error) throw error
    return { updated: true, id: existing.id }
  }

  const { data: inserted, error } = await supabase
    .from('nps_ratings')
    .insert(payload)
    .select('id')
    .single()
  if (error) throw error
  return { updated: false, id: inserted?.id }
}

/**
 * Получить информацию о партнере, который добавил клиента (через приветственный бонус)
 */
export const getReferralPartnerInfo = async (clientChatId) => {
  if (!clientChatId) return null

  try {
    // Получаем referral_source (partner_chat_id) из таблицы users
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('referral_source')
      .eq('chat_id', clientChatId)
      .single()

    if (userError || !user || !user.referral_source) {
      return null
    }

    // referral_source: "partner_123" -> chat_id "123"; "ref_ABC" не даёт партнёра
    let partnerChatId = user.referral_source
    if (typeof partnerChatId === 'string' && partnerChatId.startsWith('partner_')) {
      partnerChatId = partnerChatId.slice(8)
    }

    // Получаем информацию о партнере
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('business_type, chat_id')
      .eq('chat_id', partnerChatId)
      .single()

    if (partnerError || !partner) {
      return null
    }

    return {
      chatId: partner.chat_id,
      businessType: partner.business_type || null
    }
  } catch (error) {
    console.error('Error getting referral partner info:', error)
    return null
  }
}

/**
 * Получить метрики партнёров (NPS, средняя оценка, количество отзывов)
 * @param {string[]} partnerIds - Массив ID партнёров
 * @returns {Promise<Object>} Объект с метриками для каждого партнёра
 */
/**
 * Получить информацию о партнере
 * Сначала проверяет таблицу partners, если данных нет - берет из partner_applications
 */
export const getPartnerInfo = async (partnerChatId) => {
  if (!partnerChatId) {
    return null
  }
  
  // Сначала пытаемся получить данные из таблицы partners (одобренные партнеры)
  // Примечание: phone нет в таблице partners, он только в partner_applications
  const { data: partnerData, error: partnerError } = await supabase
    .from('partners')
    .select('chat_id, name, company_name, city, district, google_maps_link, username, booking_url, category_group, work_mode, default_referral_commission_percent, business_type, photo_url')
    .eq('chat_id', partnerChatId)
    .maybeSingle()
  
  if (partnerError) {
    console.error('Error fetching partner info from partners table:', partnerError)
  }
  
  // Если данные найдены в partners, возвращаем их
  if (partnerData) {
    return partnerData
  }
  
  // Если данных нет в partners, пытаемся получить из partner_applications
  const { data: applicationData, error: applicationError } = await supabase
    .from('partner_applications')
    .select('chat_id, name, phone, company_name, city, district, username, booking_url, category_group, work_mode, default_referral_commission_percent, business_type')
    .eq('chat_id', partnerChatId)
    .maybeSingle()
  
  if (applicationError) {
    console.error('Error fetching partner info from partner_applications table:', applicationError)
    return null
  }
  
  // Если данные найдены в partner_applications, возвращаем их
  if (applicationData) {
    return applicationData
  }
  
  return null
}

/**
 * Получить роль пользователя из app_roles (moderator, admin).
 * Роль модератора первичнее пригласившего партнёра.
 */
export const getUserRole = async (chatId) => {
  if (!chatId) return null
  const { data, error } = await supabase
    .from('app_roles')
    .select('role')
    .eq('chat_id', String(chatId))
    .maybeSingle()
  if (error) {
    console.error('Error fetching user role:', error)
    return null
  }
  return data?.role ?? null
}

/**
 * Проверить, является ли пользователь модератором или админом (доступ к просмотру всех услуг)
 */
export const isModerator = async (chatId) => {
  const role = await getUserRole(chatId)
  return role === 'moderator' || role === 'admin'
}

/**
 * Обновить информацию о партнере
 * Обновляет данные в partners, если партнер одобрен, иначе обновляет partner_applications
 */
export const updatePartnerInfo = async (partnerChatId, updateData) => {
  if (!partnerChatId) {
    throw new Error('Partner chat ID is required')
  }
  
  // Сначала проверяем, есть ли партнер в таблице partners
  const { data: existingPartner, error: checkError } = await supabase
    .from('partners')
    .select('chat_id')
    .eq('chat_id', partnerChatId)
    .maybeSingle()
  
  if (checkError && checkError.code !== 'PGRST116') {
    console.error('Error checking partner existence:', checkError)
  }
  
  // Если партнер одобрен (есть в partners), обновляем partners
  // Но убираем phone, так как в таблице partners может не быть этого поля
  if (existingPartner) {
    const { phone, ...updateDataForPartners } = updateData
    const { data, error } = await supabase
      .from('partners')
      .update(updateDataForPartners)
      .eq('chat_id', partnerChatId)
      .select()
      .single()
    
    if (error) {
      console.error('Error updating partner info in partners table:', error)
      throw error
    }
    
    return data
  }
  
  // Если партнер не одобрен, обновляем partner_applications
  // photo_url есть только в partners, исключаем его
  const { photo_url, ...updateDataForApplications } = updateData
  const { data, error } = await supabase
    .from('partner_applications')
    .update(updateDataForApplications)
    .eq('chat_id', partnerChatId)
    .select()
    .single()
  
  if (error) {
    console.error('Error updating partner info in partner_applications table:', error)
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    })
    
    // Более понятное сообщение об ошибке
    if (error.code === '42501' || error.message?.includes('permission') || error.message?.includes('policy')) {
      throw new Error('Недостаточно прав для обновления данных. Обратитесь к администратору.')
    }
    
    throw error
  }
  
  // Проверяем, что данные действительно обновились
  if (!data) {
    throw new Error('Данные не были обновлены. Попробуйте еще раз.')
  }
  
  console.log('Successfully updated partner_applications:', data)
  return data
}

/**
 * Получить настройки реактивации партнёра (Churn Prevention)
 */
export const getPartnerReactivationSettings = async (partnerChatId) => {
  const defaults = {
    enabled: true,
    min_days: 7,
    coefficient: 2.0,
    cooldown_days: 14,
    message_template: ''
  }
  
  if (!partnerChatId) return defaults
  
  try {
    const { data, error } = await supabase
      .from('partners')
      .select('reactivation_enabled, reactivation_min_days, reactivation_coefficient, reactivation_cooldown_days, reactivation_message_template')
      .eq('chat_id', partnerChatId)
      .maybeSingle()
    
    if (error) {
      console.error('Error fetching reactivation settings:', error)
      return defaults
    }
    
    if (!data) return defaults
    
    return {
      enabled: data.reactivation_enabled ?? defaults.enabled,
      min_days: data.reactivation_min_days ?? defaults.min_days,
      coefficient: parseFloat(data.reactivation_coefficient) || defaults.coefficient,
      cooldown_days: data.reactivation_cooldown_days ?? defaults.cooldown_days,
      message_template: data.reactivation_message_template ?? defaults.message_template
    }
  } catch (err) {
    console.error('Error in getPartnerReactivationSettings:', err)
    return defaults
  }
}

/**
 * Обновить настройки реактивации партнёра (Churn Prevention)
 */
export const updatePartnerReactivationSettings = async (partnerChatId, settings) => {
  if (!partnerChatId) {
    throw new Error('Partner chat ID is required')
  }
  
  const updateData = {}
  if (settings.enabled !== undefined) updateData.reactivation_enabled = settings.enabled
  if (settings.min_days !== undefined) updateData.reactivation_min_days = settings.min_days
  if (settings.coefficient !== undefined) updateData.reactivation_coefficient = settings.coefficient
  if (settings.cooldown_days !== undefined) updateData.reactivation_cooldown_days = settings.cooldown_days
  if (settings.message_template !== undefined) updateData.reactivation_message_template = settings.message_template
  
  const { data, error } = await supabase
    .from('partners')
    .update(updateData)
    .eq('chat_id', partnerChatId)
    .select()
    .single()
  
  if (error) {
    console.error('Error updating reactivation settings:', error)
    throw error
  }
  
  return data
}

/**
 * Получить статистику реактивации партнёра за последние N дней (Churn Prevention)
 */
export const getReactivationStats = async (partnerChatId, days = 30) => {
  const result = { sent: 0, failed: 0, total: 0 }
  
  if (!partnerChatId) return result
  
  try {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    
    const { data, error } = await supabase
      .from('reactivation_events')
      .select('status')
      .eq('partner_chat_id', partnerChatId)
      .gte('sent_at', cutoff.toISOString())
    
    if (error) {
      console.error('Error fetching reactivation stats:', error)
      return result
    }
    
    for (const row of data || []) {
      result.total++
      if (row.status === 'sent') {
        result.sent++
      } else {
        result.failed++
      }
    }
    
    return result
  } catch (err) {
    console.error('Error in getReactivationStats:', err)
    return result
  }
}

/**
 * Проверить, является ли пользователь одобренным партнером
 * Логика: 
 * 1. Если партнер есть в таблице partners - он одобрен
 * 2. ИЛИ если в partner_applications статус = 'Approved'
 */
export const isApprovedPartner = async (chatId) => {
  if (!chatId) {
    console.log('[isApprovedPartner] No chatId provided')
    return false
  }
  
  // Преобразуем chatId в строку для консистентности
  const chatIdStr = String(chatId)
  console.log('[isApprovedPartner] Checking partner status for chatId:', chatIdStr)
  
  try {
    // 1. Проверяем наличие в таблице partners (если есть - партнер одобрен)
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('chat_id, name, company_name')
      .eq('chat_id', chatIdStr)
      .maybeSingle()
    
    if (partnerError) {
      console.error('[isApprovedPartner] Error querying partners:', partnerError)
    }
    
    if (partner) {
      console.log('[isApprovedPartner] Partner found in partners table - APPROVED')
      return true
    }
    
    // 2. Если не найден в partners, проверяем статус в partner_applications
    const { data: application, error: appError } = await supabase
      .from('partner_applications')
      .select('chat_id, status')
      .eq('chat_id', chatIdStr)
      .maybeSingle()
    
    if (appError) {
      console.error('[isApprovedPartner] Error querying partner_applications:', appError)
    }
    
    if (application) {
      const status = application.status
      const isApproved = status && (
        status === 'Approved' || 
        status === 'approved' || 
        status.toLowerCase() === 'approved'
      )
      console.log('[isApprovedPartner] Found in partner_applications, status:', status, 'Is approved:', isApproved)
      return isApproved
    }
    
    console.log('[isApprovedPartner] Partner not found in both tables')
    return false
  } catch (error) {
    console.error('[isApprovedPartner] Error checking partner status:', error)
    return false
  }
}

export const getPartnersMetrics = async (partnerIds) => {
  if (!partnerIds || partnerIds.length === 0) {
    return {}
  }

  try {
    // Получаем все NPS оценки для указанных партнёров
    const { data: npsRatings, error: npsError } = await supabase
      .from('nps_ratings')
      .select('partner_chat_id, rating')
      .in('partner_chat_id', partnerIds)
    
    if (npsError) {
      console.error('Error fetching partners NPS ratings:', npsError)
      return {}
    }

    // Группируем оценки по партнёрам и считаем метрики
    const metricsMap = {}
    
    partnerIds.forEach(partnerId => {
      const partnerRatings = npsRatings?.filter(r => r.partner_chat_id === partnerId) || []
      
      if (partnerRatings.length === 0) {
        metricsMap[partnerId] = {
          npsScore: 0,
          avgRating: 0,
          ratingsCount: 0,
          promoters: 0,
          passives: 0,
          detractors: 0
        }
        return
      }

      const ratings = partnerRatings.map(r => r.rating)
      const promoters = ratings.filter(r => r >= 9).length
      const passives = ratings.filter(r => r >= 7 && r <= 8).length
      const detractors = ratings.filter(r => r <= 6).length
      const totalRatings = ratings.length

      const npsScore = Math.round(((promoters - detractors) / totalRatings) * 100)
      const avgRating = parseFloat((ratings.reduce((sum, r) => sum + r, 0) / totalRatings).toFixed(2))

      metricsMap[partnerId] = {
        npsScore,
        avgRating,
        ratingsCount: totalRatings,
        promoters,
        passives,
        detractors
      }
    })

    return metricsMap
  } catch (error) {
    console.error('Error in getPartnersMetrics:', error)
    return {}
  }
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
  try {
    // Сначала проверяем, существует ли уже заявка с таким chat_id
    const { data: existing, error: checkError } = await supabase
      .from('partner_applications')
      .select('id')
      .eq('chat_id', applicationData.chatId)
      .maybeSingle()
    
    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing application:', checkError)
      // Продолжаем выполнение, даже если проверка не удалась
    }
    
    const applicationDataToSave = {
      chat_id: applicationData.chatId,
      name: applicationData.name,
      phone: applicationData.phone,
      company_name: applicationData.companyName,
      business_type: applicationData.businessType || null,
      city: applicationData.city || '',
      district: applicationData.district || '',
      username: applicationData.username || null, // Username мастера
      booking_url: applicationData.bookingUrl || null, // Ссылка на бронирование
      referred_by_chat_id: applicationData.referredByChatId || null, // Chat ID партнера, который пригласил
      // Новые поля для Экосистемы 2.0
      category_group: applicationData.categoryGroup || null,
      work_mode: applicationData.workMode || 'offline',
      default_referral_commission_percent: applicationData.referralCommissionPercent || 10,
      status: 'Pending',
      created_at: new Date().toISOString()
    }
    
    // Если заявка уже существует - обновляем её
    if (existing && existing.id) {
      const { data, error } = await supabase
        .from('partner_applications')
        .update(applicationDataToSave)
        .eq('id', existing.id)
        .select()
        .single()
      
      if (error) {
        console.error('Error updating partner application:', error)
        throw error
      }
      
      return data
    }
    
    // Если заявки нет - создаём новую
    const { data, error } = await supabase
      .from('partner_applications')
      .insert([applicationDataToSave])
      .select()
      .single()
    
    if (error) {
      console.error('Error creating partner application:', error)
      throw error
    }
    
    return data
  } catch (error) {
    console.error('Error in createPartnerApplication:', error)
    throw error
  }
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
    .maybeSingle() // Используем maybeSingle вместо single - не падает если нет строк
  
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
    const { data: currentNews, error: fetchError } = await supabase
      .from('news')
      .select('views_count')
      .eq('id', newsId)
      .maybeSingle() // Используем maybeSingle вместо single - не падает если нет строк
    
    if (fetchError || !currentNews) return false
    
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
      total_promoters: 0,
      
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
    
    // Получаем промоутеров среди клиентов партнера
    const clientIds = allClients?.map(c => c.chat_id) || []
    if (clientIds.length > 0) {
      const { data: promoters } = await supabase
        .from('promoters')
        .select('client_chat_id')
        .in('client_chat_id', clientIds)
        .eq('is_active', true)
      
      if (promoters) {
        stats.total_promoters = promoters.length
      }
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

/**
 * Получить персональные популярные категории услуг клиента
 * Анализирует транзакции клиента и возвращает категории, которые он чаще всего использует
 */
export const getClientPopularCategories = async (chatId) => {
  try {
    // Получаем все транзакции обмена (redemption) клиента
    const { data: redemptionTransactions, error: redemptionError } = await supabase
      .from('transactions')
      .select('partner_chat_id, date_time')
      .eq('client_chat_id', chatId)
      .eq('operation_type', 'redemption')
      .order('date_time', { ascending: false })
      .limit(100) // Берём последние 100 транзакций
    
    if (redemptionError) throw redemptionError
    
    // Если у клиента нет транзакций, возвращаем null (будем использовать глобальную статистику)
    if (!redemptionTransactions || redemptionTransactions.length === 0) {
      return null
    }
    
    // Получаем уникальные ID партнёров из транзакций
    const partnerIds = [...new Set(redemptionTransactions.map(t => t.partner_chat_id))]
    
    // Подсчитываем частоту посещения каждого партнёра
    const partnerFrequency = {}
    redemptionTransactions.forEach(t => {
      partnerFrequency[t.partner_chat_id] = (partnerFrequency[t.partner_chat_id] || 0) + 1
    })
    
    // Получаем услуги партнёров и их категории
    const { data: services, error: servicesError } = await supabase
      .from('services')
      .select('category, partner_chat_id')
      .in('partner_chat_id', partnerIds)
      .eq('approval_status', 'Approved')
      .eq('is_active', true)
    
    if (servicesError) throw servicesError
    
    // Подсчитываем популярность категорий на основе частоты посещения партнёров
    const categoryFrequency = {}
    
    services.forEach(service => {
      if (service.category) {
        const frequency = partnerFrequency[service.partner_chat_id] || 1
        categoryFrequency[service.category] = (categoryFrequency[service.category] || 0) + frequency
      }
    })
    
    // Также учитываем начисления (accrual) - если клиент часто получает баллы от партнёра,
    // значит он часто использует услуги этого типа
    const { data: accrualTransactions, error: accrualError } = await supabase
      .from('transactions')
      .select('partner_chat_id')
      .eq('client_chat_id', chatId)
      .eq('operation_type', 'accrual')
      .order('date_time', { ascending: false })
      .limit(50) // Берём последние 50 начислений
    
    if (!accrualError && accrualTransactions) {
      const accrualPartnerIds = [...new Set(accrualTransactions.map(t => t.partner_chat_id))]
      
      // Подсчитываем частоту начислений от каждого партнёра
      const accrualFrequency = {}
      accrualTransactions.forEach(t => {
        accrualFrequency[t.partner_chat_id] = (accrualFrequency[t.partner_chat_id] || 0) + 1
      })
      
      // Добавляем категории из партнёров начислений (с меньшим весом)
      const { data: accrualServices, error: accrualServicesError } = await supabase
        .from('services')
        .select('category, partner_chat_id')
        .in('partner_chat_id', accrualPartnerIds)
        .eq('approval_status', 'Approved')
        .eq('is_active', true)
      
      if (!accrualServicesError && accrualServices) {
        accrualServices.forEach(service => {
          if (service.category) {
            const frequency = (accrualFrequency[service.partner_chat_id] || 1) * 0.5 // Меньший вес для начислений
            categoryFrequency[service.category] = (categoryFrequency[service.category] || 0) + frequency
          }
        })
      }
    }
    
    // Сортируем категории по популярности
    const sortedCategories = Object.entries(categoryFrequency)
      .sort((a, b) => b[1] - a[1])
      .map(([category]) => category)
    
    return sortedCategories
  } catch (error) {
    console.error('Error getting client popular categories:', error)
    return null
  }
}

/**
 * Получить количество партнёров по категориям (business_type)
 * Таблица partners содержит только одобренных партнёров
 * @returns {Promise<Object>} { [business_type]: number }
 */
export const getCategoryPartnerCounts = async () => {
  try {
    const { data, error } = await supabase
      .from('partners')
      .select('business_type')

    if (error) {
      console.error('Error fetching category partner counts:', error)
      return {}
    }

    const counts = {}
    ;(data || []).forEach(row => {
      const bt = row.business_type
      if (bt) {
        counts[bt] = (counts[bt] || 0) + 1
      }
    })
    return counts
  } catch (err) {
    console.error('Error in getCategoryPartnerCounts:', err)
    return {}
  }
}

/**
 * Получить глобальную статистику популярных категорий услуг
 * Используется как fallback если у клиента нет истории транзакций
 */
export const getGlobalPopularCategories = async () => {
  try {
    // Получаем все транзакции обмена за последние 90 дней
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    
    const { data: transactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('partner_chat_id')
      .eq('operation_type', 'redemption')
      .gte('date_time', ninetyDaysAgo.toISOString())
    
    if (transactionsError) throw transactionsError
    
    if (!transactions || transactions.length === 0) {
      // Если нет транзакций, возвращаем дефолтный список популярных категорий
      return ['manicure', 'hairstyle', 'massage', 'cosmetologist', 'eyebrows', 'eyelashes', 'makeup', 'skincare']
    }
    
    // Получаем уникальные ID партнёров
    const partnerIds = [...new Set(transactions.map(t => t.partner_chat_id))]
    
    // Подсчитываем частоту посещения каждого партнёра
    const partnerFrequency = {}
    transactions.forEach(t => {
      partnerFrequency[t.partner_chat_id] = (partnerFrequency[t.partner_chat_id] || 0) + 1
    })
    
    // Получаем услуги партнёров
    const { data: services, error: servicesError } = await supabase
      .from('services')
      .select('category, partner_chat_id')
      .in('partner_chat_id', partnerIds)
      .eq('approval_status', 'Approved')
      .eq('is_active', true)
    
    if (servicesError) throw servicesError
    
    // Подсчитываем популярность категорий
    const categoryFrequency = {}
    
    services.forEach(service => {
      if (service.category) {
        const frequency = partnerFrequency[service.partner_chat_id] || 1
        categoryFrequency[service.category] = (categoryFrequency[service.category] || 0) + frequency
      }
    })
    
    // Сортируем категории по популярности
    const sortedCategories = Object.entries(categoryFrequency)
      .sort((a, b) => b[1] - a[1])
      .map(([category]) => category)
    
    // Если категорий меньше 8, добавляем популярные по умолчанию
    const defaultCategories = ['manicure', 'hairstyle', 'massage', 'cosmetologist', 'eyebrows', 'eyelashes', 'makeup', 'skincare']
    const combined = [...new Set([...sortedCategories, ...defaultCategories])]
    
    return combined.slice(0, 8)
  } catch (error) {
    console.error('Error getting global popular categories:', error)
    // Возвращаем дефолтный список при ошибке
    return ['manicure', 'hairstyle', 'massage', 'cosmetologist', 'eyebrows', 'eyelashes', 'makeup', 'skincare']
  }
}

/**
 * Получить настройку приложения
 */
export const getAppSetting = async (settingKey, defaultValue = null) => {
  try {
    // Проверяем, что supabase клиент инициализирован
    if (!supabase) {
      console.warn('Supabase client not initialized')
      return defaultValue
    }
    
    const { data, error } = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', settingKey)
      .limit(1)
      .maybeSingle()
    
    if (error) {
      // Не логируем ошибку, если это просто отсутствие записи (PGRST116)
      if (error.code !== 'PGRST116') {
        console.error(`Error fetching app setting ${settingKey}:`, error)
      }
      return defaultValue
    }
    
    return data?.setting_value || defaultValue
  } catch (error) {
    // Только логируем критические ошибки
    if (error.message && !error.message.includes('PGRST116')) {
      console.error(`Error in getAppSetting for ${settingKey}:`, error)
    }
    return defaultValue
  }
}

/**
 * Получить путь к фоновому изображению
 */
export const getBackgroundImage = async () => {
  return await getAppSetting('background_image', '/bg/default.jpg')
}

/**
 * Получить реферальную статистику пользователя
 */
export const getReferralStats = async (chatId) => {
  if (!chatId) {
    return null
  }

  try {
    // Получаем данные пользователя
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('referral_code, total_referrals, active_referrals, total_referral_earnings, referral_level')
      .eq('chat_id', chatId)
      .maybeSingle()

    if (userError) {
      console.error('Error fetching user referral data:', userError)
      return null
    }

    if (!userData) {
      return null
    }

    // Получаем список рефералов
    const { data: referrals, error: referralsError } = await supabase
      .from('referral_tree')
      .select('referred_chat_id, level, registered_at, is_active, total_earned_points, total_transactions')
      .eq('referrer_chat_id', chatId)
      .order('registered_at', { ascending: false })

    if (referralsError) {
      console.error('Error fetching referrals:', referralsError)
    }

    // Обогатить referrals именами из users
    const referredIds = [...new Set((referrals || []).map(r => r.referred_chat_id).filter(Boolean))]
    let namesMap = {}
    if (referredIds.length > 0) {
      const { data: usersData } = await supabase
        .from('users')
        .select('chat_id, name')
        .in('chat_id', referredIds)
      namesMap = (usersData || []).reduce((acc, u) => {
        acc[u.chat_id] = u.name || '—'
        return acc
      }, {})
    }
    const referralsWithNames = (referrals || []).map(r => ({
      ...r,
      referred_name: namesMap[r.referred_chat_id] || '—'
    }))

    // Получаем последние награды
    const { data: rewards, error: rewardsError } = await supabase
      .from('referral_rewards')
      .select('referred_chat_id, reward_type, points, created_at, description')
      .eq('referrer_chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (rewardsError) {
      console.error('Error fetching rewards:', rewardsError)
    }

    return {
      referral_code: userData.referral_code,
      total_referrals: userData.total_referrals || 0,
      active_referrals: userData.active_referrals || 0,
      total_earnings: userData.total_referral_earnings || 0,
      referral_level: userData.referral_level || 'bronze',
      referrals_list: referralsWithNames,
      recent_rewards: rewards || []
    }
  } catch (error) {
    console.error('Error in getReferralStats:', error)
    return null
  }
}

/**
 * Получить или создать реферальный код для пользователя
 */
export const getOrCreateReferralCode = async (chatId) => {
  if (!chatId) {
    return null
  }

  try {
    // Проверяем, есть ли уже код
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('referral_code')
      .eq('chat_id', chatId)
      .maybeSingle()

    if (userError) {
      console.error('Error fetching referral code:', userError)
      return null
    }

    if (userData?.referral_code) {
      return userData.referral_code
    }

    // Если кода нет, запрашиваем создание на бэкенде (для веб-приложения)
    const apiBaseUrl = getApiBaseUrl()
    if (apiBaseUrl) {
      const res = await fetch(`${apiBaseUrl}/api/referral-code/${encodeURIComponent(chatId)}`)
      if (res.ok) {
        const data = await res.json()
        if (data?.referral_code) return data.referral_code
      }
    }
    return null
  } catch (error) {
    console.error('Error in getOrCreateReferralCode:', error)
    return null
  }
}

/**
 * Получить базовый URL API
 */
const getApiBaseUrl = () => {
  // Приоритет 1: resolved URL (из apiResolver, после health-check)
  const resolved = getResolvedApiUrl()
  if (resolved) return resolved

  // Приоритет 2: переменная окружения
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }

  // Приоритет 3: localhost для разработки
  if (typeof window !== 'undefined' && window.location.origin.includes('localhost')) {
    return 'http://localhost:8001'
  }

  // Fallback: пустая строка
  console.warn('⚠️ VITE_API_URL не установлен! Установите переменную окружения.')
  return ''
}

/**
 * Уведомить партнёра о заинтересованности клиента (просмотр карточки)
 * @param {string} partnerChatId - Chat ID партнёра
 * @param {string} clientChatId - Chat ID клиента
 * @param {string} [clientUsername] - Username клиента в Telegram
 */
export const notifyPartnerInterest = async (partnerChatId, clientChatId, clientUsername) => {
  const apiBaseUrl = getApiBaseUrl()
  if (!apiBaseUrl) return
  try {
    const res = await fetch(`${apiBaseUrl}/api/notify-partner-interest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partner_chat_id: String(partnerChatId),
        client_chat_id: String(clientChatId),
        client_username: clientUsername || null
      })
    })
    if (!res.ok) throw new Error(await res.text())
  } catch (e) {
    throw e
  }
}

/**
 * Обменять баллы на услугу (старый метод, оставлен для совместимости)
 * @param {string} clientChatId - Chat ID клиента
 * @param {string} serviceId - UUID услуги
 * @returns {Promise<{success: boolean, new_balance?: number, points_spent?: number, service?: object, error?: string}>}
 */
export const redeemService = async (clientChatId, serviceId) => {
  const apiBaseUrl = getApiBaseUrl()
  
  if (!apiBaseUrl) {
    return {
      success: false,
      error: 'API URL не настроен. Пожалуйста, свяжитесь с поддержкой.'
    }
  }
  
  try {
    const response = await fetch(`${apiBaseUrl}/api/redeem`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_chat_id: clientChatId,
        service_id: serviceId
      })
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Ошибка сервера' }))
      return {
        success: false,
        error: errorData.detail || errorData.error || 'Ошибка при обмене баллов'
      }
    }
    
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error redeeming service:', error)
    return {
      success: false,
      error: 'Ошибка сети. Проверьте подключение к интернету.'
    }
  }
}

/**
 * Подготовить обмен баллов на акцию (частичная оплата)
 * @param {string} clientChatId - Chat ID клиента
 * @param {number} promotionId - ID акции
 * @param {number} pointsToSpend - Количество баллов для оплаты
 * @returns {Promise<{success: boolean, current_balance?: number, points_to_spend?: number, points_value_usd?: number, service_price?: number, cash_payment?: number, promotion?: object, qr_data?: string, error?: string}>}
 */
export const redeemPromotion = async (clientChatId, promotionId, pointsToSpend) => {
  const apiBaseUrl = getApiBaseUrl()
  
  if (!apiBaseUrl) {
    return {
      success: false,
      error: 'API URL не настроен. Пожалуйста, свяжитесь с поддержкой.'
    }
  }
  
  try {
    const response = await fetch(`${apiBaseUrl}/api/redeem-promotion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_chat_id: clientChatId,
        promotion_id: promotionId,
        points_to_spend: pointsToSpend
      })
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Ошибка сервера' }))
      return {
        success: false,
        error: errorData.detail || errorData.error || 'Ошибка при подготовке обмена баллов'
      }
    }
    
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error redeeming promotion:', error)
    return {
      success: false,
      error: 'Ошибка сети. Проверьте подключение к интернету.'
    }
  }
}

/**
 * Получить статистику кэшбэка партнёра
 */
export const getPartnerCashbackStats = async (partnerChatId, period = 'month') => {
  const apiBaseUrl = getApiBaseUrl()
  if (!apiBaseUrl) return null
  try {
    const res = await fetch(`${apiBaseUrl}/partners/${encodeURIComponent(partnerChatId)}/cashback-stats?period=${period}`)
    if (!res.ok) return null
    return await res.json()
  } catch (e) {
    console.error('Error fetching cashback stats:', e)
    return null
  }
}

/**
 * Получить список доступных городов из таблицы available_cities
 */
export const getAvailableCities = async () => {
  const { data, error } = await supabase
    .from('available_cities')
    .select('name')
    .order('name', { ascending: true })
  if (error) {
    console.error('Error fetching available_cities:', error)
    return []
  }
  return (data || []).map(row => row.name)
}

/**
 * Отправить заявку на добавление нового города
 */
export const submitCityRequest = async ({ chatId, cityName, requesterName }) => {
  const { data, error } = await supabase
    .from('city_requests')
    .insert([{
      chat_id: String(chatId),
      city_name: cityName.trim(),
      requester_name: requesterName || null,
    }])
    .select()
    .single()
  if (error) throw error
  return data
}

