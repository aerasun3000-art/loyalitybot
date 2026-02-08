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
 * Uses UPSERT (INSERT ... ON CONFLICT) to handle duplicates
 */
export async function upsertUser(env, userData) {
  return supabaseRequest(env, 'users', {
    method: 'POST',
    headers: {
      'Prefer': 'resolution=merge-duplicates,return=representation',
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
