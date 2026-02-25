/**
 * Client bot handlers for Cloudflare Workers
 * Handles all client bot commands and callbacks
 */

import {
  getUserByChatId,
  upsertUser,
  createTransaction,
  getPartnerByChatId,
  resolveReferralSourceToChatId,
  createReferralTreeLinks,
  processReferralRegistrationBonuses,
  checkAndAwardAchievements,
  getClientTransactions,
  getClientReferralCount,
  getClientLastPartner,
  saveClientMessage,
  countClientMessagesLastHour,
  getBotState,
  setBotState,
  clearBotState,
  saveNpsRating,
  updateNpsFeedback,
  getAmbassador,
  createAmbassador,
  addAmbassadorPartner,
  getAmbassadorPartners,
  getAmbassadorEarnings,
  getPartnersForAmbassadorSelection,
  canAmbassadorAddPartner,
  recalculateKarma,
  createPayoutRequest,
  getAmbassadorBalance,
} from './supabase.js';

/** Return level info based on referral count */
function getLevelInfo(count) {
  if (count >= 25) return { level: 'Platinum', emoji: '💎', toNext: null };
  if (count >= 10) return { level: 'Gold',     emoji: '🥇', toNext: 25 - count };
  if (count >= 5)  return { level: 'Silver',   emoji: '🥈', toNext: 10 - count };
  return             { level: 'Bronze',   emoji: '🥉', toNext: 5 - count };
}

const TIER_THRESHOLDS = { bronze: 0, silver: 500, gold: 2000, platinum: 5000, diamond: 10000 };
const TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
function getTierFromBalance(balance) {
  for (const t of [...TIER_ORDER].reverse()) {
    if ((balance || 0) >= TIER_THRESHOLDS[t]) return t;
  }
  return 'bronze';
}
function isSilverPlus(tier) {
  return TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf('silver');
}
import {
  sendTelegramMessage,
  sendTelegramMessageWithKeyboard,
  answerCallbackQuery,
  editMessageText,
  setChatMenuButton,
} from './telegram.js';
import {
  getChatIdFromUpdate,
  getUserIdFromUpdate,
  getTextFromUpdate,
  logError,
} from './common.js';

/**
 * Generate signed tg_auth token for "open in browser" link.
 * Token format: chatId.expiry.base64url(signature)
 */
async function generateBrowserAuthToken(env, chatId) {
  const secret = env.AUTH_SECRET || env.SUPABASE_KEY;
  if (!secret) return null;
  const expiry = Math.floor(Date.now() / 1000) + 900; // 15 min
  const payload = `${chatId}.${expiry}`;
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
    const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `${payload}.${sigB64}`;
  } catch (e) {
    console.error('[generateBrowserAuthToken]', e);
    return null;
  }
}

/**
 * Build URL for "В браузере" button (with tg_auth for user identification)
 */
async function getBrowserUrl(env, frontendUrl, chatId) {
  const token = await generateBrowserAuthToken(env, chatId);
  if (!token) return frontendUrl;
  const sep = frontendUrl.includes('?') ? '&' : '?';
  return `${frontendUrl}${sep}tg_auth=${encodeURIComponent(token)}`;
}

/**
 * Handle /start command with referral links
 */
