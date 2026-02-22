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

  // Check if response has content
  const contentType = response.headers.get('content-type');
  const contentLength = response.headers.get('content-length');
  
  // If response is empty or no content, return empty array for consistency
  if (contentLength === '0' || !contentType || !contentType.includes('application/json')) {
    console.log('[supabaseRequest] Empty response, returning empty array');
    return [];
  }

  try {
    const text = await response.text();
    if (!text || text.trim() === '') {
      console.log('[supabaseRequest] Empty text response, returning empty array');
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
 * Checks both 'partners' table (approved) and 'partner_applications' table (pending)
 */
export async function getPartnerByChatId(env, chatId) {
  // First check approved partners
  const approved = await supabaseRequest(env, `partners?chat_id=eq.${chatId}&select=*`);
  if (approved && approved.length > 0) {
    const partner = { ...approved[0], status: 'Approved' };
    
    // Загружаем мультикатегории из partner_categories
    try {
      const categories = await supabaseRequest(env, `partner_categories?partner_chat_id=eq.${chatId}&select=business_type,is_primary&order=is_primary.desc`);
      if (categories && categories.length > 0) {
        partner.categories = categories.map(c => c.business_type);
        // Для обратной совместимости: основная категория в business_type
        const primaryCategory = categories.find(c => c.is_primary) || categories[0];
        partner.business_type = primaryCategory.business_type;
      }
    } catch (error) {
      console.error('[getPartnerByChatId] Error loading categories:', error);
    }
    
    return partner;
  }
  
  // If not found, check partner_applications
  const application = await supabaseRequest(env, `partner_applications?chat_id=eq.${chatId}&select=*`);
  if (application && application.length > 0) {
    const app = { ...application[0], status: application[0].status || 'Pending' };
    
    // Загружаем мультикатегории из partner_categories
    try {
      const categories = await supabaseRequest(env, `partner_categories?partner_chat_id=eq.${chatId}&select=business_type,is_primary&order=is_primary.desc`);
      if (categories && categories.length > 0) {
        app.categories = categories.map(c => c.business_type);
        // Для обратной совместимости: основная категория в business_type
        const primaryCategory = categories.find(c => c.is_primary) || categories[0];
        app.business_type = primaryCategory.business_type;
      }
    } catch (error) {
      console.error('[getPartnerByChatId] Error loading categories:', error);
    }
    
    return app;
  }
  
  return null;
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

/** Ambassador: resolve ambassador_code to chat_id */
export async function getAmbassadorChatIdByCode(env, ambassadorCode) {
  if (!ambassadorCode || !ambassadorCode.startsWith('amb_')) return null;
  try {
    const rows = await supabaseRequest(env, `ambassadors?ambassador_code=eq.${encodeURIComponent(ambassadorCode)}&select=chat_id`);
    return rows && rows[0] ? String(rows[0].chat_id) : null;
  } catch (e) {
    return null;
  }
}

/** Ambassador: check if partner is in ambassador's list */
export async function isPartnerInAmbassadorList(env, ambassadorChatId, partnerChatId) {
  try {
    const rows = await supabaseRequest(env, `ambassador_partners?ambassador_chat_id=eq.${encodeURIComponent(ambassadorChatId)}&partner_chat_id=eq.${encodeURIComponent(partnerChatId)}&select=id`);
    return rows && rows.length > 0;
  } catch (e) {
    return false;
  }
}

/** Ambassador: create earning and update balance */
export async function createAmbassadorEarning(env, data) {
  const gross = data.check_amount * data.commission_pct;
  const platformFee = gross * 0.30;
  const ambassadorAmount = gross * 0.70;
  await supabaseRequest(env, 'ambassador_earnings', {
    method: 'POST',
    body: JSON.stringify({
      ...data,
      gross_amount: gross,
      platform_fee: platformFee,
      ambassador_amount: ambassadorAmount,
    }),
  });
  const ambRows = await supabaseRequest(env, `ambassadors?chat_id=eq.${encodeURIComponent(data.ambassador_chat_id)}&select=balance_pending,total_earnings`);
  const amb = ambRows?.[0];
  const curPending = (amb?.balance_pending ?? 0) || 0;
  const curTotal = (amb?.total_earnings ?? 0) || 0;
  await supabaseRequest(env, `ambassadors?chat_id=eq.${encodeURIComponent(data.ambassador_chat_id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      balance_pending: Number(curPending) + ambassadorAmount,
      total_earnings: Number(curTotal) + ambassadorAmount,
    }),
  });
}

/** Ambassador: attribute transaction */
export async function attributeTransactionToAmbassador(env, transactionId, ambassadorChatId) {
  await supabaseRequest(env, `transactions?id=eq.${transactionId}`, {
    method: 'PATCH',
    body: JSON.stringify({ ambassador_chat_id: ambassadorChatId }),
  });
}

/** Ambassador: update partner's commission for ambassadors */
export async function updatePartnerAmbassadorCommission(env, chatId, pct) {
  return supabaseRequest(env, `partners?chat_id=eq.${encodeURIComponent(chatId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ ambassador_commission_pct: pct }),
  });
}

/** REFERRAL_CONFIG: 8%/4%/2% с покупок */
const REFERRAL_TRANSACTION_PERCENT = { level_1: 0.08, level_2: 0.04, level_3: 0.02 };

async function buildReferralTree(env, referredChatId, maxLevel = 3) {
  try {
    const rows = await supabaseRequest(env, `referral_tree?referred_chat_id=eq.${encodeURIComponent(referredChatId)}&level=lte.${maxLevel}&select=referrer_chat_id,level`);
    return (rows || []).map(r => ({ chat_id: r.referrer_chat_id, level: r.level }));
  } catch (e) {
    console.error('[buildReferralTree]', e);
    return [];
  }
}

async function processReferralTransactionBonuses(env, clientChatId, earnedPoints, transactionId) {
  if (!earnedPoints || earnedPoints <= 0) return;
  try {
    const tree = await buildReferralTree(env, clientChatId, 3);
    if (!tree || tree.length === 0) return;

    for (const ref of tree) {
      const percent = REFERRAL_TRANSACTION_PERCENT[`level_${ref.level}`] || 0;
      if (percent <= 0) continue;

      const bonusPoints = Math.floor(earnedPoints * percent);
      if (bonusPoints <= 0) continue;

      const userRows = await supabaseRequest(env, `users?chat_id=eq.${encodeURIComponent(ref.chat_id)}&select=balance`);
      const current = (userRows && userRows[0] && (userRows[0].balance ?? 0)) || 0;
      const next = Number(current) + bonusPoints;

      await supabaseRequest(env, `users?chat_id=eq.${encodeURIComponent(ref.chat_id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ balance: next }),
      });

      await supabaseRequest(env, 'referral_rewards', {
        method: 'POST',
        body: JSON.stringify({
          referrer_chat_id: ref.chat_id,
          referred_chat_id: clientChatId,
          reward_type: 'transaction',
          level: ref.level,
          points: bonusPoints,
          transaction_id: transactionId,
          description: `Бонус ${Math.round(percent * 100)}% с транзакции реферала уровня ${ref.level}`,
        }),
      });

      const treeRows = await supabaseRequest(env, `referral_tree?referrer_chat_id=eq.${encodeURIComponent(ref.chat_id)}&referred_chat_id=eq.${encodeURIComponent(clientChatId)}&select=total_earned_points,total_transactions`);
      const prev = treeRows && treeRows[0];
      const prevEarned = (prev?.total_earned_points ?? 0) || 0;
      const prevTxns = (prev?.total_transactions ?? 0) || 0;

      await supabaseRequest(env, `referral_tree?referrer_chat_id=eq.${encodeURIComponent(ref.chat_id)}&referred_chat_id=eq.${encodeURIComponent(clientChatId)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          total_earned_points: prevEarned + bonusPoints,
          total_transactions: prevTxns + 1,
          last_transaction_at: new Date().toISOString(),
          is_active: true,
        }),
      });
    }
  } catch (e) {
    console.error('[processReferralTransactionBonuses]', e);
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
      // data is already a JSON object from Supabase REST API, not a string
      // Ensure it's an object
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
    
    // Supabase may return empty array or single object
    const finalResult = Array.isArray(result) ? (result[0] || result) : result;
    console.log('[setBotState] State set successfully:', finalResult);
    return finalResult;
  } catch (error) {
    console.error('[setBotState] ERROR:', error);
    console.error('[setBotState] Error details:', {
      message: error.message,
      stack: error.stack,
      chatId,
      state,
    });
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
    console.error('Error clearing bot state:', error);
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
    
    // Ensure data is an object (it should be from getBotState, but double-check)
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
 * Ensure partner record exists in partners table
 * Creates a minimal partner record if it doesn't exist
 */
export async function ensurePartnerRecord(env, partnerChatId, serviceCategory = null) {
  try {
    // Check if partner already exists
    const existingPartner = await supabaseRequest(env, `partners?chat_id=eq.${partnerChatId}&select=chat_id`);
    if (existingPartner && existingPartner.length > 0) {
      console.log(`[ensurePartnerRecord] Partner ${partnerChatId} already exists`);
      return true;
    }
    
    console.log(`[ensurePartnerRecord] Creating partner record for ${partnerChatId}`);
    
    // Try to get partner data from partner_applications
    let partnerData = null;
    try {
      const appResult = await supabaseRequest(env, `partner_applications?chat_id=eq.${partnerChatId}&select=*`);
      if (appResult && appResult.length > 0) {
        partnerData = appResult[0];
        console.log(`[ensurePartnerRecord] Found partner application data`);
      }
    } catch (appError) {
      console.log(`[ensurePartnerRecord] No application data found, creating minimal record`);
    }
    
    // Create partner record with available data or defaults
    const partnerRecord = {
      chat_id: String(partnerChatId),
      name: partnerData?.name || partnerData?.contact_person || 'Партнёр',
      company_name: partnerData?.company_name || '',
      business_type: partnerData?.business_type || serviceCategory || null,
      city: partnerData?.city || '',
      district: partnerData?.district || '',
      username: partnerData?.username || null,
      booking_url: partnerData?.booking_url || null,
      work_mode: 'hybrid', // Default to hybrid to show in all cities
      referred_by_chat_id: partnerData?.referred_by_chat_id || null,
    };
    
    // Upsert to partners table
    const result = await supabaseRequest(env, 'partners', {
      method: 'POST',
      headers: {
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify(partnerRecord),
    });
    
    console.log(`[ensurePartnerRecord] Partner record created/updated:`, result);
    return true;
  } catch (error) {
    console.error('[ensurePartnerRecord] Error ensuring partner record:', error);
    // Don't throw - we'll try to create service anyway
    return false;
  }
}

/**
 * Get all services for a partner
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
 * Get service by ID
 */
export async function getServiceById(env, serviceId) {
  try {
    const result = await supabaseRequest(env, `services?id=eq.${serviceId}&select=*`);
    return result && result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('[getServiceById] Error:', error);
    return null;
  }
}

/**
 * Update service
 */
export async function updateService(env, serviceId, updateData) {
  try {
    const result = await supabaseRequest(env, `services?id=eq.${serviceId}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    });
    return result && result.length > 0 ? result[0] : null;
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
    await supabaseRequest(env, `services?id=eq.${serviceId}`, {
      method: 'DELETE',
    });
    return true;
  } catch (error) {
    console.error('[deleteService] Error:', error);
    throw error;
  }
}

/**
 * Add service to database
 */
export async function addService(env, serviceData) {
  try {
    // Ensure required fields are present
    if (!serviceData.approval_status) {
      serviceData.approval_status = 'Pending';
    }
    if (serviceData.is_active === undefined) {
      serviceData.is_active = true;
    }
    
    // Log service data before insertion
    console.log('[addService] Attempting to add service with data:', JSON.stringify(serviceData));
    
    // Check if partner exists and create if needed
    const partnerChatId = serviceData.partner_chat_id;
    if (partnerChatId) {
      try {
        const partnerCheck = await supabaseRequest(env, `partners?chat_id=eq.${partnerChatId}&select=chat_id`);
        if (!partnerCheck || partnerCheck.length === 0) {
          console.log(`[addService] Partner ${partnerChatId} not found, creating partner record...`);
          // Automatically create partner record
          await ensurePartnerRecord(env, partnerChatId, serviceData.category);
        } else {
          console.log(`[addService] Partner ${partnerChatId} exists`);
        }
      } catch (checkError) {
        console.error('[addService] Partner check failed:', checkError);
        // Try to create partner anyway
        try {
          await ensurePartnerRecord(env, partnerChatId, serviceData.category);
        } catch (createError) {
          console.error('[addService] Failed to create partner record:', createError);
          // Continue anyway - Supabase will validate FK constraint
        }
      }
    }
    
    const result = await supabaseRequest(env, 'services', {
      method: 'POST',
      body: JSON.stringify(serviceData),
    });
    
    console.log('[addService] Service added successfully:', JSON.stringify(result));
    
    // Supabase REST API returns an array when using Prefer: return=representation
    // Extract the first item if it's an array
    const finalResult = Array.isArray(result) ? (result[0] || result) : result;
    console.log('[addService] Final result:', JSON.stringify(finalResult));
    return finalResult;
  } catch (error) {
    console.error('[addService] Error adding service:', error);
    console.error('[addService] Service data was:', JSON.stringify(serviceData));
    throw error;
  }
}

// ==================== PROMOTIONS ====================

/**
 * Get promotions by partner chat_id
 */
export async function getPromotionsByPartner(env, partnerChatId) {
  try {
    const result = await supabaseRequest(env, `promotions?partner_chat_id=eq.${partnerChatId}&order=created_at.desc`);
    return result || [];
  } catch (error) {
    console.error('[getPromotionsByPartner] Error:', error);
    throw error;
  }
}

/**
 * Get promotion by ID
 */
export async function getPromotionById(env, promotionId) {
  try {
    console.log('[getPromotionById] Fetching promotion:', promotionId);
    const result = await supabaseRequest(env, `promotions?id=eq.${promotionId}&select=*`);
    console.log('[getPromotionById] Result:', result);
    return result && result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('[getPromotionById] Error:', error);
    return null; // Return null instead of throwing to avoid crashing
  }
}

/**
 * Add new promotion
 */
export async function addPromotion(env, promotionData) {
  try {
    // Set defaults
    if (promotionData.is_active === undefined) {
      promotionData.is_active = true;
    }
    
    // Set start_date to today if not provided
    if (!promotionData.start_date) {
      promotionData.start_date = new Date().toISOString().split('T')[0];
    }
    
    console.log('[addPromotion] Adding promotion:', JSON.stringify(promotionData));
    
    const result = await supabaseRequest(env, 'promotions', {
      method: 'POST',
      body: JSON.stringify(promotionData),
    });
    
    const finalResult = Array.isArray(result) ? (result[0] || result) : result;
    console.log('[addPromotion] Result:', JSON.stringify(finalResult));
    return finalResult;
  } catch (error) {
    console.error('[addPromotion] Error:', error);
    throw error;
  }
}

/**
 * Update promotion
 */
export async function updatePromotion(env, promotionId, updateData) {
  try {
    const result = await supabaseRequest(env, `promotions?id=eq.${promotionId}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    });
    return result && result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('[updatePromotion] Error:', error);
    throw error;
  }
}

/**
 * Delete promotion
 */
export async function deletePromotion(env, promotionId) {
  try {
    await supabaseRequest(env, `promotions?id=eq.${promotionId}`, {
      method: 'DELETE',
    });
    return true;
  } catch (error) {
    console.error('[deletePromotion] Error:', error);
    throw error;
  }
}

/**
 * Toggle promotion active status
 */
export async function togglePromotionStatus(env, promotionId, isActive) {
  try {
    const result = await supabaseRequest(env, `promotions?id=eq.${promotionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: isActive }),
    });
    return result && result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('[togglePromotionStatus] Error:', error);
    throw error;
  }
}

// ==================== CLIENT & TRANSACTION FUNCTIONS ====================

/**
 * Find client by chat_id or phone number
 */
export async function findClientByIdOrPhone(env, searchQuery) {
  try {
    const query = String(searchQuery).trim();
    
    // First try exact chat_id match
    let result = await supabaseRequest(env, `users?chat_id=eq.${query}&select=*`);
    if (result && result.length > 0) {
      return result[0];
    }
    
    // Try phone number (with or without + prefix)
    const phoneQuery = query.startsWith('+') ? query : `+${query}`;
    const phoneQueryWithout = query.replace(/^\+/, '');
    
    result = await supabaseRequest(env, `users?or=(phone.eq.${encodeURIComponent(phoneQuery)},phone.eq.${encodeURIComponent(phoneQueryWithout)})&select=*`);
    if (result && result.length > 0) {
      return result[0];
    }
    
    return null;
  } catch (error) {
    console.error('[findClientByIdOrPhone] Error:', error);
    return null;
  }
}

/**
 * Get client balance
 */
export async function getClientBalance(env, clientChatId) {
  try {
    const result = await supabaseRequest(env, `users?chat_id=eq.${clientChatId}&select=balance`);
    if (result && result.length > 0) {
      return result[0].balance || 0;
    }
    return 0;
  } catch (error) {
    console.error('[getClientBalance] Error:', error);
    return 0;
  }
}

/**
 * Execute transaction (accrual or spend)
 * @param {Object} env - Environment variables
 * @param {string} clientChatId - Client's chat ID
 * @param {string} partnerChatId - Partner's chat ID
 * @param {string} txnType - 'accrual' or 'spend'
 * @param {number} amount - Amount (in dollars for accrual, in points for spend)
 * @returns {Object} - { success: boolean, points?: number, new_balance?: number, error?: string }
 */
export async function executeTransaction(env, clientChatId, partnerChatId, txnType, amount) {
  try {
    console.log('[executeTransaction] Starting:', { clientChatId, partnerChatId, txnType, amount });
    
    // Get current client balance
    const client = await getUserByChatId(env, clientChatId);
    if (!client) {
      return { success: false, error: 'Клиент не найден' };
    }
    
    const currentBalance = client.balance || 0;
    let newBalance = currentBalance;
    let points = 0;
    
    if (txnType === 'accrual') {
      // Calculate points from dollar amount (1 USD = 1 point by default, can be configured)
      const pointsPerDollar = parseFloat(env.POINTS_PER_DOLLAR) || 0.05;
      points = Math.round(amount * pointsPerDollar);
      newBalance = currentBalance + points;
    } else if (txnType === 'spend') {
      points = Math.round(amount);
      if (points > currentBalance) {
        return { success: false, error: `Недостаточно баллов. Баланс: ${currentBalance}` };
      }
      newBalance = currentBalance - points;
    } else {
      return { success: false, error: 'Неизвестный тип операции' };
    }
    
    // Update client balance
    await supabaseRequest(env, `users?chat_id=eq.${clientChatId}`, {
      method: 'PATCH',
      body: JSON.stringify({ balance: newBalance }),
    });
    
    // Create transaction record (matches DB schema: client_chat_id, partner_chat_id, date_time, total_amount, earned_points, spent_points, operation_type, description)
    const earned = txnType === 'accrual' ? points : 0;
    const spent = txnType === 'spend' ? points : 0;
    const transactionData = {
      client_chat_id: clientChatId,
      partner_chat_id: partnerChatId,
      date_time: new Date().toISOString(),
      total_amount: amount,
      earned_points: earned,
      spent_points: spent,
      operation_type: txnType,
      description: txnType === 'accrual' ? `Начисление ${points} баллов (чек $${amount})` : `Списание ${points} баллов`,
    };
    
    const txnResult = await createTransaction(env, transactionData);
    const transactionId = (Array.isArray(txnResult) && txnResult[0]?.id) ? txnResult[0].id : null;

    if (txnType === 'accrual' && points > 0 && transactionId) {
      await processReferralTransactionBonuses(env, clientChatId, points, transactionId);
    }

    if (txnType === 'accrual' && transactionId && amount > 0) {
      try {
        const user = await getUserByChatId(env, clientChatId);
        const refSource = user?.referral_source;
        if (refSource && refSource.startsWith('amb_')) {
          const ambassadorChatId = await getAmbassadorChatIdByCode(env, refSource);
          const inList = ambassadorChatId ? await isPartnerInAmbassadorList(env, ambassadorChatId, partnerChatId) : false;
          const partner = await getPartnerByChatId(env, partnerChatId);
          const commissionPct = partner?.ambassador_commission_pct ?? 0;
          if (ambassadorChatId && inList && commissionPct > 0) {
            await createAmbassadorEarning(env, {
              ambassador_chat_id: ambassadorChatId,
              partner_chat_id: partnerChatId,
              transaction_id: transactionId,
              check_amount: amount,
              commission_pct: commissionPct,
            });
            await attributeTransactionToAmbassador(env, transactionId, ambassadorChatId);
          }
        }
      } catch (e) {
        console.error('[executeTransaction] Ambassador attribution failed:', e);
      }
    }

    console.log('[executeTransaction] Success:', { points, newBalance });
    
    return {
      success: true,
      points: points,
      new_balance: newBalance,
    };
  } catch (error) {
    console.error('[executeTransaction] Error:', error);
    return { success: false, error: error.message || 'Ошибка выполнения транзакции' };
  }
}

/**
 * Get pending transactions (queue) for a partner
 */
export async function getPendingTransactions(env, partnerChatId) {
  try {
    const result = await supabaseRequest(env, `transaction_queue?partner_chat_id=eq.${partnerChatId}&status=eq.pending&order=created_at.desc&limit=10`);
    return result || [];
  } catch (error) {
    console.error('[getPendingTransactions] Error:', error);
    return [];
  }
}

/**
 * Get partner's revenue share data
 */
export async function getPartnerRevenueShare(env, partnerChatId) {
  try {
    // Get partner data
    const partners = await supabaseRequest(
      env, 
      `partners?chat_id=eq.${partnerChatId}&select=is_revenue_share_active,revenue_share_monthly,total_revenue_share_earned,personal_income_monthly,client_base_count`
    );
    
    const partner = partners && partners[0];
    
    // Get pending payouts
    const pendingPayouts = await supabaseRequest(
      env,
      `partner_revenue_share?partner_chat_id=eq.${partnerChatId}&status=eq.pending&select=final_amount`
    );
    
    // Get paid payouts count
    const paidPayouts = await supabaseRequest(
      env,
      `partner_revenue_share?partner_chat_id=eq.${partnerChatId}&status=eq.paid&select=id`
    );
    
    const pendingAmount = (pendingPayouts || []).reduce((sum, p) => sum + (parseFloat(p.final_amount) || 0), 0);
    
    return {
      isActive: partner?.is_revenue_share_active || false,
      monthlyEarned: parseFloat(partner?.revenue_share_monthly) || 0,
      totalEarned: parseFloat(partner?.total_revenue_share_earned) || 0,
      personalIncome: parseFloat(partner?.personal_income_monthly) || 0,
      clientCount: parseInt(partner?.client_base_count) || 0,
      pendingAmount,
      payoutsCount: (paidPayouts || []).length
    };
  } catch (error) {
    console.error('[getPartnerRevenueShare] Error:', error);
    return {
      isActive: false,
      monthlyEarned: 0,
      totalEarned: 0,
      personalIncome: 0,
      clientCount: 0,
      pendingAmount: 0,
      payoutsCount: 0
    };
  }
}

/**
 * Get revenue share history for partner
 */
export async function getRevenueShareHistory(env, partnerChatId, limit = 10) {
  try {
    const history = await supabaseRequest(
      env,
      `partner_revenue_share?partner_chat_id=eq.${partnerChatId}&order=created_at.desc&limit=${limit}&select=*`
    );
    return history || [];
  } catch (error) {
    console.error('[getRevenueShareHistory] Error:', error);
    return [];
  }
}

/**
 * Get partner's referral network
 */
export async function getPartnerNetwork(env, partnerChatId) {
  try {
    // Level 1: direct referrals
    const level1 = await supabaseRequest(
      env,
      `partners?referred_by_chat_id=eq.${partnerChatId}&select=chat_id,name,company_name,is_revenue_share_active,personal_income_monthly`
    ) || [];

    if (level1.length === 0) {
      return { level1: [], level2: [], level3: [], totalCount: 0 };
    }

    // Level 2: batch query by all level1 chat_ids
    const l1Ids = level1.map(p => p.chat_id).join(',');
    const level2Raw = await supabaseRequest(
      env,
      `partners?referred_by_chat_id=in.(${l1Ids})&select=chat_id,name,company_name,is_revenue_share_active,referred_by_chat_id`
    ) || [];

    // Build referrer name map for level 2
    const l1Map = Object.fromEntries(level1.map(p => [p.chat_id, p.company_name || p.name || 'партнёр']));
    const level2 = level2Raw.map(p => ({
      ...p,
      referrer_name: l1Map[p.referred_by_chat_id] || 'партнёр'
    }));

    // Level 3: batch query by all level2 chat_ids
    let level3 = [];
    if (level2.length > 0) {
      const l2Ids = level2.map(p => p.chat_id).join(',');
      const level3Raw = await supabaseRequest(
        env,
        `partners?referred_by_chat_id=in.(${l2Ids})&select=chat_id,name,company_name,is_revenue_share_active,referred_by_chat_id`
      ) || [];

      const l2Map = Object.fromEntries(level2.map(p => [p.chat_id, p.company_name || p.name || 'партнёр']));
      level3 = level3Raw.map(p => ({
        ...p,
        referrer_name: l2Map[p.referred_by_chat_id] || 'партнёр'
      }));
    }

    return {
      level1,
      level2,
      level3,
      totalCount: level1.length + level2.length + level3.length
    };
  } catch (error) {
    console.error('[getPartnerNetwork] Error:', error);
    return { level1: [], level2: [], level3: [], totalCount: 0 };
  }
}

/**
 * Get partner's B2B deals
 */
export async function getPartnerB2BDeals(env, partnerChatId) {
  try {
    // Get deals where partner is source (bringing clients)
    const asSource = await supabaseRequest(
      env,
      `partner_deals?source_partner_chat_id=eq.${partnerChatId}&status=eq.active&select=*`
    );
    
    // Get deals where partner is target (receiving clients)
    const asTarget = await supabaseRequest(
      env,
      `partner_deals?target_partner_chat_id=eq.${partnerChatId}&status=eq.active&select=*`
    );
    
    // Get partner names for display
    const enrichedAsSource = [];
    for (const deal of (asSource || [])) {
      const targetPartner = await supabaseRequest(
        env,
        `partners?chat_id=eq.${deal.target_partner_chat_id}&select=name,company_name`
      );
      enrichedAsSource.push({
        ...deal,
        partner_name: targetPartner?.[0]?.company_name || targetPartner?.[0]?.name || 'Партнёр'
      });
    }
    
    const enrichedAsTarget = [];
    for (const deal of (asTarget || [])) {
      const sourcePartner = await supabaseRequest(
        env,
        `partners?chat_id=eq.${deal.source_partner_chat_id}&select=name,company_name`
      );
      enrichedAsTarget.push({
        ...deal,
        partner_name: sourcePartner?.[0]?.company_name || sourcePartner?.[0]?.name || 'Партнёр'
      });
    }
    
    return {
      asSource: enrichedAsSource,
      asTarget: enrichedAsTarget,
      totalCount: enrichedAsSource.length + enrichedAsTarget.length
    };
  } catch (error) {
    console.error('[getPartnerB2BDeals] Error:', error);
    return { asSource: [], asTarget: [], totalCount: 0 };
  }
}

/**
 * Get pending B2B deals for partner (where partner is target, awaiting acceptance)
 */
export async function getPendingB2BDealsForPartner(env, targetChatId) {
  try {
    const deals = await supabaseRequest(
      env,
      `partner_deals?target_partner_chat_id=eq.${targetChatId}&status=eq.pending&select=*&order=created_at.desc`
    );
    if (!deals || deals.length === 0) {
      return [];
    }
    const enriched = [];
    for (const deal of deals) {
      const sourcePartner = await supabaseRequest(
        env,
        `partners?chat_id=eq.${deal.source_partner_chat_id}&select=name,company_name`
      );
      enriched.push({
        ...deal,
        partner_name: sourcePartner?.[0]?.company_name || sourcePartner?.[0]?.name || 'Партнёр'
      });
    }
    return enriched;
  } catch (error) {
    console.error('[getPendingB2BDealsForPartner] Error:', error);
    return [];
  }
}

/**
 * Create B2B deal (partner-initiated)
 */
export async function createPartnerDeal(env, dealData) {
  try {
    const result = await supabaseRequest(env, 'partner_deals', {
      method: 'POST',
      body: JSON.stringify({
        ...dealData,
        status: 'pending',
        created_at: new Date().toISOString(),
      }),
    });
    return Array.isArray(result) && result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('[createPartnerDeal] Error:', error);
    throw error;
  }
}

/**
 * Update B2B deal status
 */
export async function updatePartnerDealStatus(env, dealId, status, extraFields = {}) {
  try {
    const body = { status, ...extraFields };
    if (status === 'active') {
      body.accepted_at = new Date().toISOString();
    }
    const result = await supabaseRequest(env, `partner_deals?id=eq.${dealId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    return result !== undefined;
  } catch (error) {
    console.error('[updatePartnerDealStatus] Error:', error);
    throw error;
  }
}

/**
 * Get deal by ID
 */
export async function getDealById(env, dealId) {
  try {
    const result = await supabaseRequest(env, `partner_deals?id=eq.${dealId}&select=*`);
    return result && result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('[getDealById] Error:', error);
    return null;
  }
}

/**
 * Get deal by source and target (check existing)
 */
export async function getDealBySourceAndTarget(env, sourceChatId, targetChatId) {
  try {
    const result = await supabaseRequest(
      env,
      `partner_deals?source_partner_chat_id=eq.${sourceChatId}&target_partner_chat_id=eq.${targetChatId}&select=*`
    );
    return result && result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('[getDealBySourceAndTarget] Error:', error);
    return null;
  }
}

/**
 * Get partner statistics
 */
export async function getPartnerStats(env, partnerChatId) {
  try {
    // Get all transactions for this partner
    const transactions = await supabaseRequest(
      env, 
      `transactions?partner_chat_id=eq.${partnerChatId}&select=*`
    );
    
    // Calculate statistics
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    let totalTurnover = 0;
    let totalPointsIssued = 0;
    let totalPointsSpent = 0;
    let last30DaysTransactions = 0;
    let last30DaysTurnover = 0;
    const uniqueClients = new Set();
    const last30DaysClients = new Set();
    
    for (const txn of (transactions || [])) {
      const txnDate = new Date(txn.date_time || txn.created_at);
      const amount = parseFloat(txn.total_amount) || 0;
      const earnedPoints = parseInt(txn.earned_points) || 0;
      const spentPoints = parseInt(txn.spent_points) || 0;
      
      if (txn.operation_type === 'accrual') {
        totalTurnover += amount;
        totalPointsIssued += earnedPoints;
      } else {
        totalPointsSpent += spentPoints;
      }
      
      if (txn.client_chat_id) {
        uniqueClients.add(txn.client_chat_id);
      }
      
      if (txnDate >= thirtyDaysAgo) {
        last30DaysTransactions++;
        if (txn.operation_type === 'accrual') {
          last30DaysTurnover += amount;
        }
        if (txn.client_chat_id) {
          last30DaysClients.add(txn.client_chat_id);
        }
      }
    }
    
    // Get new clients count (users who registered with this partner in last 30 days)
    let last30DaysNewClients = 0;
    try {
      const newUsers = await supabaseRequest(
        env,
        `users?referral_source=eq.partner_${partnerChatId}&reg_date=gte.${thirtyDaysAgo.toISOString().split('T')[0]}&select=chat_id`
      );
      last30DaysNewClients = (newUsers || []).length;
    } catch (e) {
      console.error('[getPartnerStats] Error getting new clients:', e);
    }
    
    return {
      totalClients: uniqueClients.size,
      totalTurnover,
      totalTransactions: (transactions || []).length,
      totalPointsIssued,
      totalPointsSpent,
      last30DaysTransactions,
      last30DaysTurnover,
      last30DaysNewClients
    };
  } catch (error) {
    console.error('[getPartnerStats] Error:', error);
    return {
      totalClients: 0,
      totalTurnover: 0,
      totalTransactions: 0,
      totalPointsIssued: 0,
      totalPointsSpent: 0,
      last30DaysTransactions: 0,
      last30DaysTurnover: 0,
      last30DaysNewClients: 0
    };
  }
}

/**
 * Get partner conversations (list of clients with messages)
 */
export async function getPartnerConversations(env, partnerChatId) {
  try {
    // Get all unique clients with messages
    const messages = await supabaseRequest(env, `messages?partner_chat_id=eq.${partnerChatId}&select=client_chat_id`);
    
    if (!messages || messages.length === 0) {
      return [];
    }
    
    const clientIds = [...new Set(messages.map(msg => msg.client_chat_id).filter(id => id))];
    
    const conversations = [];
    
    for (const clientId of clientIds) {
      // Get last message
      const lastMessages = await supabaseRequest(env, 
        `messages?client_chat_id=eq.${clientId}&partner_chat_id=eq.${partnerChatId}&order=created_at.desc&limit=1`
      );
      
      if (lastMessages && lastMessages.length > 0) {
        const lastMsg = lastMessages[0];
        
        // Get unread count
        const unreadMessages = await supabaseRequest(env,
          `messages?client_chat_id=eq.${clientId}&partner_chat_id=eq.${partnerChatId}&sender_type=eq.client&is_read=eq.false&select=id`
        );
        
        const unreadCount = unreadMessages ? unreadMessages.length : 0;
        
        conversations.push({
          client_chat_id: clientId,
          last_message: lastMsg,
          unread_count: unreadCount
        });
      }
    }
    
    return conversations;
  } catch (error) {
    console.error('[getPartnerConversations] Error:', error);
    return [];
  }
}

/**
 * Get client details for partner
 */
export async function getClientDetailsForPartner(env, clientChatId) {
  try {
    const user = await getUserByChatId(env, clientChatId);
    if (!user) {
      return null;
    }
    
    return {
      chat_id: user.chat_id,
      name: user.name || 'Не указано',
      balance: user.balance || 0,
      status: user.status || 'Bronze',
      phone: user.phone || 'Не указан',
    };
  } catch (error) {
    console.error('[getClientDetailsForPartner] Error:', error);
    return null;
  }
}

/**
 * Get conversation messages between client and partner
 */
export async function getConversation(env, clientChatId, partnerChatId, limit = 50) {
  try {
    const messages = await supabaseRequest(env,
      `messages?client_chat_id=eq.${clientChatId}&partner_chat_id=eq.${partnerChatId}&order=created_at.desc&limit=${limit}`
    );
    
    return messages ? messages.reverse() : [];
  } catch (error) {
    console.error('[getConversation] Error:', error);
    return [];
  }
}

/**
 * Save message to database
 */
export async function saveMessage(env, messageData) {
  try {
    const result = await supabaseRequest(env, 'messages', {
      method: 'POST',
      body: JSON.stringify({
        ...messageData,
        created_at: new Date().toISOString(),
      }),
    });
    
    return Array.isArray(result) ? (result[0] || result) : result;
  } catch (error) {
    console.error('[saveMessage] Error:', error);
    throw error;
  }
}

/**
 * Mark message as read
 */
export async function markMessageAsRead(env, messageId) {
  try {
    await supabaseRequest(env, `messages?id=eq.${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_read: true }),
    });
    return true;
  } catch (error) {
    console.error('[markMessageAsRead] Error:', error);
    return false;
  }
}

/**
 * Get exchange rate for currency (how many units of currency per 1 USD)
 * @param {Object} env - Environment variables
 * @param {string} currency - Currency code (VND, RUB, KZT)
 * @returns {number} - Exchange rate (e.g., 25000 for VND means 1 USD = 25000 VND)
 */
export async function getExchangeRate(env, currency) {
  try {
    if (currency === 'USD') {
      return 1;
    }
    
    const result = await supabaseRequest(env, `currency_exchange_rates?currency=eq.${currency}&select=rate`);
    
    if (result && result.length > 0 && result[0].rate) {
      return parseFloat(result[0].rate);
    }
    
    // Default fallback rates if not found in DB
    const fallbackRates = {
      VND: 25000,
      RUB: 100,
      KZT: 520,
    };
    
    return fallbackRates[currency] || 1;
  } catch (error) {
    console.error('[getExchangeRate] Error:', error);
    // Return fallback rates on error
    const fallbackRates = {
      VND: 25000,
      RUB: 100,
      KZT: 520,
    };
    return fallbackRates[currency] || 1;
  }
}

/**
 * Convert amount from local currency to USD
 * @param {Object} env - Environment variables
 * @param {number} amount - Amount in local currency
 * @param {string} currency - Currency code (VND, RUB, KZT, USD)
 * @returns {number} - Amount in USD
 */
export async function convertToUSD(env, amount, currency) {
  if (currency === 'USD') {
    return amount;
  }
  
  const rate = await getExchangeRate(env, currency);
  return amount / rate;
}

// ==================== PARTNER BROADCAST ====================

function isValidChatIdForBroadcast(cid) {
  if (!cid || typeof cid !== 'string') return false;
  if (cid.startsWith('VIA_PARTNER_')) return false;
  const n = parseInt(cid, 10);
  return !isNaN(n) && String(n) === cid;
}

/**
 * Get client chat_ids who came via partner's referral link
 */
export async function getPartnerClientChatIdsForBroadcast(env, partnerChatId, limit = 500) {
  try {
    const result = await supabaseRequest(env,
      `users?referral_source=eq.${encodeURIComponent(partnerChatId)}&select=chat_id&limit=${limit * 3}`
    );
    const seen = new Set();
    const chatIds = [];
    for (const row of result || []) {
      const cid = row.chat_id != null ? String(row.chat_id) : null;
      if (!cid || seen.has(cid) || !isValidChatIdForBroadcast(cid)) continue;
      seen.add(cid);
      chatIds.push(cid);
      if (chatIds.length >= limit) break;
    }
    return chatIds;
  } catch (error) {
    console.error('[getPartnerClientChatIdsForBroadcast]', error);
    return [];
  }
}

/**
 * Get client chat_ids who have at least one transaction with this partner
 */
export async function getPartnerClientChatIdsByTransactions(env, partnerChatId, limit = 500) {
  try {
    const result = await supabaseRequest(env,
      `transactions?partner_chat_id=eq.${encodeURIComponent(partnerChatId)}&select=client_chat_id&limit=${limit * 3}`
    );
    const seen = new Set();
    const chatIds = [];
    for (const row of result || []) {
      const cid = row.client_chat_id != null ? String(row.client_chat_id) : null;
      if (!cid || seen.has(cid) || !isValidChatIdForBroadcast(cid)) continue;
      seen.add(cid);
      chatIds.push(cid);
      if (chatIds.length >= limit) break;
    }
    return chatIds;
  } catch (error) {
    console.error('[getPartnerClientChatIdsByTransactions]', error);
    return [];
  }
}

/**
 * Combined list: referral + transactions, no duplicates
 */
export async function getPartnerClientChatIdsCombined(env, partnerChatId, limit = 500) {
  try {
    const [refIds, txnIds] = await Promise.all([
      getPartnerClientChatIdsForBroadcast(env, partnerChatId, limit),
      getPartnerClientChatIdsByTransactions(env, partnerChatId, limit),
    ]);
    const combined = [...new Set([...refIds, ...txnIds])].slice(0, limit);
    return combined;
  } catch (error) {
    console.error('[getPartnerClientChatIdsCombined]', error);
    return [];
  }
}

/**
 * Check if partner can run broadcast (max maxPerDay per day)
 */
export async function canPartnerRunBroadcast(env, partnerChatId, maxPerDay = 1) {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const result = await supabaseRequest(env,
      `partner_broadcast_campaigns?partner_chat_id=eq.${encodeURIComponent(partnerChatId)}&started_at=gte.${startOfToday}&status=in.(running,completed)&select=id&limit=5`
    );
    const count = (result || []).length;
    return count < maxPerDay;
  } catch (error) {
    console.error('[canPartnerRunBroadcast]', error);
    return false;
  }
}

/**
 * Create broadcast campaign record
 */
export async function createBroadcastCampaign(env, partnerChatId, templateId, recipientCount, audienceType = null) {
  try {
    const payload = {
      partner_chat_id: String(partnerChatId),
      template_id: templateId,
      recipient_count: recipientCount,
      sent_count: 0,
      status: 'running',
    };
    if (audienceType) payload.audience_type = audienceType;
    const result = await supabaseRequest(env, 'partner_broadcast_campaigns', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const row = Array.isArray(result) ? result[0] : result;
    return row && row.id != null ? row.id : null;
  } catch (error) {
    console.error('[createBroadcastCampaign]', error);
    return null;
  }
}

/**
 * Update broadcast campaign when finished
 */
export async function updateBroadcastCampaignFinished(env, campaignId, sentCount, status = 'completed', errorMessage = null) {
  try {
    const payload = {
      sent_count: sentCount,
      status,
      finished_at: new Date().toISOString(),
    };
    if (errorMessage) payload.error_message = errorMessage;
    await supabaseRequest(env, `partner_broadcast_campaigns?id=eq.${campaignId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return true;
  } catch (error) {
    console.error('[updateBroadcastCampaignFinished]', error);
    return false;
  }
}
