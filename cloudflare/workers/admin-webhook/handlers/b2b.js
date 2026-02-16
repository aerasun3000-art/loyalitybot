/**
 * B2B deals handlers  
 */

import {
  supabaseRequest,
  getBotState,
  setBotState,
  clearBotState,
  getPartnerByChatId,
  createDeal,
  updateDealStatus,
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
 * Handle B2B menu
 */
export async function handleB2BMenu(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  const keyboard = [
    [{ text: '📋 Все сделки', callback_data: 'b2b_list_all' }],
    [{ text: '⏳ Ожидающие', callback_data: 'b2b_list_pending' }],
    [{ text: '➕ Создать сделку', callback_data: 'b2b_create' }],
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
    
    for (const deal of deals) {
      const sourcePartner = await getPartnerByChatId(env, deal.source_partner_chat_id);
      const targetPartner = await getPartnerByChatId(env, deal.target_partner_chat_id);
      
      const messageText = (
        `**B2B Сделка #${deal.id}**\n\n` +
        `📤 Продавец: ${sourcePartner?.name || deal.source_partner_chat_id}\n` +
        `📥 Покупатель: ${targetPartner?.name || deal.target_partner_chat_id}\n` +
        `💰 Условия продавца: ${deal.seller_pays || '—'}\n` +
        `🎁 Условия покупателя: ${deal.buyer_gets || '—'}\n` +
        `📅 Дата: ${(deal.created_at || '').substring(0, 10)}`
      );
      
      const keyboard = [
        [
          { text: '✅ Принять', callback_data: `b2b_accept_${deal.id}` },
          { text: '❌ Отклонить', callback_data: `b2b_reject_${deal.id}` },
        ],
      ];
      
      await sendTelegramMessageWithKeyboard(
        env.ADMIN_BOT_TOKEN,
        chatId,
        messageText,
        keyboard
      );
    }
    
    const keyboard = [[{ text: '◀️ Назад', callback_data: 'admin_b2b_deals' }]];
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      `⏳ Загружено ${deals.length} сделок на модерацию.`,
      keyboard
    );
    
    return { success: true, handled: true, action: 'b2b_list_pending', count: deals.length };
  } catch (error) {
    logError('handleListPending', error, { chatId });
    throw error;
  }
}

/**
 * Handle create deal start
 */
export async function handleCreateStart(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  await editMessageText(
    env.ADMIN_BOT_TOKEN,
    chatId,
    callbackQuery.message.message_id,
    '➕ **Создание B2B сделки**\n\n' +
    '**Шаг 1/4:** Введите chat_id партнёра-продавца:',
    [[{ text: '❌ Отмена', callback_data: 'admin_b2b_deals' }]],
    { parseMode: 'Markdown' }
  );
  
  await setBotState(env, chatId, 'b2b_waiting_source', {});
  
  return { success: true, handled: true, action: 'create_start' };
}

/**
 * Handle deal action (accept/reject)
 */
export async function handleDealAction(env, callbackQuery, dealId, action) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const newStatus = action === 'accept' ? 'approved' : 'rejected';
    const success = await updateDealStatus(env, dealId, newStatus);
    
    if (success) {
      const resultText = action === 'accept' ? '✅ ОДОБРЕНО' : '❌ ОТКЛОНЕНО';
      const originalText = callbackQuery.message.text || '';
      const processedText = originalText.split('\n')[0];
      
      await editMessageText(
        env.ADMIN_BOT_TOKEN,
        chatId,
        callbackQuery.message.message_id,
        `${processedText}\n\n**СТАТУС: ${resultText}**`,
        { parseMode: 'Markdown' }
      );
      
      // Notify both partners
      const deals = await supabaseRequest(env, `partner_deals?id=eq.${dealId}&select=*`);
      if (deals && deals.length > 0) {
        const deal = deals[0];
        const statusText = action === 'accept' ? 'одобрена' : 'отклонена';
        
        await sendPartnerNotification(
          env,
          deal.source_partner_chat_id,
          `🤝 **B2B сделка ${statusText}**\n\n` +
          `Ваша сделка с партнёром ${deal.target_partner_chat_id} была ${statusText}.`
        );
        
        await sendPartnerNotification(
          env,
          deal.target_partner_chat_id,
          `🤝 **B2B сделка ${statusText}**\n\n` +
          `Сделка с партнёром ${deal.source_partner_chat_id} была ${statusText}.`
        );
      }
      
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: resultText });
      return { success: true, handled: true, action: 'deal_updated', status: newStatus };
    } else {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка обновления', show_alert: true });
      return { success: false, handled: true };
    }
  } catch (error) {
    logError('handleDealAction', error, { dealId, action });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка', show_alert: true });
    throw error;
  }
}

/**
 * Handle FSM messages for B2B
 */