export async function handleStart(env, update) {
  const message = update.message;
  if (!message || !message.chat) {
    return { success: false, error: 'Invalid message structure' };
  }
  const chatId = String(message.chat.id);
  const from = message.from;
  const text = message.text || '';
  
  // Parse referral link: /start partner_123, /start ref_ABC123, /start amb_abc12345
  const referralMatch = text.match(/(partner_|ref_|amb_)([\w\d]+)/i);
  const referralSource = referralMatch ? (referralMatch[1] + referralMatch[2]) : null;
  const referralId = referralMatch ? referralMatch[2] : null;
  
  try {
    // Check if user exists
    let user = await getUserByChatId(env, chatId);
    
    if (!user) {
      // Create new user
      const welcomeBonus = parseInt(env.WELCOME_BONUS_AMOUNT || '100');
      
      // Build name from first_name and last_name (from can be absent in rare cases)
      const name = from ? ([from.first_name, from.last_name]
        .filter(Boolean)
        .join(' ') || from.username || null) : chatId;
      
      const directReferrerChatId = referralSource && !referralSource.startsWith('amb_')
        ? await resolveReferralSourceToChatId(env, referralSource) : null;

      const userData = {
        chat_id: chatId,
        name: name,
        reg_date: new Date().toISOString(),
        balance: welcomeBonus,
        referral_source: referralSource,
        referred_by_chat_id: directReferrerChatId || undefined,
        status: 'active',
      };

      user = await upsertUser(env, userData);

      if (directReferrerChatId) {
        await createReferralTreeLinks(env, chatId, directReferrerChatId);
        const credited = await processReferralRegistrationBonuses(env, chatId, directReferrerChatId);
        for (const ref of (credited || [])) {
          await sendTelegramMessage(
            env.TOKEN_CLIENT,
            ref.chat_id,
            `🎉 По вашей реферальной ссылке зарегистрировался новый пользователь!\n\n` +
            `💰 Вам начислено <b>${ref.bonus} баллов</b>${ref.level > 1 ? ` (уровень ${ref.level})` : ''}`
          ).catch(() => {});
        }

        // Check achievements for direct referrer
        const achievements = await checkAndAwardAchievements(env, directReferrerChatId);
        for (const ach of achievements) {
          await sendTelegramMessage(
            env.TOKEN_CLIENT,
            directReferrerChatId,
            `🏆 <b>Достижение разблокировано!</b>\n\n` +
            `Вы пригласили <b>${ach.threshold} друзей</b>!\n` +
            `💰 Бонус: <b>+${ach.bonus} баллов</b>`
          ).catch(() => {});
        }
      }
      
      // Send welcome message
      // IMPORTANT: Always use Cloudflare Pages URL
      const frontendUrl = env.FRONTEND_URL || 'https://loyalitybot-frontend.pages.dev';
      const browserUrl = await getBrowserUrl(env, frontendUrl, chatId);
      console.log('[handleStart] New user - FRONTEND_URL from env:', env.FRONTEND_URL);
      const keyboard = [
        [
          { text: '🚀 Открыть приложение', web_app: { url: frontendUrl } },
          { text: '🌐 В браузере', url: browserUrl }
        ],
        [{ text: '📊 Мой баланс', callback_data: 'balance' }, { text: '📜 История', callback_data: 'history' }],
        [{ text: '💬 Написать партнёру', callback_data: 'feedback_menu' }]
      ];
      const greeting = name ? `<b>${name}</b>, добро` : 'Добро';
      await sendTelegramMessageWithKeyboard(
        env.TOKEN_CLIENT,
        chatId,
        `🎉 ${greeting} пожаловать в программу лояльности!\n\n` +
        `✅ Вы получили приветственный бонус: <b>${welcomeBonus} баллов</b>\n\n` +
        `💡 <b>Как использовать:</b>\n` +
        `• Нажмите "Открыть приложение" или "В браузере" (если используете VPN)\n` +
        `• Получайте баллы за покупки у наших партнеров\n` +
        `• Обменивайте баллы на услуги и акции\n\n` +
        `🚀 Начните прямо сейчас!`,
        keyboard,
        { parseMode: 'HTML' }
      );
      await setChatMenuButton(env.TOKEN_CLIENT, chatId, frontendUrl).catch(() => {});
      return { success: true, newUser: true };
    } else {
      // User already exists — update referral_source if came via ambassador link
      if (referralSource && referralSource.startsWith('amb_')) {
        await upsertUser(env, { chat_id: chatId, referral_source: referralSource });
      }
      if (text.includes('cmd_ambassador')) {
        return await handleAmbassadorCommand(env, chatId);
      }
      // IMPORTANT: Always use Cloudflare Pages URL
      const frontendUrl = env.FRONTEND_URL || 'https://loyalitybot-frontend.pages.dev';
      const browserUrl = await getBrowserUrl(env, frontendUrl, chatId);
      console.log('[handleStart] Existing user - FRONTEND_URL from env:', env.FRONTEND_URL);
      const refCount = await getClientReferralCount(env, chatId);
      const lvl = getLevelInfo(refCount);
      const keyboard = [
        [
          { text: '🚀 Открыть приложение', web_app: { url: frontendUrl } },
          { text: '🌐 В браузере', url: browserUrl }
        ],
        [{ text: '📊 Мой баланс', callback_data: 'balance' }, { text: '📜 История', callback_data: 'history' }],
        [{ text: '💬 Написать партнёру', callback_data: 'feedback_menu' }]
      ];
      const userName = user.name ? `<b>${user.name}</b>` : 'С возвращением';
      const levelLine = lvl.toNext !== null
        ? `${lvl.emoji} Уровень: <b>${lvl.level}</b> (до ${lvl.level === 'Bronze' ? 'Silver' : lvl.level === 'Silver' ? 'Gold' : 'Platinum'}: ещё ${lvl.toNext} друзей)`
        : `${lvl.emoji} Уровень: <b>${lvl.level}</b>`;
      await sendTelegramMessageWithKeyboard(
        env.TOKEN_CLIENT,
        chatId,
        `👋 ${userName}, рады видеть вас снова!\n\n` +
        `💰 Баланс: <b>${user.balance || 0} баллов</b>\n` +
        `${levelLine}\n\n` +
        `Нажмите "Открыть приложение" или "В браузере" (если используете VPN).`,
        keyboard,
        { parseMode: 'HTML' }
      );
      await setChatMenuButton(env.TOKEN_CLIENT, chatId, frontendUrl).catch(() => {});
      return { success: true, newUser: false };
    }
  } catch (error) {
    logError('handleStart', error, { chatId, referralId });
    throw error;
  }
}

