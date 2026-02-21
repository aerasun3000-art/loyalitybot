/**
 * Supabase client utility for Cloudflare Workers
 */

/**
 * Get Supabase client configuration from environment
 */
export function getSupabaseConfig(env) {
  return {
    url: env.SUPABASE_URL,
    key: env.SUPABASE_KEY,
  };
}

/**
 * Make a request to Supabase REST API
 */
export async function supabaseRequest(env, endpoint, options = {}) {
  const config = getSupabaseConfig(env);
  const url = `${config.url}/rest/v1/${endpoint}`;
  
  const headers = {
    'apikey': config.key,
    'Authorization': `Bearer ${config.key}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Supabase error: ${response.status} - ${error}`);
  }

  const contentType = response.headers.get('content-type');
  const contentLength = response.headers.get('content-length');

  if (contentLength === '0' || !contentType || !contentType.includes('application/json')) {
    return [];
  }

  try {
    const text = await response.text();
    if (!text || text.trim() === '') {
      return [];
    }
    return JSON.parse(text);
  } catch (error) {
    console.error('[supabaseRequest] JSON parse error:', error);
    throw new Error(`Failed to parse Supabase response: ${error.message}`);
  }
}

/**
 * Get user by chat_id
 */
export async function getUserByChatId(env, chatId) {
  const result = await supabaseRequest(env, `users?chat_id=eq.${chatId}&select=*`);
  return result && result.length > 0 ? result[0] : null;
}

/**
 * Get partner by chat_id
 */
export async function getPartnerByChatId(env, chatId) {
  const result = await supabaseRequest(env, `partners?chat_id=eq.${chatId}&select=*`);
  return result && result.length > 0 ? result[0] : null;
}

/**
 * Create or update user
 */
