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

/** REFERRAL_CONFIG: 100/25/10 за регистрацию, 8%/4%/2% с покупок */
const REFERRAL_CONFIG = {
  registration_bonus: { level_1: 100, level_2: 25, level_3: 10 },
  transaction_percent: { level_1: 0.08, level_2: 0.04, level_3: 0.02 },
};

/**
 * Resolve referral_source to direct_referrer_chat_id.
 * partner_123 -> "123", ref_ABC123 -> chat_id from users where referral_code=ABC123
 */
export async function resolveReferralSourceToChatId(env, referralSource) {
  if (!referralSource || typeof referralSource !== 'string') return null;
  try {
    if (referralSource.startsWith('partner_')) {
      return referralSource.slice(8);
    }
    if (referralSource.startsWith('ref_')) {
      const code = referralSource.slice(4).toUpperCase();
      const rows = await supabaseRequest(env, `users?referral_code=eq.${encodeURIComponent(code)}&select=chat_id`);
      return rows && rows.length > 0 ? String(rows[0].chat_id) : null;
    }
    return null;
  } catch (e) {
    console.error('[resolveReferralSourceToChatId]', e);
    return null;
  }
}

/**
 * Create referral_tree links for levels 1-3.
 * Referrer must exist in users (referral_tree FK).
 */
export async function createReferralTreeLinks(env, newUserChatId, directReferrerChatId) {
  if (!directReferrerChatId) return;
  try {
    const referrerExists = await supabaseRequest(env, `users?chat_id=eq.${encodeURIComponent(directReferrerChatId)}&select=chat_id`);
    if (!referrerExists || referrerExists.length === 0) return;

    const insertLink = async (referrerId, referredId, level) => {
      const existing = await supabaseRequest(env, `referral_tree?referrer_chat_id=eq.${encodeURIComponent(referrerId)}&referred_chat_id=eq.${encodeURIComponent(referredId)}&select=id`);
      if (existing && existing.length > 0) return;
      await supabaseRequest(env, 'referral_tree', {
        method: 'POST',
        body: JSON.stringify({
          referrer_chat_id: referrerId,
          referred_chat_id: referredId,
          level,
          is_active: true,
        }),
      });
    };

    await insertLink(directReferrerChatId, newUserChatId, 1);

    const ref1 = await supabaseRequest(env, `users?chat_id=eq.${directReferrerChatId}&select=referred_by_chat_id`);
    const referredBy1 = ref1 && ref1[0] && ref1[0].referred_by_chat_id;
    if (referredBy1) {
      await insertLink(referredBy1, newUserChatId, 2);
      const ref2 = await supabaseRequest(env, `users?chat_id=eq.${referredBy1}&select=referred_by_chat_id`);
      const referredBy2 = ref2 && ref2[0] && ref2[0].referred_by_chat_id;
      if (referredBy2) {
        await insertLink(referredBy2, newUserChatId, 3);
      }
    }
  } catch (e) {
    console.error('[createReferralTreeLinks]', e);
  }
}

/**
 * Process registration bonuses (100/25/10) for referrers.
 */
export async function processReferralRegistrationBonuses(env, newUserChatId, referrerChatId) {
  if (!referrerChatId) return;
  try {
    const tree = await buildReferralTree(env, newUserChatId, 1, 3);
    if (!tree || tree.length === 0) return;

    for (const ref of tree) {
      const bonus = REFERRAL_CONFIG.registration_bonus[`level_${ref.level}`] || 0;
      if (bonus <= 0) continue;

      const userRows = await supabaseRequest(env, `users?chat_id=eq.${encodeURIComponent(ref.chat_id)}&select=commission_balance`);
      const current = (userRows && userRows[0] && (userRows[0].commission_balance ?? 0)) || 0;
      const next = Number(current) + bonus;

      await supabaseRequest(env, `users?chat_id=eq.${encodeURIComponent(ref.chat_id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ commission_balance: next }),
      });

      await supabaseRequest(env, 'referral_rewards', {
        method: 'POST',
        body: JSON.stringify({
          referrer_chat_id: ref.chat_id,
          referred_chat_id: newUserChatId,
          reward_type: 'registration',
          level: ref.level,
          points: bonus,
          description: `Бонус за регистрацию реферала уровня ${ref.level}`,
        }),
      });

      await supabaseRequest(env, `referral_tree?referrer_chat_id=eq.${encodeURIComponent(ref.chat_id)}&referred_chat_id=eq.${encodeURIComponent(newUserChatId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ total_earned_points: bonus, total_transactions: 0, is_active: true }),
      });
    }
  } catch (e) {
    console.error('[processReferralRegistrationBonuses]', e);
  }
}

/**
 * Build referral tree (referrers for given referred user).
 */
export async function buildReferralTree(env, referredChatId, level = 1, maxLevel = 3) {
  if (level > maxLevel) return [];
  try {
    const rows = await supabaseRequest(env, `referral_tree?referred_chat_id=eq.${referredChatId}&level=eq.${level}&select=referrer_chat_id,level`);
    const tree = [];
    for (const r of rows || []) {
      tree.push({ chat_id: r.referrer_chat_id, level: r.level });
      const next = await buildReferralTree(env, r.referrer_chat_id, level + 1, maxLevel);
      tree.push(...next);
    }
    return tree;
  } catch (e) {
    console.error('[buildReferralTree]', e);
    return [];
  }
}