/**
 * Handle NPS rating callback
 */
export async function handleNpsRating(env, update) {
  const callbackQuery = update.callback_query;
  const chatId = String(callbackQuery.message.chat.id);
  const rating = parseInt(callbackQuery.data.replace('nps_rate_', ''));

  try {
    await answerCallbackQuery(env.TOKEN_CLIENT, callbackQuery.id);

    const user = await getUserByChatId(env, chatId);
    if (!user) {
      await editMessageText(
        env.TOKEN_CLIENT, chatId, callbackQuery.message.message_id,
        '❌ Пользователь не найден. Пожалуйста, зарегистрируйтесь через /start'
      );
      return { success: false };
    }

    const partnerChatId = await getClientLastPartner(env, chatId);
    const ratingId = await saveNpsRating(env, { clientChatId: chatId, partnerChatId, rating });
    // Пересчёт кармы (fire-and-forget)
    recalculateKarma(env, chatId).catch(() => {});

    await editMessageText(
      env.TOKEN_CLIENT, chatId, callbackQuery.message.message_id,
      `⭐ Оценка <b>${rating}/10</b> принята!\n\n✍️ Напишите короткий отзыв (или отправьте /skip чтобы пропустить):`
    );

    await setBotState(env, chatId, 'awaiting_nps_review', { ratingId, partnerChatId });
    return { success: true, rating };
  } catch (error) {
    logError('handleNpsRating', error, { chatId, rating });
    throw error;
  }
}

/**
 * Handle NPS text review when user is in awaiting_nps_review state
 */
export async function handleNpsReview(env, chatId, text) {
  try {
    const stateRow = await getBotState(env, chatId);

    // Обработка ввода суммы выплаты
    if (stateRow && stateRow.state === 'ambassador_payout_amount') {
      const amount = parseFloat(text.replace(',', '.'));
      const maxAmount = stateRow.data?.balance || 0;
      if (!Number.isFinite(amount) || amount < 500 || amount > maxAmount) {
        await sendTelegramMessage(
          env.TOKEN_CLIENT, chatId,
          `❌ Введите сумму от 500 до ${Math.floor(maxAmount)} ₽:`
        );
        return true;
      }
      await setBotState(env, chatId, 'ambassador_payout_method', { ...stateRow.data, amount });
      await sendTelegramMessage(
        env.TOKEN_CLIENT, chatId,
        '💳 Выберите способ получения:',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '💳 Карта', callback_data: 'payout_method_card' }],
              [{ text: '📱 СБП (по номеру телефона)', callback_data: 'payout_method_sbp' }],
              [{ text: '₿ Крипто', callback_data: 'payout_method_crypto' }],
            ]
          }
        }
      );
      return true;
    }

    // Обработка ввода реквизитов выплаты
    if (stateRow && stateRow.state === 'ambassador_payout_details') {
      const { amount, method, balance } = stateRow.data || {};
      await clearBotState(env, chatId);
      const req = await createPayoutRequest(env, {
        ambassadorChatId: chatId,
        amount,
        paymentMethod: method,
        paymentDetails: text.trim(),
      });
      await sendTelegramMessage(
        env.TOKEN_CLIENT, chatId,
        `✅ Заявка на выплату <b>${Math.floor(amount)} ₽</b> принята!\n\nМы обработаем её в течение 3 рабочих дней.`,
        { parseMode: 'HTML' }
      );
      if (env.ADMIN_CHAT_ID) {
        const methodLabel = { card: 'Карта', sbp: 'СБП', crypto: 'Крипто' }[method] || method;
        sendTelegramMessage(
          env.TOKEN_CLIENT, env.ADMIN_CHAT_ID,
          `📋 Новая заявка на выплату амбассадора\nID: ${chatId}\nСумма: ${Math.floor(amount)} ₽\nСпособ: ${methodLabel}`,
          { parseMode: 'HTML' }
        ).catch(() => {});
      }
      return true;
    }

    if (!stateRow || stateRow.state !== 'awaiting_nps_review') return false;

    const { ratingId, partnerChatId } = stateRow.data || {};
    await clearBotState(env, chatId);

    if (text === '/skip' || !text || !text.trim()) {
      await sendTelegramMessage(env.TOKEN_CLIENT, chatId, '✅ Спасибо за вашу оценку!');
      return true;
    }

    if (ratingId) {
      await updateNpsFeedback(env, ratingId, text.trim());
    }

    if (partnerChatId) {
      const user = await getUserByChatId(env, chatId);
      const clientName = (user && user.name) ? user.name : `ID ${chatId}`;
      await sendTelegramMessage(
        env.TOKEN_PARTNER, partnerChatId,
        `📝 <b>Отзыв от клиента</b>\n\nКлиент: <b>${clientName}</b>\nОтзыв: <i>${text.trim()}</i>`
      ).catch(() => {});
    }

    await sendTelegramMessage(env.TOKEN_CLIENT, chatId, '✅ Спасибо за отзыв! Это поможет партнёру стать лучше.');
    return true;
  } catch (e) {
    console.error('[handleNpsReview]', e);
    return false;
  }
}

