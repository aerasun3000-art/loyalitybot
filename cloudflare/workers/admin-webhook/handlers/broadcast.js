/**
 * Broadcast (mass messaging) handlers
 */

import { 
  supabaseRequest,
  setBotState,
  clearBotState,
} from '../supabase.js';
import {
  sendTelegramMessage,
  sendTelegramMessageWithKeyboard,
  answerCallbackQuery,
  editMessageText,
} from '../telegram.js';
import {
  logError,
} from '../common.js';
import { getAllApprovedPartners, sendPartnerNotification } from './partners.js';

/**
 * Get distinct cities from partners
 */
async function getDistinctCities(env) {
  try {
    const partners = await getAllApprovedPartners(env);
    const cities = [...new Set(partners.map(p => p.city).filter(c => c && c.trim()))];
    return cities.sort();
  } catch (error) {
    logError('getDistinctCities', error, {});
    return [];
  }
}

/**
 * Get distinct service categories
 */
async function getDistinctCategories(env) {
  try {
    const result = await supabaseRequest(env, 'services?select=category&is_active=eq.true');
    const categories = [...new Set(result.map(s => s.category).filter(c => c && c.trim()))];
    return categories.sort();
  } catch (error) {
    logError('getDistinctCategories', error, {});
    return [];
  }
}

/**
 * Get partners by city
 */
async function getPartnersByCity(env, city) {
  try {
    const partners = await getAllApprovedPartners(env);
    return partners.filter(p => p.city === city && p.chat_id);
  } catch (error) {
    logError('getPartnersByCity', error, { city });
    return [];
  }
}

/**
 * Get partners by category
 */
async function getPartnersByCategory(env, category) {
  try {
    const services = await supabaseRequest(env, `services?category=eq.${encodeURIComponent(category)}&is_active=eq.true&select=partner_chat_id`);
    const partnerChatIds = [...new Set(services.map(s => s.partner_chat_id).filter(id => id))];
    const allPartners = await getAllApprovedPartners(env);
    return allPartners.filter(p => partnerChatIds.includes(p.chat_id));
  } catch (error) {
    logError('getPartnersByCategory', error, { category });
    return [];
  }
}

/**
 * Handle broadcast start
 */
export async function handleBroadcastStart(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  const keyboard = [
    [{ text: '🌍 Все партнёры', callback_data: 'broadcast_all' }],
    [{ text: '🏙 По городу', callback_data: 'broadcast_select_city' }],
    [{ text: '📂 По категории услуг', callback_data: 'broadcast_select_category' }],
    [{ text: '◀️ Назад', callback_data: 'back_to_main' }],
  ];
  
  await editMessageText(
    env.ADMIN_BOT_TOKEN,
    chatId,
    callbackQuery.message.message_id,
    '📢 <b>Массовая рассылка партнёрам</b>\n\nВыберите группу партнёров для рассылки:',
    keyboard,
    { parseMode: 'HTML' }
  );
  
  return { success: true, handled: true, action: 'broadcast_start' };
}

/**
 * Handle broadcast all partners
 */
export async function handleBroadcastAll(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const partners = await getAllApprovedPartners(env);
    const partnerChatIds = partners.map(p => p.chat_id).filter(id => id);
    
    if (partnerChatIds.length === 0) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Нет партнёров для рассылки', show_alert: true });
      return { success: false, handled: true };
    }
    
    await setBotState(env, chatId, 'broadcast_waiting_message', {
      type: 'all',
      partner_chat_ids: partnerChatIds,
    });
    
    const keyboard = [[{ text: '❌ Отмена', callback_data: 'cancel_broadcast' }]];
    
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      `📢 <b>Рассылка всем партнёрам</b>\n\nПартнёров: ${partnerChatIds.length}\n\nВведите сообщение для рассылки:`,
      keyboard,
      { parseMode: 'HTML' }
    );
    
    return { success: true, handled: true, action: 'broadcast_all', count: partnerChatIds.length };
  } catch (error) {
    logError('handleBroadcastAll', error, { chatId });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка', show_alert: true });
    throw error;
  }
}

/**
 * Handle broadcast city selection
 */
export async function handleBroadcastSelectCity(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const cities = await getDistinctCities(env);
    
    if (cities.length === 0) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Нет городов', show_alert: true });
      return { success: false, handled: true };
    }
    
    const keyboard = cities.map(city => {
      const cityBase64 = btoa(encodeURIComponent(city));
      return [{ text: `🏙 ${city}`, callback_data: `broadcast_city_${cityBase64}` }];
    });
    
    keyboard.push([{ text: '◀️ Назад', callback_data: 'admin_broadcast' }]);
    
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      '🏙 <b>Выберите город</b>\n\nВыберите город для рассылки:',
      keyboard,
      { parseMode: 'HTML' }
    );
    
    return { success: true, handled: true, action: 'broadcast_select_city' };
  } catch (error) {
    logError('handleBroadcastSelectCity', error, { chatId });
    throw error;
  }
}

/**
 * Handle broadcast city selected
 */