export async function upsertUser(env, userData) {
  return supabaseRequest(env, 'users', {
    method: 'POST',
    headers: {
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify(userData),
  });
}

/**
 * Create transaction
 */
export async function createTransaction(env, transactionData) {
  return supabaseRequest(env, 'transactions', {
    method: 'POST',
    body: JSON.stringify(transactionData),
  });
}

/**
 * Update service approval status
 */
export async function updateServiceApprovalStatus(env, serviceId, newStatus) {
  try {
    const config = getSupabaseConfig(env);
    
    // UUID needs to be properly encoded in URL
    // Supabase REST API expects UUID in format: id=eq.{uuid}
    // For UUIDs with dashes, we need to ensure proper encoding
    const encodedServiceId = encodeURIComponent(serviceId);
    const url = `${config.url}/rest/v1/services?id=eq.${encodedServiceId}`;
    
    console.log('[updateServiceApprovalStatus] Updating service:', { 
      serviceId, 
      encodedServiceId, 
      newStatus,
      url: url.replace(config.key, '***') // Hide key in logs
    });
    
    // Prepare update data
    const updateData = { 
      approval_status: newStatus 
    };
    
    // If approving, also ensure is_active is true
    if (newStatus === 'Approved') {
      updateData.is_active = true;
    }
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'apikey': config.key,
        'Authorization': `Bearer ${config.key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[updateServiceApprovalStatus] Supabase error response:', {
        status: response.status,
        statusText: response.statusText,
        error
      });
      throw new Error(`Supabase error: ${response.status} - ${error}`);
    }

    const result = await response.json();
    console.log('[updateServiceApprovalStatus] Service updated successfully:', { 
      serviceId, 
      newStatus, 
      resultCount: Array.isArray(result) ? result.length : (result ? 1 : 0),
      result: Array.isArray(result) ? result[0] : result
    });
    
    // Return true if at least one row was updated
    const hasResult = Array.isArray(result) 
      ? result.length > 0 
      : (result && typeof result === 'object' && Object.keys(result).length > 0);
    
    if (!hasResult) {
      console.warn('[updateServiceApprovalStatus] No rows updated - service may not exist:', serviceId);
    }
    
    return hasResult;
  } catch (error) {
    console.error('[updateServiceApprovalStatus] Error:', error);
    console.error('[updateServiceApprovalStatus] Error details:', {
      message: error.message,
      stack: error.stack,
      serviceId,
      newStatus
    });
    throw error;
  }
}

/**
 * Get service by ID
 */
export async function getServiceById(env, serviceId) {
  try {
    // Clean and encode serviceId for URL
    const cleanServiceId = String(serviceId).trim();
    const encodedServiceId = encodeURIComponent(cleanServiceId);
    const url = `services?id=eq.${encodedServiceId}&select=*`;
    
    console.log('[getServiceById] Fetching service:', { serviceId: cleanServiceId, encodedServiceId });
    
    const result = await supabaseRequest(env, url);
    
    if (result && Array.isArray(result) && result.length > 0) {
      console.log('[getServiceById] Service found:', { id: result[0].id, title: result[0].title });
      return result[0];
    }
    
    console.warn('[getServiceById] Service not found:', cleanServiceId);
    return null;
  } catch (error) {
    console.error('[getServiceById] Error:', error);
    return null;
  }
}

/**
 * Get bot state for a chat_id
 */
export async function getBotState(env, chatId) {
  try {
    const result = await supabaseRequest(env, `bot_states?chat_id=eq.${chatId}&select=*`);
    if (result && result.length > 0) {
      const state = result[0];
      if (state.data && typeof state.data === 'string') {
        try {
          state.data = JSON.parse(state.data);
        } catch (e) {
          state.data = {};
        }
      }
      return state;
    }
    return null;
  } catch (error) {
    console.error('[getBotState] Error getting bot state:', error);
    return null;
  }
}

/**
 * Set bot state (create or update)
 */
export async function setBotState(env, chatId, state, data = {}) {
  try {
    const stateData = {
      chat_id: chatId,
      state: state,
      data: data,
      updated_at: new Date().toISOString(),
    };
    
    console.log('[setBotState] Setting state:', { chatId, state, data });
    
    const result = await supabaseRequest(env, 'bot_states', {
      method: 'POST',
      headers: {
        'Prefer': 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(stateData),
    });
    
    const finalResult = Array.isArray(result) ? (result[0] || result) : result;
    console.log('[setBotState] State set successfully:', finalResult);
    return finalResult;
  } catch (error) {
    console.error('[setBotState] ERROR:', error);
    throw error;
  }
}

/**
 * Clear bot state (delete)
 */
export async function clearBotState(env, chatId) {
  try {
    return await supabaseRequest(env, `bot_states?chat_id=eq.${chatId}`, {
      method: 'DELETE',
    });
  } catch (error) {
    console.error('[clearBotState] Error clearing bot state:', error);
    throw error;
  }
}

/**
 * Update bot state data (merge with existing data)
 */
export async function updateBotStateData(env, chatId, newData) {
  try {
    const currentState = await getBotState(env, chatId);
    if (!currentState) {
      throw new Error('State not found');
    }
    
    let currentData = currentState.data || {};
    if (typeof currentData === 'string') {
      try {
        currentData = JSON.parse(currentData);
      } catch (e) {
        currentData = {};
      }
    }
    
    const mergedData = { ...currentData, ...newData };
    return await setBotState(env, chatId, currentState.state, mergedData);
  } catch (error) {
    console.error('[updateBotStateData] Error updating bot state data:', error);
    throw error;
  }
}

/**
 * Get services by partner chat_id
 */
export async function getServicesByPartner(env, partnerChatId) {
  try {
    const result = await supabaseRequest(env, `services?partner_chat_id=eq.${partnerChatId}&select=*&order=created_at.desc`);
    return result || [];
  } catch (error) {
    console.error('[getServicesByPartner] Error:', error);
    return [];
  }
}

/**
 * Get service categories (hardcoded, matching category_group values in DB)
 */
export async function getServiceCategories(env) {
  return [
    { name: 'beauty', emoji: '💅', label: 'Красота и здоровье' },
    { name: 'self_discovery', emoji: '🔮', label: 'Самопознание' },
    { name: 'food', emoji: '🍽', label: 'Еда и рестораны' },
    { name: 'education', emoji: '📚', label: 'Образование' },
    { name: 'retail', emoji: '🛍', label: 'Розница' },
    { name: 'sports_fitness', emoji: '🏃', label: 'Спорт и фитнес' },
    { name: 'entertainment', emoji: '🎉', label: 'Развлечения' },
    { name: 'healthcare', emoji: '🏥', label: 'Здравоохранение' },
    { name: 'services', emoji: '🔧', label: 'Услуги' },
    { name: 'travel', emoji: '✈', label: 'Путешествия' },
    { name: 'influencer', emoji: '📸', label: 'Блогер/Инфлюенсер' },
    { name: 'b2b', emoji: '💼', label: 'B2B' },
  ];
}

/**
 * Get pending services for moderation
 */
export async function getPendingServices(env) {
  try {
    const result = await supabaseRequest(env, 'services?approval_status=eq.Pending&select=*&order=created_at.desc');
    return result || [];
  } catch (error) {
    console.error('[getPendingServices] Error:', error);
    return [];
  }
}

/**
 * Add new service
 */
export async function addService(env, serviceData) {
  try {
    const result = await supabaseRequest(env, 'services', {
      method: 'POST',
      body: JSON.stringify(serviceData),
    });
    return result && result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('[addService] Error:', error);
    throw error;
  }
}

/**
 * Update service
 */
export async function updateService(env, serviceId, data) {
  try {
    const encodedServiceId = encodeURIComponent(serviceId);
    const result = await supabaseRequest(env, `services?id=eq.${encodedServiceId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return result && result.length > 0;
  } catch (error) {
    console.error('[updateService] Error:', error);
    throw error;
  }
}

/**
 * Delete service
 */
export async function deleteService(env, serviceId) {
  try {
    const encodedServiceId = encodeURIComponent(serviceId);
    await supabaseRequest(env, `services?id=eq.${encodedServiceId}`, {
      method: 'DELETE',
    });
    return true;
  } catch (error) {
    console.error('[deleteService] Error:', error);
    throw error;
  }
}

/**
 * Update multiple partner fields at once
 */
export async function updatePartnerFields(env, partnerChatId, fields) {
  try {
    const result = await supabaseRequest(env, `partners?chat_id=eq.${partnerChatId}`, {
      method: 'PATCH',
      body: JSON.stringify(fields),
    });
    return result && result.length > 0;
  } catch (error) {
    console.error('[updatePartnerFields] Error:', error);
    throw error;
  }
}

/**
 * Update partner field
 */
export async function updatePartnerField(env, partnerChatId, field, value) {
  try {
    const data = { [field]: value };
    const result = await supabaseRequest(env, `partners?chat_id=eq.${partnerChatId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return result && result.length > 0;
  } catch (error) {
    console.error('[updatePartnerField] Error:', error);
    throw error;
  }
}

/**
 * Get distinct cities from partners
 */
export async function getDistinctCitiesFromPartners(env) {
  try {
    const partners = await supabaseRequest(env, 'partners?select=city');
    const cities = [...new Set(partners.map(p => p.city).filter(c => c && c.trim()))];
    return cities.sort();
  } catch (error) {
    console.error('[getDistinctCitiesFromPartners] Error:', error);
    return [];
  }
}

/**
 * Get districts for a city
 */
export async function getDistrictsForCity(env, city) {
  try {
    const partners = await supabaseRequest(env, `partners?city=eq.${encodeURIComponent(city)}&select=district`);
    const districts = [...new Set(partners.map(p => p.district).filter(d => d && d.trim()))];
    return districts.sort();
  } catch (error) {
    console.error('[getDistrictsForCity] Error:', error);
    return [];
  }
}

/**
 * Get all news
 */
export async function getAllNews(env) {
  try {
    const result = await supabaseRequest(env, 'news?select=*&order=created_at.desc');
    return result || [];
  } catch (error) {
    console.error('[getAllNews] Error:', error);
    return [];
  }
}

/**
 * Get news by ID
 */
export async function getNewsById(env, id) {
  try {
    const result = await supabaseRequest(env, `news?id=eq.${id}&select=*`);
    return result && result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('[getNewsById] Error:', error);
    return null;
  }
}

/**
 * Create news
 */
export async function createNews(env, newsData) {
  try {
    const result = await supabaseRequest(env, 'news', {
      method: 'POST',
      body: JSON.stringify({
        ...newsData,
        is_published: false,
        created_at: new Date().toISOString(),
      }),
    });
    return result && result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('[createNews] Error:', error);
    throw error;
  }
}

/**
 * Update news
 */
export async function updateNews(env, id, data) {
  try {
    const result = await supabaseRequest(env, `news?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return result && result.length > 0;
  } catch (error) {
    console.error('[updateNews] Error:', error);
    throw error;
  }
}

/**
 * Delete news
 */
export async function deleteNews(env, id) {
  try {
    await supabaseRequest(env, `news?id=eq.${id}`, {
      method: 'DELETE',
    });
    return true;
  } catch (error) {
    console.error('[deleteNews] Error:', error);
    throw error;
  }
}

/**
 * Get pending UGC
 */
export async function getPendingUGC(env) {
  try {
    const result = await supabaseRequest(env, 'ugc_content?status=eq.pending&select=*&order=created_at.desc');
    return result || [];
  } catch (error) {
    console.error('[getPendingUGC] Error:', error);
    return [];
  }
}

/**
 * Update UGC status
 */
export async function updateUGCStatus(env, id, status) {
  try {
    const updateData = { 
      status,
      approved_at: status === 'approved' ? new Date().toISOString() : null,
    };
    
    const result = await supabaseRequest(env, `ugc_content?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    });
    return result && result.length > 0;
  } catch (error) {
    console.error('[updateUGCStatus] Error:', error);
    throw error;
  }
}

/**
 * Get all promoters
 */
export async function getPromoters(env) {
  try {
    const result = await supabaseRequest(env, 'promoters?select=*&order=points.desc');
    return result || [];
  } catch (error) {
    console.error('[getPromoters] Error:', error);
    return [];
  }
}

/**
 * Get promoter by chat_id
 */
export async function getPromoterByChat(env, chatId) {
  try {
    const result = await supabaseRequest(env, `promoters?chat_id=eq.${chatId}&select=*`);
    return result && result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('[getPromoterByChat] Error:', error);
    return null;
  }
}

/**
 * Get promoter UGC content
 */
export async function getPromoterUGC(env, chatId) {
  try {
    const result = await supabaseRequest(env, `ugc_content?promoter_chat_id=eq.${chatId}&select=*&order=created_at.desc`);
    return result || [];
  } catch (error) {
    console.error('[getPromoterUGC] Error:', error);
    return [];
  }
}

/**
 * Get pending payments for MLM
 */
export async function getPendingPayments(env) {
  try {
    const result = await supabaseRequest(env, 'revenue_share_payments?status=eq.pending&select=*&order=created_at.desc');
    return result || [];
  } catch (error) {
    console.error('[getPendingPayments] Error:', error);
    return [];
  }
}

/**
 * Update payment status
 */
export async function updatePaymentStatus(env, id, status) {
  try {
    const result = await supabaseRequest(env, `revenue_share_payments?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ 
        status, 
        processed_at: new Date().toISOString() 
      }),
    });
    return result && result.length > 0;
  } catch (error) {
    console.error('[updatePaymentStatus] Error:', error);
    throw error;
  }
}