/**
 * Handle balance callback
 */
export async function handleBalance(env, update) {
  const callbackQuery = update.callback_query;
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    await answerCallbackQuery(env.TOKEN_CLIENT, callbackQuery.id);
    
    const user = await getUserByChatId(env, chatId);
    if (!user) {
      await sendTelegramMessage(
        env.TOKEN_CLIENT,
        chatId,
        '❌ Пользователь не найден. Пожалуйста, зарегистрируйтесь через /start'
      );
      return { success: false };
    }
    
    const balance = user.balance || 0;
    const refCount = await getClientReferralCount(env, chatId);
    const lvl = getLevelInfo(refCount);
    const levelLine = lvl.toNext !== null
      ? `${lvl.emoji} Уровень: <b>${lvl.level}</b> — до следующего ещё <b>${lvl.toNext}</b> друзей`
      : `${lvl.emoji} Уровень: <b>${lvl.level}</b> — максимальный!`;
    const userName = user.name ? `<b>${user.name}</b>, ваш` : 'Ваш';
    await sendTelegramMessage(
      env.TOKEN_CLIENT,
      chatId,
      `💰 ${userName} баланс: <b>${balance} баллов</b>\n` +
      `${levelLine}\n\n` +
      `Используйте баллы для оплаты услуг и акций наших партнёров!`
    );

    return { success: true, balance };
  } catch (error) {
    logError('handleBalance', error, { chatId });
    throw error;
  }
}

/**
 * Handle text messages
 */
export async function handleTextMessage(env, update) {
  const message = update.message;
  const chatId = String(message.chat.id);
  const text = message.text || '';
  
  try {
    // Check if user exists
    const user = await getUserByChatId(env, chatId);
    if (!user) {
      await sendTelegramMessage(
        env.TOKEN_CLIENT,
        chatId,
        `👋 Привет! Для начала работы нажмите /start`
      );
      return { success: true };
    }
    
    // Handle commands or regular messages
    if (text.startsWith('/')) {
      // Command handling would go here
      return { success: true, handled: false };
    }
    
    // Default: redirect to /start
    await sendTelegramMessage(
      env.TOKEN_CLIENT,
      chatId,
      `Пожалуйста, начните с команды /start.\n\n` +
      `💡 Подсказка: Для вопросов используйте команду /ask или начните сообщение с **?**`
    );
    
    return { success: true };
  } catch (error) {
    logError('handleTextMessage', error, { chatId, text });
    throw error;
  }
}

/**
 * Handle /history command and 'history' callback
 */
export async function handleHistory(env, chatId) {
  try {
    const [user, transactions] = await Promise.all([
      getUserByChatId(env, chatId),
      getClientTransactions(env, chatId, 5),
    ]);
    if (!user) {
      await sendTelegramMessage(env.TOKEN_CLIENT, chatId, '❌ Пользователь не найден. Нажмите /start');
      return { success: false };
    }
    if (!transactions || transactions.length === 0) {
      const who = user.name ? `<b>${user.name}</b>, у вас` : 'У вас';
      await sendTelegramMessage(env.TOKEN_CLIENT, chatId, `${who} пока нет транзакций.`);
      return { success: true };
    }
    const lines = transactions.map(t => {
      const date = new Date(t.date_time).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
      if (t.operation_type === 'accrual') {
        return `📅 ${date} — <b>+${t.earned_points} баллов</b> (чек: ${t.total_amount})`;
      } else if (t.operation_type === 'redemption') {
        return `📅 ${date} — <b>−${t.spent_points} баллов</b> (списание)`;
      }
      return `📅 ${date} — ${t.earned_points || 0} баллов`;
    });
    const who = user.name ? `<b>${user.name}</b>, последние покупки` : 'Последние покупки';
    await sendTelegramMessage(
      env.TOKEN_CLIENT, chatId,
      `📜 ${who}:\n\n${lines.join('\n')}\n\n💰 Текущий баланс: <b>${user.balance || 0} баллов</b>`
    );
    return { success: true };
  } catch (error) {
    logError('handleHistory', error, { chatId });
    throw error;
  }
}

/**
 * Handle /ambassador command (text message)
 */