export async function handleBroadcastCity(env, callbackQuery, cityBase64) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const city = decodeURIComponent(atob(cityBase64));
    const partners = await getPartnersByCity(env, city);
    const partnerChatIds = partners.map(p => p.chat_id).filter(id => id);
    
    if (partnerChatIds.length === 0) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Нет партнёров в этом городе', show_alert: true });
      return { success: false, handled: true };
    }
    
    await setBotState(env, chatId, 'broadcast_waiting_message', {
      type: 'city',
      city: city,
      partner_chat_ids: partnerChatIds,
    });
    
    const keyboard = [[{ text: '❌ Отмена', callback_data: 'cancel_broadcast' }]];
    
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      `📢 <b>Рассылка партнёрам города: ${city}</b>\n\nПартнёров: ${partnerChatIds.length}\n\nВведите сообщение для рассылки:`,
      keyboard,
      { parseMode: 'HTML' }
    );
    
    return { success: true, handled: true, action: 'broadcast_city', city, count: partnerChatIds.length };
  } catch (error) {
    logError('handleBroadcastCity', error, { chatId, cityBase64 });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка', show_alert: true });
    throw error;
  }
}

/**
 * Handle broadcast category selection
 */
export async function handleBroadcastSelectCategory(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const categories = await getDistinctCategories(env);
    
    if (categories.length === 0) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Нет категорий', show_alert: true });
      return { success: false, handled: true };
    }
    
    const keyboard = categories.map(category => {
      return [{ text: `📂 ${category}`, callback_data: `broadcast_category_${encodeURIComponent(category)}` }];
    });
    
    keyboard.push([{ text: '◀️ Назад', callback_data: 'admin_broadcast' }]);
    
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      '📂 <b>Выберите категорию услуг</b>\n\nВыберите категорию для рассылки:',
      keyboard,
      { parseMode: 'HTML' }
    );
    
    return { success: true, handled: true, action: 'broadcast_select_category' };
  } catch (error) {
    logError('handleBroadcastSelectCategory', error, { chatId });
    throw error;
  }
}

/**
 * Handle broadcast category selected
 */
export async function handleBroadcastCategory(env, callbackQuery, category) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const decodedCategory = decodeURIComponent(category);
    const partners = await getPartnersByCategory(env, decodedCategory);
    const partnerChatIds = partners.map(p => p.chat_id).filter(id => id);
    
    if (partnerChatIds.length === 0) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Нет партнёров в этой категории', show_alert: true });
      return { success: false, handled: true };
    }
    
    await setBotState(env, chatId, 'broadcast_waiting_message', {
      type: 'category',
      category: decodedCategory,
      partner_chat_ids: partnerChatIds,
    });
    
    const keyboard = [[{ text: '❌ Отмена', callback_data: 'cancel_broadcast' }]];
    
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      `📢 <b>Рассылка партнёрам категории: ${decodedCategory}</b>\n\nПартнёров: ${partnerChatIds.length}\n\nВведите сообщение для рассылки:`,
      keyboard,
      { parseMode: 'HTML' }
    );
    
    return { success: true, handled: true, action: 'broadcast_category', category: decodedCategory, count: partnerChatIds.length };
  } catch (error) {
    logError('handleBroadcastCategory', error, { chatId, category });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка', show_alert: true });
    throw error;
  }
}

/**
 * Handle broadcast message (FSM state handler)
 */
export async function handleBroadcastMessage(env, update, stateData) {
  const message = update.message;
  const chatId = String(message.chat.id);
  const text = message.text || '';
  
  try {
    if (!text || text.trim().length === 0) {
      await sendTelegramMessage(env.ADMIN_BOT_TOKEN, chatId, 'Сообщение не может быть пустым. Введите сообщение или отмените рассылку.');
      return { success: true, handled: true };
    }
    
    const partnerChatIds = stateData.partner_chat_ids || [];
    let sent = 0;
    let failed = 0;
    
    await sendTelegramMessage(env.ADMIN_BOT_TOKEN, chatId, `📤 Начинаю рассылку ${partnerChatIds.length} партнёрам...`);
    
    for (const partnerChatId of partnerChatIds) {
      try {
        await sendPartnerNotification(env, partnerChatId, text);
        sent++;
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        failed++;
        logError('handleBroadcastMessage.send', error, { partnerChatId });
      }
    }
    
    await clearBotState(env, chatId);
    
    const keyboard = [[{ text: '◀️ Главное меню', callback_data: 'back_to_main' }]];
    
    await sendTelegramMessageWithKeyboard(
      env.ADMIN_BOT_TOKEN,
      chatId,
      `✅ <b>Рассылка завершена</b>\n\nОтправлено: ${sent}\nОшибок: ${failed}\nВсего: ${partnerChatIds.length}`,
      keyboard,
      { parseMode: 'HTML' }
    );
    
    return { success: true, handled: true, action: 'broadcast_complete', sent, failed };
  } catch (error) {
    logError('handleBroadcastMessage', error, { chatId });
    await clearBotState(env, chatId);
    await sendTelegramMessage(env.ADMIN_BOT_TOKEN, chatId, `Ошибка при рассылке: ${error.message}`);
    return { success: false, handled: true, error: error.message };
  }
}

/**
 * Handle cancel broadcast
 */
export async function handleCancelBroadcast(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    await clearBotState(env, chatId);
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Рассылка отменена' });
    
    // Import showMainMenu dynamically to avoid circular dependency
    const { showMainMenu } = await import('../admin.js');
    await showMainMenu(env, chatId);
    
    return { success: true, handled: true, action: 'broadcast_cancelled' };
  } catch (error) {
    logError('handleCancelBroadcast', error, { chatId });
    throw error;
  }
}
