/**
 * Service management and moderation handlers
 */

import { 
  supabaseRequest,
  updateServiceApprovalStatus,
  getServiceById,
} from '../supabase.js';
import {
  answerCallbackQuery,
  editMessageText,
} from '../telegram.js';
import {
  logError,
} from '../common.js';
import { sendPartnerNotification } from './partners.js';

/**
 * Handle service approval/rejection
 */
export async function handleServiceApproval(env, callbackQuery, serviceId, newStatus) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    serviceId = String(serviceId).trim();
    console.log('[handleServiceApproval] Processing:', { serviceId, newStatus, chatId });
    
    const success = await updateServiceApprovalStatus(env, serviceId, newStatus);
    
    if (success) {
      const resultText = newStatus === 'Approved' ? '🟢 Одобрена' : '🔴 Отклонена';
      const originalText = callbackQuery.message.text || '';
      const processedText = originalText.split('\n')[0];
      
      await editMessageText(
        env.ADMIN_BOT_TOKEN,
        chatId,
        callbackQuery.message.message_id,
        `${processedText}\n\n**СТАТУС: ${resultText}**`,
        { parseMode: 'Markdown' }
      );
      
      const service = await getServiceById(env, serviceId);
      if (service && service.partner_chat_id) {
        if (newStatus === 'Approved') {
          await sendPartnerNotification(
            env,
            service.partner_chat_id,
            `✅ **Ваша услуга одобрена!**\n\n` +
            `Услуга "${service.title || 'N/A'}" теперь доступна клиентам.`
          );
        } else {
          await sendPartnerNotification(
            env,
            service.partner_chat_id,
            `❌ **Ваша услуга отклонена**\n\n` +
            `Услуга "${service.title || 'N/A'}" была отклонена администратором.`
          );
        }
      }
      
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: resultText });
      return { success: true, handled: true, action: 'service_updated', status: newStatus };
    } else {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка при обновлении статуса в БД', show_alert: true });
      return { success: false, handled: true, action: 'service_update_failed' };
    }
  } catch (error) {
    console.error('[handleServiceApproval] Error:', error);
    logError('handleServiceApproval', error, { serviceId, newStatus });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Произошла ошибка', show_alert: true });
    throw error;
  }
}
