/**
 * UGC moderation handlers
 */

import {
  getPendingUGC,
  updateUGCStatus,
  getPromoterByChat,
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
import { sendPartnerNotification } from './partners.js';

/**
 * Handle UGC moderation menu
 */
export async function handleAdminUGC(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const pendingUGC = await getPendingUGC(env);
    
    if (pendingUGC.length === 0) {
      const keyboard = [[{ text: '◀️ Назад', callback_data: 'back_to_main' }]];
      await editMessageText(
        env.ADMIN_BOT_TOKEN,
        chatId,
        callbackQuery.message.message_id,
        '✅ Нет UGC контента на модерации.',
        keyboard
      );
      return { success: true, handled: true, action: 'no_pending_ugc' };
    }
    
    for (const ugc of pendingUGC) {
      const promoter = ugc.promoter_chat_id ? await getPromoterByChat(env, ugc.promoter_chat_id) : null;
      
      const messageText = (
        `**UGC контент на модерации**\n\n` +
        `🆔 ID: ${ugc.id}\n` +
        `📱 Тип: ${ugc.content_type || '—'}\n` +
        `👤 Промоутер: ${promoter?.name || ugc.promoter_chat_id || '—'}\n` +
        `📝 Описание: ${ugc.description || '—'}\n` +
        `🔗 URL: ${ugc.content_url || '—'}\n` +
        `📅 Дата: ${(ugc.created_at || '').substring(0, 10)}`
      );
      
      const keyboard = [
        [
          { text: '🟢 Одобрить (+100 баллов)', callback_data: `ugc_approve_${ugc.id}` },
          { text: '🔴 Отклонить', callback_data: `ugc_reject_${ugc.id}` },
        ],
      ];
      
      await sendTelegramMessageWithKeyboard(
        env.ADMIN_BOT_TOKEN,
        chatId,
        messageText,
        keyboard
      );
    }
    
    const keyboard = [[{ text: '◀️ Назад', callback_data: 'back_to_main' }]];
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      `⏳ Загружено ${pendingUGC.length} UGC на модерацию.`,
      keyboard
    );
    
    return { success: true, handled: true, action: 'ugc_moderation', count: pendingUGC.length };
  } catch (error) {
    logError('handleAdminUGC', error, { chatId });
    throw error;
  }
}

/**
 * Handle UGC approval
 */
export async function handleUGCApproval(env, callbackQuery, ugcId, status) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const success = await updateUGCStatus(env, ugcId, status);
    
    if (success) {
      const resultText = status === 'approved' ? '🟢 Одобрен' : '🔴 Отклонён';
      const originalText = callbackQuery.message.text || '';
      const processedText = originalText.split('\n')[0];
      
      await editMessageText(
        env.ADMIN_BOT_TOKEN,
        chatId,
        callbackQuery.message.message_id,
        `${processedText}\n\n**СТАТУС: ${resultText}**`,
        { parseMode: 'Markdown' }
      );
      
      // Get UGC to notify promoter
      const ugcList = await getPendingUGC(env);
      const ugc = ugcList.find(u => u.id === ugcId);
      
      if (ugc && ugc.promoter_chat_id) {
        if (status === 'approved') {
          await sendPartnerNotification(
            env,
            ugc.promoter_chat_id,
            `✅ Ваш UGC контент одобрен!\n\n` +
            `📸 Ссылка: ${ugc.content_url || 'N/A'}\n` +
            `💰 Начислено: 100 баллов\n\n` +
            `Спасибо за качественный контент!`
          );
        } else {
          await sendPartnerNotification(
            env,
            ugc.promoter_chat_id,
            `❌ Ваш UGC контент был отклонён.\n\n` +
            `Пожалуйста, проверьте требования к контенту и попробуйте снова.`
          );
        }
      }
      
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: resultText });
      return { success: true, handled: true, action: 'ugc_updated', status };
    } else {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка обновления', show_alert: true });
      return { success: false, handled: true };
    }
  } catch (error) {
    logError('handleUGCApproval', error, { ugcId, status });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Произошла ошибка', show_alert: true });
    throw error;
  }
}