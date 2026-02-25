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
 * Get last 5 transactions for client
 */
export async function getClientTransactions(env, chatId, limit = 5) {
  try {
    return await supabaseRequest(env, `transactions?client_chat_id=eq.${encodeURIComponent(chatId)}&order=date_time.desc&limit=${limit}&select=date_time,operation_type,earned_points,spent_points,total_amount,partner_chat_id`);
  } catch (e) {
    console.error('[getClientTransactions]', e);
    return [];
  }
}

/**
 * Count level-1 referrals for a user
 */
export async function getClientReferralCount(env, chatId) {
  try {
    const rows = await supabaseRequest(env, `referral_tree?referrer_chat_id=eq.${encodeURIComponent(chatId)}&level=eq.1&select=id`);
    return rows ? rows.length : 0;
  } catch (e) {
    return 0;
  }
}

/**
 * Get partner_chat_id from most recent transaction
 */
export async function getClientLastPartner(env, chatId) {
  try {
    const rows = await supabaseRequest(env, `transactions?client_chat_id=eq.${encodeURIComponent(chatId)}&order=date_time.desc&limit=1&select=partner_chat_id`);
    return rows && rows[0] ? rows[0].partner_chat_id : null;
  } catch (e) {
    return null;
  }
}

/**
 * Save message from client to partner
 */
export async function saveClientMessage(env, { clientChatId, partnerChatId, messageText, messageType = 'text' }) {
  try {
    await supabaseRequest(env, 'messages', {
      method: 'POST',
      body: JSON.stringify({
        client_chat_id: clientChatId,
        partner_chat_id: partnerChatId,
        sender_type: 'client',
        message_text: messageText,
        message_type: messageType,
        is_read: false,
        created_at: new Date().toISOString(),
      }),
    });
    return true;
  } catch (e) {
    console.error('[saveClientMessage]', e);
    return false;
  }
}

/**
 * Count messages sent by client to partner in the last hour
 */
export async function countClientMessagesLastHour(env, clientChatId, partnerChatId) {
  try {
    const since = new Date(Date.now() - 3600_000).toISOString();
    const rows = await supabaseRequest(env,
      `messages?client_chat_id=eq.${encodeURIComponent(clientChatId)}&partner_chat_id=eq.${encodeURIComponent(partnerChatId)}&sender_type=eq.client&created_at=gte.${encodeURIComponent(since)}&select=id`
    );
    return rows ? rows.length : 0;
  } catch (e) {
    console.error('[countClientMessagesLastHour]', e);
    return 0;
  }
}

/**
 * Get bot state for client
 */
export async function getBotState(env, chatId) {
  try {
    const result = await supabaseRequest(env, `bot_states?chat_id=eq.${chatId}&select=*`);
    if (result && result.length > 0) {
      const state = result[0];
      if (state.data && typeof state.data === 'string') {
        try { state.data = JSON.parse(state.data); } catch (e) { state.data = {}; }
      }
      return state;
    }
    return null;
  } catch (e) {
    console.error('[getBotState]', e);
    return null;
  }
}

/**
 * Set bot state (create or update)
 */
export async function setBotState(env, chatId, state, data = {}) {
  try {
    return await supabaseRequest(env, 'bot_states', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ chat_id: chatId, state, data, updated_at: new Date().toISOString() }),
    });
  } catch (e) {
    console.error('[setBotState]', e);
  }
}

/**
 * Clear bot state
 */
export async function clearBotState(env, chatId) {
  try {
    return await supabaseRequest(env, `bot_states?chat_id=eq.${chatId}`, { method: 'DELETE' });
  } catch (e) {
    console.error('[clearBotState]', e);
  }
}

/**
 * Save NPS rating to nps_ratings table. Returns the created row id.
 */
export async function saveNpsRating(env, { clientChatId, partnerChatId, rating }) {
  try {
    const result = await supabaseRequest(env, 'nps_ratings', {
      method: 'POST',
      body: JSON.stringify({
        client_chat_id: clientChatId,
        partner_chat_id: partnerChatId,
        rating,
        created_at: new Date().toISOString(),
      }),
    });
    return result && result[0] ? result[0].id : null;
  } catch (e) {
    console.error('[saveNpsRating]', e);
    return null;
  }
}

/**
 * Update feedback text on existing nps_ratings row
 */
