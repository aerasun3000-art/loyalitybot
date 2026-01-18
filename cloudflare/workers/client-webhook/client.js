/**
 * Client bot handlers for Cloudflare Workers
 * Handles all client bot commands and callbacks
 */

import { 
  getUserByChatId, 
  upsertUser, 
  createTransaction,
  getPartnerByChatId 
} from './supabase.js';
import {
  sendTelegramMessage,
  sendTelegramMessageWithKeyboard,
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
 * Handle /start command with referral links
 */
export async function handleStart(env, update) {
  const message = update.message;
  const chatId = String(message.chat.id);
  const userId = String(message.from.id);
  const text = message.text || '';
  
  // Parse referral link: /start partner_123 или /start ref_ABC123
  const referralMatch = text.match(/(?:partner_|ref_)(\d+|[\w\d]+)/i);
  const referralId = referralMatch ? referralMatch[1] : null;
  
  try {
    // Check if user exists
    let user = await getUserByChatId(env, chatId);
    
    if (!user) {
      // Create new user
      const welcomeBonus = parseInt(env.WELCOME_BONUS_AMOUNT || '100');
      
      const userData = {
        chat_id: chatId,
        user_id: userId,
        username: message.from.username || null,
        first_name: message.from.first_name || null,
        last_name: message.from.last_name || null,
        registration_date: new Date().toISOString(),
        balance: welcomeBonus,
        referral_source: referralId ? (text.includes('partner_') ? `partner_${referralId}` : `ref_${referralId}`) : null,
      };
      
      user = await upsertUser(env, userData);
      
      // Send welcome message
      const frontendUrl = env.FRONTEND_URL || 'https://your-frontend-domain.com';
      const keyboard = [[
        { text: '🚀 Открыть приложение', web_app: { url: frontendUrl } },
        { text: '📊 Мой баланс', callback_data: 'balance' }
      ]];
      
      await sendTelegramMessageWithKeyboard(
        env.TOKEN_CLIENT,
        chatId,
        `🎉 **Добро пожаловать в программу лояльности!**\n\n` +
        `✅ Вы получили приветственный бонус: **${welcomeBonus} баллов**\n\n` +
        `💡 **Как использовать:**\n` +
        `• Нажмите кнопку "Открыть приложение" для доступа ко всем функциям\n` +
        `• Получайте баллы за покупки у наших партнеров\n` +
        `• Обменивайте баллы на услуги и акции\n\n` +
        `🚀 Начните прямо сейчас!`,
        keyboard,
        { parseMode: 'HTML' }
      );
      
      return { success: true, newUser: true };
    } else {
      // User already exists
      const frontendUrl = env.FRONTEND_URL || 'https://your-frontend-domain.com';
      const keyboard = [[
        { text: '🚀 Открыть приложение', web_app: { url: frontendUrl } },
        { text: '📊 Мой баланс', callback_data: 'balance' }
      ]];
      
      await sendTelegramMessageWithKeyboard(
        env.TOKEN_CLIENT,
        chatId,
        `👋 С возвращением!\n\n` +
        `Ваш баланс: **${user.balance || 0} баллов**\n\n` +
        `Нажмите кнопку "Открыть приложение" для доступа ко всем функциям.`,
        keyboard,
        { parseMode: 'HTML' }
      );
      
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
    // Answer callback query first
    await answerCallbackQuery(env.TOKEN_CLIENT, callbackQuery.id);
    
    // Get user
    const user = await getUserByChatId(env, chatId);
    if (!user) {
      await editMessageText(
        env.TOKEN_CLIENT,
        chatId,
        callbackQuery.message.message_id,
        '❌ Пользователь не найден. Пожалуйста, зарегистрируйтесь через /start'
      );
      return { success: false };
    }
    
    // Save NPS rating (you'll need to implement this in Supabase)
    // For now, just acknowledge
    await editMessageText(
      env.TOKEN_CLIENT,
      chatId,
      callbackQuery.message.message_id,
      `⭐ Спасибо за вашу оценку: **${rating}**!\n\nВаше мнение помогает нам стать лучше.`,
      { parseMode: 'HTML' }
    );
    
    return { success: true, rating };
  } catch (error) {
    logError('handleNpsRating', error, { chatId, rating });
    throw error;
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
    await sendTelegramMessage(
      env.TOKEN_CLIENT,
      chatId,
      `💰 **Ваш баланс:** ${balance} баллов\n\n` +
      `Используйте баллы для оплаты услуг и акций наших партнеров!`
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
 * Route update to appropriate handler
 */
export async function routeUpdate(env, update) {
  // Handle callback queries
  if (update.callback_query) {
    const callbackData = update.callback_query.data;
    
    if (callbackData.startsWith('nps_rate_')) {
      return await handleNpsRating(env, update);
    }
    
    if (callbackData === 'balance') {
      return await handleBalance(env, update);
    }
    
    // Handle other callbacks...
    return { success: true, handled: false };
  }
  
  // Handle messages
  if (update.message) {
    const text = update.message.text || '';
    
    // Handle /start command
    if (text.startsWith('/start')) {
      return await handleStart(env, update);
    }
    
    // Handle other text messages
    if (text) {
      return await handleTextMessage(env, update);
    }
    
    // Handle other message types (photos, documents, etc.)
    return { success: true, handled: false };
  }
  
  return { success: true, handled: false };
}
