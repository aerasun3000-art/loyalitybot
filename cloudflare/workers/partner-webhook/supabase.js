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
    console.error('[supabaseRequest] Response text:', await response.text());
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
    return { ...approved[0], status: 'Approved' };
  }
  
  // If not found, check partner_applications
  const application = await supabaseRequest(env, `partner_applications?chat_id=eq.${chatId}&select=*`);
  if (application && application.length > 0) {
    return { ...application[0], status: application[0].status || 'Pending' };
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
