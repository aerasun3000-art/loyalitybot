/**
 * Partner bot handlers for Cloudflare Workers
 * Handles all partner bot commands and callbacks
 */

import { 
  getPartnerByChatId,
  getUserByChatId,
  supabaseRequest,
  getBotState,
  setBotState,
  clearBotState,
  updateBotStateData,
  getPartnerClientChatIdsForBroadcast,
  getPartnerClientChatIdsByTransactions,
  getPartnerClientChatIdsCombined,
  canPartnerRunBroadcast,
  createBroadcastCampaign,
  updateBroadcastCampaignFinished,
  addService,
  getServicesByPartner,
  getServiceById,
  updateService,
  deleteService,
  getPromotionsByPartner,
  getPromotionById,
  addPromotion,
  updatePromotion,
  deletePromotion,
  togglePromotionStatus,
  findClientByIdOrPhone,
  executeTransaction,
  getPendingTransactions,
  getPartnerStats,
  getPartnerRevenueShare,
  getRevenueShareHistory,
  getPartnerNetwork,
  getPartnerB2BDeals,
  getPendingB2BDealsForPartner,
  createPartnerDeal,
  updatePartnerDealStatus,
  getDealById,
  getDealBySourceAndTarget,
  getPartnerConversations,
  getClientDetailsForPartner,
  getConversation,
  saveMessage,
  markMessageAsRead,
  getExchangeRate,
  convertToUSD,
  updatePartnerAmbassadorCommission,
} from './supabase.js';
import {
  sendTelegramMessage,
  sendTelegramMessageWithKeyboard,
  sendTelegramMessageWithReplyKeyboard,
  answerCallbackQuery,
  editMessageText,
} from './telegram.js';
import {
  getChatIdFromUpdate,
  getUserIdFromUpdate,
  getTextFromUpdate,
  logError,
} from './common.js';

const CATEGORY_MAPPING = {
  'manicure': 'nail_care',
  'hairstyle': 'hair_salon',
  'massage': 'massage_therapy',
  'cosmetologist': 'facial_aesthetics',
  'eyebrows': 'brow_design',
  'eyelashes': 'lash_services',
  'laser': 'hair_removal',
  'makeup': 'makeup_pmu',
  'skincare': 'facial_aesthetics',
  'nutrition': 'nutrition_coaching',
  'psychology': 'mindfulness_coaching',
  'delivery': 'food_delivery',
  'spa': 'body_wellness',
};

function mapOldCategoryToNew(oldCode) {
  return CATEGORY_MAPPING[oldCode] || oldCode;
}

/** B2B deal presets: { cashback%, commission% } — кэшбэк везде 5% для упрощения выплат */
const B2B_PRESETS = {
  standard: { cashback: 5, commission: 8, label: 'Стандарт' },
  partner_plus: { cashback: 5, commission: 12, label: 'Партнёр+' },
  premium: { cashback: 5, commission: 15, label: 'Премиум' },
};

/**
 * Check if partner exists and get status
 */
export async function checkPartnerStatus(env, chatId) {
  try {
    const partner = await getPartnerByChatId(env, chatId);
    if (!partner) {
      return { exists: false, status: null };
    }
    // Status is now set by getPartnerByChatId based on which table it came from
    const status = partner.status || 'Pending';
    return { 
      exists: true, 
      status: status,
      partner: partner 
    };
  } catch (error) {
    logError('checkPartnerStatus', error, { chatId });
    return { exists: false, status: null, error };
  }
}

/**
 * Handle /start command for partner bot
 */
export async function handleStart(env, update) {
  const message = update.message;
  const chatId = String(message.chat.id);
  const text = message.text || '';
  const payload = text.replace('/start', '').replace('/partner_start', '').trim();
  
  try {
    // Check for special payload
    if (payload === 'partner_applied') {
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        '⏳ Ваша заявка принята и ожидает одобрения.'
      );
      return { success: true, handled: true };
    }

    // B2B invite link: b2b_<source_chat_id>_<preset>
    if (payload.startsWith('b2b_')) {
      const result = await handleB2BInviteLink(env, chatId, payload);
      if (result) return result;
    }
    
    // Check partner status
    const partnerStatus = await checkPartnerStatus(env, chatId);
    
    if (!partnerStatus.exists) {
      // Not a partner - show registration button
      const keyboard = [[{ text: '🚀 Зарегистрироваться' }]];
      await sendTelegramMessageWithReplyKeyboard(
        env.TOKEN_PARTNER,
        chatId,
        'Добро пожаловать в LoyalityBot!\n\n' +
        'Вы еще не зарегистрированы как партнер.\n' +
        'Нажмите кнопку ниже, чтобы начать.',
        keyboard,
        { resize_keyboard: true, one_time_keyboard: true }
      );
      return { success: true, handled: true, action: 'registration_offered' };
    }
    
    const status = partnerStatus.status;
    
    if (status === 'Approved') {
      // Show main menu
      await showPartnerMainMenu(env, chatId);
      return { success: true, handled: true, action: 'main_menu' };
    } else if (status === 'Pending') {
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        '⏳ Ваша заявка находится на рассмотрении.'
      );
      return { success: true, handled: true, action: 'pending' };
    } else if (status === 'Rejected') {
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        '❌ Ваша заявка была отклонена. Свяжитесь с администратором.'
      );
      return { success: true, handled: true, action: 'rejected' };
    }
    
    return { success: true, handled: true };
  } catch (error) {
    logError('handleStart (partner)', error, { chatId, payload });
    throw error;
  }
}

/**
 * Show partner main menu
 */
export async function showPartnerMainMenu(env, chatId) {
  try {
    // Get partner config to determine category
    const partner = await getPartnerByChatId(env, chatId);
    const isInfluencer = partner?.category_group === 'influencer';
    
    // Build keyboard based on category
    const keyboard = [];
    
    if (isInfluencer) {
      // Influencer menu
      keyboard.push(
        [{ text: '📊 Аналитика' }, { text: '💎 Revenue Share' }],
        [{ text: '👥  Работа с базой' }, { text: '⚙️ Ещё' }]
      );
    } else {
      // Standard partner menu
      keyboard.push(
        [{ text: '💰 Операции' }, { text: '📝 Контент' }],
        [{ text: '📊 Аналитика' }, { text: '💎 Revenue Share' }],
        [{ text: '👥  Работа с базой' }, { text: '⚙️ Ещё' }]
      );
    }
    
    await sendTelegramMessageWithReplyKeyboard(
      env.TOKEN_PARTNER,
      chatId,
      '🤝 **Добро пожаловать в рабочее меню партнера!**',
      keyboard,
      { parseMode: 'HTML', resize_keyboard: true }
    );
    
    return { success: true };
  } catch (error) {
    logError('showPartnerMainMenu', error, { chatId });
    throw error;
  }
}

/**
 * Handle main menu button clicks
 */
export async function handleMenuButton(env, update) {
  const message = update.message;
  const chatId = String(message.chat.id);
  const text = message.text;
  
  try {
    // Check partner status
    const partnerStatus = await checkPartnerStatus(env, chatId);
    if (!partnerStatus.exists || partnerStatus.status !== 'Approved') {
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        '❌ У вас нет прав для выполнения этой операции.'
      );
      return { success: false };
    }
    
    if (text === '💰 Операции') {
      return await handleOperationsMenu(env, chatId);
    } else if (text === '📝 Контент') {
      return await handleContentMenu(env, chatId);
    } else if (text === '📊 Аналитика') {
      return await handleAnalyticsMenu(env, chatId);
    } else if (text === '💎 Revenue Share') {
      return await handleRevenueShareMenu(env, chatId);
    } else if (text === '⚙️ Ещё') {
      return await handleMoreMenu(env, chatId);
    } else if (text === '👥  Работа с базой') {
      return await handleInviteClient(env, chatId);
    }
    
    return { success: true, handled: false };
  } catch (error) {
    logError('handleMenuButton', error, { chatId, text });
    throw error;
  }
}

/**
 * Handle Operations menu
 */
export async function handleOperationsMenu(env, chatId) {
  const keyboard = [[
    { text: '➕ Начислить баллы', callback_data: 'menu_add_points' },
    { text: '➖ Списать баллы', callback_data: 'menu_subtract_points' }
  ], [
    { text: '📦 Очередь операций', callback_data: 'menu_queue' },
    { text: '👤 Найти клиента', callback_data: 'menu_find_client' }
  ], [
    { text: '⬅️ Назад', callback_data: 'partner_main_menu' }
  ]];
  
  await sendTelegramMessageWithKeyboard(
    env.TOKEN_PARTNER,
    chatId,
    '*💰 Операции:*\nВыберите действие:',
    keyboard,
    { parseMode: 'HTML' }
  );
  
  return { success: true };
}

/**
 * Handle Content menu
 */
export async function handleContentMenu(env, chatId) {
  const keyboard = [[
    { text: '🌟 Акции', callback_data: 'menu_promotions' },
    { text: '🛠️ Услуги', callback_data: 'menu_services' }
  ], [
    { text: '⬅️ Назад', callback_data: 'partner_main_menu' }
  ]];
  
  await sendTelegramMessageWithKeyboard(
    env.TOKEN_PARTNER,
    chatId,
    '*📝 Контент:*\nВыберите действие:',
    keyboard,
    { parseMode: 'HTML' }
  );
  
  return { success: true };
}

/**
 * Handle Analytics menu
 */
export async function handleAnalyticsMenu(env, chatId) {
  const keyboard = [[
    { text: '📊 Моя статистика', callback_data: 'menu_stats' },
    { text: '📈 Дашборд', callback_data: 'menu_dashboard' }
  ], [
    { text: '⬅️ Назад', callback_data: 'partner_main_menu' }
  ]];
  
  await sendTelegramMessageWithKeyboard(
    env.TOKEN_PARTNER,
    chatId,
    '*📊 Аналитика:*\nВыберите действие:',
    keyboard,
    { parseMode: 'HTML' }
  );
  
  return { success: true };
}

/**
 * Handle Revenue Share menu
 */
export async function handleRevenueShareMenu(env, chatId) {
  try {
    // Get partner's revenue share data
    const revenueData = await getPartnerRevenueShare(env, chatId);
    
    // ВРЕМЕННО: Revenue Share доступен всем без условий
    const isActiveTemporary = true;
    
    let message = 
      `💎 <b>Revenue Share</b>\n\n` +
      `📊 <b>Статус:</b> ✅ Активен\n` +
      `🎁 <i>Временно доступно всем партнёрам без ограничений!</i>\n\n`;
    
    message +=
      `💰 <b>За текущий месяц:</b> $${revenueData.monthlyEarned.toFixed(2)}\n` +
      `💵 <b>Всего заработано:</b> $${revenueData.totalEarned.toFixed(2)}\n` +
      `📈 <b>Выплат получено:</b> ${revenueData.payoutsCount}\n\n`;
    
    if (revenueData.pendingAmount > 0) {
      message += `⏳ <b>Ожидает выплаты:</b> $${revenueData.pendingAmount.toFixed(2)}\n\n`;
    }
    
    message +=
      `<b>Как это работает:</b>\n` +
      `• Приглашайте партнёров в сеть\n` +
      `• Получайте 5% от дохода системы с их клиентов\n` +
      `• До 3 уровней глубины (5% на каждом уровне)`;
    
    const keyboard = [];
    
    if (revenueData.totalEarned > 0) {
      keyboard.push([{ text: '📜 История выплат', callback_data: 'rs_history' }]);
    }
    
    keyboard.push([{ text: '👥 Моя сеть партнёров', callback_data: 'rs_network' }]);
    keyboard.push([{ text: '🔗 Пригласить партнёра', callback_data: 'rs_invite' }]);
    
    await sendTelegramMessageWithKeyboard(
      env.TOKEN_PARTNER,
      chatId,
      message,
      keyboard,
      { parseMode: 'HTML' }
    );
    
    return { success: true };
  } catch (error) {
    console.error('[handleRevenueShareMenu] Error:', error);
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      '❌ Ошибка при загрузке Revenue Share. Попробуйте позже.'
    );
    return { success: false };
  }
}

/**
 * Handle Revenue Share History
 */
export async function handleRevenueShareHistory(env, chatId) {
  try {
    const history = await getRevenueShareHistory(env, chatId);
    
    if (!history || history.length === 0) {
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        '📜 <b>История выплат</b>\n\nУ вас пока нет выплат Revenue Share.',
        { parseMode: 'HTML' }
      );
      return { success: true };
    }
    
    let message = '📜 <b>История выплат Revenue Share</b>\n\n';
    
    for (const payout of history) {
      const date = new Date(payout.created_at).toLocaleDateString('ru-RU');
      const statusEmoji = payout.status === 'paid' ? '✅' : (payout.status === 'pending' ? '⏳' : '❌');
      const amount = parseFloat(payout.final_amount || payout.amount_usd) || 0;
      
      message += `${statusEmoji} ${date} — <b>$${amount.toFixed(2)}</b> (уровень ${payout.level || 1})\n`;
    }
    
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      message,
      { parseMode: 'HTML' }
    );
    
    return { success: true };
  } catch (error) {
    console.error('[handleRevenueShareHistory] Error:', error);
    await sendTelegramMessage(env.TOKEN_PARTNER, chatId, '❌ Ошибка при загрузке истории.');
    return { success: false };
  }
}

/**
 * Handle Revenue Share Network
 */
export async function handleRevenueShareNetwork(env, chatId) {
  try {
    const network = await getPartnerNetwork(env, chatId);
    
    let message = '👥 <b>Ваша сеть партнёров</b>\n\n';
    
    if (network.totalCount === 0) {
      message += 'У вас пока нет приглашённых партнёров.\n\n';
      message += '💡 Приглашайте партнёров и получайте 5% от дохода системы с их клиентов!';
    } else {
      message += `📊 Всего партнёров: <b>${network.totalCount}</b>\n\n`;
      
      if (network.level1.length > 0) {
        message += `<b>1-й уровень (5%):</b> ${network.level1.length} партнёр(ов)\n`;
        for (const p of network.level1) {
          const name = p.company_name || p.name || 'Партнёр';
          const activeIcon = p.is_revenue_share_active ? '🟢' : '⚪';
          message += `  ${activeIcon} ${name}\n`;
        }
        message += '\n';
      }
      
      if (network.level2.length > 0) {
        message += `<b>2-й уровень (5%):</b> ${network.level2.length} партнёр(ов)\n`;
        for (const p of network.level2) {
          const name = p.company_name || p.name || 'Партнёр';
          const referrerName = p.referrer_name || 'партнёр';
          const activeIcon = p.is_revenue_share_active ? '🟢' : '⚪';
          message += `  ${activeIcon} ${name} <i>(через ${referrerName})</i>\n`;
        }
        message += '\n';
      }
      
      if (network.level3.length > 0) {
        message += `<b>3-й уровень (5%):</b> ${network.level3.length} партнёр(ов)\n`;
        for (const p of network.level3) {
          const name = p.company_name || p.name || 'Партнёр';
          const referrerName = p.referrer_name || 'партнёр';
          const activeIcon = p.is_revenue_share_active ? '🟢' : '⚪';
          message += `  ${activeIcon} ${name} <i>(через ${referrerName})</i>\n`;
        }
      }
    }
    
    const keyboard = [[
      { text: '🔗 Пригласить партнёра', callback_data: 'rs_invite' }
    ]];
    
    await sendTelegramMessageWithKeyboard(
      env.TOKEN_PARTNER,
      chatId,
      message,
      keyboard,
      { parseMode: 'HTML' }
    );
    
    return { success: true };
  } catch (error) {
    console.error('[handleRevenueShareNetwork] Error:', error);
    await sendTelegramMessage(env.TOKEN_PARTNER, chatId, '❌ Ошибка при загрузке сети партнёров.');
    return { success: false };
  }
}

/**
 * Handle Revenue Share Invite
 * По старинке: ссылка на клиентского бота → приложение → анкета (форма только из Telegram).
 */
export async function handleRevenueShareInvite(env, chatId) {
  try {
    const botUsername = env.BOT_USERNAME || 'mindbeatybot';
    const inviteLink = `https://t.me/${botUsername}?start=partner_${chatId}`;

    const message =
      `🔗 <b>Пригласить партнёра</b>\n\n` +
      `Ваша реферальная ссылка:\n` +
      `<code>${inviteLink}</code>\n\n` +
      `📋 Нажмите на ссылку, чтобы скопировать. Отправьте её кандидату.\n\n` +
      `📌 <b>Алгоритм приглашения:</b>\n` +
      `1️⃣ Кандидат переходит по вашей ссылке → открывается <b>клиентский бот</b> в Telegram.\n` +
      `2️⃣ В боте нажимает <b>«🚀 Открыть приложение»</b>.\n` +
      `3️⃣ В приложении заходит в раздел <b>«Стать партнёром»</b> и заполняет анкету.\n` +
      `4️⃣ Отправляет заявку. Вы будете указаны как пригласивший.\n\n` +
      `⚠️ Анкету нужно открывать <b>только через приложение в Telegram</b> (из клиентского бота). Иначе форма не сработает.\n\n` +
      `<b>Что получаете вы:</b>\n` +
      `• 5% от дохода системы с клиентов партнёра (1-й уровень)\n` +
      `• 5% от партнёров 2-го уровня\n` +
      `• 5% от партнёров 3-го уровня\n\n` +
      `<b>Что получает партнёр:</b>\n` +
      `• Быстрый онбординг в системе\n` +
      `• Поддержку и обучение\n` +
      `• Собственную программу лояльности`;

    const keyboard = [[
      { text: '🔗 Открыть бота (проверить ссылку)', url: inviteLink }
    ]];

    await sendTelegramMessageWithKeyboard(
      env.TOKEN_PARTNER,
      chatId,
      message,
      keyboard,
      { parseMode: 'HTML' }
    );

    return { success: true };
  } catch (error) {
    console.error('[handleRevenueShareInvite] Error:', error);
    await sendTelegramMessage(env.TOKEN_PARTNER, chatId, '❌ Ошибка при создании ссылки.');
    return { success: false };
  }
}

/**
 * Handle Partner Stats
 */
export async function handlePartnerStats(env, chatId) {
  try {
    // Get partner statistics from database
    const stats = await getPartnerStats(env, chatId);
    
    const message = 
      `📊 <b>Ваша статистика</b>\n\n` +
      `👥 Клиентов: <b>${stats.totalClients || 0}</b>\n` +
      `💰 Оборот: <b>$${(stats.totalTurnover || 0).toFixed(2)}</b>\n` +
      `📝 Транзакций: <b>${stats.totalTransactions || 0}</b>\n` +
      `💎 Баллов начислено: <b>${stats.totalPointsIssued || 0}</b>\n` +
      `💸 Баллов списано: <b>${stats.totalPointsSpent || 0}</b>\n\n` +
      `📅 За последние 30 дней:\n` +
      `   • Транзакций: ${stats.last30DaysTransactions || 0}\n` +
      `   • Оборот: $${(stats.last30DaysTurnover || 0).toFixed(2)}\n` +
      `   • Новых клиентов: ${stats.last30DaysNewClients || 0}`;
    
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      message,
      { parseMode: 'HTML' }
    );
    
    return { success: true };
  } catch (error) {
    console.error('[handlePartnerStats] Error:', error);
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      '❌ Ошибка при загрузке статистики. Попробуйте позже.'
    );
    return { success: false };
  }
}

/**
 * Handle Partner Dashboard
 */