async function handleAmbassadorCommand(env, chatId) {
  const user = await getUserByChatId(env, chatId);
  if (!user) {
    await sendTelegramMessage(env.TOKEN_CLIENT, chatId, '❌ Пользователь не найден. Нажмите /start');
    return { success: false };
  }
  const balance = user.balance || 0;
  const tier = getTierFromBalance(balance);
  if (!isSilverPlus(tier)) {
    await sendTelegramMessage(env.TOKEN_CLIENT, chatId,
      `🔒 Достигните Silver (500 баллов), чтобы стать амбассадором.\n\nУ вас: ${balance} / 500`);
    return { success: true };
  }
  const amb = await getAmbassador(env, chatId);
  if (amb) {
    const partners = await getAmbassadorPartners(env, chatId);
    const count = partners?.length || 0;
    const botUsername = (env.CLIENT_BOT_USERNAME || 'mindbeatybot').replace('@', '');
    const link = `https://t.me/${botUsername}?start=${amb.ambassador_code || ''}`;
    const keyboard = [
      [{ text: '📊 История начислений', callback_data: 'ambassador_earnings' }, { text: '💳 Запросить выплату', callback_data: 'ambassador_payout' }],
      [{ text: '➕ Добавить партнёра', callback_data: 'ambassador_add_partner' }],
    ];
    await sendTelegramMessageWithKeyboard(env.TOKEN_CLIENT, chatId,
      `🌟 <b>Кабинет амбассадора</b>\n\n` +
      `Тир: ${amb.tier_at_signup || '—'}\n` +
      `Партнёры: ${count} / ${amb.max_partners || 3}\n` +
      `Баланс к выплате: ${(amb.balance_pending || 0).toFixed(0)} ₽\n` +
      `Всего заработано: ${(amb.total_earnings || 0).toFixed(0)} ₽\n\n` +
      `🔗 Ссылка:\n<code>${link}</code>`,
      keyboard,
      { parseMode: 'HTML' }
    );
    return { success: true };
  }
  const maxPartners = ['gold', 'platinum', 'diamond'].includes(tier) ? 10 : 3;
  const partners = await getPartnersForAmbassadorSelection(env);
  if (!partners || partners.length === 0) {
    await sendTelegramMessage(env.TOKEN_CLIENT, chatId, '❌ Нет доступных партнёров для выбора.');
    return { success: true };
  }
  await setBotState(env, chatId, 'awaiting_ambassador_partners_selection', {
    maxPartners,
    selectedPartners: [],
    tierAtSignup: tier,
    partners,
  });
  const keyboard = partners.slice(0, 15).map(p => [
    { text: (p.company_name || p.name || p.chat_id).slice(0, 30), callback_data: `amb_partner_${p.chat_id}` }
  ]);
  keyboard.push([{ text: '✅ Готово', callback_data: 'amb_confirm' }]);
  await sendTelegramMessageWithKeyboard(env.TOKEN_CLIENT, chatId,
    `🌟 Выберите до ${maxPartners} партнёров, которых будете продвигать:\n\n` +
    `⚠️  <b>Честное продвижение:</b> добавить можно только партнёров, у которых вы были клиентом (акция или покупка + оценка 10) за последние 12 месяцев.\n\n` +
    `Нажмите на партнёра, чтобы добавить. Затем «Готово».`,
    keyboard,
    { parseMode: 'HTML' }
  );
  return { success: true };
}

/**
 * Handle become_ambassador / ambassador_cabinet and related callbacks
 */