/**
 * Get active leaderboard period
 */
export async function getActiveLeaderboardPeriod(env) {
  try {
    const result = await supabaseRequest(env, 'leaderboard_periods?is_active=eq.true&select=*&limit=1');
    return result && result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('[getActiveLeaderboardPeriod] Error:', error);
    return null;
  }
}

/**
 * Create leaderboard period
 */
export async function createLeaderboardPeriod(env, name) {
  try {
    const result = await supabaseRequest(env, 'leaderboard_periods', {
      method: 'POST',
      body: JSON.stringify({
        name,
        start_date: new Date().toISOString(),
        is_active: true,
      }),
    });
    return result && result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('[createLeaderboardPeriod] Error:', error);
    throw error;
  }
}

/**
 * Deactivate all leaderboard periods
 */
export async function deactivateLeaderboardPeriods(env) {
  try {
    await supabaseRequest(env, 'leaderboard_periods?is_active=eq.true', {
      method: 'PATCH',
      body: JSON.stringify({ is_active: false }),
    });
    return true;
  } catch (error) {
    console.error('[deactivateLeaderboardPeriods] Error:', error);
    throw error;
  }
}

/**
 * Create B2B deal
 */
export async function createDeal(env, dealData) {
  try {
    const result = await supabaseRequest(env, 'partner_deals', {
      method: 'POST',
      body: JSON.stringify({
        ...dealData,
        status: 'pending',
        created_at: new Date().toISOString(),
      }),
    });
    return result && result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('[createDeal] Error:', error);
    throw error;
  }
}

/**
 * Update deal status
 */
export async function updateDealStatus(env, id, status) {
  try {
    const result = await supabaseRequest(env, `partner_deals?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    return result && result.length > 0;
  } catch (error) {
    console.error('[updateDealStatus] Error:', error);
    throw error;
  }
}