export async function handlePartnerDashboard(env, chatId) {
  try {
    const frontendUrl = env.FRONTEND_URL || 'https://loyalitybot-frontend.pages.dev';
    const dashboardUrl = `${frontendUrl}/partner/analytics?partner_id=${chatId}`;
    
    const keyboard = [[
      { text: '📊 Открыть дашборд', url: dashboardUrl }
    ]];
    
    await sendTelegramMessageWithKeyboard(
      env.TOKEN_PARTNER,
      chatId,
      `📈 <b>Дашборд партнёра</b>\n\n` +
      `Ваш персональный дашборд с визуализацией всех метрик:\n\n` +
      `• 📊 График оборота и транзакций\n` +
      `• 👥 Динамика клиентской базы\n` +
      `• ⭐ NPS метрики и отзывы\n` +
      `• 💰 Финансовые показатели\n` +
      `• 📈 Тренды и аналитика\n\n` +
      `Нажмите кнопку ниже, чтобы открыть дашборд:`,
      keyboard,
      { parseMode: 'HTML' }
    );
    
    return { success: true };
  } catch (error) {
    console.error('[handlePartnerDashboard] Error:', error);
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      '❌ Ошибка при загрузке дашборда. Попробуйте позже.'
    );
    return { success: false };
  }
}

/**
 * Handle Operations Queue
 */
export async function handleOperationsQueue(env, chatId) {
  try {
    const pendingTxns = await getPendingTransactions(env, chatId);
    
    if (!pendingTxns || pendingTxns.length === 0) {
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        '📦 <b>Очередь операций</b>\n\n' +
        '✅ Очередь пуста. Все операции выполнены.',
        { parseMode: 'HTML' }
      );
      return { success: true };
    }
    
    let message = '📦 <b>Очередь операций:</b>\n\n';
    
    for (const txn of pendingTxns) {
      const typeEmoji = txn.type === 'accrual' ? '➕' : '➖';
      const date = new Date(txn.created_at).toLocaleString('ru-RU');
      message += `${typeEmoji} ${txn.amount} | Клиент: ${txn.user_chat_id} | ${date}\n`;
    }
    
    message += '\n⏳ Эти операции будут выполнены автоматически.';
    
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      message,
      { parseMode: 'HTML' }
    );
    
    return { success: true };
  } catch (error) {
    console.error('[handleOperationsQueue] Error:', error);
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      '❌ Ошибка при загрузке очереди операций.'
    );
    return { success: false };
  }
}

/**
 * Handle B2B Partnership menu (submenu)
 */
export async function handlePartnershipMenu(env, chatId) {
  try {
    const [deals, pendingCount] = await Promise.all([
      getPartnerB2BDeals(env, chatId),
      getPendingB2BDealsForPartner(env, chatId).then((p) => p.length),
    ]);

    let message = '🤝 <b>B2B Партнёрство</b>\n\n';
    message += '<b>Что такое B2B сделка?</b>\n';
    message += '• Вы приводите клиентов к другому партнёру\n';
    message += '• Ваши клиенты получают повышенный кэшбэк\n';
    message += '• Вы получаете комиссию с их покупок\n\n';
    if (deals.totalCount > 0) {
      message += `📊 Активных сделок: <b>${deals.totalCount}</b>\n`;
    }
    if (pendingCount > 0) {
      message += `📩 Входящих предложений: <b>${pendingCount}</b>\n`;
    }

    const keyboard = [
      [{ text: '📋 Мои сделки', callback_data: 'b2b_my_deals' }],
      [{ text: '📩 Входящие предложения', callback_data: 'b2b_incoming' }],
      [{ text: '➕ Предложить сделку', callback_data: 'b2b_propose' }],
      [{ text: '⬅️ Назад', callback_data: 'more_menu' }],
    ];

    await sendTelegramMessageWithKeyboard(
      env.TOKEN_PARTNER,
      chatId,
      message,
      keyboard,
      { parseMode: 'HTML' }
    );

    return { success: true };
  } catch (error) {
    console.error('[handlePartnershipMenu] Error:', error);
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      '❌ Ошибка при загрузке. Попробуйте позже.'
    );
    return { success: false };
  }
}

/**
 * Handle "My deals" - list active B2B deals
 */
export async function handleB2BMyDeals(env, chatId) {
  try {
    const deals = await getPartnerB2BDeals(env, chatId);

    let message = '📋 <b>Мои B2B сделки</b>\n\n';

    if (deals.totalCount === 0) {
      message += 'У вас пока нет активных сделок.\n';
      message += 'Нажмите «Предложить сделку», чтобы создать первую.';
    } else {
      if (deals.asSource.length > 0) {
        message += '<b>🔹 Вы приводите клиентов к:</b>\n';
        for (const deal of deals.asSource) {
          const comm = deal.referral_commission_percent ?? deal.seller_pays_percent ?? 0;
          const cash = deal.client_cashback_percent ?? deal.buyer_gets_percent ?? 0;
          message += `  • ${deal.partner_name}\n`;
          message += `    └ Комиссия: ${comm}%, Кэшбэк клиентам: ${cash}%\n`;
        }
        message += '\n';
      }
      if (deals.asTarget.length > 0) {
        message += '<b>🔸 К вам приводят клиентов:</b>\n';
        for (const deal of deals.asTarget) {
          const comm = deal.referral_commission_percent ?? deal.seller_pays_percent ?? 0;
          const cash = deal.client_cashback_percent ?? deal.buyer_gets_percent ?? 0;
          message += `  • ${deal.partner_name}\n`;
          message += `    └ Вы платите: ${comm}%, Кэшбэк их клиентам: ${cash}%\n`;
        }
      }
    }

    const keyboard = [[{ text: '⬅️ Назад', callback_data: 'menu_partnership' }]];
    await sendTelegramMessageWithKeyboard(
      env.TOKEN_PARTNER,
      chatId,
      message,
      keyboard,
      { parseMode: 'HTML' }
    );
    return { success: true };
  } catch (error) {
    console.error('[handleB2BMyDeals] Error:', error);
    await sendTelegramMessage(env.TOKEN_PARTNER, chatId, '❌ Ошибка при загрузке.');
    return { success: false };
  }
}

/**
 * Handle "Incoming" - pending deals where partner is target
 */
export async function handleB2BIncoming(env, chatId) {
  try {
    const pending = await getPendingB2BDealsForPartner(env, chatId);

    let message = '📩 <b>Входящие предложения</b>\n\n';

    if (pending.length === 0) {
      message += 'Нет новых предложений.';
    } else {
      for (const deal of pending) {
        const comm = deal.referral_commission_percent ?? 0;
        const cash = deal.client_cashback_percent ?? 0;
        message += `• <b>${deal.partner_name}</b>\n`;
        message += `  Кэшбэк клиентам: ${cash}%, Ваша комиссия партнёру: ${comm}%\n\n`;
      }
    }

    const keyboard = [];
    for (const deal of pending) {
      keyboard.push([
        { text: `✅ Принять ${deal.partner_name}`, callback_data: `b2b_accept_${deal.id}` },
        { text: `❌ Отклонить`, callback_data: `b2b_reject_${deal.id}` },
      ]);
    }
    keyboard.push([{ text: '⬅️ Назад', callback_data: 'menu_partnership' }]);

    await sendTelegramMessageWithKeyboard(
      env.TOKEN_PARTNER,
      chatId,
      message,
      keyboard,
      { parseMode: 'HTML' }
    );
    return { success: true };
  } catch (error) {
    console.error('[handleB2BIncoming] Error:', error);
    await sendTelegramMessage(env.TOKEN_PARTNER, chatId, '❌ Ошибка при загрузке.');
    return { success: false };
  }
}

/**
 * Handle "Propose deal" - select preset
 */
export async function handleB2BPropose(env, chatId) {
  const keyboard = [
    [
      { text: '🟢 Стандарт (5%/8%)', callback_data: 'b2b_preset_standard' },
    ],
    [
      { text: '🔵 Партнёр+ (5%/12%)', callback_data: 'b2b_preset_partner_plus' },
    ],
    [
      { text: '🟡 Премиум (5%/15%)', callback_data: 'b2b_preset_premium' },
    ],
    [{ text: '⬅️ Назад', callback_data: 'menu_partnership' }],
  ];

  await sendTelegramMessageWithKeyboard(
    env.TOKEN_PARTNER,
    chatId,
    '➕ <b>Предложить сделку</b>\n\nВыберите условия (кэшбэк клиентам везде 5%):\n' +
      '🟢 Стандарт — комиссия 8%\n' +
      '🔵 Партнёр+ — комиссия 12%\n' +
      '🟡 Премиум — комиссия 15%',
    keyboard,
    { parseMode: 'HTML' }
  );
  return { success: true };
}

/**
 * Handle preset selection - show link + option to enter chat_id
 */
export async function handleB2BPresetSelected(env, chatId, presetKey, callbackQuery) {
  const preset = B2B_PRESETS[presetKey];
  if (!preset) return { success: false };

  const botUsername = env.PARTNER_BOT_USERNAME || env.BOT_USERNAME || 'mindbeatybot';
  const inviteLink = `https://t.me/${botUsername}?start=b2b_${chatId}_${presetKey}`;

  const message =
    `✅ <b>Условия: ${preset.label}</b> — кэшбэк ${preset.cashback}%, комиссия ${preset.commission}%\n\n` +
    `📤 Отправьте эту ссылку партнёру:\n\n` +
    `<code>${inviteLink}</code>\n\n` +
    `Партнёр откроет ссылку и сможет принять или отклонить предложение.\n\n` +
    `Или введите chat_id партнёра, если знаете:`;

  await setBotState(env, chatId, 'b2b_awaiting_target', {
    preset: presetKey,
    cashback: preset.cashback,
    commission: preset.commission,
  });

  const keyboard = [[{ text: '❌ Отмена', callback_data: 'menu_partnership' }]];

  await editMessageText(
    env.TOKEN_PARTNER,
    chatId,
    callbackQuery.message.message_id,
    message,
    keyboard,
    { parseMode: 'HTML' }
  );
  return { success: true };
}

/**
 * Handle deal accept
 */
export async function handleB2BAccept(env, chatId, dealId, callbackQuery) {
  try {
    const deal = await getDealById(env, dealId);
    if (!deal || deal.target_partner_chat_id !== chatId) {
      await answerCallbackQuery(env.TOKEN_PARTNER, callbackQuery.id, {
        text: 'Сделка не найдена',
        show_alert: true,
      });
      return { success: false };
    }
    if (deal.status !== 'pending') {
      await answerCallbackQuery(env.TOKEN_PARTNER, callbackQuery.id, {
        text: 'Сделка уже обработана',
        show_alert: true,
      });
      return { success: false };
    }

    await updatePartnerDealStatus(env, dealId, 'active');

    const sourcePartner = await getPartnerByChatId(env, deal.source_partner_chat_id);
    const sourceNameDisplay = sourcePartner?.company_name || sourcePartner?.name || 'Партнёр';

    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      deal.source_partner_chat_id,
      `✅ <b>B2B сделка принята!</b>\n\n` +
        `Партнёр принял ваше предложение.\n` +
        `Сделка активна.`,
      { parseMode: 'HTML' }
    );

    await editMessageText(
      env.TOKEN_PARTNER,
      chatId,
      callbackQuery.message.message_id,
      `✅ Сделка с ${sourceNameDisplay} принята и активна.`,
      [[{ text: '⬅️ Назад', callback_data: 'menu_partnership' }]],
      { parseMode: 'HTML' }
    );

    await answerCallbackQuery(env.TOKEN_PARTNER, callbackQuery.id, { text: '✅ Сделка принята' });
    return { success: true };
  } catch (error) {
    console.error('[handleB2BAccept] Error:', error);
    await answerCallbackQuery(env.TOKEN_PARTNER, callbackQuery.id, {
      text: 'Ошибка',
      show_alert: true,
    });
    return { success: false };
  }
}

/**
 * Handle deal reject
 */
export async function handleB2BReject(env, chatId, dealId, callbackQuery) {
  try {
    const deal = await getDealById(env, dealId);
    if (!deal || deal.target_partner_chat_id !== chatId) {
      await answerCallbackQuery(env.TOKEN_PARTNER, callbackQuery.id, {
        text: 'Сделка не найдена',
        show_alert: true,
      });
      return { success: false };
    }
    if (deal.status !== 'pending') {
      await answerCallbackQuery(env.TOKEN_PARTNER, callbackQuery.id, {
        text: 'Сделка уже обработана',
        show_alert: true,
      });
      return { success: false };
    }

    await updatePartnerDealStatus(env, dealId, 'rejected');

    const partner = await getPartnerByChatId(env, deal.source_partner_chat_id);
    const sourceNameDisplay = partner?.company_name || partner?.name || 'Партнёр';

    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      deal.source_partner_chat_id,
      `❌ <b>B2B предложение отклонено</b>\n\n` +
        `Партнёр ${sourceNameDisplay} отклонил ваше предложение.`,
      { parseMode: 'HTML' }
    );

    await editMessageText(
      env.TOKEN_PARTNER,
      chatId,
      callbackQuery.message.message_id,
      `❌ Предложение отклонено.`,
      [[{ text: '⬅️ Назад', callback_data: 'menu_partnership' }]],
      { parseMode: 'HTML' }
    );

    await answerCallbackQuery(env.TOKEN_PARTNER, callbackQuery.id, { text: 'Отклонено' });
    return { success: true };
  } catch (error) {
    console.error('[handleB2BReject] Error:', error);
    await answerCallbackQuery(env.TOKEN_PARTNER, callbackQuery.id, {
      text: 'Ошибка',
      show_alert: true,
    });
    return { success: false };
  }
}

/**
 * Handle B2B invite link: /start b2b_<source_chat_id>_<preset>
 */
export async function handleB2BInviteLink(env, chatId, payload) {
  try {
    const parts = payload.replace('b2b_', '').split('_');
    const sourceChatId = parts[0];
    const presetKey = parts[1] || 'standard';
    const preset = B2B_PRESETS[presetKey] || B2B_PRESETS.standard;

    const partnerStatus = await checkPartnerStatus(env, chatId);
    if (!partnerStatus.exists || partnerStatus.status !== 'Approved') {
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        '❌ Только одобренные партнёры могут заключать B2B сделки.\nЗарегистрируйтесь как партнёр.'
      );
      return { success: true, handled: true };
    }

    if (sourceChatId === chatId) {
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        '❌ Нельзя заключить сделку с самим собой.'
      );
      return { success: true, handled: true };
    }

    const sourcePartner = await getPartnerByChatId(env, sourceChatId);
    if (!sourcePartner || sourcePartner.status !== 'Approved') {
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        '❌ Партнёр, отправивший ссылку, не найден или не одобрен.'
      );
      return { success: true, handled: true };
    }

    const sourceName = sourcePartner.company_name || sourcePartner.name || 'Партнёр';

    const existing = await getDealBySourceAndTarget(env, sourceChatId, chatId);
    if (existing) {
      if (existing.status === 'active') {
        await sendTelegramMessage(
          env.TOKEN_PARTNER,
          chatId,
          `✅ У вас уже есть активная сделка с ${sourceName}.`,
          { parseMode: 'HTML' }
        );
      } else if (existing.status === 'pending') {
        const keyboard = [
          [
            { text: '✅ Принять', callback_data: `b2b_accept_${existing.id}` },
            { text: '❌ Отклонить', callback_data: `b2b_reject_${existing.id}` },
          ],
        ];
        await sendTelegramMessageWithKeyboard(
          env.TOKEN_PARTNER,
          chatId,
          `📩 <b>Предложение от ${sourceName}</b>\n\n` +
            `Кэшбэк клиентам: ${preset.cashback}%\n` +
            `Ваша комиссия партнёру: ${preset.commission}%\n\n` +
            `Принять или отклонить?`,
          keyboard,
          { parseMode: 'HTML' }
        );
      } else {
        await sendTelegramMessage(
          env.TOKEN_PARTNER,
          chatId,
          `Сделка с ${sourceName} уже была обработана ранее.`,
          { parseMode: 'HTML' }
        );
      }
      return { success: true, handled: true };
    }

    const newDeal = await createPartnerDeal(env, {
      source_partner_chat_id: sourceChatId,
      target_partner_chat_id: chatId,
      client_cashback_percent: preset.cashback,
      referral_commission_percent: preset.commission,
    });

    if (!newDeal) {
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        '❌ Не удалось создать сделку. Попробуйте позже.'
      );
      return { success: true, handled: true };
    }

    const keyboard = [
      [
        { text: '✅ Принять', callback_data: `b2b_accept_${newDeal.id}` },
        { text: '❌ Отклонить', callback_data: `b2b_reject_${newDeal.id}` },
      ],
    ];
    await sendTelegramMessageWithKeyboard(
      env.TOKEN_PARTNER,
      chatId,
      `📩 <b>Предложение от ${sourceName}</b>\n\n` +
        `Партнёр предлагает B2B сделку:\n` +
        `• Кэшбэк вашим клиентам: ${preset.cashback}%\n` +
        `• Комиссия партнёру: ${preset.commission}%\n\n` +
        `Принять или отклонить?`,
      keyboard,
      { parseMode: 'HTML' }
    );
    return { success: true, handled: true };
  } catch (error) {
    console.error('[handleB2BInviteLink] Error:', error);
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      '❌ Ошибка при обработке ссылки. Попробуйте позже.'
    );
    return { success: true, handled: true };
  }
}

/**
 * Handle More menu
 */
export async function handleMoreMenu(env, chatId) {
  const keyboard = [[
    { text: '💬 Мои сообщения', callback_data: 'menu_messages' },
    { text: '🤝 Партнерство', callback_data: 'menu_partnership' }
  ], [
    { text: '⚙️ Настройки', callback_data: 'menu_settings' }
  ], [
    { text: '⬅️ Назад', callback_data: 'partner_main_menu' }
  ]];
  
  await sendTelegramMessageWithKeyboard(
    env.TOKEN_PARTNER,
    chatId,
    '*⚙️ Ещё:*\nВыберите действие:',
    keyboard,
    { parseMode: 'HTML' }
  );
  
  return { success: true };
}

/**
 * Handle Settings menu
 */
export async function handleSettingsMenu(env, chatId) {
  const partner = await getPartnerByChatId(env, chatId);
  const messagesEnabled = partner ? partner.allow_client_messages !== false : true;
  const toggleText = messagesEnabled ? '🔕 Отключить сообщения клиентов' : '🔔 Включить сообщения клиентов';

  const keyboard = [[
    { text: 'ℹ️ Моя информация', callback_data: 'settings_info' }
  ], [
    { text: '🎁 Приветственный бонус', callback_data: 'settings_bonus' }
  ], [
    { text: '✏️ Редактировать данные', callback_data: 'settings_edit' }
  ], [
    { text: '💰 Комиссия сети', callback_data: 'settings_commission' }
  ], [
    { text: '🤝 B2B Сделки', callback_data: 'settings_deals' }
  ], [
    { text: '🌟 Комиссия для амбассадоров', callback_data: 'settings_ambassador_commission' }
  ], [
    { text: toggleText, callback_data: 'settings_toggle_messages' }
  ], [
    { text: '⬅️ Назад', callback_data: 'more_menu' }
  ]];

  await sendTelegramMessageWithKeyboard(
    env.TOKEN_PARTNER,
    chatId,
    '⚙️ <b>Настройки партнёра:</b>\nВыберите действие:',
    keyboard,
    { parseMode: 'HTML' }
  );

  return { success: true };
}

/**
 * Handle Invite Client
 */
