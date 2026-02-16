/**
 * Statistics handlers
 */

import {
  answerCallbackQuery,
  editMessageText,
} from '../telegram.js';
import {
  logError,
} from '../common.js';
import { getAllPartnerApplications, getAllApprovedPartners } from './partners.js';

/**
 * Handle admin stats
 */
export async function handleAdminStats(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const allApplications = await getAllPartnerApplications(env);
    const allPartners = await getAllApprovedPartners(env);
    
    const totalPartners = allPartners.length;
    const approved = allApplications.filter(p => (p.status || '').toLowerCase() === 'approved').length;
    const pending = allApplications.filter(p => (p.status || 'pending').toLowerCase() === 'pending').length;
    
    const text = (
      '📊 **Общая статистика**\n\n' +
      `🤝 Партнёров всего: ${totalPartners}\n` +
      `✅ Одобрено: ${approved}\n` +
      `⏳ На модерации: ${pending}`
    );
    
    const keyboard = [[{ text: '◀️ Назад', callback_data: 'back_to_main' }]];
    
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      text,
      keyboard,
      { parseMode: 'Markdown' }
    );
    
    return { success: true, handled: true, action: 'admin_stats' };
  } catch (error) {
    logError('handleAdminStats', error, { chatId });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка при загрузке статистики', show_alert: true });
    throw error;
  }
}