export async function updateNpsFeedback(env, ratingId, feedbackText) {
  try {
    await supabaseRequest(env, `nps_ratings?id=eq.${ratingId}`, {
      method: 'PATCH',
      body: JSON.stringify({ feedback: feedbackText }),
    });
  } catch (e) {
    console.error('[updateNpsFeedback]', e);
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
 * Ensure referrer exists in users. If partner (from partner_ link) is not in users
 * but exists in partners, create minimal user record so referral_tree FK is satisfied.
 */
async function ensureReferrerInUsers(env, directReferrerChatId) {
  const inUsers = await supabaseRequest(env, `users?chat_id=eq.${encodeURIComponent(directReferrerChatId)}&select=chat_id`);
  if (inUsers && inUsers.length > 0) return true;
  const inPartners = await supabaseRequest(env, `partners?chat_id=eq.${encodeURIComponent(directReferrerChatId)}&select=chat_id,name,company_name`);
  if (!inPartners || inPartners.length === 0) return false;
  const p = inPartners[0];
  await supabaseRequest(env, 'users', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      chat_id: String(directReferrerChatId),
      name: p.company_name || p.name || 'Партнёр',
      reg_date: new Date().toISOString(),
      balance: 0,
      status: 'active',
    }),
  });
  return true;
}

/**
 * Create referral_tree links for levels 1-3.
 * Referrer must exist in users (referral_tree FK).
 * For partner_ links: creates user record from partners if missing.
 */
export async function createReferralTreeLinks(env, newUserChatId, directReferrerChatId) {
  if (!directReferrerChatId) return;
  try {
    const referrerReady = await ensureReferrerInUsers(env, directReferrerChatId);
    if (!referrerReady) return;

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
  if (!referrerChatId) return [];
  const credited = [];
  try {
    const tree = await buildReferralTree(env, newUserChatId, 3);
    if (!tree || tree.length === 0) return credited;

    for (const ref of tree) {
      const bonus = REFERRAL_CONFIG.registration_bonus[`level_${ref.level}`] || 0;
      if (bonus <= 0) continue;

      const userRows = await supabaseRequest(env, `users?chat_id=eq.${encodeURIComponent(ref.chat_id)}&select=balance`);
      const current = (userRows && userRows[0] && (userRows[0].balance ?? 0)) || 0;
      const next = Number(current) + bonus;

      await supabaseRequest(env, `users?chat_id=eq.${encodeURIComponent(ref.chat_id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ balance: next }),
      });
      credited.push({ chat_id: ref.chat_id, level: ref.level, bonus });

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
  return credited;
}

const ACHIEVEMENT_THRESHOLDS = [
  { threshold: 5,  bonus: 200,  key: '5_referrals' },
  { threshold: 10, bonus: 500,  key: '10_referrals' },
  { threshold: 25, bonus: 1500, key: '25_referrals' },
  { threshold: 50, bonus: 3000, key: '50_referrals' },
];

/**
 * Check and award achievement bonuses for reaching referral milestones (5/10/25/50).
 * Returns list of newly awarded achievements.
 */
export async function checkAndAwardAchievements(env, referrerChatId) {
  const awarded = [];
  try {
    // Count level-1 referrals directly from referral_tree
    const treeRows = await supabaseRequest(env, `referral_tree?referrer_chat_id=eq.${encodeURIComponent(referrerChatId)}&level=eq.1&select=id`);
    const totalReferrals = treeRows ? treeRows.length : 0;

    // Get already awarded achievements
    const existingRows = await supabaseRequest(env, `referral_rewards?referrer_chat_id=eq.${encodeURIComponent(referrerChatId)}&reward_type=eq.achievement&select=description`);
    const existingKeys = new Set((existingRows || []).map(r => r.description));

    for (const { threshold, bonus, key } of ACHIEVEMENT_THRESHOLDS) {
      if (totalReferrals < threshold) continue;
      const desc = `Достижение: ${threshold} рефералов`;
      if (existingKeys.has(desc)) continue;

      // Credit balance
      const userRows = await supabaseRequest(env, `users?chat_id=eq.${encodeURIComponent(referrerChatId)}&select=balance`);
      const current = (userRows && userRows[0] && (userRows[0].balance ?? 0)) || 0;
      await supabaseRequest(env, `users?chat_id=eq.${encodeURIComponent(referrerChatId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ balance: Number(current) + bonus }),
      });

      // Record achievement
      await supabaseRequest(env, 'referral_rewards', {
        method: 'POST',
        body: JSON.stringify({
          referrer_chat_id: referrerChatId,
          referred_chat_id: referrerChatId,
          reward_type: 'achievement',
          level: 0,
          points: bonus,
          description: desc,
        }),
      });

      awarded.push({ key, threshold, bonus, description: desc });
    }
  } catch (e) {
    console.error('[checkAndAwardAchievements]', e);
  }
  return awarded;
}