export async function handleInviteClient(env, chatId) {
  try {
    const partner = await getPartnerByChatId(env, chatId);
    const botUsername = env.BOT_USERNAME || 'your_client_bot_username';
    const referralLink = `https://t.me/${botUsername}?start=partner_${chatId}`;
    
    const keyboard = [[
      { text: '📢 Разослать всем моим клиентам', callback_data: 'invite_broadcast_start' }
    ]];
    
    await sendTelegramMessageWithKeyboard(
      env.TOKEN_PARTNER,
      chatId,
      `👥 <b>Работа с базой</b>\n\n` +
      `Поделитесь этой ссылкой с клиентами:\n\n` +
      `🔗 <a href="${referralLink}">${referralLink}</a>\n\n` +
      `Клиенты, зарегистрированные по этой ссылке, будут привязаны к вам.`,
      keyboard,
      { parseMode: 'HTML' }
    );
    
    return { success: true, referralLink };
  } catch (error) {
    logError('handleInviteClient', error, { chatId });
    throw error;
  }
}

/**
 * Handle Services menu
 */
export async function handleServicesMenu(env, chatId) {
  const keyboard = [[
    { text: '➕ Добавить новую услугу', callback_data: 'service_add' },
    { text: '🔍 Мои услуги', callback_data: 'service_status' },
    { text: '✏️ Редактировать услугу', callback_data: 'service_edit_list' },
    { text: '🗑️ Удалить услугу', callback_data: 'service_delete_list' }
  ], [
    { text: '⬅️ Назад в меню', callback_data: 'partner_main_menu' }
  ]];
  
  await sendTelegramMessageWithKeyboard(
    env.TOKEN_PARTNER,
    chatId,
    '*🛠️ Управление Услугами:*\n\n' +
    'Создайте услугу, которая будет доступна для обмена баллов клиентами (требуется одобрение Администратора).',
    keyboard,
    { parseMode: 'HTML' }
  );
  
  return { success: true };
}

/**
 * Handle service status list - shows all services with their statuses
 */
export async function handleServiceStatusList(env, chatId) {
  try {
    const services = await getServicesByPartner(env, chatId);
    
    if (!services || services.length === 0) {
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        'У вас пока нет созданных услуг.'
      );
      await showPartnerMainMenu(env, chatId);
      return { success: true, handled: true };
    }
    
    let response = '<b>📋 Ваши услуги:</b>\n\n';
    
    for (const service of services) {
      const title = service.title || 'Без названия';
      const price = service.price_points || 0;
      const status = service.approval_status || 'Unknown';
      
      // Status emoji
      const statusEmoji = {
        'Pending': '⏳',
        'Approved': '✅',
        'Rejected': '❌'
      }[status] || '❓';
      
      response += `${statusEmoji} <b>${title}</b>\n`;
      response += `   💎 Стоимость: ${price} баллов | Статус: ${status}\n\n`;
    }
    
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      response,
      { parseMode: 'HTML' }
    );
    
    await showPartnerMainMenu(env, chatId);
    return { success: true, handled: true };
  } catch (error) {
    console.error('[handleServiceStatusList] Error:', error);
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      '❌ Ошибка при получении списка услуг.'
    );
    return { success: false };
  }
}

// ==================== PROMOTIONS HANDLERS ====================

/**
 * Handle promotions menu - shows promotions management options
 */
export async function handlePromotionsMenu(env, chatId) {
  try {
    const keyboard = [
      [{ text: '➕ Создать акцию', callback_data: 'promo_add' }],
      [{ text: '📋 Мои акции', callback_data: 'promo_list' }],
      [{ text: '⬅️ Назад', callback_data: 'menu_content' }]
    ];
    
    await sendTelegramMessageWithKeyboard(
      env.TOKEN_PARTNER,
      chatId,
      '🌟 <b>Управление акциями</b>\n\n' +
      'Создавайте акции для привлечения клиентов!\n\n' +
      '• <b>Скидка</b> - процентная или фиксированная скидка\n' +
      '• <b>Оплата баллами</b> - клиенты платят баллами\n' +
      '• <b>Кэшбэк</b> - возврат части суммы баллами',
      keyboard,
      { parseMode: 'HTML' }
    );
    
    return { success: true, handled: true };
  } catch (error) {
    console.error('[handlePromotionsMenu] Error:', error);
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      '❌ Ошибка при загрузке меню акций.'
    );
    return { success: false };
  }
}

/**
 * Handle promotions list - shows all partner's promotions
 */
export async function handlePromotionsList(env, chatId) {
  try {
    const promotions = await getPromotionsByPartner(env, chatId);
    
    if (!promotions || promotions.length === 0) {
      const keyboard = [
        [{ text: '➕ Создать первую акцию', callback_data: 'promo_add' }],
        [{ text: '⬅️ Назад', callback_data: 'menu_promotions' }]
      ];
      
      await sendTelegramMessageWithKeyboard(
        env.TOKEN_PARTNER,
        chatId,
        '📋 <b>Ваши акции</b>\n\n' +
        'У вас пока нет акций.\n' +
        'Создайте первую акцию, чтобы привлечь клиентов!',
        keyboard,
        { parseMode: 'HTML' }
      );
      return { success: true, handled: true };
    }
    
    // Build promotions list with status indicators
    let messageText = '📋 <b>Ваши акции:</b>\n\n';
    const keyboard = [];
    
    for (const promo of promotions) {
      const statusEmoji = promo.is_active ? '✅' : '⏸️';
      const endDate = promo.end_date ? new Date(promo.end_date).toLocaleDateString('ru-RU') : '—';
      
      messageText += `${statusEmoji} <b>${promo.title || 'Без названия'}</b>\n`;
      messageText += `   📅 До: ${endDate}\n`;
      messageText += `   💰 ${promo.discount_value || '—'}\n\n`;
      
      keyboard.push([
        { text: `${statusEmoji} ${(promo.title || 'Акция').substring(0, 25)}`, callback_data: `promo_view_${promo.id}` }
      ]);
    }
    
    keyboard.push([{ text: '➕ Создать акцию', callback_data: 'promo_add' }]);
    keyboard.push([{ text: '⬅️ Назад', callback_data: 'menu_promotions' }]);
    
    await sendTelegramMessageWithKeyboard(
      env.TOKEN_PARTNER,
      chatId,
      messageText,
      keyboard,
      { parseMode: 'HTML' }
    );
    
    return { success: true, handled: true };
  } catch (error) {
    console.error('[handlePromotionsList] Error:', error);
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      '❌ Ошибка при загрузке списка акций.'
    );
    return { success: false };
  }
}

/**
 * Handle view single promotion - shows promotion details
 */
export async function handlePromotionView(env, chatId, promotionId) {
  try {
    const promo = await getPromotionById(env, promotionId);
    
    if (!promo) {
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        '❌ Акция не найдена.'
      );
      return { success: false };
    }
    
    // Verify ownership (compare as strings)
    if (String(promo.partner_chat_id) !== String(chatId)) {
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        '❌ У вас нет доступа к этой акции.'
      );
      return { success: false };
    }
    
    const statusEmoji = promo.is_active ? '✅ Активна' : '⏸️ Приостановлена';
    const startDate = promo.start_date ? new Date(promo.start_date).toLocaleDateString('ru-RU') : '—';
    const endDate = promo.end_date ? new Date(promo.end_date).toLocaleDateString('ru-RU') : '—';
    
    const messageText = 
      `🌟 <b>${promo.title || 'Без названия'}</b>\n\n` +
      `📝 ${promo.description || 'Нет описания'}\n\n` +
      `💰 Скидка: ${promo.discount_value || '—'}\n` +
      `📅 Период: ${startDate} — ${endDate}\n` +
      `📊 Статус: ${statusEmoji}\n` +
      `🏷️ Тип: ${promo.promotion_type || 'discount'}`;
    
    const toggleText = promo.is_active ? '⏸️ Приостановить' : '▶️ Активировать';
    
    const keyboard = [
      [
        { text: toggleText, callback_data: `promo_toggle_${promotionId}` },
        { text: '✏️ Редактировать', callback_data: `promo_edit_${promotionId}` }
      ],
      [
        { text: '🗑️ Удалить', callback_data: `promo_delete_${promotionId}` }
      ],
      [{ text: '⬅️ К списку акций', callback_data: 'promo_list' }]
    ];
    
    await sendTelegramMessageWithKeyboard(
      env.TOKEN_PARTNER,
      chatId,
      messageText,
      keyboard,
      { parseMode: 'HTML' }
    );
    
    return { success: true, handled: true };
  } catch (error) {
    console.error('[handlePromotionView] Error:', error);
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      '❌ Ошибка при загрузке акции.'
    );
    return { success: false };
  }
}

/**
 * Handle promotion toggle - activate/deactivate promotion
 */
export async function handlePromotionToggle(env, chatId, promotionId) {
  try {
    const promo = await getPromotionById(env, promotionId);
    
    if (!promo || String(promo.partner_chat_id) !== String(chatId)) {
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        '❌ Акция не найдена или у вас нет доступа.'
      );
      return { success: false };
    }
    
    const newStatus = !promo.is_active;
    await togglePromotionStatus(env, promotionId, newStatus);
    
    const statusText = newStatus ? 'активирована ✅' : 'приостановлена ⏸️';
    
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      `✅ Акция "<b>${promo.title}</b>" ${statusText}`,
      { parseMode: 'HTML' }
    );
    
    // Show updated promotion view
    return await handlePromotionView(env, chatId, promotionId);
  } catch (error) {
    console.error('[handlePromotionToggle] Error:', error);
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      '❌ Ошибка при изменении статуса акции.'
    );
    return { success: false };
  }
}

/**
 * Handle promotion delete confirmation
 */
export async function handlePromotionDeleteConfirm(env, chatId, promotionId) {
  try {
    const promo = await getPromotionById(env, promotionId);
    
    if (!promo || String(promo.partner_chat_id) !== String(chatId)) {
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        '❌ Акция не найдена или у вас нет доступа.'
      );
      return { success: false };
    }
    
    const keyboard = [
      [
        { text: '✅ Да, удалить', callback_data: `promo_delete_confirm_${promotionId}` },
        { text: '❌ Отмена', callback_data: `promo_view_${promotionId}` }
      ]
    ];
    
    await sendTelegramMessageWithKeyboard(
      env.TOKEN_PARTNER,
      chatId,
      `🗑️ <b>Подтверждение удаления:</b>\n\n` +
      `Вы уверены, что хотите удалить акцию "<b>${promo.title}</b>"?\n\n` +
      `⚠️ Это действие нельзя отменить.`,
      keyboard,
      { parseMode: 'HTML' }
    );
    
    return { success: true, handled: true };
  } catch (error) {
    console.error('[handlePromotionDeleteConfirm] Error:', error);
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      '❌ Ошибка при загрузке акции.'
    );
    return { success: false };
  }
}

/**
 * Handle promotion delete execution
 */
export async function handlePromotionDeleteExecute(env, chatId, promotionId) {
  try {
    const promo = await getPromotionById(env, promotionId);
    
    if (!promo || String(promo.partner_chat_id) !== String(chatId)) {
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        '❌ Акция не найдена или у вас нет доступа.'
      );
      return { success: false };
    }
    
    await deletePromotion(env, promotionId);
    
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      `✅ Акция "<b>${promo.title}</b>" удалена.`,
      { parseMode: 'HTML' }
    );
    
    // Return to promotions list
    return await handlePromotionsList(env, chatId);
  } catch (error) {
    console.error('[handlePromotionDeleteExecute] Error:', error);
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      '❌ Ошибка при удалении акции.'
    );
    return { success: false };
  }
}

/**
 * Start promotion creation flow
 */
export async function handlePromotionAdd(env, chatId) {
  try {
    // Set state for promotion creation
    await setBotState(env, chatId, 'awaiting_promo_title', {
      partner_chat_id: chatId
    });
    
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      '✍️ <b>Создание акции (Шаг 1 из 4):</b>\n\n' +
      '1. Введите <b>Название</b> акции:',
      { parseMode: 'HTML' }
    );
    
    return { success: true, handled: true };
  } catch (error) {
    console.error('[handlePromotionAdd] Error:', error);
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      '❌ Ошибка при начале создания акции.'
    );
    return { success: false };
  }
}

/**
 * Handle promotion edit menu
 */
export async function handlePromotionEditMenu(env, chatId, promotionId) {
  try {
    console.log('[handlePromotionEditMenu] Loading promotion:', { chatId, promotionId });
    const promo = await getPromotionById(env, promotionId);
    console.log('[handlePromotionEditMenu] Promotion data:', promo);
    
    if (!promo) {
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        '❌ Акция не найдена.'
      );
      return { success: false };
    }
    
    // Compare as strings to handle type mismatches
    if (String(promo.partner_chat_id) !== String(chatId)) {
      console.log('[handlePromotionEditMenu] Access denied:', { promo_partner: promo.partner_chat_id, chatId });
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        '❌ У вас нет доступа к этой акции.'
      );
      return { success: false };
    }
    
    // Shorten callback_data to fit Telegram's 64 byte limit
    // pe = promo_edit, t/d/v/e = title/description/discount_value/end_date
    const keyboard = [
      [{ text: '📝 Название', callback_data: `pe_t_${promotionId}` }],
      [{ text: '📋 Описание', callback_data: `pe_d_${promotionId}` }],
      [{ text: '💰 Скидка/Стоимость', callback_data: `pe_v_${promotionId}` }],
      [{ text: '📅 Дата окончания', callback_data: `pe_e_${promotionId}` }],
      [{ text: '⬅️ Назад', callback_data: `pv_${promotionId}` }]
    ];
    
    await sendTelegramMessageWithKeyboard(
      env.TOKEN_PARTNER,
      chatId,
      `✏️ <b>Редактирование акции:</b>\n\n` +
      `📝 ${promo.title || 'Без названия'}\n\n` +
      `Выберите поле для редактирования:`,
      keyboard,
      { parseMode: 'HTML' }
    );
    
    return { success: true, handled: true };
  } catch (error) {
    console.error('[handlePromotionEditMenu] Error:', error);
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      '❌ Ошибка при загрузке меню редактирования.'
    );
    return { success: false };
  }
}

/**
 * Handle promotion edit field - prompts user to enter new value
 */
export async function handlePromotionEditField(env, chatId, promotionId, field) {
  try {
    const fieldNames = {
      'title': 'Название',
      'description': 'Описание',
      'discount': 'Скидка/Стоимость',
      'end_date': 'Дата окончания (ДД.ММ.ГГГГ)'
    };
    
    const fieldName = fieldNames[field] || field;
    
    await setBotState(env, chatId, `editing_promo_${field}`, {
      promotion_id: promotionId,
      field: field
    });
    
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      `✏️ Введите новое значение для поля <b>${fieldName}</b>:`,
      { parseMode: 'HTML' }
    );
    
    return { success: true, handled: true };
  } catch (error) {
    console.error('[handlePromotionEditField] Error:', error);
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      '❌ Ошибка при подготовке к редактированию.'
    );
    return { success: false };
  }
}

// ==================== END PROMOTIONS HANDLERS ====================

/**
 * Handle service edit list - shows services available for editing
 */
export async function handleServiceEditList(env, chatId) {
  try {
    const services = await getServicesByPartner(env, chatId);
    
    if (!services || services.length === 0) {
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        'У вас пока нет созданных услуг для редактирования.'
      );
      await showPartnerMainMenu(env, chatId);
      return { success: true, handled: true };
    }
    
    const keyboard = [];
    
    for (const service of services) {
      const title = service.title || 'Без названия';
      const price = service.price_points || 0;
      
      keyboard.push([{
        text: `✏️ ${title} (${price} баллов)`,
        callback_data: `edit_service_${service.id}`
      }]);
    }
    
    keyboard.push([{ text: '⬅️ Назад', callback_data: 'service_back' }]);
    
    await sendTelegramMessageWithKeyboard(
      env.TOKEN_PARTNER,
      chatId,
      '✏️ <b>Выберите услугу для редактирования:</b>',
      keyboard,
      { parseMode: 'HTML' }
    );
    
    return { success: true, handled: true };
  } catch (error) {
    console.error('[handleServiceEditList] Error:', error);
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      '❌ Ошибка при получении списка услуг.'
    );
    return { success: false };
  }
}

/**
 * Handle service delete list - shows services available for deletion
 */
export async function handleServiceDeleteList(env, chatId) {
  try {
    const services = await getServicesByPartner(env, chatId);
    
    if (!services || services.length === 0) {
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        'У вас пока нет созданных услуг для удаления.'
      );
      await showPartnerMainMenu(env, chatId);
      return { success: true, handled: true };
    }
    
    const keyboard = [];
    
    for (const service of services) {
      const title = service.title || 'Без названия';
      const price = service.price_points || 0;
      
      keyboard.push([{
        text: `🗑️ ${title} (${price} баллов)`,
        callback_data: `delete_service_${service.id}`
      }]);
    }
    
    keyboard.push([{ text: '⬅️ Назад', callback_data: 'service_back' }]);
    
    await sendTelegramMessageWithKeyboard(
      env.TOKEN_PARTNER,
      chatId,
      '🗑️ <b>Выберите услугу для удаления:</b>',
      keyboard,
      { parseMode: 'HTML' }
    );
    
    return { success: true, handled: true };
  } catch (error) {
    console.error('[handleServiceDeleteList] Error:', error);
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      '❌ Ошибка при получении списка услуг.'
    );
    return { success: false };
  }
}

/**
 * Handle service edit menu - shows fields that can be edited
 */
export async function handleServiceEditMenu(env, chatId, serviceId) {
  try {
    const service = await getServiceById(env, serviceId);
    
    if (!service) {
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        '❌ Услуга не найдена.'
      );
      return { success: false };
    }
    
    // Verify service belongs to this partner
    if (String(service.partner_chat_id) !== String(chatId)) {
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        '❌ Вы не можете редактировать эту услугу.'
      );
      return { success: false };
    }
    
    const keyboard = [
      [{ text: '📝 Название', callback_data: `edit_field_title_${serviceId}` }],
      [{ text: '📋 Описание', callback_data: `edit_field_description_${serviceId}` }],
      [{ text: '💎 Стоимость (баллы)', callback_data: `edit_field_price_${serviceId}` }],
      [{ text: '⬅️ Назад', callback_data: 'service_edit_list' }]
    ];
    
    const statusEmoji = {
      'Pending': '⏳',
      'Approved': '✅',
      'Rejected': '❌'
    }[service.approval_status] || '❓';
    
    await sendTelegramMessageWithKeyboard(
      env.TOKEN_PARTNER,
      chatId,
      `✏️ <b>Редактирование услуги:</b>\n\n` +
      `📝 Название: ${service.title || '—'}\n` +
      `📋 Описание: ${(service.description || '—').substring(0, 50)}...\n` +
      `💎 Стоимость: ${service.price_points || 0} баллов\n` +
      `${statusEmoji} Статус: ${service.approval_status || 'Unknown'}\n\n` +
      `Выберите поле для редактирования:`,
      keyboard,
      { parseMode: 'HTML' }
    );
    
    return { success: true, handled: true };
  } catch (error) {
    console.error('[handleServiceEditMenu] Error:', error);
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      '❌ Ошибка при загрузке услуги.'
    );
    return { success: false };
  }
}

/**
 * Handle service edit field - prompts user to enter new value
 */
