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
