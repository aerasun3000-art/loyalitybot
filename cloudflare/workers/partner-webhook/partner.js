/**
 * Partner bot handlers for Cloudflare Workers
 * Handles all partner bot commands and callbacks
 */

import { 
  getPartnerByChatId,
  getUserByChatId,
  supabaseRequest,
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
        [{ text: '👥 Пригласить клиента' }, { text: '⚙️ Ещё' }]
      );
    } else {
      // Standard partner menu
      keyboard.push(
        [{ text: '💰 Операции' }, { text: '📝 Контент' }],
        [{ text: '📊 Аналитика' }, { text: '💎 Revenue Share' }],
        [{ text: '👥 Пригласить клиента' }, { text: '⚙️ Ещё' }]
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
    } else if (text === '👥 Пригласить клиента') {
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
  await sendTelegramMessage(
    env.TOKEN_PARTNER,
    chatId,
    '💎 **Revenue Share**\n\n' +
    'Функционал Revenue Share будет доступен в ближайшее время.'
  );
  return { success: true };
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
 * Handle Invite Client
 */
export async function handleInviteClient(env, chatId) {
  try {
    const partner = await getPartnerByChatId(env, chatId);
    const botUsername = env.BOT_USERNAME || 'your_client_bot_username';
    const referralLink = `https://t.me/${botUsername}?start=partner_${chatId}`;
    
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      `👥 <b>Пригласить клиента</b>\n\n` +
      `Поделитесь этой ссылкой с клиентами:\n\n` +
      `🔗 <a href="${referralLink}">${referralLink}</a>\n\n` +
      `Клиенты, зарегистрированные по этой ссылке, будут привязаны к вам.`,
      { parseMode: 'HTML' }
    );
    
    return { success: true, referralLink };
  } catch (error) {
    logError('handleInviteClient', error, { chatId });
    throw error;
  }
}

/**
 * Handle callback queries
 */
export async function handleCallback(env, update) {
  const callbackQuery = update.callback_query;
  const chatId = String(callbackQuery.message.chat.id);
  const callbackData = callbackQuery.data;
  
  try {
    // Answer callback query first
    await answerCallbackQuery(env.TOKEN_PARTNER, callbackQuery.id);
    
    // Route to appropriate handler
    if (callbackData === 'partner_main_menu') {
      return await showPartnerMainMenu(env, chatId);
    }
    
    // Add more callback handlers here as needed
    // For now, just acknowledge
    await sendTelegramMessage(
      env.TOKEN_PARTNER,
      chatId,
      `Функция "${callbackData}" будет доступна в ближайшее время.`
    );
    
    return { success: true, handled: false };
  } catch (error) {
    logError('handleCallback (partner)', error, { chatId, callbackData });
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
      `🔗 ${env.FRONTEND_URL || 'https://your-frontend-domain.com'}/partner/apply`
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
  // Handle callback queries
  if (update.callback_query) {
    return await handleCallback(env, update);
  }
  
  // Handle messages
  if (update.message) {
    const text = update.message.text || '';
    
    // Handle /start command
    if (text.startsWith('/start') || text.startsWith('/partner_start')) {
      return await handleStart(env, update);
    }
    
    // Handle registration button
    if (text === '🚀 Зарегистрироваться') {
      return await handleRegistration(env, update);
    }
    
    // Handle main menu buttons
    const menuButtons = [
      '💰 Операции', '📝 Контент', '📊 Аналитика',
      '💎 Revenue Share', '⚙️ Ещё', '👥 Пригласить клиента'
    ];
    
    if (menuButtons.includes(text)) {
      return await handleMenuButton(env, update);
    }
    
    // Handle other text messages
    return await handleTextMessage(env, update);
  }
  
  return { success: true, handled: false };
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