export async function handleServiceEditField(env, chatId, serviceId, field) {
  try {
    const fieldNames = {
      'title': 'Название',
      'description': 'Описание',
      'price': 'Стоимость (баллы)'
    };
    
    const fieldName = fieldNames[field] || field;
    
    // Set state for editing
    await setBotState(env, chatId, `editing_service_${field}`, {
      service_id: serviceId,
      field: field
    });
    
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      `✏️ Введите новое значение для поля <b>${fieldName}</b>:`,
      { parseMode: 'HTML' }
    );
    
    return { success: true, handled: true };
  } catch (error) {
    console.error('[handleServiceEditField] Error:', error);
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      '❌ Ошибка при подготовке к редактированию.'
    );
    return { success: false };
  }
}

/**
 * Handle service delete confirmation - asks for confirmation
 */
export async function handleServiceDeleteConfirm(env, chatId, serviceId) {
  try {
    const service = await getServiceById(env, serviceId);
    
    if (!service) {
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        '❌ Услуга не найдена.'
      );
      return { success: false };
    }
    
    // Verify service belongs to this partner
    if (String(service.partner_chat_id) !== String(chatId)) {
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        '❌ Вы не можете удалить эту услугу.'
      );
      return { success: false };
    }
    
    const statusEmoji = {
      'Pending': '⏳',
      'Approved': '✅',
      'Rejected': '❌'
    }[service.approval_status] || '❓';
    
    const keyboard = [
      [
        { text: '✅ Да, удалить', callback_data: `confirm_delete_service_${serviceId}` },
        { text: '❌ Отмена', callback_data: 'service_delete_list' }
      ]
    ];
    
    await sendTelegramMessageWithKeyboard(
      env.TOKEN_PARTNER,
      chatId,
      `🗑️ <b>Подтверждение удаления:</b>\n\n` +
      `📝 Название: ${service.title || '—'}\n` +
      `💎 Стоимость: ${service.price_points || 0} баллов\n` +
      `${statusEmoji} Статус: ${service.approval_status || 'Unknown'}\n\n` +
      `⚠️ <b>Вы уверены, что хотите удалить эту услугу?</b>\n` +
      `Это действие нельзя отменить.`,
      keyboard,
      { parseMode: 'HTML' }
    );
    
    return { success: true, handled: true };
  } catch (error) {
    console.error('[handleServiceDeleteConfirm] Error:', error);
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      '❌ Ошибка при загрузке услуги.'
    );
    return { success: false };
  }
}

/**
 * Handle service delete execution - actually deletes the service
 */
export async function handleServiceDeleteExecute(env, chatId, serviceId) {
  try {
    const service = await getServiceById(env, serviceId);
    
    if (!service) {
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        '❌ Услуга не найдена.'
      );
      return { success: false };
    }
    
    // Verify service belongs to this partner
    if (String(service.partner_chat_id) !== String(chatId)) {
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        '❌ Вы не можете удалить эту услугу.'
      );
      return { success: false };
    }
    
    await deleteService(env, serviceId);
    
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      `✅ Услуга "<b>${service.title}</b>" успешно удалена.`,
      { parseMode: 'HTML' }
    );
    
    // Show services menu again
    await handleServicesMenu(env, chatId);
    
    return { success: true, handled: true };
  } catch (error) {
    console.error('[handleServiceDeleteExecute] Error:', error);
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      '❌ Ошибка при удалении услуги.'
    );
    return { success: false };
  }
}

/**
 * Handle partner messages menu
 */
export async function handlePartnerMessages(env, chatId) {
  try {
    const conversations = await getPartnerConversations(env, chatId);
    
    if (!conversations || conversations.length === 0) {
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        '📭 **У вас пока нет сообщений**\n\n' +
        'Клиенты смогут написать вам через приложение, и их сообщения появятся здесь.',
        { parseMode: 'Markdown' }
      );
      return { success: true };
    }
    
    // Sort by last message date
    conversations.sort((a, b) => {
      const dateA = new Date(a.last_message?.created_at || 0);
      const dateB = new Date(b.last_message?.created_at || 0);
      return dateB - dateA;
    });
    
    const messageText = '💬 **Мои сообщения**\n\n' +
      `Всего переписок: ${conversations.length}\n\n` +
      'Выберите переписку для просмотра:\n\n';
    
    const keyboard = [];
    
    for (let idx = 0; idx < Math.min(conversations.length, 10); idx++) {
      const conv = conversations[idx];
      const clientId = conv.client_chat_id;
      const lastMsg = conv.last_message;
      const unreadCount = conv.unread_count || 0;
      
      // Get client info
      let clientName = 'Неизвестный клиент';
      try {
        const clientData = await getClientDetailsForPartner(env, clientId);
        if (clientData) {
          clientName = clientData.name || 'Не указано';
        }
      } catch (error) {
        console.error('[handlePartnerMessages] Error getting client details:', error);
      }
      
      // Format button text
      const unreadBadge = unreadCount > 0 ? ` (${unreadCount})` : '';
      let buttonText = `${idx + 1}. ${clientName}${unreadBadge}`;
      
      if (lastMsg?.service_title) {
        const serviceShort = lastMsg.service_title.length > 20 
          ? lastMsg.service_title.substring(0, 20) + '...' 
          : lastMsg.service_title;
        buttonText += ` | ${serviceShort}`;
      }
      
      keyboard.push([{
        text: buttonText,
        callback_data: `view_conversation_${clientId}`
      }]);
    }
    
    keyboard.push([{ text: '⬅️ Назад', callback_data: 'more_menu' }]);
    
    await sendTelegramMessageWithKeyboard(
      env.TOKEN_PARTNER,
      chatId,
      messageText,
      keyboard,
      { parseMode: 'Markdown' }
    );
    
    return { success: true };
  } catch (error) {
    logError('handlePartnerMessages', error, { chatId });
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      '❌ Произошла ошибка при загрузке сообщений. Попробуйте позже.'
    );
    return { success: false };
  }
}

/**
 * Handle view conversation with specific client
 */
export async function handleViewConversation(env, chatId, clientChatId) {
  try {
    // Get client info
    let clientName = 'Неизвестный клиент';
    let clientPhone = 'Не указан';
    
    try {
      const clientData = await getClientDetailsForPartner(env, clientChatId);
      if (clientData) {
        clientName = clientData.name || 'Не указано';
        clientPhone = clientData.phone || 'Не указан';
      }
    } catch (error) {
      console.error('[handleViewConversation] Error getting client details:', error);
    }
    
    // Get conversation messages
    const messages = await getConversation(env, clientChatId, chatId, 50);
    
    if (!messages || messages.length === 0) {
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        '❌ Переписка не найдена.'
      );
      return { success: false };
    }
    
    // Format conversation history
    let conversationText = `💬 **Переписка с ${clientName}**\n\n`;
    conversationText += `📞 Телефон: ${clientPhone}\n\n`;
    conversationText += '**История сообщений:**\n\n';
    
    for (const msg of messages) {
      const sender = msg.sender_type === 'client' ? '👤 Клиент' : '🏢 Вы';
      const timestamp = new Date(msg.created_at).toLocaleString('ru-RU');
      const msgType = msg.message_type || 'text';
      
      let msgContent = '';
      if (msgType === 'qr_code') {
        msgContent = '📱 QR-код';
      } else if (msg.message_text) {
        msgContent = msg.message_text;
      } else {
        msgContent = `📎 ${msgType}`;
      }
      
      conversationText += `${sender} (${timestamp}):\n${msgContent}\n\n`;
    }
    
    const keyboard = [
      [{ text: '💬 Написать ответ', callback_data: `reply_to_client_${clientChatId}` }],
      [{ text: '⬅️ Назад к сообщениям', callback_data: 'menu_messages' }]
    ];
    
    await sendTelegramMessageWithKeyboard(
      env.TOKEN_PARTNER,
      chatId,
      conversationText,
      keyboard,
      { parseMode: 'Markdown' }
    );
    
    return { success: true };
  } catch (error) {
    logError('handleViewConversation', error, { chatId, clientChatId });
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      '❌ Произошла ошибка при загрузке переписки.'
    );
    return { success: false };
  }
}

/**
 * Handle reply to client - set state for replying
 */
export async function handleReplyToClient(env, chatId, clientChatId) {
  try {
    await setBotState(env, chatId, `replying_to_client_${clientChatId}`, {
      client_chat_id: clientChatId
    });
    
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      '💬 **Ответ клиенту**\n\nВведите ваше сообщение для клиента:',
      { parseMode: 'Markdown' }
    );
    
    return { success: true };
  } catch (error) {
    logError('handleReplyToClient', error, { chatId, clientChatId });
    return { success: false };
  }
}

/**
 * Handle partner reply message to client
 */
export async function handlePartnerReplyMessage(env, update, botState) {
  const message = update.message;
  const chatId = String(message.chat.id);
  const replyText = message.text || '';
  
  if (!replyText || !replyText.trim()) {
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      '❌ Сообщение не может быть пустым. Введите сообщение или отмените ответ.'
    );
    return { success: true };
  }
  
  const clientChatId = botState.state.replace('replying_to_client_', '') || botState.data?.client_chat_id;
  
  if (!clientChatId) {
    await sendTelegramMessage(env.TOKEN_PARTNER, chatId, '❌ Ошибка: не указан клиент');
    await clearBotState(env, chatId);
    await showPartnerMainMenu(env, chatId);
    return { success: false };
  }
  
  try {
    // Get partner info
    const partner = await getPartnerByChatId(env, chatId);
    const partnerName = partner?.name || 'Специалист';
    const partnerCompany = partner?.company_name || '';
    
    // Save message to database
    const messageData = {
      client_chat_id: String(clientChatId),
      partner_chat_id: String(chatId),
      sender_type: 'partner',
      message_text: replyText,
      message_type: 'text',
      is_read: false,
    };
    
    const savedMessage = await saveMessage(env, messageData);
    
    // Format message for client
    let clientMessage = '💬 **Ответ от специалиста**\n\n';
    if (partnerCompany) {
      clientMessage += `🏢 ${partnerCompany}\n`;
    }
    clientMessage += `👤 ${partnerName}\n\n`;
    clientMessage += `_${replyText}_`;
    
    // Send to client via client bot (if TOKEN_CLIENT is available)
    if (env.TOKEN_CLIENT) {
      try {
        await sendTelegramMessage(
          env.TOKEN_CLIENT,
          String(clientChatId),
          clientMessage,
          { parseMode: 'Markdown' }
        );
        
        // Mark as read if sent successfully
        if (savedMessage?.id) {
          await markMessageAsRead(env, savedMessage.id);
        }
      } catch (sendError) {
        console.error('[handlePartnerReplyMessage] Failed to send to client:', sendError);
        // Message is saved in DB, client will see it later
      }
    }
    
    // Confirm to partner
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      '✅ **Сообщение отправлено клиенту**\n\n' +
      `Ваш ответ: ${replyText}`,
      { parseMode: 'Markdown' }
    );
    
    // Clear state
    await clearBotState(env, chatId);
    
    return { success: true };
  } catch (error) {
    logError('handlePartnerReplyMessage', error, { chatId, clientChatId });
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      '❌ Произошла ошибка при отправке сообщения. Попробуйте позже.'
    );
    await clearBotState(env, chatId);
    return { success: false };
  }
}

/**
 * Start reply flow to admin from partner
 */
export async function handleReplyToAdmin(env, chatId) {
  try {
    await setBotState(env, chatId, 'replying_to_admin', {});

    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      '💬 **Ответ администратору**\n\nВведите ваше сообщение:',
      { parseMode: 'Markdown' }
    );

    return { success: true };
  } catch (error) {
    logError('handleReplyToAdmin', error, { chatId });
    return { success: false };
  }
}

/**
 * Handle partner reply message to admin
 */
export async function handlePartnerReplyToAdmin(env, update, botState) {
  const message = update.message;
  const chatId = String(message.chat.id);
  const replyText = message.text || '';

  if (!replyText || !replyText.trim()) {
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      '❌ Сообщение не может быть пустым. Введите сообщение или отмените ответ.'
    );
    return { success: true };
  }

  try {
    // Информация о партнёре
    const partner = await getPartnerByChatId(env, chatId);
    const partnerName = partner?.name || 'Партнёр';
    const partnerCompany = partner?.company_name || '';

    // Сообщение для админа
    let adminMessage = '💬 **Сообщение от партнёра**\n\n';
    if (partnerCompany) {
      adminMessage += `🏢 ${partnerCompany}\n`;
    }
    adminMessage += `👤 ${partnerName}\n`;
    adminMessage += `ID: \`${chatId}\`\n\n`;
    adminMessage += `_${replyText}_`;

    const adminIds = (env.ADMIN_CHAT_ID || '')
      .split(',')
      .map(id => id.trim())
      .filter(Boolean);

    if (env.ADMIN_BOT_TOKEN && adminIds.length > 0) {
      for (const adminId of adminIds) {
        try {
          await sendTelegramMessage(
            env.ADMIN_BOT_TOKEN,
            String(adminId),
            adminMessage,
            { parseMode: 'Markdown' }
          );
        } catch (error) {
          console.error('[handlePartnerReplyToAdmin] Failed to send to admin:', {
            adminId,
            error,
          });
        }
      }
    }

    await clearBotState(env, chatId);

    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      '✅ **Сообщение отправлено администратору**\n\nВаш ответ будет рассмотрен.',
      { parseMode: 'Markdown' }
    );

    return { success: true };
  } catch (error) {
    logError('handlePartnerReplyToAdmin', error, { chatId });
    await clearBotState(env, chatId);
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      '❌ Произошла ошибка при отправке сообщения администратору. Попробуйте позже.'
    );
    return { success: false };
  }
}

/**
 * Handle callback queries
 */
