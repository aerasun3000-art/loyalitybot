/**
 * MLM Revenue Share handlers
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
 * Handle MLM menu
 */
export async function handleMLMMenu(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  const keyboard = [
    [{ text: '📊 Статистика MLM', callback_data: 'mlm_stats' }],
    [{ text: '🌳 Сеть партнёров', callback_data: 'mlm_network' }],
    [{ text: '◀️ Назад', callback_data: 'back_to_main' }],
  ];
  
  await editMessageText(
    env.ADMIN_BOT_TOKEN,
    chatId,
    callbackQuery.message.message_id,
    '💎 **MLM Revenue Share**\n\nВыберите действие:',
    keyboard,
    { parseMode: 'Markdown' }
  );
  
  return { success: true, handled: true, action: 'mlm_menu' };
}

/**
 * Handle MLM stats
 */
export async function handleMLMStats(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const partners = await supabaseRequest(env, 'partners?select=chat_id,pv_percent,is_revenue_share_active');
    const network = await supabaseRequest(env, 'partner_network?select=*');
    
    const totalPartners = partners.length;
    const activeMLM = partners.filter(p => (p.pv_percent || 0) > 0).length;
    const networkSize = network?.length || 0;
    const avgPV = totalPartners > 0 
      ? (partners.reduce((sum, p) => sum + (parseFloat(p.pv_percent) || 0), 0) / totalPartners).toFixed(1)
      : 0;
    
    const text = (
      `📊 **MLM СТАТИСТИКА**\n\n` +
      `👥 **ПАРТНЕРЫ:**\n` +
      `├─ Всего партнеров: ${totalPartners}\n` +
      `├─ Активных MLM: ${activeMLM}\n` +
      `├─ Размер сети: ${networkSize} связей\n` +
      `└─ Средний PV: ${avgPV}%\n`
    );
    
    const keyboard = [[{ text: '◀️ Назад', callback_data: 'admin_mlm' }]];
    
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      text,
      keyboard,
      { parseMode: 'Markdown' }
    );
    
    return { success: true, handled: true, action: 'mlm_stats' };
  } catch (error) {
    logError('handleMLMStats', error, { chatId });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка загрузки', show_alert: true });
    throw error;
  }
}

/**
 * Handle MLM network
 */
export async function handleMLMNetwork(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const network = await supabaseRequest(env, 'partner_network?select=*&order=level&limit=50');
    
    if (!network || network.length === 0) {
      const keyboard = [[{ text: '◀️ Назад', callback_data: 'admin_mlm' }]];
      await editMessageText(
        env.ADMIN_BOT_TOKEN,
        chatId,
        callbackQuery.message.message_id,
        '📭 Сеть партнёров пуста.',
        keyboard
      );
      return { success: true, handled: true, action: 'empty_network' };
    }
    
    let text = '🌳 **Сеть партнёров**\n\n';
    
    network.forEach((node, idx) => {
      const indent = '↳ '.repeat(node.level || 0);
      text += `${indent}${idx + 1}. ID: ${node.partner_chat_id} (уровень ${node.level || 0})\n`;
    });
    
    const keyboard = [[{ text: '◀️ Назад', callback_data: 'admin_mlm' }]];
    
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      text.substring(0, 4000),
      keyboard,
      { parseMode: 'Markdown' }
    );
    
    return { success: true, handled: true, action: 'mlm_network', count: network.length };
  } catch (error) {
    logError('handleMLMNetwork', error, { chatId });
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
