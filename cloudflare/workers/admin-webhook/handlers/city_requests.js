/**
 * City requests handler for admin bot
 */

import { supabaseRequest } from '../supabase.js';
import {
  sendTelegramMessage,
  sendTelegramMessageWithKeyboard,
  answerCallbackQuery,
  editMessageText,
} from '../telegram.js';
import { logError } from '../common.js';
import { sendPartnerNotification } from './partners.js';

/**
 * Notify admin about new city request
 */
export async function notifyAdminNewCityRequest(env, cityRequest) {
  const adminIds = (env.ADMIN_CHAT_ID || '').split(',').map(id => id.trim()).filter(Boolean);
  const text =
    `🌍 <b>Новая заявка на город</b>\n\n` +
    `<b>Город:</b> ${cityRequest.city_name}\n` +
    `<b>От партнёра:</b> ${cityRequest.requester_name || 'не указано'}\n` +
    `<b>Chat ID:</b> <code>${cityRequest.chat_id}</code>\n` +
    `<b>ID заявки:</b> ${cityRequest.id}`;

  const keyboard = [[
    { text: '✅ Одобрить', callback_data: `city_req_approve_${cityRequest.id}` },
    { text: '❌ Отклонить', callback_data: `city_req_reject_${cityRequest.id}` },
  ]];

  for (const adminId of adminIds) {
    try {
      await sendTelegramMessageWithKeyboard(env.ADMIN_BOT_TOKEN, adminId, text, keyboard, { parseMode: 'HTML' });
    } catch (err) {
      logError('notifyAdminNewCityRequest', err, { adminId });
    }
  }
}

/**
 * Handle city_req_approve / city_req_reject callback
 */
export async function handleCityRequestCallback(env, callbackQuery) {
  const data = callbackQuery.data;
  const chatId = String(callbackQuery.message.chat.id);
  const messageId = callbackQuery.message.message_id;

  const approveMatch = data.match(/^city_req_approve_(\d+)$/);
  const rejectMatch = data.match(/^city_req_reject_(\d+)$/);
  const requestId = approveMatch?.[1] || rejectMatch?.[1];
  const isApprove = !!approveMatch;

  if (!requestId) return false;

  try {
    const rows = await supabaseRequest(env, `city_requests?id=eq.${requestId}&select=*`);
    if (!rows || rows.length === 0) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Заявка не найдена' });
      return true;
    }
    const req = rows[0];

    if (req.status !== 'pending') {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, {
        text: `Уже обработана: ${req.status}`,
      });
      return true;
    }

    const newStatus = isApprove ? 'approved' : 'rejected';

    await supabaseRequest(env, `city_requests?id=eq.${requestId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus }),
    });

    if (isApprove) {
      try {
        await supabaseRequest(env, 'available_cities', {
          method: 'POST',
          headers: { 'Prefer': 'resolution=ignore-duplicates' },
          body: JSON.stringify({ name: req.city_name }),
        });
      } catch (insertErr) {
        if (!insertErr.message?.includes('duplicate') && !insertErr.message?.includes('23505')) {
          throw insertErr;
        }
      }
    }

    const partnerMsg = isApprove
      ? `✅ Ваш запрос на добавление города *${req.city_name}* одобрен! Теперь вы можете выбрать его при регистрации.`
      : `❌ Ваш запрос на добавление города *${req.city_name}* отклонён администратором.`;
    await sendPartnerNotification(env, req.chat_id, partnerMsg);

    const resultText =
      `${isApprove ? '✅ Одобрено' : '❌ Отклонено'}: город <b>${req.city_name}</b>\n` +
      `Партнёр уведомлён.`;
    await editMessageText(env.ADMIN_BOT_TOKEN, chatId, messageId, resultText, { parseMode: 'HTML' });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, {
      text: isApprove ? '✅ Город добавлен' : '❌ Заявка отклонена',
    });

  } catch (err) {
    logError('handleCityRequestCallback', err, { requestId });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка обработки' });
  }

  return true;
}

/**
 * Show pending city requests list to admin
 */
export async function showCityRequests(env, chatId) {
  try {
    const rows = await supabaseRequest(env, 'city_requests?status=eq.pending&select=*&order=created_at.asc');
    if (!rows || rows.length === 0) {
      await sendTelegramMessage(env.ADMIN_BOT_TOKEN, chatId, '🌍 Нет новых заявок на города.');
      return;
    }
    for (const req of rows) {
      const text =
        `🌍 <b>Заявка на город</b>\n\n` +
        `<b>Город:</b> ${req.city_name}\n` +
        `<b>От партнёра:</b> ${req.requester_name || 'не указано'}\n` +
        `<b>Chat ID:</b> <code>${req.chat_id}</code>`;
      const keyboard = [[
        { text: '✅ Одобрить', callback_data: `city_req_approve_${req.id}` },
        { text: '❌ Отклонить', callback_data: `city_req_reject_${req.id}` },
      ]];
      await sendTelegramMessageWithKeyboard(env.ADMIN_BOT_TOKEN, chatId, text, keyboard, { parseMode: 'HTML' });
    }
  } catch (err) {
    logError('showCityRequests', err, { chatId });
  }
}