export async function handleCallback(env, update) {
  const callbackQuery = update.callback_query;
  const chatId = String(callbackQuery.message.chat.id);
  const callbackData = callbackQuery.data;
  
  console.log('[handleCallback] Received callback:', { chatId, callbackData });
  
  try {
    // Answer callback query first
    console.log('[handleCallback] Answering callback query:', callbackQuery.id);
    await answerCallbackQuery(env.TOKEN_PARTNER, callbackQuery.id);
    console.log('[handleCallback] Callback query answered successfully');
    
    // Route to appropriate handler
    if (callbackData === 'partner_main_menu') {
      return await showPartnerMainMenu(env, chatId);
    }
    
    // ==================== INVITE BROADCAST CALLBACKS ====================
    if (callbackData === 'invite_broadcast_start') {
      const canRun = await canPartnerRunBroadcast(env, chatId);
      if (!canRun) {
        await sendTelegramMessage(env.TOKEN_PARTNER, chatId, '⚠️ Рассылка возможна не чаще одного раза в сутки.');
        return { success: true, handled: true };
      }
      const keyboard = [
        [{ text: '👥 По реферальной ссылке', callback_data: 'invite_broadcast_audience_referral' }],
        [{ text: '🛒 По визитам', callback_data: 'invite_broadcast_audience_transactions' }],
        [{ text: '📋 Все мои клиенты', callback_data: 'invite_broadcast_audience_combined' }],
        [{ text: '❌ Отмена', callback_data: 'invite_broadcast_cancel' }],
      ];
      await sendTelegramMessageWithKeyboard(
        env.TOKEN_PARTNER,
        chatId,
        '📢 <b>Выберите аудиторию для рассылки:</b>\n\n' +
        '• <b>По реферальной ссылке</b> — клиенты, пришедшие по вашей ссылке\n' +
        '• <b>По визитам</b> — клиенты, которые были у вас (делали покупки)\n' +
        '• <b>Все мои клиенты</b> — объединённый список без повторов',
        keyboard,
        { parseMode: 'HTML' }
      );
      return { success: true, handled: true };
    }
    
    if (callbackData === 'invite_broadcast_audience_referral' || callbackData === 'invite_broadcast_audience_transactions' || callbackData === 'invite_broadcast_audience_combined') {
      const audienceMap = {
        'invite_broadcast_audience_referral': ['referral', getPartnerClientChatIdsForBroadcast],
        'invite_broadcast_audience_transactions': ['transactions', getPartnerClientChatIdsByTransactions],
        'invite_broadcast_audience_combined': ['combined', getPartnerClientChatIdsCombined],
      };
      const [audienceType, getMethod] = audienceMap[callbackData];
      const recipients = await getMethod(env, chatId, 500);
      const emptyMsgs = {
        referral: 'У вас пока нет клиентов, пришедших по реферальной ссылке.',
        transactions: 'У вас пока нет клиентов с визитами (транзакциями).',
        combined: 'У вас пока нет клиентов для рассылки.',
      };
      if (!recipients || recipients.length === 0) {
        await sendTelegramMessage(env.TOKEN_PARTNER, chatId, `У вас пока нет клиентов для рассылки по этому критерию. ${emptyMsgs[audienceType]}`);
        return { success: true, handled: true };
      }
      await setBotState(env, chatId, 'awaiting_broadcast_message', {
        recipients,
        audienceType,
        partnerId: chatId,
      });
      const keyboard = [[{ text: '❌ Отмена', callback_data: 'invite_broadcast_cancel' }]];
      await sendTelegramMessageWithKeyboard(
        env.TOKEN_PARTNER,
        chatId,
        `📢 <b>Рассылка</b>\n\nПолучателей: <b>${recipients.length}</b>\n\nВведите текст сообщения для рассылки (до 4096 символов):`,
        keyboard,
        { parseMode: 'HTML' }
      );
      return { success: true, handled: true };
    }
    
    if (callbackData === 'invite_broadcast_confirm') {
      const botState = await getBotState(env, chatId);
      if (!botState || botState.state !== 'broadcast_preview' || !botState.data?.recipients?.length) {
        await sendTelegramMessage(env.TOKEN_PARTNER, chatId, '❌ Данные рассылки устарели. Начните заново: «👥  Работа с базой» → «Разослать всем».');
        return { success: true, handled: true };
      }
      const { recipients, audienceType, templateText } = botState.data;
      const campaignId = await createBroadcastCampaign(env, chatId, 'referral_program', recipients.length, audienceType);
      if (!campaignId) {
        await sendTelegramMessage(env.TOKEN_PARTNER, chatId, '❌ Не удалось создать кампанию. Попробуйте позже.');
        return { success: true, handled: true };
      }
      if (!env.TOKEN_CLIENT) {
        await sendTelegramMessage(env.TOKEN_PARTNER, chatId, '❌ Рассылка недоступна: не настроен TOKEN_CLIENT.');
        await clearBotState(env, chatId);
        return { success: true, handled: true };
      }
      await sendTelegramMessage(env.TOKEN_PARTNER, chatId, `📤 Отправка сообщений ${recipients.length} клиентам… Не закрывайте бота.`);
      let sentCount = 0;
      let errorCount = 0;
      for (const cid of recipients) {
        try {
          await sendTelegramMessage(env.TOKEN_CLIENT, cid, templateText);
          sentCount++;
        } catch (e) {
          errorCount++;
          console.warn('[invite_broadcast_confirm] Send failed for', cid, e?.message);
        }
        await new Promise(r => setTimeout(r, 50));
      }
      await updateBroadcastCampaignFinished(env, campaignId, sentCount, 'completed', errorCount > 0 ? `Errors: ${errorCount}` : null);
      await clearBotState(env, chatId);
      await sendTelegramMessage(env.TOKEN_PARTNER, chatId, `✅ Рассылка завершена. Отправлено: <b>${sentCount}</b> сообщений${errorCount > 0 ? `, ошибок: ${errorCount}` : ''}.`, { parseMode: 'HTML' });
      return { success: true, handled: true };
    }
    
    if (callbackData === 'invite_broadcast_cancel') {
      await clearBotState(env, chatId);
      await sendTelegramMessage(env.TOKEN_PARTNER, chatId, '❌ Рассылка отменена.');
      return { success: true, handled: true };
    }
    // ==================== END INVITE BROADCAST ====================
    
    // Handle services menu
    if (callbackData === 'menu_services') {
      return await handleServicesMenu(env, chatId);
    }
    
    // Handle service actions
    if (callbackData === 'service_add') {
      try {
        console.log('[handleCallback] service_add - initializing state for chatId:', chatId);
        
        // Initialize state for service creation
        await setBotState(env, chatId, 'awaiting_service_title', {
          partner_chat_id: chatId,
          approval_status: 'Pending',
        });
        
        console.log('[handleCallback] service_add - state set successfully');
        
        await sendTelegramMessage(
          env.TOKEN_PARTNER,
          chatId,
          '✍️ <b>Создание Услуги (Шаг 1 из 4):</b>\n\n' +
          '1. Введите <b>Название</b> услуги (например: "Бесплатный кофе", "Скидка 500 руб."):',
          { parseMode: 'HTML' }
        );
        
        console.log('[handleCallback] service_add - message sent successfully');
        return { success: true, handled: true };
      } catch (error) {
        console.error('[handleCallback] service_add - ERROR:', error);
        logError('handleCallback - service_add', error, { chatId });
        
        // Try to send error message to user
        try {
          await sendTelegramMessage(
            env.TOKEN_PARTNER,
            chatId,
            '❌ Ошибка при создании услуги. Пожалуйста, попробуйте позже.\n\n' +
            'Если проблема сохраняется, проверьте, что таблица bot_states создана в Supabase.'
          );
        } catch (sendError) {
          console.error('[handleCallback] service_add - Failed to send error message:', sendError);
        }
        
        return { success: false, handled: true, error: error.message };
      }
    }
    
    // Handle service category selection
    if (callbackData.startsWith('service_category_')) {
      const category = callbackData.replace('service_category_', '');
      return await handleServiceCategorySelection(env, chatId, category);
    }
    
    if (callbackData === 'service_status') {
      return await handleServiceStatusList(env, chatId);
    }
    
    if (callbackData === 'service_edit_list') {
      return await handleServiceEditList(env, chatId);
    }
    
    if (callbackData === 'service_delete_list') {
      return await handleServiceDeleteList(env, chatId);
    }
    
    // Handle edit service selection
    if (callbackData.startsWith('edit_service_')) {
      const serviceId = callbackData.replace('edit_service_', '');
      return await handleServiceEditMenu(env, chatId, serviceId);
    }
    
    // Handle delete service selection
    if (callbackData.startsWith('delete_service_')) {
      const serviceId = callbackData.replace('delete_service_', '');
      return await handleServiceDeleteConfirm(env, chatId, serviceId);
    }
    
    // Handle delete confirmation
    if (callbackData.startsWith('confirm_delete_service_')) {
      const serviceId = callbackData.replace('confirm_delete_service_', '');
      return await handleServiceDeleteExecute(env, chatId, serviceId);
    }
    
    // Handle edit field selection
    if (callbackData.startsWith('edit_field_')) {
      const parts = callbackData.replace('edit_field_', '').split('_');
      const field = parts[0];
      const serviceId = parts.slice(1).join('_');
      return await handleServiceEditField(env, chatId, serviceId, field);
    }
    
    if (callbackData === 'service_back') {
      return await handleServicesMenu(env, chatId);
    }
    
    // ==================== PROMOTIONS CALLBACKS ====================
    
    if (callbackData === 'menu_promotions') {
      return await handlePromotionsMenu(env, chatId);
    }
    
    if (callbackData === 'promo_list') {
      return await handlePromotionsList(env, chatId);
    }
    
    if (callbackData === 'promo_add') {
      return await handlePromotionAdd(env, chatId);
    }
    
    if (callbackData.startsWith('promo_view_')) {
      const promotionId = callbackData.replace('promo_view_', '');
      return await handlePromotionView(env, chatId, promotionId);
    }
    
    if (callbackData.startsWith('promo_toggle_')) {
      const promotionId = callbackData.replace('promo_toggle_', '');
      return await handlePromotionToggle(env, chatId, promotionId);
    }
    
    // Shortened promo edit field callbacks: pe_t_, pe_d_, pe_v_, pe_e_
    if (callbackData.startsWith('pe_t_')) {
      const promotionId = callbackData.replace('pe_t_', '');
      return await handlePromotionEditField(env, chatId, promotionId, 'title');
    }
    if (callbackData.startsWith('pe_d_')) {
      const promotionId = callbackData.replace('pe_d_', '');
      return await handlePromotionEditField(env, chatId, promotionId, 'description');
    }
    if (callbackData.startsWith('pe_v_')) {
      const promotionId = callbackData.replace('pe_v_', '');
      return await handlePromotionEditField(env, chatId, promotionId, 'discount');
    }
    if (callbackData.startsWith('pe_e_')) {
      const promotionId = callbackData.replace('pe_e_', '');
      return await handlePromotionEditField(env, chatId, promotionId, 'end_date');
    }
    
    // Shortened promo view callback: pv_
    if (callbackData.startsWith('pv_')) {
      const promotionId = callbackData.replace('pv_', '');
      return await handlePromotionView(env, chatId, promotionId);
    }
    
    // Legacy full-length callbacks (for backwards compatibility)
    if (callbackData.startsWith('promo_edit_field_')) {
      const parts = callbackData.replace('promo_edit_field_', '').split('_');
      const field = parts[0];
      const promotionId = parts.slice(1).join('_');
      return await handlePromotionEditField(env, chatId, promotionId, field);
    }
    
    if (callbackData.startsWith('promo_edit_') && !callbackData.startsWith('promo_edit_field_')) {
      const promotionId = callbackData.replace('promo_edit_', '');
      console.log('[handleCallback] promo_edit_ matched, promotionId:', promotionId);
      return await handlePromotionEditMenu(env, chatId, promotionId);
    }
    
    // Tier selection during promo creation
    if (callbackData.startsWith('promo_tier_')) {
      const botState = await getBotState(env, chatId);
      if (botState?.state === 'awaiting_promo_tier' && botState.data) {
        const tierVal = callbackData.replace('promo_tier_', '');
        if (tierVal === 'all') {
          const partnerStatus = await checkPartnerStatus(env, chatId);
          if (partnerStatus.status !== 'Approved') {
            await clearBotState(env, chatId);
            await sendTelegramMessage(env.TOKEN_PARTNER, chatId,
              '❌ Акции могут создавать только одобренные партнёры. Ваша заявка ещё на рассмотрении.'
            );
            return { success: false };
          }
          const promoData = {
            partner_chat_id: String(chatId),
            title: botState.data.title,
            description: botState.data.description,
            discount_value: botState.data.discount_value,
            end_date: botState.data.end_date,
            is_active: true,
            promotion_type: 'discount',
            tier_visibility: 'all',
          };
          try {
            await addPromotion(env, promoData);
            await clearBotState(env, chatId);
            await sendTelegramMessage(env.TOKEN_PARTNER, chatId,
              '✅ <b>Акция успешно создана!</b>\n\n' +
              `📝 ${promoData.title}\n💰 ${promoData.discount_value}\n📅 До: ${botState.data.date_text}`,
              { parseMode: 'HTML' }
            );
            return await handlePromotionsMenu(env, chatId);
          } catch (err) {
            console.error('[promo_tier_all]', err?.message || err, err);
            await clearBotState(env, chatId);
            const errMsg = (err?.message || '').toLowerCase();
            const hint = errMsg.includes('foreign key') || errMsg.includes('violates')
              ? '\n\nВозможно, партнёр не найден в системе. Обратитесь к администратору.'
              : '';
            await sendTelegramMessage(env.TOKEN_PARTNER, chatId, '❌ Ошибка при создании акции.' + hint);
            return { success: false };
          }
        }
        // Specific tier: ask visibility
        await setBotState(env, chatId, 'awaiting_promo_visibility', {
          ...botState.data,
          promo_min_tier: tierVal,
        });
        const visKeyboard = [
          [{ text: '👁 Видна всем (с замком)', callback_data: 'promo_vis_all' }],
          [{ text: '🔒 Только для выбранного уровня', callback_data: 'promo_vis_tier_only' }],
        ];
        await sendTelegramMessageWithKeyboard(env.TOKEN_PARTNER, chatId,
          '✍️ <b>Создание акции (Шаг 6 из 6):</b>\n\n6. Видимость акции:',
          visKeyboard,
          { parseMode: 'HTML' }
        );
        return { success: true, handled: true };
      }
    }

    if (callbackData.startsWith('promo_vis_')) {
      const botState = await getBotState(env, chatId);
      if (botState?.state === 'awaiting_promo_visibility' && botState.data?.promo_min_tier) {
        const visVal = callbackData.replace('promo_vis_', '');
        const partnerStatus = await checkPartnerStatus(env, chatId);
        if (partnerStatus.status !== 'Approved') {
          await clearBotState(env, chatId);
          await sendTelegramMessage(env.TOKEN_PARTNER, chatId,
            '❌ Акции могут создавать только одобренные партнёры. Ваша заявка ещё на рассмотрении.'
          );
          return { success: false };
        }
        const promoData = {
          partner_chat_id: String(chatId),
          title: botState.data.title,
          description: botState.data.description,
          discount_value: botState.data.discount_value,
          end_date: botState.data.end_date,
          is_active: true,
          promotion_type: 'discount',
          min_tier: botState.data.promo_min_tier,
          tier_visibility: visVal === 'tier_only' ? 'tier_only' : 'all',
        };
        try {
          await addPromotion(env, promoData);
          await clearBotState(env, chatId);
          await sendTelegramMessage(env.TOKEN_PARTNER, chatId,
            '✅ <b>Акция успешно создана!</b>\n\n' +
            `📝 ${promoData.title}\n💰 ${promoData.discount_value}\n📅 До: ${botState.data.date_text}`,
            { parseMode: 'HTML' }
          );
          return await handlePromotionsMenu(env, chatId);
        } catch (err) {
          console.error('[promo_vis]', err?.message || err, err);
          await clearBotState(env, chatId);
          const errMsg = (err?.message || '').toLowerCase();
          const hint = errMsg.includes('foreign key') || errMsg.includes('violates')
            ? '\n\nВозможно, партнёр не найден в системе. Обратитесь к администратору.'
            : '';
          await sendTelegramMessage(env.TOKEN_PARTNER, chatId, '❌ Ошибка при создании акции.' + hint);
          return { success: false };
        }
      }
    }

    if (callbackData.startsWith('promo_delete_confirm_')) {
      const promotionId = callbackData.replace('promo_delete_confirm_', '');
      return await handlePromotionDeleteExecute(env, chatId, promotionId);
    }
    
    if (callbackData.startsWith('promo_delete_')) {
      const promotionId = callbackData.replace('promo_delete_', '');
      return await handlePromotionDeleteConfirm(env, chatId, promotionId);
    }
    
    if (callbackData === 'menu_content') {
      return await handleContentMenu(env, chatId);
    }
    
    // ==================== END PROMOTIONS CALLBACKS ====================
    
    // ==================== REVENUE SHARE CALLBACKS ====================
    
    if (callbackData === 'rs_history') {
      return await handleRevenueShareHistory(env, chatId);
    }
    
    if (callbackData === 'rs_network') {
      return await handleRevenueShareNetwork(env, chatId);
    }
    
    if (callbackData === 'rs_invite') {
      return await handleRevenueShareInvite(env, chatId);
    }
    
    // ==================== END REVENUE SHARE CALLBACKS ====================
    
    // ==================== B2B PARTNERSHIP CALLBACKS ====================
    
    if (callbackData === 'menu_partnership') {
      return await handlePartnershipMenu(env, chatId);
    }
    if (callbackData === 'b2b_my_deals') {
      return await handleB2BMyDeals(env, chatId);
    }
    if (callbackData === 'b2b_incoming') {
      return await handleB2BIncoming(env, chatId);
    }
    if (callbackData === 'b2b_propose') {
      return await handleB2BPropose(env, chatId);
    }
    if (callbackData.startsWith('b2b_preset_')) {
      const presetKey = callbackData.replace('b2b_preset_', '');
      return await handleB2BPresetSelected(env, chatId, presetKey, callbackQuery);
    }
    if (callbackData.startsWith('b2b_accept_')) {
      const dealId = callbackData.replace('b2b_accept_', '');
      return await handleB2BAccept(env, chatId, dealId, callbackQuery);
    }
    if (callbackData.startsWith('b2b_reject_')) {
      const dealId = callbackData.replace('b2b_reject_', '');
      return await handleB2BReject(env, chatId, dealId, callbackQuery);
    }
    
    if (callbackData === 'more_menu') {
      return await handleMoreMenu(env, chatId);
    }
    
    if (callbackData === 'menu_messages') {
      return await handlePartnerMessages(env, chatId);
    }
    
    if (callbackData.startsWith('view_conversation_')) {
      const clientChatId = callbackData.replace('view_conversation_', '');
      return await handleViewConversation(env, chatId, clientChatId);
    }
    
    if (callbackData.startsWith('reply_to_client_')) {
      const clientChatId = callbackData.replace('reply_to_client_', '');
      return await handleReplyToClient(env, chatId, clientChatId);
    }

    if (callbackData === 'reply_to_admin') {
      return await handleReplyToAdmin(env, chatId);
    }
    
    // ==================== END B2B PARTNERSHIP CALLBACKS ====================
    
    // ==================== SETTINGS CALLBACKS ====================
    
    if (callbackData === 'menu_settings') {
      return await handleSettingsMenu(env, chatId);
    }
    
    if (callbackData === 'settings_info') {
      try {
        const partner = await getPartnerByChatId(env, chatId);
        if (partner) {
          const infoText =
            `ℹ️ <b>Информация о вашем аккаунте:</b>\n\n` +
            `👤 Имя: ${partner.name || 'Не указано'}\n` +
            `🏢 Компания: ${partner.company_name || 'Не указано'}\n` +
            `📱 Телефон: ${partner.phone || 'Не указан'}\n` +
            `📊 Статус: ${partner.status || 'Неизвестно'}\n` +
            `🆔 Chat ID: <code>${chatId}</code>`;

          const keyboard = [[
            { text: '⬅️ Назад', callback_data: 'menu_settings' }
          ]];
          await sendTelegramMessageWithKeyboard(
            env.TOKEN_PARTNER, chatId, infoText, keyboard, { parseMode: 'HTML' }
          );
        } else {
          await sendTelegramMessage(env.TOKEN_PARTNER, chatId, 'Информация о партнёре не найдена.');
          await handleSettingsMenu(env, chatId);
        }
      } catch (error) {
        logError('settings_info', error, { chatId });
        await sendTelegramMessage(env.TOKEN_PARTNER, chatId, '❌ Ошибка при получении информации.');
        await handleSettingsMenu(env, chatId);
      }
      return { success: true, handled: true };
    }
    
    if (callbackData === 'settings_bonus') {
      const welcomeBonus = env.WELCOME_BONUS_AMOUNT || '100';
      const keyboard = [[
        { text: '⬅️ Назад', callback_data: 'menu_settings' }
      ]];
      await sendTelegramMessageWithKeyboard(
        env.TOKEN_PARTNER,
        chatId,
        `🎁 <b>Приветственный бонус</b>\n\n` +
        `Текущий приветственный бонус для новых клиентов: <b>${welcomeBonus}</b> баллов.\n\n` +
        `Для изменения этой настройки обратитесь к администратору системы.`,
        keyboard,
        { parseMode: 'HTML' }
      );
      return { success: true, handled: true };
    }
    
    if (callbackData === 'settings_edit') {
      const keyboard = [[
        { text: '👤 Редактировать имя', callback_data: 'edit_name' }
      ], [
        { text: '🏢 Редактировать компанию', callback_data: 'edit_company' }
      ], [
        { text: '📱 Редактировать телефон', callback_data: 'edit_phone' }
      ], [
        { text: '📅 Редактировать ссылку на бронирование', callback_data: 'edit_booking_url' }
      ], [
        { text: '⬅️ Назад', callback_data: 'menu_settings' }
      ]];
      await sendTelegramMessageWithKeyboard(
        env.TOKEN_PARTNER,
        chatId,
        '✏️ <b>Редактирование данных:</b>\n\nВыберите поле, которое хотите изменить:',
        keyboard,
        { parseMode: 'HTML' }
      );
      return { success: true, handled: true };
    }
    
    if (callbackData === 'settings_toggle_messages') {
      try {
        const partner = await getPartnerByChatId(env, chatId);
        const current = partner ? partner.allow_client_messages !== false : true;
        const newValue = !current;
        await supabaseRequest(env, `partners?chat_id=eq.${chatId}`, {
          method: 'PATCH',
          body: JSON.stringify({ allow_client_messages: newValue }),
        });
        const statusText = newValue ? '🔔 Сообщения от клиентов <b>включены</b>.' : '🔕 Сообщения от клиентов <b>отключены</b>.';
        await sendTelegramMessage(env.TOKEN_PARTNER, chatId, statusText, { parseMode: 'HTML' });
        await handleSettingsMenu(env, chatId);
      } catch (e) {
        await sendTelegramMessage(env.TOKEN_PARTNER, chatId, '❌ Ошибка. Попробуйте позже.');
      }
      return { success: true, handled: true };
    }

    if (callbackData === 'edit_name') {
      await setBotState(env, chatId, 'awaiting_edit_name', { partner_chat_id: chatId });
      await sendTelegramMessage(
        env.TOKEN_PARTNER, chatId,
        '✏️ <b>Редактирование имени</b>\n\nВведите новое имя:',
        { parseMode: 'HTML' }
      );
      return { success: true, handled: true };
    }
    
    if (callbackData === 'edit_company') {
      await setBotState(env, chatId, 'awaiting_edit_company', { partner_chat_id: chatId });
      await sendTelegramMessage(
        env.TOKEN_PARTNER, chatId,
        '✏️ <b>Редактирование названия компании</b>\n\nВведите новое название компании:',
        { parseMode: 'HTML' }
      );
      return { success: true, handled: true };
    }
    
    if (callbackData === 'edit_phone') {
      await setBotState(env, chatId, 'awaiting_edit_phone', { partner_chat_id: chatId });
      await sendTelegramMessage(
        env.TOKEN_PARTNER, chatId,
        '✏️ <b>Редактирование телефона</b>\n\nВведите новый номер телефона:',
        { parseMode: 'HTML' }
      );
      return { success: true, handled: true };
    }
    
    if (callbackData === 'edit_booking_url') {
      await setBotState(env, chatId, 'awaiting_edit_booking_url', { partner_chat_id: chatId });
      await sendTelegramMessage(
        env.TOKEN_PARTNER, chatId,
        '✏️ <b>Редактирование ссылки на бронирование</b>\n\nВведите новую ссылку на систему бронирования (или отправьте "удалить" для удаления):',
        { parseMode: 'HTML' }
      );
      return { success: true, handled: true };
    }
    
    if (callbackData === 'settings_commission') {
      try {
        const partner = await getPartnerByChatId(env, chatId);
        const currentPercent = partner?.base_reward_percent || 0.05;
        const percentDisplay = `${(currentPercent * 100).toFixed(1)}%`;

        const keyboard = [[
          { text: '⬅️ Назад', callback_data: 'menu_settings' }
        ]];
        await sendTelegramMessageWithKeyboard(
          env.TOKEN_PARTNER,
          chatId,
          `💰 <b>Комиссия сети</b>\n\n` +
          `Текущий процент комиссионного фонда: <b>${percentDisplay}</b>\n\n` +
          `Это процент от суммы чека, который вы отдаёте в комиссионный фонд для стандартной MLM логики.\n` +
          `Он распределяется по цепочке рефералов (5%/5%/5%) и системе (85%).\n\n` +
          `<i>Для изменения этого процента обратитесь к администратору.</i>`,
          keyboard,
          { parseMode: 'HTML' }
        );
      } catch (error) {
        logError('settings_commission', error, { chatId });
        await sendTelegramMessage(env.TOKEN_PARTNER, chatId, '❌ Ошибка при получении информации о комиссии.');
        await handleSettingsMenu(env, chatId);
      }
      return { success: true, handled: true };
    }
    
    if (callbackData === 'settings_deals') {
      return await handlePartnershipMenu(env, chatId);
    }
    
    if (callbackData === 'settings_ambassador_commission') {
      try {
        const partner = await getPartnerByChatId(env, chatId);
        const currentPct = (partner?.ambassador_commission_pct ?? 0.10) * 100;
        const keyboard = [
          [{ text: '5%', callback_data: 'amb_commission_5' }, { text: '7%', callback_data: 'amb_commission_7' }, { text: '10%', callback_data: 'amb_commission_10' }, { text: '15%', callback_data: 'amb_commission_15' }],
          [{ text: '⬅️ Назад', callback_data: 'menu_settings' }],
        ];
        await sendTelegramMessageWithKeyboard(
          env.TOKEN_PARTNER,
          chatId,
          `🌟 <b>Комиссия для амбассадоров</b>\n\n` +
          `Текущая ставка: <b>${currentPct.toFixed(0)}%</b>\n\n` +
          `Выберите процент от чека, который платите амбассадорам за привлечённый трафик:`,
          keyboard,
          { parseMode: 'HTML' }
        );
      } catch (error) {
        logError('settings_ambassador_commission', error, { chatId });
        await sendTelegramMessage(env.TOKEN_PARTNER, chatId, '❌ Ошибка.');
        await handleSettingsMenu(env, chatId);
      }
      return { success: true, handled: true };
    }
    
    if (callbackData?.startsWith('amb_commission_')) {
      const pctStr = callbackData.replace('amb_commission_', '');
      const pctNum = parseInt(pctStr, 10);
      if (pctNum >= 1 && pctNum <= 100) {
        const pct = pctNum / 100;
        await updatePartnerAmbassadorCommission(env, chatId, pct);
        await sendTelegramMessage(env.TOKEN_PARTNER, chatId, `✅ Комиссия для амбассадоров установлена: <b>${pctNum}%</b>`, { parseMode: 'HTML' });
        await handleSettingsMenu(env, chatId);
      }
      return { success: true, handled: true };
    }
    
    // ==================== END SETTINGS CALLBACKS ====================
    
    // ==================== OPERATIONS CALLBACKS ====================
    
    if (callbackData === 'menu_add_points') {
      await setBotState(env, chatId, 'awaiting_client_id_issue', {
        partner_chat_id: chatId,
        txn_type: 'accrual'
      });
      
      const frontendUrl = env.FRONTEND_URL || 'https://loyalitybot-frontend.pages.dev';
      const replyKeyboard = [[
        { text: '📷 Сканировать QR', web_app: { url: `${frontendUrl}/qr-scanner.html?op=add` } }
      ]];

      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        '➕ <b>Начисление баллов</b>\n\n' +
        'Введите <b>Chat ID клиента</b> или <b>номер телефона</b>.\n\n' +
        '📷 Или нажмите кнопку ниже для сканирования QR-кода:',
        {
          parseMode: 'HTML',
          reply_markup: {
            keyboard: replyKeyboard,
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        }
      );
      return { success: true, handled: true };
    }

    if (callbackData === 'menu_subtract_points') {
      await setBotState(env, chatId, 'awaiting_client_id_spend', {
        partner_chat_id: chatId,
        txn_type: 'spend'
      });

      const frontendUrl = env.FRONTEND_URL || 'https://loyalitybot-frontend.pages.dev';
      const replyKeyboard = [[
        { text: '📷 Сканировать QR', web_app: { url: `${frontendUrl}/qr-scanner.html?op=sub` } }
      ]];

      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        '➖ <b>Списание баллов</b>\n\n' +
        'Введите <b>Chat ID клиента</b> или <b>номер телефона</b>.\n\n' +
        '📷 Или нажмите кнопку ниже для сканирования QR-кода:',
        {
          parseMode: 'HTML',
          reply_markup: {
            keyboard: replyKeyboard,
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        }
      );
      return { success: true, handled: true };
    }
    
    // Handle currency selection for accrual
    if (callbackData.startsWith('currency_')) {
      const currency = callbackData.replace('currency_', '');
      const botState = await getBotState(env, chatId);
      
      if (!botState || botState.state !== 'awaiting_currency_selection') {
        await answerCallbackQuery(env.TOKEN_PARTNER, callbackQuery.id, '❌ Сессия истекла. Начните заново.');
        return { success: false };
      }
      
      // Get exchange rate for display
      const rate = await getExchangeRate(env, currency);
      const currencySymbols = { USD: '$', VND: '₫', RUB: '₽', KZT: '₸' };
      const symbol = currencySymbols[currency] || currency;
      
      // Update state with selected currency
      await setBotState(env, chatId, 'awaiting_amount', {
        ...botState.data,
        currency: currency,
        exchange_rate: rate
      });
      
      let rateInfo = '';
      if (currency !== 'USD') {
        rateInfo = `\n💱 Курс: 1 USD = ${rate.toLocaleString()} ${currency}`;
      }
      
      await answerCallbackQuery(env.TOKEN_PARTNER, callbackQuery.id);
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        `✅ Валюта: <b>${currency}</b>${rateInfo}\n\n` +
        `Введите <b>сумму чека</b> в ${currency} (${symbol}):`,
        { parseMode: 'HTML' }
      );
      return { success: true, handled: true };
    }
    
    if (callbackData === 'menu_queue') {
      return await handleOperationsQueue(env, chatId);
    }
    
    if (callbackData === 'menu_find_client') {
      await setBotState(env, chatId, 'awaiting_client_search', {
        partner_chat_id: chatId
      });
      
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        '🔍 <b>Поиск клиента</b>\n\n' +
        'Введите <b>Chat ID</b>, <b>номер телефона</b> или <b>имя</b> клиента:',
        { parseMode: 'HTML' }
      );
      return { success: true, handled: true };
    }
    
    if (callbackData === 'menu_stats') {
      return await handlePartnerStats(env, chatId);
    }
    
    if (callbackData === 'menu_dashboard') {
      return await handlePartnerDashboard(env, chatId);
    }
    
    // Handle quick add/subtract from client search
    if (callbackData.startsWith('quick_add_')) {
      const clientId = callbackData.replace('quick_add_', '');
      const client = await findClientByIdOrPhone(env, clientId);
      
      if (!client) {
        await sendTelegramMessage(env.TOKEN_PARTNER, chatId, '❌ Клиент не найден.');
        return { success: false };
      }
      
      // For accrual: show currency selection
      await setBotState(env, chatId, 'awaiting_currency_selection', {
        partner_chat_id: chatId,
        client_id: clientId,
        client_name: client.name || client.username || 'Клиент',
        current_balance: client.balance || 0,
        txn_type: 'accrual'
      });
      
      const currencyKeyboard = {
        inline_keyboard: [
          [
            { text: '🇺🇸 USD', callback_data: 'currency_USD' },
            { text: '🇻🇳 VND', callback_data: 'currency_VND' },
          ],
          [
            { text: '🇷🇺 RUB', callback_data: 'currency_RUB' },
            { text: '🇰🇿 KZT', callback_data: 'currency_KZT' },
          ],
        ],
      };
      
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        `➕ <b>Начисление баллов</b>\n\n` +
        `👤 Клиент: ${client.name || client.username || 'Клиент'}\n` +
        `💰 Баланс: <b>${client.balance || 0}</b> баллов\n\n` +
        `💱 Выберите валюту чека:`,
        { parseMode: 'HTML', reply_markup: currencyKeyboard }
      );
      return { success: true, handled: true };
    }
    
    if (callbackData.startsWith('quick_sub_')) {
      const clientId = callbackData.replace('quick_sub_', '');
      const client = await findClientByIdOrPhone(env, clientId);
      
      if (!client) {
        await sendTelegramMessage(env.TOKEN_PARTNER, chatId, '❌ Клиент не найден.');
        return { success: false };
      }
      
      await setBotState(env, chatId, 'awaiting_amount', {
        partner_chat_id: chatId,
        client_id: clientId,
        client_name: client.name || client.username || 'Клиент',
        current_balance: client.balance || 0,
        txn_type: 'spend',
        currency: 'USD'
      });
      
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        `➖ <b>Списание баллов</b>\n\n` +
        `👤 Клиент: ${client.name || client.username || 'Клиент'}\n` +
        `💰 Баланс: <b>${client.balance || 0}</b> баллов\n\n` +
        `Введите <b>количество баллов</b> для списания:`,
        { parseMode: 'HTML' }
      );
      return { success: true, handled: true };
    }
    
    // ==================== END OPERATIONS CALLBACKS ====================
    
    // Add more callback handlers here as needed
    // For now, just acknowledge
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      `Функция "${callbackData}" будет доступна в ближайшее время.`
    );
    
    return { success: true, handled: false };
  } catch (error) {
    console.error('[handleCallback] ERROR caught:', error);
    console.error('[handleCallback] Error stack:', error.stack);
    logError('handleCallback (partner)', error, { chatId, callbackData });
    
    // Try to send error message to user
    try {
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        '❌ Произошла ошибка при обработке запроса. Попробуйте позже.'
      );
    } catch (sendError) {
      console.error('[handleCallback] Failed to send error message:', sendError);
    }
    
    throw error;
  }
}

