/**
 * Promoters management handlers
 */

import {
  getPromoters,
  getPromoterByChat,
  getPromoterUGC,
} from '../supabase.js';
import {
  answerCallbackQuery,
  editMessageText,
} from '../telegram.js';
import {
  logError,
} from '../common.js';

/**
 * Handle promoters list
 */
export async function handleAdminPromoters(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const promoters = await getPromoters(env);
    
    if (promoters.length === 0) {
      const keyboard = [[{ text: '◀️ Назад', callback_data: 'back_to_main' }]];
      await editMessageText(
        env.ADMIN_BOT_TOKEN,
        chatId,
        callbackQuery.message.message_id,
        '📭 Промоутеров пока нет.',
        keyboard
      );
      return { success: true, handled: true, action: 'no_promoters' };
    }
    
    const keyboard = promoters.slice(0, 50).map(promoter => [{
      text: `${promoter.name || 'Аноним'} — ${promoter.points || 0} баллов`,
      callback_data: `promoter_info_${promoter.chat_id}`,
    }]);
    
    keyboard.push([{ text: '◀️ Назад', callback_data: 'back_to_main' }]); 
    
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      `🎯 **Промоутеры** (${promoters.length})\n\nВыберите промоутера для просмотра:`,
      keyboard,
      { parseMode: 'Markdown' }
    );
    
    return { success: true, handled: true, action: 'promoters_list', count: promoters.length };
  } catch (error) {
    logError('handleAdminPromoters', error, { chatId });
    throw error;
  }
}

/**
 * Handle promoter info
 */
export async function handlePromoterInfo(env, callbackQuery, promoterChatId) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const promoter = await getPromoterByChat(env, promoterChatId);
    
    if (!promoter) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Промоутер не найден', show_alert: true });
      return { success: false, handled: true };
    }
    
    const ugcContent = await getPromoterUGC(env, promoterChatId);
    const approved = ugcContent.filter(c => c.status === 'approved').length;
    const pending = ugcContent.filter(c => c.status === 'pending').length;
    const rejected = ugcContent.filter(c => c.status === 'rejected').length;
    
    let text = (
      `🎯 **Информация о промоутере**\n\n` +
      `👤 Имя: ${promoter.name || 'N/A'}\n` +
      `📱 Username: @${promoter.username || 'N/A'}\n` +
      `💰 Баллы: ${promoter.points || 0}\n` +
      `🎁 Промо-код: \`${promoter.promo_code || 'N/A'}\`\n\n` +
      `📸 **UGC контент:**\n` +
      `• Всего: ${ugcContent.length}\n` +
      `• Одобрено: ${approved}\n` +
      `• На модерации: ${pending}\n` +
      `• Отклонено: ${rejected}\n`
    );
    
    if (ugcContent.length > 0) {
      text += `\n📋 **Последние публикации:**\n`;
      ugcContent.slice(0, 5).forEach((ugc, idx) => {
        const statusEmoji = { 'approved': '✅', 'pending': '⏳', 'rejected': '❌' }[ugc.status] || '❓';
        const date = (ugc.created_at || '').substring(0, 10);
        text += `${idx + 1}. ${statusEmoji} ${ugc.content_type || 'N/A'} — ${date}\n`;
      });
    }
    
    const keyboard = [[{ text: '◀️ Назад', callback_data: 'admin_promoters' }]];
    
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      text,
      keyboard,
      { parseMode: 'Markdown' }
    );
    
    return { success: true, handled: true, action: 'promoter_info' };
  } catch (error) {
    logError('handlePromoterInfo', error, { chatId, promoterChatId });
    throw error;
  }
}