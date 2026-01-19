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
  addService,
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
      // TODO: Implement service status list
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        '🔍 <b>Мои услуги</b>\n\n' +
        'Функция просмотра статуса услуг находится в разработке. Скоро будет доступна!',
        { parseMode: 'HTML' }
      );
      return { success: true, handled: true };
    }
    
    if (callbackData === 'service_edit_list' || callbackData === 'service_delete_list') {
      await sendTelegramMessage(
        env.TOKEN_PARTNER,
        chatId,
        '⏳ Функция редактирования/удаления услуг находится в разработке. Скоро будет доступна!'
      );
      return { success: true, handled: true };
    }
    
    if (callbackData === 'service_back') {
      return await handleServicesMenu(env, chatId);
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
  console.log('[routeUpdate] Received update:', {
    hasCallback: !!update.callback_query,
    hasMessage: !!update.message,
    callbackData: update.callback_query?.data,
    messageText: update.message?.text,
  });
  
  // Handle callback queries
  if (update.callback_query) {
    console.log('[routeUpdate] Routing to handleCallback');
    return await handleCallback(env, update);
  }
  
  // Handle messages
  if (update.message) {
    const chatId = String(update.message.chat.id);
    const text = update.message.text || '';
    
    // Check for active state first (before processing commands)
    const botState = await getBotState(env, chatId);
    if (botState && botState.state.startsWith('awaiting_')) {
      // User is in a multi-step process, handle state-based message
      return await handleStateBasedMessage(env, update, botState);
    }
    
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
      // Clear any active state when user clicks menu buttons
      const botState = await getBotState(env, chatId);
      if (botState && botState.state.startsWith('awaiting_')) {
        console.log('[routeUpdate] Clearing active state on menu button click:', botState.state);
        try {
          await clearBotState(env, chatId);
        } catch (clearError) {
          console.error('[routeUpdate] Error clearing state:', clearError);
        }
      }
      return await handleMenuButton(env, update);
    }
    
    // Handle other text messages
    return await handleTextMessage(env, update);
  }
  
  return { success: true, handled: false };
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
      // Step 3: Price received, validate and move to category selection
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
      
      await updateBotStateData(env, chatId, { price_points: price });
      await setBotState(env, chatId, 'awaiting_service_category', {
        ...botState.data,
        price_points: price,
      });
      
      // Show category selection keyboard
      const categories = [
        ['💅', 'manicure', 'Маникюр'],
        ['💇‍♀️', 'hairstyle', 'Прически'],
        ['💆‍♀️', 'massage', 'Массаж'],
        ['🧴', 'cosmetologist', 'Косметолог'],
        ['✨', 'eyebrows', 'Брови'],
        ['👁️', 'eyelashes', 'Ресницы'],
        ['💫', 'laser', 'Лазерная эпиляция'],
        ['💄', 'makeup', 'Визажист'],
        ['🌸', 'skincare', 'Уход за кожей'],
        ['🧹', 'cleaning', 'Уборка'],
        ['🔧', 'repair', 'Ремонт'],
        ['🚗', 'delivery', 'Доставка'],
        ['🏃‍♀️', 'fitness', 'Фитнес'],
        ['🛁', 'spa', 'SPA'],
        ['🧘‍♀️', 'yoga', 'Йога'],
        ['🥗', 'nutrition', 'Питание'],
        ['🧠', 'psychology', 'Психолог'],
      ];
      
      const keyboard = [];
      // Add buttons in rows of 2
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
    
    // Prepare service data
    const serviceData = {
      ...botState.data,
      category: category,
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