/**
 * Handle registration button
 */
export async function handleRegistration(env, update) {
  const message = update.message;
  const chatId = String(message.chat.id);
  
  try {
    // For now, redirect to registration
    // Full registration logic can be added later
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      '🚀 **Регистрация партнера**\n\n' +
      'Для регистрации в качестве партнера, пожалуйста, заполните заявку через веб-интерфейс:\n\n' +
      `🔗 ${env.FRONTEND_URL || 'https://loyalitybot-frontend.pages.dev'}/partner/apply`
    );
    
    return { success: true };
  } catch (error) {
    logError('handleRegistration', error, { chatId });
    throw error;
  }
}

/**
 * Route update to appropriate handler
 */
export async function routeUpdate(env, update) {
  console.log('[routeUpdate] Received update:', {
    hasCallback: !!update.callback_query,
    hasMessage: !!update.message,
    hasWebAppData: !!update.message?.web_app_data,
    callbackData: update.callback_query?.data,
    messageText: update.message?.text,
  });
  
  // Handle callback queries
  if (update.callback_query) {
    console.log('[routeUpdate] Routing to handleCallback');
    return await handleCallback(env, update);
  }
  
  // Handle Web App data (QR scanner result)
  if (update.message?.web_app_data) {
    console.log('[routeUpdate] Routing to handleWebAppData');
    return await handleWebAppData(env, update);
  }
  
  // Handle messages
  if (update.message) {
    const chatId = String(update.message.chat.id);
    const text = update.message.text || '';
    
    // Handle /start command FIRST - always clear state and show menu
    if (text.startsWith('/start') || text.startsWith('/partner_start')) {
      // Clear any active state
      try {
        await clearBotState(env, chatId);
      } catch (clearError) {
        console.error('[routeUpdate] Error clearing state on /start:', clearError);
      }
      return await handleStart(env, update);
    }
    
    // Handle registration button
    if (text === '🚀 Зарегистрироваться') {
      return await handleRegistration(env, update);
    }
    
    // Handle main menu buttons - clear state and process
    const menuButtons = [
      '💰 Операции', '📝 Контент', '📊 Аналитика',
      '💎 Revenue Share', '⚙️ Ещё', '👥  Работа с базой'
    ];
    
    if (menuButtons.includes(text)) {
      // Clear any active state when user clicks menu buttons
      try {
        await clearBotState(env, chatId);
        console.log('[routeUpdate] Cleared state on menu button click');
      } catch (clearError) {
        console.error('[routeUpdate] Error clearing state:', clearError);
      }
      return await handleMenuButton(env, update);
    }
    
    // Check for active state AFTER commands/menu buttons
    const botState = await getBotState(env, chatId);
    if (botState && botState.state.startsWith('replying_to_client_')) {
      // Partner is replying to a client
      return await handlePartnerReplyMessage(env, update, botState);
    }

    if (botState && botState.state === 'replying_to_admin') {
      // Partner is replying to admin
      return await handlePartnerReplyToAdmin(env, update, botState);
    }
    
    if (botState && (
      botState.state.startsWith('awaiting_') || 
      botState.state.startsWith('editing_service_') ||
      botState.state.startsWith('editing_promo_') ||
      botState.state.startsWith('b2b_')
    )) {
      // User is in a multi-step process, handle state-based message
      return await handleStateBasedMessage(env, update, botState);
    }
    
    // Handle other text messages
    return await handleTextMessage(env, update);
  }
  
  return { success: true, handled: false };
}

/**
 * Handle Web App data (QR scanner result)
 */
export async function handleWebAppData(env, update) {
  const message = update.message;
  const chatId = String(message.chat.id);
  const webAppData = message.web_app_data;
  
  console.log('[handleWebAppData] Received:', { chatId, data: webAppData.data });
  
  try {
    const data = JSON.parse(webAppData.data);
    
    if (data.action === 'client_id' && data.client_id) {
      const clientId = data.client_id;
      const operation = data.operation || 'add';
      const txnType = operation === 'sub' ? 'spend' : 'accrual';
      
      // Find client
      const client = await findClientByIdOrPhone(env, clientId);
      
      if (!client) {
        await sendTelegramMessage(
          env.TOKEN_PARTNER,
          chatId,
          `❌ Клиент с ID <code>${clientId}</code> не найден.`,
          { parseMode: 'HTML' }
        );
        await showPartnerMainMenu(env, chatId);
        return { success: false };
      }
      
      const currentBalance = client.balance || 0;
      
      if (txnType === 'accrual') {
        // For accrual: show currency selection
        await setBotState(env, chatId, 'awaiting_currency_selection', {
          partner_chat_id: chatId,
          client_id: client.chat_id,
          client_name: client.name || client.username || 'Клиент',
          current_balance: currentBalance,
          txn_type: txnType
        });
        
        const currencyKeyboard = {
          inline_keyboard: [
            [
              { text: '🇺🇸 USD', callback_data: 'currency_USD' },
              { text: '🇻🇳 VND', callback_data: 'currency_VND' },
            ],
            [
              { text: '🇷🇺 RUB', callback_data: 'currency_RUB' },
              { text: '🇰🇿 KZT', callback_data: 'currency_KZT' },
            ],
          ],
        };
        
        await sendTelegramMessage(
          env.TOKEN_PARTNER,
          chatId,
          `✅ QR-код распознан!\n\n` +
          `👤 ${client.name || client.username || 'Клиент'}\n` +
          `🆔 ID: <code>${client.chat_id}</code>\n` +
          `💰 Баланс: <b>${currentBalance}</b> баллов\n\n` +
          `💱 Выберите валюту чека:`,
          { parseMode: 'HTML', reply_markup: currencyKeyboard }
        );
      } else {
        // For spend: go directly to amount input
        await setBotState(env, chatId, 'awaiting_amount', {
          partner_chat_id: chatId,
          client_id: client.chat_id,
          client_name: client.name || client.username || 'Клиент',
          current_balance: currentBalance,
          txn_type: txnType,
          currency: 'USD'
        });
        
        await sendTelegramMessage(
          env.TOKEN_PARTNER,
          chatId,
          `✅ QR-код распознан!\n\n` +
          `👤 ${client.name || client.username || 'Клиент'}\n` +
          `🆔 ID: <code>${client.chat_id}</code>\n` +
          `💰 Баланс: <b>${currentBalance}</b> баллов\n\n` +
          `Введите <b>количество баллов</b> для списания:`,
          { parseMode: 'HTML' }
        );
      }
      
      return { success: true, handled: true };
    }
    
    return { success: true, handled: false };
  } catch (error) {
    console.error('[handleWebAppData] Error:', error);
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      '❌ Ошибка при обработке данных из QR-сканера.'
    );
    return { success: false };
  }
}

/**
 * Handle state-based messages (multi-step processes)
 */
