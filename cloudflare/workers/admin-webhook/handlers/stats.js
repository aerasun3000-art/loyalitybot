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
 * Handle admin stats (extended version)
 */
export async function handleAdminStats(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const allApplications = await getAllPartnerApplications(env);
    const allPartners = await getAllApprovedPartners(env);
    
    const totalPartners = allPartners.length;
    const approved = allApplications.filter(p => (p.status || '').toLowerCase() === 'approved').length;
    const pending = allApplications.filter(p => (p.status || 'pending').toLowerCase() === 'pending').length;
    
    // Get additional stats
    const { supabaseRequest } = await import('../supabase.js');
    const services = await supabaseRequest(env, 'services?select=approval_status');
    const news = await supabaseRequest(env, 'news?select=is_published');
    const ugc = await supabaseRequest(env, 'ugc_content?select=status');
    const promoters = await supabaseRequest(env, 'promoters?select=chat_id');
    const deals = await supabaseRequest(env, 'partner_deals?select=status');
    
    const servicesTotal = services?.length || 0;
    const servicesPending = services?.filter(s => s.approval_status === 'Pending').length || 0;
    const newsTotal = news?.length || 0;
    const newsPublished = news?.filter(n => n.is_published).length || 0;
    const ugcTotal = ugc?.length || 0;
    const ugcPending = ugc?.filter(u => u.status === 'pending').length || 0;
    const promotersTotal = promoters?.length || 0;
    const dealsTotal = deals?.length || 0;
    const dealsPending = deals?.filter(d => d.status === 'pending').length || 0;
    
    const text = (
      '📊 **Расширенная статистика**\n\n' +
      `**ПАРТНЁРЫ:**\n` +
      `├─ Всего: ${totalPartners}\n` +
      `├─ Одобрено: ${approved}\n` +
      `└─ На модерации: ${pending}\n\n` +
      `**УСЛУГИ:**\n` +
      `├─ Всего: ${servicesTotal}\n` +
      `└─ На модерации: ${servicesPending}\n\n` +
      `**НОВОСТИ:**\n` +
      `├─ Всего: ${newsTotal}\n` +
      `└─ Опубликовано: ${newsPublished}\n\n` +
      `**UGC:**\n` +
      `├─ Всего: ${ugcTotal}\n` +
      `└─ На модерации: ${ugcPending}\n\n` +
      `**ПРОМОУТЕРЫ:** ${promotersTotal}\n\n` +
      `**B2B СДЕЛКИ:**\n` +
      `├─ Всего: ${dealsTotal}\n` +
      `└─ На модерации: ${dealsPending}`
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