/**
 * Build referral tree (referrers for given referred user).
 * Flat query — all levels pointing to referredChatId in one request.
 */
export async function buildReferralTree(env, referredChatId, maxLevel = 3) {
  try {
    const rows = await supabaseRequest(env, `referral_tree?referred_chat_id=eq.${encodeURIComponent(referredChatId)}&level=lte.${maxLevel}&select=referrer_chat_id,level`);
    return (rows || []).map(r => ({ chat_id: r.referrer_chat_id, level: r.level }));
  } catch (e) {
    console.error('[buildReferralTree]', e);
    return [];
  }
}

/** Ambassador: resolve ambassador_code (e.g. amb_abc12345) to ambassador chat_id */
export async function getAmbassadorChatIdByCode(env, ambassadorCode) {
  if (!ambassadorCode || !ambassadorCode.startsWith('amb_')) return null;
  try {
    const rows = await supabaseRequest(env, `ambassadors?ambassador_code=eq.${encodeURIComponent(ambassadorCode)}&select=chat_id`);
    return rows && rows[0] ? String(rows[0].chat_id) : null;
  } catch (e) {
    console.error('[getAmbassadorChatIdByCode]', e);
    return null;
  }
}

/** Ambassador: check if user is ambassador */
export async function getAmbassador(env, chatId) {
  try {
    const res = await supabaseRequest(env, `ambassadors?chat_id=eq.${encodeURIComponent(chatId)}&select=*`);
    return res?.[0] || null;
  } catch (e) {
    console.error('[getAmbassador]', e);
    return null;
  }
}

/** Ambassador: register new ambassador */
export async function createAmbassador(env, chatId, tierAtSignup) {
  const maxPartners = ['gold', 'platinum', 'diamond'].includes(tierAtSignup) ? 10 : 3;
  return supabaseRequest(env, 'ambassadors', {
    method: 'POST',
    body: JSON.stringify({
      chat_id: chatId,
      tier_at_signup: tierAtSignup,
      max_partners: maxPartners,
      status: 'active',
    }),
  });
}

/** Ambassador: add partner to ambassador's list */
export async function addAmbassadorPartner(env, ambassadorChatId, partnerChatId) {
  return supabaseRequest(env, 'ambassador_partners', {
    method: 'POST',
    body: JSON.stringify({
      ambassador_chat_id: ambassadorChatId,
      partner_chat_id: partnerChatId,
    }),
  });
}

/** Ambassador: get ambassador's partners */
export async function getAmbassadorPartners(env, ambassadorChatId) {
  try {
    return await supabaseRequest(env, `ambassador_partners?ambassador_chat_id=eq.${encodeURIComponent(ambassadorChatId)}&select=*,partners(name,company_name,category_group)`);
  } catch (e) {
    console.error('[getAmbassadorPartners]', e);
    return [];
  }
}

/** Ambassador: get earnings */
export async function getAmbassadorEarnings(env, ambassadorChatId) {
  try {
    return await supabaseRequest(env, `ambassador_earnings?ambassador_chat_id=eq.${encodeURIComponent(ambassadorChatId)}&order=created_at.desc&limit=50&select=*`);
  } catch (e) {
    console.error('[getAmbassadorEarnings]', e);
    return [];
  }
}

/** Ambassador: attribute transaction to ambassador */
export async function attributeTransactionToAmbassador(env, transactionId, ambassadorChatId) {
  return supabaseRequest(env, `transactions?id=eq.${transactionId}`, {
    method: 'PATCH',
    body: JSON.stringify({ ambassador_chat_id: ambassadorChatId }),
  });
}