export async function handleStateBasedMessage(env, update, botState) {
  const message = update.message;
  const chatId = String(message.chat.id);
  const text = message.text || '';
  const state = botState.state;
  
  console.log('[handleStateBasedMessage] Processing:', { chatId, state, textLength: text.length });
  
  try {
    if (state === 'awaiting_broadcast_message') {
      if (text.trim() === '/cancel') {
        await clearBotState(env, chatId);
        await sendTelegramMessage(env.TOKEN_PARTNER, chatId, '❌ Рассылка отменена.');
        return { success: true, handled: true };
      }
      const trimmed = text.trim();
      if (!trimmed) {
        await sendTelegramMessage(env.TOKEN_PARTNER, chatId, '❌ Введите непустой текст сообщения.');
        return { success: true, handled: true };
      }
      if (trimmed.length > 4096) {
        await sendTelegramMessage(env.TOKEN_PARTNER, chatId, `❌ Сообщение слишком длинное (${trimmed.length} символов). Максимум 4096.`);
        return { success: true, handled: true };
      }
      const { recipients, audienceType, partnerId } = botState.data || {};
      if (!recipients || recipients.length === 0) {
        await clearBotState(env, chatId);
        await sendTelegramMessage(env.TOKEN_PARTNER, chatId, '❌ Данные рассылки устарели. Начните заново.');
        return { success: true, handled: true };
      }
      await setBotState(env, chatId, 'broadcast_preview', {
        recipients,
        audienceType,
        partnerId,
        templateText: trimmed,
      });
      const keyboard = [
        [{ text: `✅ Разослать ${recipients.length} клиентам`, callback_data: 'invite_broadcast_confirm' }],
        [{ text: '❌ Отмена', callback_data: 'invite_broadcast_cancel' }],
      ];
      const previewRaw = trimmed.length > 400 ? trimmed.slice(0, 400) + '...' : trimmed;
      const previewEscaped = previewRaw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      await sendTelegramMessageWithKeyboard(
        env.TOKEN_PARTNER,
        chatId,
        `📢 <b>Рассылка по вашей базе</b>\n\nПолучателей: <b>${recipients.length}</b>\n\n<b>Предпросмотр:</b>\n\n${previewEscaped}`,
        keyboard,
        { parseMode: 'HTML' }
      );
      return { success: true, handled: true };
    }

    if (state === 'b2b_awaiting_target') {
      const targetChatId = text.trim();
      if (!targetChatId) {
        await sendTelegramMessage(env.TOKEN_PARTNER, chatId, '❌ Введите chat_id партнёра.');
        return { success: true, handled: true };
      }
      if (targetChatId === chatId) {
        await sendTelegramMessage(env.TOKEN_PARTNER, chatId, '❌ Нельзя заключить сделку с самим собой.');
        return { success: true, handled: true };
      }
      const targetPartner = await getPartnerByChatId(env, targetChatId);
      if (!targetPartner || targetPartner.status !== 'Approved') {
        await sendTelegramMessage(
          env.TOKEN_PARTNER,
          chatId,
          `❌ Партнёр с chat_id ${targetChatId} не найден или не одобрен.`
        );
        return { success: true, handled: true };
      }
      const existing = await getDealBySourceAndTarget(env, chatId, targetChatId);
      if (existing && (existing.status === 'active' || existing.status === 'pending')) {
        await sendTelegramMessage(
          env.TOKEN_PARTNER,
          chatId,
          `У вас уже есть сделка с этим партнёром (статус: ${existing.status}).`
        );
        await clearBotState(env, chatId);
        return { success: true, handled: true };
      }
      const { cashback, commission } = botState.data;
      const newDeal = await createPartnerDeal(env, {
        source_partner_chat_id: chatId,
        target_partner_chat_id: targetChatId,
        client_cashback_percent: cashback,
        referral_commission_percent: commission,
      });
      await clearBotState(env, chatId);
      if (!newDeal) {
        await sendTelegramMessage(env.TOKEN_PARTNER, chatId, '❌ Не удалось создать сделку.');
        return { success: true, handled: true };
      }
      const targetName = targetPartner.company_name || targetPartner.name || 'Партнёр';
      const sourcePartnerData = await getPartnerByChatId(env, chatId);
      const sourceName = sourcePartnerData?.company_name || sourcePartnerData?.name || 'Партнёр';
      await sendTelegramMessageWithKeyboard(
        env.TOKEN_PARTNER,
        targetChatId,
        `📩 <b>Новое B2B предложение от ${sourceName}!</b>\n\n` +
          `• Кэшбэк клиентам: ${cashback}%\n` +
          `• Комиссия вам: ${commission}%\n\n` +
          `Принять или отклонить?`,
        [
          [
            { text: '✅ Принять', callback_data: `b2b_accept_${newDeal.id}` },
            { text: '❌ Отклонить', callback_data: `b2b_reject_${newDeal.id}` },
          ],
        ],
        { parseMode: 'HTML' }
      );
      await sendTelegramMessageWithKeyboard(
        env.TOKEN_PARTNER,
        chatId,
        `✅ Предложение отправлено партнёру ${targetName}.\nОжидайте ответа.`,
        [[{ text: '⬅️ В меню', callback_data: 'menu_partnership' }]],
        { parseMode: 'HTML' }
      );
      return { success: true, handled: true };
    }

    if (state === 'awaiting_service_title') {
      // Step 1: Title received, move to description
      console.log('[handleStateBasedMessage] Step 1: Title received:', text.trim());
      await updateBotStateData(env, chatId, { title: text.trim() });
      await setBotState(env, chatId, 'awaiting_service_description', {
        ...botState.data,
        title: text.trim(),
      });
      
      console.log('[handleStateBasedMessage] Step 1: Sending step 2 message');
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        '✍️ <b>Создание Услуги (Шаг 2 из 4):</b>\n\n' +
        '2. Введите <b>Описание</b> услуги (подробности, ограничения, как получить):',
        { parseMode: 'HTML' }
      );
      return { success: true, handled: true };
    }
    
    if (state === 'awaiting_service_description') {
      // Step 2: Description received, move to price
      await updateBotStateData(env, chatId, { description: text.trim() });
      await setBotState(env, chatId, 'awaiting_service_price', {
        ...botState.data,
        description: text.trim(),
      });
      
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        '✍️ <b>Создание Услуги (Шаг 3 из 4):</b>\n\n' +
        '3. Введите <b>Стоимость</b> услуги в <b>баллах</b> (целое число, например: 100):',
        { parseMode: 'HTML' }
      );
      return { success: true, handled: true };
    }
    
    if (state === 'awaiting_service_price') {
      // Step 3: Price received, validate and move to category or save
      const price = parseInt(text.trim(), 10);
      
      if (isNaN(price) || price <= 0) {
        await sendTelegramMessage(
          env.TOKEN_PARTNER,
          chatId,
          '❌ Неверный формат. Введите <b>целое число</b> баллов больше нуля.',
          { parseMode: 'HTML' }
        );
        return { success: true, handled: true };
      }
      
      const partner = await getPartnerByChatId(env, chatId);
      const hasBusinessType = partner?.business_type && String(partner.business_type).trim() !== '';
      
      if (hasBusinessType) {
        // Пропускаем шаг 4: сразу сохраняем с category = business_type
        const serviceData = {
          ...botState.data,
          price_points: price,
          category: mapOldCategoryToNew(partner.business_type.trim()),
          is_active: true,
        };
        try {
          const result = await addService(env, serviceData);
          const serviceId = result?.id || (Array.isArray(result) && result[0]?.id) || null;
          await clearBotState(env, chatId);
          await sendTelegramMessage(
            env.TOKEN_PARTNER,
            chatId,
            '✅ <b>Услуга отправлена на модерацию!</b>\n\n' +
            'Администратор рассмотрит вашу заявку и одобрит услугу, после чего она станет доступна клиентам.',
            { parseMode: 'HTML' }
          );
          await notifyAdminsAboutNewService(env, serviceId, serviceData);
          await showPartnerMainMenu(env, chatId);
        } catch (err) {
          try { await clearBotState(env, chatId); } catch (_) {}
          logError('service_create_skip_step4', err, { chatId, serviceData });
          await sendTelegramMessage(
            env.TOKEN_PARTNER,
            chatId,
            '❌ Ошибка при сохранении услуги. Попробуйте позже или обратитесь в поддержку.',
            { parseMode: 'HTML' }
          );
        }
        return { success: true, handled: true };
      }
      
      await updateBotStateData(env, chatId, { price_points: price });
      await setBotState(env, chatId, 'awaiting_service_category', {
        ...botState.data,
        price_points: price,
      });
      
      // Получаем данные партнёра для определения category_group (используем уже загруженные данные)
      const categoryGroup = partner?.category_group || 'beauty';
      
      // Категории по группам бизнеса
      const getCategoriesByGroup = (group) => {
        const categoriesMap = {
          beauty: [
            ['💅', 'nail_care', 'Ногтевой сервис'],
            ['👁️', 'brow_design', 'Коррекция бровей'],
            ['💇‍♀️', 'hair_salon', 'Парикмахерские услуги'],
            ['⚡', 'hair_removal', 'Депиляция'],
            ['✨', 'facial_aesthetics', 'Косметология'],
            ['👀', 'lash_services', 'Наращивание ресниц'],
            ['💆‍♀️', 'massage_therapy', 'Массаж'],
            ['💄', 'makeup_pmu', 'Визаж и перманент'],
            ['🌸', 'body_wellness', 'Телесная терапия'],
            ['🍎', 'nutrition_coaching', 'Нутрициология'],
            ['🧠', 'mindfulness_coaching', 'Ментальное здоровье'],
            ['👗', 'image_consulting', 'Стиль']
          ],
          self_discovery: [
            ['🔮', 'astrology', 'Астрология'],
            ['🔢', 'numerology', 'Нумерология'],
            ['🧠', 'psychology_coaching', 'Психология и коучинг'],
            ['🧘‍♀️', 'meditation_spirituality', 'Медитации и духовные практики']
          ],
          food: [
            ['🍽️', 'restaurant', 'Рестораны'],
            ['☕', 'cafe', 'Кафе и кофейни'],
            ['🚚', 'food_delivery', 'Доставка еды'],
            ['🥖', 'bakery', 'Пекарни'],
            ['🍸', 'bar', 'Бары и пабы']
          ],
          education: [
            ['📚', 'education', 'Образование'],
            ['🌍', 'language_school', 'Языковая школа'],
            ['📝', 'training', 'Тренинги и курсы'],
            ['💻', 'online_education', 'Онлайн-образование']
          ],
          retail: [
            ['🛍️', 'retail', 'Магазины'],
            ['👔', 'fashion', 'Мода и одежда'],
            ['💄', 'cosmetics_shop', 'Косметика'],
            ['📱', 'electronics', 'Электроника'],
            ['🎁', 'gift_shop', 'Подарки']
          ],
          sports_fitness: [
            ['🏃‍♀️', 'fitness', 'Фитнес'],
            ['🧘‍♀️', 'yoga', 'Йога'],
            ['⚽', 'sports', 'Спорт'],
            ['🏊', 'swimming', 'Плавание']
          ],
          entertainment: [
            ['🎉', 'entertainment', 'Развлечения'],
            ['🎬', 'cinema', 'Кино'],
            ['🎭', 'events', 'Мероприятия'],
            ['🎮', 'gaming', 'Игры'],
            ['🎵', 'music', 'Музыка']
          ],
          healthcare: [
            ['🏥', 'healthcare', 'Здравоохранение'],
            ['🦷', 'dental', 'Стоматология'],
            ['🐾', 'veterinary', 'Ветеринария'],
            ['💊', 'pharmacy', 'Аптека']
          ],
          services: [
            ['🧹', 'cleaning', 'Уборка и клининг'],
            ['🔧', 'repair', 'Ремонт'],
            ['📷', 'photography', 'Фотография'],
            ['⚖️', 'legal', 'Юридические услуги'],
            ['📊', 'accounting', 'Бухгалтерия']
          ],
          travel: [
            ['✈️', 'travel', 'Путешествия'],
            ['🏨', 'hotel', 'Отели'],
            ['🗺️', 'tours', 'Туры']
          ],
          automotive: [
            ['🔧', 'car_service', 'Автосервис'],
            ['🚗', 'car_rental', 'Аренда авто'],
            ['🐶', 'pet_services', 'Услуги для животных']
          ],
          influencer: [
            ['💄', 'beauty_influencer', 'Бьюти-блогер'],
            ['🍔', 'food_influencer', 'Фуд-блогер'],
            ['📸', 'lifestyle_influencer', 'Лайфстайл'],
            ['👗', 'fashion_influencer', 'Фэшн-блогер'],
            ['✈️', 'travel_influencer', 'Тревел-блогер']
          ],
          b2b: [
            ['💼', 'consulting', 'Консалтинг'],
            ['📣', 'marketing_agency', 'Маркетинг и реклама'],
            ['💻', 'it_services', 'IT-услуги'],
            ['👥', 'hr_services', 'HR и рекрутинг'],
            ['🚛', 'logistics', 'Логистика'],
            ['🏢', 'coworking', 'Коворкинг'],
            ['🎓', 'business_training', 'Бизнес-обучение'],
            ['🎪', 'event_management', 'Организация мероприятий'],
            ['⚖️', 'legal', 'Юридические услуги'],
            ['📊', 'accounting', 'Бухгалтерия']
          ]
        };
        return categoriesMap[group] || categoriesMap.beauty;
      };
      
      const categories = getCategoriesByGroup(categoryGroup);
      
      const keyboard = [];
      for (let i = 0; i < categories.length; i += 2) {
        const row = [];
        for (let j = 0; j < 2 && i + j < categories.length; j++) {
          const [emoji, key, name] = categories[i + j];
          row.push({ text: `${emoji} ${name}`, callback_data: `service_category_${key}` });
        }
        keyboard.push(row);
      }
      
      await sendTelegramMessageWithKeyboard(
        env.TOKEN_PARTNER,
        chatId,
        '✍️ <b>Создание Услуги (Шаг 4 из 4):</b>\n\n' +
        '4. Выберите <b>Категорию</b> услуги:',
        keyboard,
        { parseMode: 'HTML' }
      );
      return { success: true, handled: true };
    }
    
    // Handle service editing states
    if (state.startsWith('editing_service_')) {
      const field = state.replace('editing_service_', '');
      const serviceId = botState.data?.service_id;
      
      if (!serviceId) {
        await clearBotState(env, chatId);
        await sendTelegramMessage(
          env.TOKEN_PARTNER,
          chatId,
          '❌ Ошибка сессии. Попробуйте начать редактирование снова.'
        );
        return { success: false };
      }
      
      let updateData = {};
      
      if (field === 'title') {
        updateData.title = text.trim();
      } else if (field === 'description') {
        updateData.description = text.trim();
      } else if (field === 'price') {
        const price = parseInt(text.trim(), 10);
        if (isNaN(price) || price <= 0) {
          await sendTelegramMessage(
            env.TOKEN_PARTNER,
            chatId,
            '❌ Неверный формат. Введите <b>целое число</b> баллов больше нуля.',
            { parseMode: 'HTML' }
          );
          return { success: true, handled: true };
        }
        updateData.price_points = price;
      }
      
      try {
        // After editing, service goes back to Pending for re-moderation
        updateData.approval_status = 'Pending';
        
        await updateService(env, serviceId, updateData);
        
        // Get updated service data and notify admins
        const updatedService = await getServiceById(env, serviceId);
        if (updatedService) {
          await notifyAdminsAboutNewService(env, serviceId, updatedService);
        }
        
        await clearBotState(env, chatId);
        
        await sendTelegramMessage(
          env.TOKEN_PARTNER,
          chatId,
          '✅ <b>Услуга обновлена!</b>\n\n' +
          'Услуга отправлена на повторную модерацию.',
          { parseMode: 'HTML' }
        );
        
        await handleServicesMenu(env, chatId);
        return { success: true, handled: true };
      } catch (error) {
        console.error('[handleStateBasedMessage] Edit error:', error);
        await clearBotState(env, chatId);
        await sendTelegramMessage(
          env.TOKEN_PARTNER,
          chatId,
          '❌ Ошибка при обновлении услуги.'
        );
        return { success: false };
      }
    }
    
    // ==================== PROMOTION CREATION STATES ====================
    
    if (state === 'awaiting_promo_tier' || state === 'awaiting_promo_visibility') {
      await sendTelegramMessage(env.TOKEN_PARTNER, chatId, '👆 Выберите вариант кнопкой выше.');
      return { success: true, handled: true };
    }
    
    if (state === 'awaiting_promo_title') {
      console.log('[handleStateBasedMessage] Promo Step 1: Title received:', text.trim());
      await setBotState(env, chatId, 'awaiting_promo_description', {
        ...botState.data,
        title: text.trim(),
      });
      
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        '✍️ <b>Создание акции (Шаг 2 из 4):</b>\n\n' +
        '2. Введите <b>Описание</b> акции:',
        { parseMode: 'HTML' }
      );
      return { success: true, handled: true };
    }
    
    if (state === 'awaiting_promo_description') {
      console.log('[handleStateBasedMessage] Promo Step 2: Description received');
      await setBotState(env, chatId, 'awaiting_promo_discount', {
        ...botState.data,
        description: text.trim(),
      });
      
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        '✍️ <b>Создание акции (Шаг 3 из 4):</b>\n\n' +
        '3. Введите <b>Скидку или стоимость</b>:\n\n' +
        'Например: "50%", "500 баллов", "Оплата баллами"',
        { parseMode: 'HTML' }
      );
      return { success: true, handled: true };
    }
    
    if (state === 'awaiting_promo_discount') {
      console.log('[handleStateBasedMessage] Promo Step 3: Discount received');
      await setBotState(env, chatId, 'awaiting_promo_end_date', {
        ...botState.data,
        discount_value: text.trim(),
      });
      
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        '✍️ <b>Создание акции (Шаг 4 из 4):</b>\n\n' +
        '4. Введите <b>Дату окончания</b> акции:\n\n' +
        'Формат: ДД.ММ.ГГГГ (например: 31.12.2026)',
        { parseMode: 'HTML' }
      );
      return { success: true, handled: true };
    }
    
    if (state === 'awaiting_promo_end_date') {
      console.log('[handleStateBasedMessage] Promo Step 4: End date received');
      
      // Parse date
      const dateText = text.trim();
      let endDate = null;
      
      // Try DD.MM.YYYY format
      const ddmmyyyy = dateText.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      if (ddmmyyyy) {
        const [, day, month, year] = ddmmyyyy;
        endDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      
      // Try YYYY-MM-DD format
      const yyyymmdd = dateText.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (yyyymmdd) {
        endDate = dateText;
      }
      
      if (!endDate) {
        await sendTelegramMessage(
          env.TOKEN_PARTNER,
          chatId,
          '❌ Неверный формат даты.\n\nВведите дату в формате <b>ДД.ММ.ГГГГ</b> (например: 31.12.2026)',
          { parseMode: 'HTML' }
        );
        return { success: true, handled: true };
      }
      
      // Step 5: tier selection (inline keyboard)
      await setBotState(env, chatId, 'awaiting_promo_tier', {
        ...botState.data,
        end_date: endDate,
        date_text: dateText,
      });
      
      const tierKeyboard = [
        [{ text: '🏅 Все уровни', callback_data: 'promo_tier_all' }],
        [{ text: '🥈 Silver+', callback_data: 'promo_tier_silver' }, { text: '🥇 Gold+', callback_data: 'promo_tier_gold' }],
        [{ text: '💎 Platinum+', callback_data: 'promo_tier_platinum' }, { text: '💎 Diamond', callback_data: 'promo_tier_diamond' }],
      ];
      
      await sendTelegramMessageWithKeyboard(
        env.TOKEN_PARTNER,
        chatId,
        '✍️ <b>Создание акции (Шаг 5 из 6):</b>\n\n' +
        '5. Выберите минимальный уровень клиента для акции:',
        tierKeyboard,
        { parseMode: 'HTML' }
      );
      return { success: true, handled: true };
    }
    
    // ==================== PROMOTION EDITING STATES ====================
    
    if (state.startsWith('editing_promo_')) {
      const field = state.replace('editing_promo_', '');
      const promotionId = botState.data?.promotion_id;
      
      if (!promotionId) {
        await clearBotState(env, chatId);
        await sendTelegramMessage(
          env.TOKEN_PARTNER,
          chatId,
          '❌ Ошибка сессии. Попробуйте начать редактирование снова.'
        );
        return { success: false };
      }
      
      let updateData = {};
      
      if (field === 'title') {
        updateData.title = text.trim();
      } else if (field === 'description') {
        updateData.description = text.trim();
      } else if (field === 'discount') {
        updateData.discount_value = text.trim();
      } else if (field === 'end_date') {
        const dateText = text.trim();
        let endDate = null;
        
        const ddmmyyyy = dateText.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        if (ddmmyyyy) {
          const [, day, month, year] = ddmmyyyy;
          endDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        
        const yyyymmdd = dateText.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (yyyymmdd) {
          endDate = dateText;
        }
        
        if (!endDate) {
          await sendTelegramMessage(
            env.TOKEN_PARTNER,
            chatId,
            '❌ Неверный формат даты.\n\nВведите дату в формате <b>ДД.ММ.ГГГГ</b>',
            { parseMode: 'HTML' }
          );
          return { success: true, handled: true };
        }
        
        updateData.end_date = endDate;
      }
      
      try {
        await updatePromotion(env, promotionId, updateData);
        await clearBotState(env, chatId);
        
        await sendTelegramMessage(
          env.TOKEN_PARTNER,
          chatId,
          '✅ <b>Акция обновлена!</b>',
          { parseMode: 'HTML' }
        );
        
        await handlePromotionView(env, chatId, promotionId);
        return { success: true, handled: true };
      } catch (error) {
        console.error('[handleStateBasedMessage] Promo edit error:', error);
        await clearBotState(env, chatId);
        await sendTelegramMessage(
          env.TOKEN_PARTNER,
          chatId,
          '❌ Ошибка при обновлении акции.'
        );
        return { success: false };
      }
    }
    
    // ==================== END PROMOTION STATES ====================
    
    // ==================== TRANSACTION STATES ====================
    
    if (state === 'awaiting_client_id_issue' || state === 'awaiting_client_id_spend') {
      const clientIdInput = text.trim();
      const txnType = state === 'awaiting_client_id_issue' ? 'accrual' : 'spend';
      
      // Validate client ID (numeric chat_id or phone number)
      let clientId = clientIdInput;
      
      // Try to find client by chat_id or phone
      const client = await findClientByIdOrPhone(env, clientIdInput);
      
      if (!client) {
        await sendTelegramMessage(
          env.TOKEN_PARTNER,
          chatId,
          '❌ Клиент с таким ID или телефоном не найден.\n\n' +
          'Попробуйте еще раз или нажмите 💰 Операции для возврата в меню.',
          { parseMode: 'HTML' }
        );
        return { success: true, handled: true };
      }
      
      clientId = client.chat_id;
      const currentBalance = client.balance || 0;
      
      if (txnType === 'accrual') {
        // For accrual: show currency selection
        await setBotState(env, chatId, 'awaiting_currency_selection', {
          ...botState.data,
          client_id: clientId,
          client_name: client.name || client.username || 'Клиент',
          current_balance: currentBalance,
          txn_type: txnType
        });
        
        const currencyKeyboard = {
          inline_keyboard: [
            [
              { text: '🇺🇸 USD', callback_data: 'currency_USD' },
              { text: '🇻🇳 VND', callback_data: 'currency_VND' },
            ],
            [
              { text: '🇷🇺 RUB', callback_data: 'currency_RUB' },
              { text: '🇰🇿 KZT', callback_data: 'currency_KZT' },
            ],
          ],
        };
        
        await sendTelegramMessage(
          env.TOKEN_PARTNER,
          chatId,
          `✅ Клиент найден!\n\n` +
          `👤 ${client.name || client.username || 'Клиент'}\n` +
          `🆔 ID: <code>${clientId}</code>\n` +
          `💰 Баланс: <b>${currentBalance}</b> баллов\n\n` +
          `💱 Выберите валюту чека:`,
          { parseMode: 'HTML', reply_markup: currencyKeyboard }
        );
      } else {
        // For spend: go directly to amount input (in points)
        await setBotState(env, chatId, 'awaiting_amount', {
          ...botState.data,
          client_id: clientId,
          client_name: client.name || client.username || 'Клиент',
          current_balance: currentBalance,
          txn_type: txnType,
          currency: 'USD' // Not used for spend, but for consistency
        });
        
        await sendTelegramMessage(
          env.TOKEN_PARTNER,
          chatId,
          `✅ Клиент найден!\n\n` +
          `👤 ${client.name || client.username || 'Клиент'}\n` +
          `🆔 ID: <code>${clientId}</code>\n` +
          `💰 Баланс: <b>${currentBalance}</b> баллов\n\n` +
          `Введите <b>количество баллов</b> для списания:`,
          { parseMode: 'HTML' }
        );
      }
      return { success: true, handled: true };
    }
    
    if (state === 'awaiting_amount') {
      const amountText = text.trim().replace(',', '.');
      const amount = parseFloat(amountText);
      
      if (isNaN(amount) || amount <= 0) {
        await sendTelegramMessage(
          env.TOKEN_PARTNER,
          chatId,
          '❌ Неверный формат суммы. Введите корректное число больше нуля.',
          { parseMode: 'HTML' }
        );
        return { success: true, handled: true };
      }
      
      const clientId = botState.data?.client_id;
      const txnType = botState.data?.txn_type || 'accrual';
      const currentBalance = botState.data?.current_balance || 0;
      const currency = botState.data?.currency || 'USD';
      
      if (!clientId) {
        await clearBotState(env, chatId);
        await sendTelegramMessage(
          env.TOKEN_PARTNER,
          chatId,
          '❌ Ошибка сессии. Начните операцию заново через меню 💰 Операции.'
        );
        return { success: false };
      }
      
      // For spend operation, check if client has enough balance
      if (txnType === 'spend' && amount > currentBalance) {
        await sendTelegramMessage(
          env.TOKEN_PARTNER,
          chatId,
          `❌ Недостаточно баллов!\n\n` +
          `Баланс клиента: <b>${currentBalance}</b> баллов\n` +
          `Запрошено: <b>${amount}</b> баллов\n\n` +
          `Введите меньшую сумму:`,
          { parseMode: 'HTML' }
        );
        return { success: true, handled: true };
      }
      
      // Execute transaction
      try {
        // For accrual: convert amount to USD before processing
        let amountUSD = amount;
        if (txnType === 'accrual' && currency !== 'USD') {
          amountUSD = await convertToUSD(env, amount, currency);
        }
        
        const result = await executeTransaction(env, clientId, chatId, txnType, amountUSD);
        await clearBotState(env, chatId);
        
        if (result.success) {
          const currencySymbols = { USD: '$', VND: '₫', RUB: '₽', KZT: '₸' };
          const symbol = currencySymbols[currency] || currency;
          const displayAmount = Number.isInteger(amount) ? amount.toLocaleString() : amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
          let msg = '';
          
          if (txnType === 'accrual') {
            let conversionInfo = '';
            if (currency !== 'USD') {
              conversionInfo = `\n💱 Конвертация: ${displayAmount} ${symbol} → ${amountUSD.toFixed(2)} $`;
            }
            msg = `✅ <b>Баллы начислены!</b>\n\n` +
              `➕ Начислено: <b>${result.points || 0}</b> баллов\n` +
              `💵 Сумма чека: ${displayAmount} ${symbol}${conversionInfo}\n` +
              `💰 Новый баланс: <b>${result.new_balance}</b> баллов`;
          } else {
            const displayAmountSpend = Number.isInteger(amount) ? amount : amount.toFixed(2);
            msg = `✅ <b>Баллы списаны!</b>\n\n` +
              `➖ Списано: <b>${displayAmountSpend}</b> баллов\n` +
              `💰 Новый баланс: <b>${result.new_balance}</b> баллов`;
          }
          
          await sendTelegramMessage(
            env.TOKEN_PARTNER,
            chatId,
            msg,
            { parseMode: 'HTML' }
          );
        } else {
          await sendTelegramMessage(
            env.TOKEN_PARTNER,
            chatId,
            `❌ Ошибка транзакции: ${result.error || 'Неизвестная ошибка'}`,
            { parseMode: 'HTML' }
          );
        }
      } catch (error) {
        console.error('[handleStateBasedMessage] Transaction error:', error);
        await clearBotState(env, chatId);
        await sendTelegramMessage(
          env.TOKEN_PARTNER,
          chatId,
          '❌ Ошибка при выполнении транзакции. Попробуйте позже.'
        );
      }
      
      await showPartnerMainMenu(env, chatId);
      return { success: true, handled: true };
    }
    
    if (state === 'awaiting_client_search') {
      const searchQuery = text.trim();
      
      const client = await findClientByIdOrPhone(env, searchQuery);
      await clearBotState(env, chatId);
      
      if (!client) {
        await sendTelegramMessage(
          env.TOKEN_PARTNER,
          chatId,
          `🔍 Клиент не найден по запросу: <code>${searchQuery}</code>`,
          { parseMode: 'HTML' }
        );
      } else {
        const keyboard = [[
          { text: '➕ Начислить', callback_data: `quick_add_${client.chat_id}` },
          { text: '➖ Списать', callback_data: `quick_sub_${client.chat_id}` }
        ]];
        
        await sendTelegramMessageWithKeyboard(
          env.TOKEN_PARTNER,
          chatId,
          `👤 <b>Клиент найден:</b>\n\n` +
          `🆔 ID: <code>${client.chat_id}</code>\n` +
          `📛 Имя: ${client.name || client.username || '—'}\n` +
          `📱 Телефон: ${client.phone || '—'}\n` +
          `💰 Баланс: <b>${client.balance || 0}</b> баллов`,
          keyboard,
          { parseMode: 'HTML' }
        );
        return { success: true, handled: true };
      }
      
      await showPartnerMainMenu(env, chatId);
      return { success: true, handled: true };
    }
    
    // ==================== END TRANSACTION STATES ====================
    
    // ==================== SETTINGS EDIT STATES ====================
    
    if (state === 'awaiting_edit_name') {
      const newName = text.trim();
      await clearBotState(env, chatId);

      if (newName.length < 2) {
        await setBotState(env, chatId, 'awaiting_edit_name', { partner_chat_id: chatId });
        await sendTelegramMessage(
          env.TOKEN_PARTNER, chatId,
          '❌ Имя слишком короткое. Введите имя ещё раз:'
        );
        return { success: true, handled: true };
      }

      try {
        await supabaseRequest(env, `partners?chat_id=eq.${chatId}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: newName }),
        });
        await sendTelegramMessage(
          env.TOKEN_PARTNER, chatId,
          `✅ Имя успешно обновлено на: <b>${newName}</b>`,
          { parseMode: 'HTML' }
        );
      } catch (error) {
        logError('edit_name', error, { chatId });
        await sendTelegramMessage(env.TOKEN_PARTNER, chatId, '❌ Ошибка при обновлении имени. Попробуйте позже.');
      }
      await handleSettingsMenu(env, chatId);
      return { success: true, handled: true };
    }

    if (state === 'awaiting_edit_company') {
      const newCompany = text.trim();
      await clearBotState(env, chatId);

      if (newCompany.length < 2) {
        await setBotState(env, chatId, 'awaiting_edit_company', { partner_chat_id: chatId });
        await sendTelegramMessage(
          env.TOKEN_PARTNER, chatId,
          '❌ Название компании слишком короткое. Введите название ещё раз:'
        );
        return { success: true, handled: true };
      }

      try {
        await supabaseRequest(env, `partners?chat_id=eq.${chatId}`, {
          method: 'PATCH',
          body: JSON.stringify({ company_name: newCompany }),
        });
        await sendTelegramMessage(
          env.TOKEN_PARTNER, chatId,
          `✅ Название компании обновлено на: <b>${newCompany}</b>`,
          { parseMode: 'HTML' }
        );
      } catch (error) {
        logError('edit_company', error, { chatId });
        await sendTelegramMessage(env.TOKEN_PARTNER, chatId, '❌ Ошибка при обновлении названия компании. Попробуйте позже.');
      }
      await handleSettingsMenu(env, chatId);
      return { success: true, handled: true };
    }

    if (state === 'awaiting_edit_phone') {
      const newPhone = text.trim();
      await clearBotState(env, chatId);
      const digits = newPhone.replace(/\D/g, '');

      if (digits.length < 10) {
        await setBotState(env, chatId, 'awaiting_edit_phone', { partner_chat_id: chatId });
        await sendTelegramMessage(
          env.TOKEN_PARTNER, chatId,
          '❌ Номер телефона слишком короткий. Введите корректный номер телефона:'
        );
        return { success: true, handled: true };
      }

      try {
        await supabaseRequest(env, `partners?chat_id=eq.${chatId}`, {
          method: 'PATCH',
          body: JSON.stringify({ phone: newPhone }),
        });
        await sendTelegramMessage(
          env.TOKEN_PARTNER, chatId,
          `✅ Номер телефона обновлён на: <b>${newPhone}</b>`,
          { parseMode: 'HTML' }
        );
      } catch (error) {
        logError('edit_phone', error, { chatId });
        await sendTelegramMessage(env.TOKEN_PARTNER, chatId, '❌ Ошибка при обновлении номера телефона. Попробуйте позже.');
      }
      await handleSettingsMenu(env, chatId);
      return { success: true, handled: true };
    }

    if (state === 'awaiting_edit_booking_url') {
      const input = text.trim();
      await clearBotState(env, chatId);

      const shouldDelete = ['удалить', 'delete', 'нет', 'no', ''].includes(input.toLowerCase());

      if (!shouldDelete && !input.startsWith('http://') && !input.startsWith('https://')) {
        await setBotState(env, chatId, 'awaiting_edit_booking_url', { partner_chat_id: chatId });
        await sendTelegramMessage(
          env.TOKEN_PARTNER, chatId,
          '❌ Ссылка должна начинаться с http:// или https://. Введите корректную ссылку (или отправьте "удалить" для удаления):'
        );
        return { success: true, handled: true };
      }

      try {
        const newUrl = shouldDelete ? null : input;
        await supabaseRequest(env, `partners?chat_id=eq.${chatId}`, {
          method: 'PATCH',
          body: JSON.stringify({ booking_url: newUrl }),
        });
        if (newUrl) {
          await sendTelegramMessage(
            env.TOKEN_PARTNER, chatId,
            `✅ Ссылка на бронирование обновлена на: <b>${newUrl}</b>`,
            { parseMode: 'HTML' }
          );
        } else {
          await sendTelegramMessage(env.TOKEN_PARTNER, chatId, '✅ Ссылка на бронирование успешно удалена.');
        }
      } catch (error) {
        logError('edit_booking_url', error, { chatId });
        await sendTelegramMessage(env.TOKEN_PARTNER, chatId, '❌ Ошибка при обновлении ссылки на бронирование. Попробуйте позже.');
      }
      await handleSettingsMenu(env, chatId);
      return { success: true, handled: true };
    }
    
    // ==================== END SETTINGS EDIT STATES ====================
    
    return { success: true, handled: false };
  } catch (error) {
    logError('handleStateBasedMessage', error, { chatId, state });
    throw error;
  }
}

/**
 * Notify admins about new service for moderation
 */
async function notifyAdminsAboutNewService(env, serviceId, serviceData) {
  try {
    // Check if admin bot token and admin chat IDs are configured
    if (!env.ADMIN_BOT_TOKEN || !env.ADMIN_CHAT_ID) {
      console.log('[notifyAdminsAboutNewService] ADMIN_BOT_TOKEN or ADMIN_CHAT_ID not configured, skipping notification');
      return;
    }
    
    // Get admin IDs (can be comma-separated)
    const adminIds = env.ADMIN_CHAT_ID.split(',').map(id => id.trim()).filter(Boolean);
    
    if (adminIds.length === 0) {
      console.log('[notifyAdminsAboutNewService] No admin IDs found');
      return;
    }
    
    // Prepare message
    const messageText = (
      `🆕 <b>Новая Услуга на Модерации (ID: ${serviceId || 'N/A'})</b>\n\n` +
      `🤝 Партнер ID: ${serviceData.partner_chat_id || '—'}\n` +
      `💎 Название: ${serviceData.title || '—'}\n` +
      `💵 Стоимость: ${serviceData.price_points || 0} баллов\n` +
      `📝 Описание: ${(serviceData.description || '—').substring(0, 50)}...`
    );
    
    // Create keyboard with approve/reject buttons
    const keyboard = [[
      { text: '🟢 Одобрить', callback_data: `service_approve_${serviceId || ''}` },
      { text: '🔴 Отклонить', callback_data: `service_reject_${serviceId || ''}` }
    ]];
    
    // Send notification to all admins
    for (const adminId of adminIds) {
      try {
        await sendTelegramMessageWithKeyboard(
          env.ADMIN_BOT_TOKEN,
          adminId,
          messageText,
          keyboard,
          { parseMode: 'HTML' }
        );
        console.log(`[notifyAdminsAboutNewService] Notification sent to admin ${adminId} for service ${serviceId}`);
      } catch (error) {
        console.error(`[notifyAdminsAboutNewService] Error sending notification to admin ${adminId}:`, error);
        logError('notifyAdminsAboutNewService', error, { adminId, serviceId });
      }
    }
  } catch (error) {
    console.error('[notifyAdminsAboutNewService] Error:', error);
    logError('notifyAdminsAboutNewService', error, { serviceId, serviceData });
    // Don't throw - notification failure shouldn't break service creation
  }
}

/**
 * Handle service category selection (final step)
 */
export async function handleServiceCategorySelection(env, chatId, category) {
  try {
    const botState = await getBotState(env, chatId);
    
    if (!botState || botState.state !== 'awaiting_service_category') {
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        '❌ Ошибка сессии. Попробуйте начать снова: 📝 Контент → 🛠️ Услуги → ➕ Добавить новую услугу'
      );
      return { success: false };
    }
    
    // Преобразуем старый код в новый (если нужно)
    const canonicalCategory = mapOldCategoryToNew(category);
    
    // Получаем данные партнёра для проверки business_type и category_group
    const partner = await getPartnerByChatId(env, chatId);
    
    // Используем business_type партнёра, если установлен, иначе выбранную категорию
    // Для мультикатегорий: если у партнера есть категории в partner_categories, используем их
    let finalCategory = canonicalCategory;
    
    // Проверяем мультикатегории партнера
    try {
      const categoriesResult = await supabaseRequest(env, `partner_categories?partner_chat_id=eq.${chatId}&select=business_type,is_primary&order=is_primary.desc`);
      if (categoriesResult && categoriesResult.length > 0) {
        // Используем основную категорию партнера
        const primaryCategory = categoriesResult.find(c => c.is_primary) || categoriesResult[0];
        finalCategory = mapOldCategoryToNew(primaryCategory.business_type);
        console.log(`[handleServiceCategorySelection] Using primary category from partner_categories: ${finalCategory}`);
      } else if (partner?.business_type) {
        // Обратная совместимость: используем business_type из partners
        finalCategory = mapOldCategoryToNew(partner.business_type);
        console.log(`[handleServiceCategorySelection] Using business_type from partners: ${finalCategory}`);
      }
    } catch (error) {
      console.error('[handleServiceCategorySelection] Error fetching partner categories:', error);
      // Fallback на business_type партнера
      if (partner?.business_type) {
        finalCategory = mapOldCategoryToNew(partner.business_type);
      }
    }
    
    // Prepare service data
    const serviceData = {
      ...botState.data,
      category: finalCategory,  // Используем business_type партнёра или выбранную категорию
      is_active: true,
    };
    
    // Save service to database
    try {
      console.log('[handleServiceCategorySelection] Saving service with data:', JSON.stringify(serviceData));
      const result = await addService(env, serviceData);
      console.log('[handleServiceCategorySelection] Service saved successfully:', result);
      
      // Get service ID from result (Supabase returns array with service object)
      const serviceId = result?.id || (Array.isArray(result) && result[0]?.id) || null;
      console.log('[handleServiceCategorySelection] Service ID:', serviceId);
      console.log('[handleServiceCategorySelection] Full result:', JSON.stringify(result));
      
      // Clear state
      await clearBotState(env, chatId);
      
      // Send notification to partner
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        '✅ <b>Услуга отправлена на модерацию!</b>\n\n' +
        'Администратор рассмотрит вашу заявку и одобрит услугу, после чего она станет доступна клиентам.',
        { parseMode: 'HTML' }
      );
      
      // Notify admins about new service
      await notifyAdminsAboutNewService(env, serviceId, serviceData);
      
      // Show main menu
      await showPartnerMainMenu(env, chatId);
      
      return { success: true, handled: true };
    } catch (error) {
      console.error('[handleServiceCategorySelection] Error details:', error);
      logError('handleServiceCategorySelection - addService', error, { chatId, serviceData });
      
      // Clear state even on error to allow retry
      try {
        await clearBotState(env, chatId);
      } catch (clearError) {
        console.error('[handleServiceCategorySelection] Error clearing state:', clearError);
      }
      
      const errorMessage = error.message || 'Неизвестная ошибка';
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        `❌ Ошибка при сохранении услуги.\n\n` +
        `Детали: ${errorMessage}\n\n` +
        `Попробуйте позже или обратитесь в поддержку.`
      );
      return { success: false };
    }
  } catch (error) {
    logError('handleServiceCategorySelection', error, { chatId, category });
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
    // Check partner status
    const partnerStatus = await checkPartnerStatus(env, chatId);
    
    if (!partnerStatus.exists) {
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        '👋 Для начала работы нажмите /start'
      );
      return { success: true };
    }
    
    // Default: show main menu
    if (partnerStatus.status === 'Approved') {
      await showPartnerMainMenu(env, chatId);
    }
    
    return { success: true };
  } catch (error) {
    logError('handleTextMessage (partner)', error, { chatId, text });
    throw error;
  }
}