export async function handleAmbassador(env, update) {
  const callbackQuery = update.callback_query;
  const chatId = String(callbackQuery.message.chat.id);
  const data = callbackQuery.data;
  try {
    await answerCallbackQuery(env.TOKEN_CLIENT, callbackQuery.id);
    const user = await getUserByChatId(env, chatId);
    if (!user) {
      await sendTelegramMessage(env.TOKEN_CLIENT, chatId, '❌ Пользователь не найден. Нажмите /start');
      return { success: false };
    }
    const balance = user.balance || 0;
    const tier = getTierFromBalance(balance);

    if (data === 'become_ambassador' || data === 'ambassador_cabinet') {
      if (!isSilverPlus(tier)) {
        await editMessageText(
          env.TOKEN_CLIENT, chatId, callbackQuery.message.message_id,
          `🔒 Достигните Silver (500 баллов), чтобы стать амбассадором.\n\nУ вас: ${balance} / 500`
        );
        return { success: true };
      }
      const amb = await getAmbassador(env, chatId);
      if (amb) {
        return await showAmbassadorCabinet(env, chatId, amb, callbackQuery.message.message_id);
      }
      if (data === 'ambassador_cabinet') return { success: true };
      const maxPartners = ['gold', 'platinum', 'diamond'].includes(tier) ? 10 : 3;
      const partners = await getPartnersForAmbassadorSelection(env);
      if (!partners || partners.length === 0) {
        await editMessageText(
          env.TOKEN_CLIENT, chatId, callbackQuery.message.message_id,
          '❌ Нет доступных партнёров для выбора.'
        );
        return { success: true };
      }
      await setBotState(env, chatId, 'awaiting_ambassador_partners_selection', {
        maxPartners,
        selectedPartners: [],
        tierAtSignup: tier,
        partners,
      });
      const keyboard = partners.slice(0, 15).map(p => [
        { text: (p.company_name || p.name || p.chat_id).slice(0, 30), callback_data: `amb_partner_${p.chat_id}` }
      ]);
      keyboard.push([{ text: '✅ Готово', callback_data: 'amb_confirm' }]);
      await editMessageText(
        env.TOKEN_CLIENT, chatId, callbackQuery.message.message_id,
        `🌟 Выберите до ${maxPartners} партнёров, которых будете продвигать:\n\n` +
        `⚠️  <b>Честное продвижение:</b> добавить можно только партнёров, у которых вы были клиентом (акция или покупка + оценка 10) за последние 12 месяцев.\n\n` +
        `Нажмите на партнёра, чтобы добавить. Затем «Готово».`,
        { parseMode: 'HTML', reply_markup: { inline_keyboard: keyboard } }
      );
      return { success: true };
    }

    if (data === 'amb_confirm') {
      const state = await getBotState(env, chatId);
      if (!state || state.state !== 'awaiting_ambassador_partners_selection') return { success: false };
      const { selectedPartners, maxPartners, tierAtSignup } = state.data || {};
      if (!selectedPartners || selectedPartners.length === 0) {
        await editMessageText(
          env.TOKEN_CLIENT, chatId, callbackQuery.message.message_id,
          '❌ Выберите хотя бы одного партнёра.'
        );
        return { success: true };
      }

      const addedPartners = [];
      const rejectedPartners = [];
      for (const pid of selectedPartners) {
        const check = await canAmbassadorAddPartner(env, chatId, pid);
        if (check.canAdd) {
          addedPartners.push(pid);
        } else {
          rejectedPartners.push({ pid, reason: check.reason, message: check.message });
        }
      }

      if (addedPartners.length === 0) {
        const firstRejection = rejectedPartners[0];
        await editMessageText(
          env.TOKEN_CLIENT, chatId, callbackQuery.message.message_id,
          `❌ <b>Партнёры не добавлены</b>\n\n${firstRejection.message}\n\n` +
          `Условия для добавления партнёра:\n` +
          `• Воспользуйтесь акцией партнёра (оплата баллами)\n` +
          `• ИЛИ совершите покупку и поставьте оценку 10`,
          { parseMode: 'HTML' }
        );
        return { success: true };
      }

      const created = await createAmbassador(env, chatId, tierAtSignup);
      const ambRow = Array.isArray(created) ? created[0] : created;
      const ambassadorCode = ambRow?.ambassador_code || 'amb_unknown';
      const botUsername = (env.CLIENT_BOT_USERNAME || 'mindbeatybot').replace('@', '');

      for (const pid of addedPartners) {
        await addAmbassadorPartner(env, chatId, pid).catch(() => {});
      }

      await clearBotState(env, chatId);
      let resultMsg = `✅ <b>Добавлено партнёров: ${addedPartners.length}</b>\n\n`;
      if (rejectedPartners.length > 0) {
        resultMsg += `⚠️  Не добавлено: ${rejectedPartners.length} (не выполнены условия «честного продвижения»)\n\n`;
      }
      resultMsg += `🔗 Ваша ссылка: <code>https://t.me/${botUsername}?start=${ambassadorCode}</code>`;
      await editMessageText(
        env.TOKEN_CLIENT, chatId, callbackQuery.message.message_id,
        resultMsg,
        { parseMode: 'HTML' }
      );
      return { success: true };
    }

    if (data?.startsWith('amb_partner_')) {
      const state = await getBotState(env, chatId);
      if (!state || state.state !== 'awaiting_ambassador_partners_selection') return { success: false };
      const partnerChatId = data.replace('amb_partner_', '');
      const { selectedPartners, maxPartners, partners: partnersList } = state.data || {};
      const sel = selectedPartners || [];
      if (sel.includes(partnerChatId)) {
        sel.splice(sel.indexOf(partnerChatId), 1);
      } else if (sel.length < maxPartners) {
        sel.push(partnerChatId);
      }
      await setBotState(env, chatId, 'awaiting_ambassador_partners_selection', {
        ...state.data,
        selectedPartners: sel,
        partners: state.data?.partners || await getPartnersForAmbassadorSelection(env),
      });
      const partners = partnersList || state.data?.partners || await getPartnersForAmbassadorSelection(env);
      const keyboard = (partners || []).slice(0, 15).map(p => {
        const isSel = sel.includes(p.chat_id);
        return [{ text: `${isSel ? '✓ ' : ''}${(p.company_name || p.name || p.chat_id).slice(0, 28)}`, callback_data: `amb_partner_${p.chat_id}` }];
      });
      keyboard.push([{ text: '✅ Готово', callback_data: 'amb_confirm' }]);
      await editMessageText(
        env.TOKEN_CLIENT, chatId, callbackQuery.message.message_id,
        `Выбрано: ${sel.length} / ${maxPartners}\n\nНажмите «Готово», когда закончите.`,
        { reply_markup: { inline_keyboard: keyboard } }
      );
      return { success: true };
    }

    if (data === 'ambassador_earnings') {
      const amb = await getAmbassador(env, chatId);
      if (!amb) return { success: false };
      const earnings = await getAmbassadorEarnings(env, chatId);
      const lines = (earnings || []).slice(0, 10).map(e =>
        `${new Date(e.created_at).toLocaleDateString('ru-RU')} — +${(e.ambassador_amount || 0).toFixed(0)} ₽`
      );
      await editMessageText(
        env.TOKEN_CLIENT, chatId, callbackQuery.message.message_id,
        `📊 История начислений:\n\n${lines.length ? lines.join('\n') : 'Пока нет начислений'}`,
        { parseMode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '◀️ Назад', callback_data: 'ambassador_cabinet' }]] } }
      );
      return { success: true };
    }

    if (data === 'ambassador_add_partner') {
      const amb = await getAmbassador(env, chatId);
      if (!amb) return { success: false };
      const existing = await getAmbassadorPartners(env, chatId);
      const count = existing?.length || 0;
      if (count >= amb.max_partners) {
        await editMessageText(
          env.TOKEN_CLIENT, chatId, callbackQuery.message.message_id,
          `Достигнут лимит: ${amb.max_partners} партнёров.`
        );
        return { success: true };
      }
      await editMessageText(
        env.TOKEN_CLIENT, chatId, callbackQuery.message.message_id,
        '➕ Добавление партнёра — в разработке. Обратитесь в поддержку.'
      );
      return { success: true };
    }

    if (data === 'ambassador_payout') {
      const pendingBalance = await getAmbassadorBalance(env, chatId);
      if (pendingBalance < 500) {
        await editMessageText(
          env.TOKEN_CLIENT, chatId, callbackQuery.message.message_id,
          `💳 Минимальная сумма выплаты — 500 ₽.\nВаш баланс к выплате: <b>${Math.floor(pendingBalance)} ₽</b>`,
          { parseMode: 'HTML' }
        );
        return { success: true };
      }
      await setBotState(env, chatId, 'ambassador_payout_amount', { balance: pendingBalance });
      await editMessageText(
        env.TOKEN_CLIENT, chatId, callbackQuery.message.message_id,
        `💳 Введите сумму для вывода (от 500 до ${Math.floor(pendingBalance)} ₽):`
      );
      return { success: true };
    }

    if (data === 'payout_method_card' || data === 'payout_method_sbp' || data === 'payout_method_crypto') {
      const stateRow = await getBotState(env, chatId);
      if (!stateRow || stateRow.state !== 'ambassador_payout_method') {
        return { success: false };
      }
      const methodMap = { payout_method_card: 'card', payout_method_sbp: 'sbp', payout_method_crypto: 'crypto' };
      const labelMap = { payout_method_card: 'Номер карты (16 цифр)', payout_method_sbp: 'Номер телефона для СБП', payout_method_crypto: 'Адрес крипто-кошелька' };
      const method = methodMap[data];
      await setBotState(env, chatId, 'ambassador_payout_details', { ...stateRow.data, method });
      await editMessageText(
        env.TOKEN_CLIENT, chatId, callbackQuery.message.message_id,
        `📝 Введите реквизиты:\n${labelMap[data]}`
      );
      return { success: true };
    }

    return { success: false };
  } catch (e) {
    logError('handleAmbassador', e, { chatId, data });
    throw e;
  }
}