/** Ambassador: create earning and update ambassador balance */
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
  const amb = await getAmbassador(env, data.ambassador_chat_id);
  const curPending = (amb?.balance_pending ?? 0) || 0;
  const curTotal = (amb?.total_earnings ?? 0) || 0;
  return supabaseRequest(env, `ambassadors?chat_id=eq.${encodeURIComponent(data.ambassador_chat_id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      balance_pending: Number(curPending) + ambassadorAmount,
      total_earnings: Number(curTotal) + ambassadorAmount,
    }),
  });
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

/** Ambassador: get approved partners for selection (chat_id, name, company_name) */
export async function getPartnersForAmbassadorSelection(env) {
  try {
    return await supabaseRequest(env, 'partners?select=chat_id,name,company_name&order=name.asc');
  } catch (e) {
    console.error('[getPartnersForAmbassadorSelection]', e);
    return [];
  }
}

/**
 * Проверить, может ли амбассадор добавить партнёра («честное продвижение»).
 * Возвращает { canAdd: boolean, reason: string, message: string }
 */
export async function canAmbassadorAddPartner(env, ambassadorChatId, partnerChatId) {
  if (ambassadorChatId === partnerChatId) {
    return { canAdd: false, reason: 'self_add_forbidden', message: 'Нельзя добавить себя в магазин.' };
  }

  const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

  const existing = await supabaseRequest(env,
    `ambassador_partners?ambassador_chat_id=eq.${encodeURIComponent(ambassadorChatId)}&partner_chat_id=eq.${encodeURIComponent(partnerChatId)}&select=id`);
  if (existing?.length > 0) {
    return { canAdd: false, reason: 'already_added', message: 'Этот партнёр уже в вашем магазине.' };
  }

  const amb = await supabaseRequest(env,
    `ambassadors?chat_id=eq.${encodeURIComponent(ambassadorChatId)}&select=max_partners`);
  const maxPartners = amb?.[0]?.max_partners ?? 3;
  const currentCount = await supabaseRequest(env,
    `ambassador_partners?ambassador_chat_id=eq.${encodeURIComponent(ambassadorChatId)}&select=id`);
  if ((currentCount?.length ?? 0) >= maxPartners) {
    return { canAdd: false, reason: 'limit_reached', message: `Достигнут лимит партнёров (${maxPartners}).` };
  }

  const promoTxns = await supabaseRequest(env,
    `transactions?client_chat_id=eq.${encodeURIComponent(ambassadorChatId)}&partner_chat_id=eq.${encodeURIComponent(partnerChatId)}&spent_points=gt.0&date_time=gte.${since}&select=id&limit=1`);
  if (promoTxns?.length > 0) {
    return { canAdd: true, reason: 'promotion_used', message: 'Отлично! Вы использовали акцию этого партнёра.' };
  }

  const anyTxns = await supabaseRequest(env,
    `transactions?client_chat_id=eq.${encodeURIComponent(ambassadorChatId)}&partner_chat_id=eq.${encodeURIComponent(partnerChatId)}&date_time=gte.${since}&select=id&limit=1`);
  const nps10 = await supabaseRequest(env,
    `nps_ratings?client_chat_id=eq.${encodeURIComponent(ambassadorChatId)}&partner_chat_id=eq.${encodeURIComponent(partnerChatId)}&rating=eq.10&created_at=gte.${since}&select=id&limit=1`);
  if (anyTxns?.length > 0 && nps10?.length > 0) {
    return { canAdd: true, reason: 'client_nps10', message: 'Отлично! Вы были клиентом и поставили оценку 10.' };
  }

  return { canAdd: false, reason: 'qualification_required',
    message: 'Чтобы добавить партнёра, воспользуйтесь его акцией или совершите покупку и поставьте оценку 10.' };
}

/**
 * Recalculate karma score for user (non-blocking RPC call)
 */
export async function recalculateKarma(env, chatId) {
  try {
    const config = getSupabaseConfig(env);
    const response = await fetch(`${config.url}/rest/v1/rpc/recalculate_karma`, {
      method: 'POST',
      headers: {
        'apikey': config.key,
        'Authorization': `Bearer ${config.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_chat_id: String(chatId) }),
    });
    if (!response.ok) {
      const err = await response.text();
      console.error('[recalculateKarma] RPC failed:', err);
    }
  } catch (e) {
    console.error('[recalculateKarma] error:', e);
  }
}

/**
 * Create ambassador payout request
 */
export async function createPayoutRequest(env, { ambassadorChatId, amount, paymentMethod, paymentDetails }) {
  try {
    const result = await supabaseRequest(env, 'ambassador_payout_requests', {
      method: 'POST',
      body: JSON.stringify({
        ambassador_chat_id: String(ambassadorChatId),
        amount: Number(amount),
        payment_method: paymentMethod,
        payment_details: paymentDetails,
      }),
    });
    return result && result[0] ? result[0] : null;
  } catch (e) {
    console.error('[createPayoutRequest]', e);
    return null;
  }
}

/**
 * Get ambassador pending balance
 */
export async function getAmbassadorBalance(env, chatId) {
  try {
    const rows = await supabaseRequest(env,
      `ambassadors?chat_id=eq.${encodeURIComponent(chatId)}&select=balance_pending`);
    return rows && rows[0] ? (rows[0].balance_pending || 0) : 0;
  } catch (e) {
    console.error('[getAmbassadorBalance]', e);
    return 0;
  }
}
