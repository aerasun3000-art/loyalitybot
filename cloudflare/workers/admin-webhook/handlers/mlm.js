/**
 * MLM Revenue Share handlers
 */

import {
  supabaseRequest,
  getBotState,
  setBotState,
  clearBotState,
  getPartnerByChatId,
  updatePartnerField,
  getPendingPayments,
  updatePaymentStatus,
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
 * Handle MLM menu
 */
export async function handleMLMMenu(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  const keyboard = [
    [{ text: '📊 Статистика MLM', callback_data: 'mlm_stats' }],
    [{ text: '💰 Установить PV', callback_data: 'mlm_set_pv' }],
    [{ text: '✅ Одобрить выплаты', callback_data: 'mlm_approve_payments' }],
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
 * Handle Set PV menu
 */
export async function handleSetPVMenu(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  await editMessageText(
    env.ADMIN_BOT_TOKEN,
    chatId,
    callbackQuery.message.message_id,
    '💰 **Установка PV (Partner Value)**\n\n' +
    'Отправьте сообщение в формате:\n' +
    '`chat_id процент`\n\n' +
    '**Пример:** `123456789 15`\n' +
    '(установит 15% PV для партнёра с chat_id 123456789)',
    [[{ text: '❌ Отмена', callback_data: 'admin_mlm' }]],
    { parseMode: 'Markdown' }
  );
  
  await setBotState(env, chatId, 'mlm_waiting_pv', {});
  
  return { success: true, handled: true, action: 'set_pv_menu' };
}

/**
 * Handle approve payments menu
 */
export async function handleApprovePayments(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const payments = await getPendingPayments(env);
    
    if (!payments || payments.length === 0) {
      const keyboard = [[{ text: '◀️ Назад', callback_data: 'admin_mlm' }]];
      await editMessageText(
        env.ADMIN_BOT_TOKEN,
        chatId,
        callbackQuery.message.message_id,
        '✅ Нет выплат на модерации.',
        keyboard
      );
      return { success: true, handled: true, action: 'no_pending_payments' };
    }
    
    for (const payment of payments) {
      const partner = await getPartnerByChatId(env, payment.partner_chat_id);
      const partnerName = partner?.name || payment.partner_chat_id;
      
      const messageText = (
        `**Выплата MLM на модерации**\n\n` +
        `🆔 ID: ${payment.id}\n` +
        `👤 Партнёр: ${partnerName}\n` +
        `💰 Сумма: ${payment.amount || 0} ₸\n` +
        `📅 Дата: ${(payment.created_at || '').substring(0, 10)}`
      );
      
      const keyboard = [
        [
          { text: '✅ Одобрить', callback_data: `mlm_pay_approve_${payment.id}` },
          { text: '❌ Отклонить', callback_data: `mlm_pay_reject_${payment.id}` },
        ],
      ];
      
      await sendTelegramMessageWithKeyboard(
        env.ADMIN_BOT_TOKEN,
        chatId,
        messageText,
        keyboard
      );
    }
    
    const keyboard = [[{ text: '◀️ Назад', callback_data: 'admin_mlm' }]];
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      `⏳ Загружено ${payments.length} выплат на модерацию.`,
      keyboard
    );
    
    return { success: true, handled: true, action: 'approve_payments', count: payments.length };
  } catch (error) {
    logError('handleApprovePayments', error, { chatId });
    throw error;
  }
}

/**
 * Handle payment action (approve/reject)
 */
export async function handlePaymentAction(env, callbackQuery, paymentId, action) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const success = await updatePaymentStatus(env, paymentId, newStatus);
    
    if (success) {
      const resultText = action === 'approve' ? '✅ ОДОБРЕНО' : '❌ ОТКЛОНЕНО';
      const originalText = callbackQuery.message.text || '';
      const processedText = originalText.split('\n')[0];
      
      await editMessageText(
        env.ADMIN_BOT_TOKEN,
        chatId,
        callbackQuery.message.message_id,
        `${processedText}\n\n**СТАТУС: ${resultText}**`,
        { parseMode: 'Markdown' }
      );
      
      // Notify partner
      const payments = await supabaseRequest(env, `revenue_share_payments?id=eq.${paymentId}&select=*`);
      if (payments && payments.length > 0) {
        const payment = payments[0];
        if (action === 'approve') {
          await sendPartnerNotification(
            env,
            payment.partner_chat_id,
            `✅ **Выплата одобрена!**\n\n` +
            `💰 Сумма: ${payment.amount || 0} ₸\n` +
            `Деньги будут переведены в ближайшее время.`
          );
        } else {
          await sendPartnerNotification(
            env,
            payment.partner_chat_id,
            `❌ **Выплата отклонена**\n\n` +
            `Свяжитесь с администратором для уточнения деталей.`
          );
        }
      }
      
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: resultText });
      return { success: true, handled: true, action: 'payment_updated', status: newStatus };
    } else {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка обновления', show_alert: true });
      return { success: false, handled: true };
    }
  } catch (error) {
    logError('handlePaymentAction', error, { paymentId, action });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка', show_alert: true });
    throw error;
  }
}

/**
 * Handle FSM messages for MLM
 */
export async function handleMessage(env, update, stateData) {
  const message = update.message;
  const chatId = String(message.chat.id);
  const text = message.text || '';
  const state = (await getBotState(env, chatId))?.state;
  
  try {
    if (state === 'mlm_waiting_pv') {
      const parts = text.trim().split(/\s+/);
      
      if (parts.length !== 2) {
        await sendTelegramMessage(
          env.ADMIN_BOT_TOKEN,
          chatId,
          '❌ Неверный формат. Введите: `chat_id процент`\n\nПример: `123456789 15`',
          { parseMode: 'Markdown' }
        );
        return { success: true, handled: true };
      }
      
      const [targetChatId, pvStr] = parts;
      const pvPercent = parseFloat(pvStr);
      
      if (isNaN(pvPercent) || pvPercent < 0 || pvPercent > 100) {
        await sendTelegramMessage(
          env.ADMIN_BOT_TOKEN,
          chatId,
          '❌ Процент должен быть числом от 0 до 100.'
        );
        return { success: true, handled: true };
      }
      
      const partner = await getPartnerByChatId(env, targetChatId);
      if (!partner) {
        await sendTelegramMessage(
          env.ADMIN_BOT_TOKEN,
          chatId,
          `❌ Партнёр с chat_id ${targetChatId} не найден.`
        );
        return { success: true, handled: true };
      }
      
      await updatePartnerField(env, targetChatId, 'pv_percent', pvPercent);
      await clearBotState(env, chatId);
      
      const keyboard = [[{ text: '◀️ Назад', callback_data: 'admin_mlm' }]];
      await sendTelegramMessageWithKeyboard(
        env.ADMIN_BOT_TOKEN,
        chatId,
        `✅ **PV установлен!**\n\n` +
        `👤 Партнёр: ${partner.name || targetChatId}\n` +
        `💰 PV: ${pvPercent}%`,
        keyboard,
        { parseMode: 'Markdown' }
      );
      
      await sendPartnerNotification(
        env,
        targetChatId,
        `💰 **Ваш PV обновлён!**\n\n` +
        `Новый процент: ${pvPercent}%`
      );
      
      return { success: true, handled: true, action: 'pv_set' };
    }
    
    return { success: true, handled: false };
  } catch (error) {
    logError('mlm.handleMessage', error, { chatId, state });
    await sendTelegramMessage(env.ADMIN_BOT_TOKEN, chatId, `Ошибка: ${error.message}`);
    return { success: false, handled: true, error: error.message };
  }
}