async function showAmbassadorCabinet(env, chatId, amb, messageId) {
  const partners = await getAmbassadorPartners(env, chatId);
  const count = partners?.length || 0;
  const botUsername = (env.CLIENT_BOT_USERNAME || 'mindbeatybot').replace('@', '');
  const link = `https://t.me/${botUsername}?start=${amb.ambassador_code || ''}`;
  const keyboard = [
    [{ text: '📊 История начислений', callback_data: 'ambassador_earnings' }, { text: '💳 Запросить выплату', callback_data: 'ambassador_payout' }],
    [{ text: '➕ Добавить партнёра', callback_data: 'ambassador_add_partner' }],
  ];
  await editMessageText(
    env.TOKEN_CLIENT, chatId, messageId,
    `🌟 <b>Кабинет амбассадора</b>\n\n` +
    `Тир: ${amb.tier_at_signup || '—'}\n` +
    `Партнёры: ${count} / ${amb.max_partners || 3}\n` +
    `Баланс к выплате: ${(amb.balance_pending || 0).toFixed(0)} ₽\n` +
    `Всего заработано: ${(amb.total_earnings || 0).toFixed(0)} ₽\n\n` +
    `🔗 Ссылка:\n<code>${link}</code>`,
    { parseMode: 'HTML', reply_markup: { inline_keyboard: keyboard } }
  );
  return { success: true };
}

/**
 * Handle feedback callbacks: menu + actions
 */
