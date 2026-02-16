/**
 * B2B deals handlers  
 */

import {
  supabaseRequest,
} from '../supabase.js';
import {
  answerCallbackQuery,
  editMessageText,
} from '../telegram.js';
import {
  logError,
} from '../common.js';

/**
 * Handle B2B menu
 */
export async function handleB2BMenu(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  const keyboard = [
    [{ text: '📋 Все сделки', callback_data: 'b2b_list_all' }],
    [{ text: '⏳ Ожидающие', callback_data: 'b2b_list_pending' }],
    [{ text: '◀️ Назад', callback_data: 'back_to_main' }],
  ];
  
  await editMessageText(
    env.ADMIN_BOT_TOKEN,
    chatId,
    callbackQuery.message.message_id,
    '🤝 **B2B Сделки**\n\nВыберите действие:',
    keyboard,
    { parseMode: 'Markdown' }
  );
  
  return { success: true, handled: true, action: 'b2b_menu' };
}

/**
 * Handle list all deals
 */
export async function handleListAll(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const deals = await supabaseRequest(env, 'partner_deals?select=*&order=created_at.desc&limit=20');
    
    if (!deals || deals.length === 0) {
      const keyboard = [[{ text: '◀️ Назад', callback_data: 'admin_b2b_deals' }]];
      await editMessageText(
        env.ADMIN_BOT_TOKEN,
        chatId,
        callbackQuery.message.message_id,
        '📭 Сделок пока нет.',
        keyboard
      );
      return { success: true, handled: true, action: 'no_deals' };
    }
    
    let text = '📋 **Все B2B сделки**\n\n';
    
    deals.forEach((deal, idx) => {
      const status = { 'pending': '⏳', 'approved': '✅', 'rejected': '❌', 'completed': '🎯' }[deal.status] || '❓';
      text += `${idx + 1}. ${status} ${deal.source_partner_chat_id} → ${deal.target_partner_chat_id}\n`;
      text += `   Дата: ${(deal.created_at || '').substring(0, 10)}\n\n`;
    });
    
    const keyboard = [[{ text: '◀️ Назад', callback_data: 'admin_b2b_deals' }]];
    
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      text.substring(0, 4000),
      keyboard,
      { parseMode: 'Markdown' }
    );
    
    return { success: true, handled: true, action: 'b2b_list_all', count: deals.length };
  } catch (error) {
    logError('handleListAll', error, { chatId });
    throw error;
  }
}

/**
 * Handle list pending deals
 */
export async function handleListPending(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const deals = await supabaseRequest(env, 'partner_deals?status=eq.pending&select=*&order=created_at.desc');
    
    if (!deals || deals.length === 0) {
      const keyboard = [[{ text: '◀️ Назад', callback_data: 'admin_b2b_deals' }]];
      await editMessageText(
        env.ADMIN_BOT_TOKEN,
        chatId,
        callbackQuery.message.message_id,
        '✅ Нет сделок на модерации.',
        keyboard
      );
      return { success: true, handled: true, action: 'no_pending_deals' };
    }
    
    let text = '⏳ **B2B сделки на модерации**\n\n';
    
    deals.forEach((deal, idx) => {
      text += `${idx + 1}. ${deal.source_partner_chat_id} → ${deal.target_partner_chat_id}\n`;
      text += `   ID: ${deal.id}\n`;
      text += `   Дата: ${(deal.created_at || '').substring(0, 10)}\n\n`;
    });
    
    const keyboard = [[{ text: '◀️ Назад', callback_data: 'admin_b2b_deals' }]];
    
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      text.substring(0, 4000),
      keyboard,
      { parseMode: 'Markdown' }
    );
    
    return { success: true, handled: true, action: 'b2b_list_pending', count: deals.length };
  } catch (error) {
    logError('handleListPending', error, { chatId });
    throw error;
  }
}

/**
 * Generic stub
 */
export async function handleFeatureStub(env, callbackQuery, featureName) {
  const chatId = String(callbackQuery.message.chat.id);
  
  const keyboard = [[{ text: '◀️ Назад', callback_data: 'back_to_main' }]];
  
  await editMessageText(
    env.ADMIN_BOT_TOKEN,
    chatId,
    callbackQuery.message.message_id,
    `⚠️ **${featureName}**\n\nДанная функция пока не реализована в облачной версии админ-бота.\n\nДля доступа ко всем функциям используйте локальную Python-версию админ-бота.`,
    keyboard,
    { parseMode: 'Markdown' }
  );
  
  return { success: true, handled: true, action: 'feature_not_implemented' };
}