export async function handleMessage(env, update, stateData) {
  const message = update.message;
  const chatId = String(message.chat.id);
  const text = message.text || '';
  const currentState = await getBotState(env, chatId);
  const state = currentState?.state;
  const data = currentState?.data || {};
  
  try {
    // Step 1: Source partner
    if (state === 'b2b_waiting_source') {
      const sourceChatId = text.trim();
      const partner = await getPartnerByChatId(env, sourceChatId);
      
      if (!partner) {
        await sendTelegramMessage(
          env.ADMIN_BOT_TOKEN,
          chatId,
          `❌ Партнёр с chat_id ${sourceChatId} не найден.\n\nВведите корректный chat_id:`
        );
        return { success: true, handled: true };
      }
      
      await setBotState(env, chatId, 'b2b_waiting_target', {
        source_chat_id: sourceChatId,
        source_name: partner.name || sourceChatId,
      });
      
      await sendTelegramMessageWithKeyboard(
        env.ADMIN_BOT_TOKEN,
        chatId,
        `✅ Продавец: **${partner.name || sourceChatId}**\n\n` +
        '**Шаг 2/4:** Введите chat_id партнёра-покупателя:',
        [[{ text: '❌ Отмена', callback_data: 'admin_b2b_deals' }]],
        { parseMode: 'Markdown' }
      );
      
      return { success: true, handled: true, action: 'source_set' };
    }
    
    // Step 2: Target partner
    if (state === 'b2b_waiting_target') {
      const targetChatId = text.trim();
      const partner = await getPartnerByChatId(env, targetChatId);
      
      if (!partner) {
        await sendTelegramMessage(
          env.ADMIN_BOT_TOKEN,
          chatId,
          `❌ Партнёр с chat_id ${targetChatId} не найден.\n\nВведите корректный chat_id:`
        );
        return { success: true, handled: true };
      }
      
      await setBotState(env, chatId, 'b2b_waiting_seller_pays', {
        ...data,
        target_chat_id: targetChatId,
        target_name: partner.name || targetChatId,
      });
      
      await sendTelegramMessageWithKeyboard(
        env.ADMIN_BOT_TOKEN,
        chatId,
        `✅ Покупатель: **${partner.name || targetChatId}**\n\n` +
        '**Шаг 3/4:** Введите условия для продавца (что платит):',
        [[{ text: '❌ Отмена', callback_data: 'admin_b2b_deals' }]],
        { parseMode: 'Markdown' }
      );
      
      return { success: true, handled: true, action: 'target_set' };
    }
    
    // Step 3: Seller pays
    if (state === 'b2b_waiting_seller_pays') {
      const sellerPays = text.trim();
      
      if (!sellerPays) {
        await sendTelegramMessage(
          env.ADMIN_BOT_TOKEN,
          chatId,
          '❌ Условия не могут быть пустыми. Введите условия:'
        );
        return { success: true, handled: true };
      }
      
      await setBotState(env, chatId, 'b2b_waiting_buyer_gets', {
        ...data,
        seller_pays: sellerPays,
      });
      
      await sendTelegramMessageWithKeyboard(
        env.ADMIN_BOT_TOKEN,
        chatId,
        `✅ Условия продавца сохранены.\n\n` +
        '**Шаг 4/4:** Введите условия для покупателя (что получает):',
        [[{ text: '❌ Отмена', callback_data: 'admin_b2b_deals' }]],
        { parseMode: 'Markdown' }
      );
      
      return { success: true, handled: true, action: 'seller_pays_set' };
    }
    
    // Step 4: Buyer gets - create deal
    if (state === 'b2b_waiting_buyer_gets') {
      const buyerGets = text.trim();
      
      if (!buyerGets) {
        await sendTelegramMessage(
          env.ADMIN_BOT_TOKEN,
          chatId,
          '❌ Условия не могут быть пустыми. Введите условия:'
        );
        return { success: true, handled: true };
      }
      
      const dealData = {
        source_partner_chat_id: data.source_chat_id,
        target_partner_chat_id: data.target_chat_id,
        seller_pays: data.seller_pays,
        buyer_gets: buyerGets,
      };
      
      const newDeal = await createDeal(env, dealData);
      await clearBotState(env, chatId);
      
      if (newDeal) {
        const keyboard = [[{ text: '◀️ Назад', callback_data: 'admin_b2b_deals' }]];
        await sendTelegramMessageWithKeyboard(
          env.ADMIN_BOT_TOKEN,
          chatId,
          `✅ **B2B сделка создана!**\n\n` +
          `🆔 ID: ${newDeal.id}\n` +
          `📤 Продавец: ${data.source_name}\n` +
          `📥 Покупатель: ${data.target_name}\n` +
          `💰 Условия продавца: ${data.seller_pays}\n` +
          `🎁 Условия покупателя: ${buyerGets}\n` +
          `📊 Статус: ⏳ Ожидает модерации`,
          keyboard,
          { parseMode: 'Markdown' }
        );
        
        // Notify both partners
        await sendPartnerNotification(
          env,
          data.source_chat_id,
          `🤝 **Новая B2B сделка!**\n\n` +
          `Создана сделка с партнёром ${data.target_name}.\n` +
          `Ожидайте модерации.`
        );
        
        await sendPartnerNotification(
          env,
          data.target_chat_id,
          `🤝 **Новая B2B сделка!**\n\n` +
          `Создана сделка с партнёром ${data.source_name}.\n` +
          `Ожидайте модерации.`
        );
        
        return { success: true, handled: true, action: 'deal_created' };
      } else {
        await sendTelegramMessage(env.ADMIN_BOT_TOKEN, chatId, '❌ Ошибка при создании сделки');
        return { success: false, handled: true };
      }
    }
    
    return { success: true, handled: false };
  } catch (error) {
    logError('b2b.handleMessage', error, { chatId, state });
    await sendTelegramMessage(env.ADMIN_BOT_TOKEN, chatId, `Ошибка: ${error.message}`);
    return { success: false, handled: true, error: error.message };
  }
}