export async function handleFeedback(env, update) {
  const callbackQuery = update.callback_query;
  const chatId = String(callbackQuery.message.chat.id);
  const data = callbackQuery.data;
  try {
    await answerCallbackQuery(env.TOKEN_CLIENT, callbackQuery.id);
    const user = await getUserByChatId(env, chatId);
    if (!user) return { success: false };

    if (data === 'feedback_menu') {
      const keyboard = [
        [{ text: '👍 Всё супер!', callback_data: 'feedback_great' }, { text: '❓ Есть вопрос', callback_data: 'feedback_question' }],
        [{ text: '📅 Хочу записаться', callback_data: 'feedback_book' }],
        [{ text: '◀️ Назад', callback_data: 'balance' }],
      ];
      await sendTelegramMessageWithKeyboard(env.TOKEN_CLIENT, chatId, '💬 Что хотите передать партнёру?', keyboard);
      return { success: true };
    }

    const partnerChatId = await getClientLastPartner(env, chatId);
    if (!partnerChatId) {
      await sendTelegramMessage(env.TOKEN_CLIENT, chatId, '❌ Не найден партнёр. Сначала совершите покупку.');
      return { success: false };
    }

    // Check partner allows messages
    const partner = await getPartnerByChatId(env, partnerChatId);
    if (partner && partner.allow_client_messages === false) {
      await sendTelegramMessage(env.TOKEN_CLIENT, chatId, '🔕 Партнёр временно отключил приём сообщений.');
      return { success: false };
    }

    // Rate limit: max 3 messages per hour
    const msgCount = await countClientMessagesLastHour(env, chatId, partnerChatId);
    if (msgCount >= 3) {
      await sendTelegramMessage(env.TOKEN_CLIENT, chatId, '⏳ Вы уже отправили 3 сообщения за последний час. Попробуйте позже.');
      return { success: false };
    }

    const texts = { feedback_great: '👍 Всё супер!', feedback_question: '❓ Есть вопрос', feedback_book: '📅 Хочу записаться' };
    const messageText = texts[data];
    if (!messageText) return { success: false };

    await saveClientMessage(env, { clientChatId: chatId, partnerChatId, messageText });

    const clientName = user.name || `ID ${chatId}`;
    await sendTelegramMessageWithKeyboard(
      env.TOKEN_PARTNER, partnerChatId,
      `💬 <b>Сообщение от клиента</b>\n\nКлиент: <b>${clientName}</b>\nСообщение: <b>${messageText}</b>`,
      [[{ text: '💬 Ответить клиенту', callback_data: `reply_to_client_${chatId}` }]]
    ).catch(() => {});

    await sendTelegramMessage(env.TOKEN_CLIENT, chatId, '✅ Ваше сообщение отправлено партнёру!');
    return { success: true };
  } catch (error) {
    logError('handleFeedback', error, { chatId, data });
    throw error;
  }
}

/**
 * Normalize update: use message or edited_message as message
 */
function getMessage(update) {
  return update.message || update.edited_message;
}

/**
 * Route update to appropriate handler
 */
export async function routeUpdate(env, update) {
  // Handle callback queries
  if (update.callback_query) {
    const callbackData = update.callback_query.data;
    if (callbackData?.startsWith('nps_rate_')) {
      return await handleNpsRating(env, update);
    }
    if (callbackData === 'balance') {
      return await handleBalance(env, update);
    }
    if (callbackData === 'history') {
      const chatId = String(update.callback_query.message.chat.id);
      await answerCallbackQuery(env.TOKEN_CLIENT, update.callback_query.id);
      return await handleHistory(env, chatId);
    }
    if (callbackData?.startsWith('feedback_')) {
      return await handleFeedback(env, update);
    }
    if (callbackData === 'become_ambassador' || callbackData === 'ambassador_cabinet' ||
        callbackData === 'amb_confirm' || callbackData?.startsWith('amb_partner_') ||
        callbackData === 'ambassador_earnings' || callbackData === 'ambassador_add_partner' ||
        callbackData === 'ambassador_payout' ||
        callbackData === 'payout_method_card' || callbackData === 'payout_method_sbp' ||
        callbackData === 'payout_method_crypto') {
      return await handleAmbassador(env, update);
    }
    return { success: true, handled: false };
  }

  // Handle messages (including edited_message for /start)
  const message = getMessage(update);
  if (message) {
    const text = message.text || '';
    if (text.startsWith('/start')) {
      return await handleStart(env, { ...update, message });
    }
    if (text.startsWith('/history')) {
      const chatId = String(message.chat.id);
      return await handleHistory(env, chatId);
    }
    if (text.startsWith('/ambassador')) {
      const chatId = String(message.chat.id);
      return await handleAmbassadorCommand(env, chatId);
    }
    if (text) {
      const chatId = String(message.chat.id);
      const handled = await handleNpsReview(env, chatId, text);
      if (handled) return { success: true };
      return await handleTextMessage(env, { ...update, message });
    }
    return { success: true, handled: false };
  }

  return { success: true, handled: false };
}
