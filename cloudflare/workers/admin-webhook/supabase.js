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

  return response.json();
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
