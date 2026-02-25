/**
 * Promotion moderation handlers
 */

import {
  getPendingPromotions,
  getPromotionById,
  updatePromotion,
  updatePromotionApprovalStatus,
  getPartnerByChatId,
  getBotState,
  setBotState,
  clearBotState,
} from '../supabase.js';
import {
  sendTelegramMessage,
  sendTelegramMessageWithKeyboard,
  answerCallbackQuery,
  editMessageText,
} from '../telegram.js';
import { logError } from '../common.js';
import { sendPartnerNotification } from './partners.js';

const TELEGRAM_MAX_MESSAGE_LENGTH = 4000;

function splitLongText(text, maxLen = TELEGRAM_MAX_MESSAGE_LENGTH) {
  if (!text || text.length <= maxLen) return [text || ''];
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    chunks.push(remaining.slice(0, maxLen));
    remaining = remaining.slice(maxLen);
  }
  return chunks;
}

/**
 * Handle promotion moderation menu
 */
export async function handleAdminPromotions(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);

  try {
    const pendingPromotions = await getPendingPromotions(env);

    if (pendingPromotions.length === 0) {
      const keyboard = [[{ text: '◀️ Назад', callback_data: 'back_to_main' }]];
      await editMessageText(
        env.ADMIN_BOT_TOKEN,
        chatId,
        callbackQuery.message.message_id,
        '✅ Нет акций на модерации.',
        keyboard
      );
      return { success: true, handled: true, action: 'no_pending_promotions' };
    }

    for (const promo of pendingPromotions) {
      const partner = promo.partner_chat_id ? await getPartnerByChatId(env, promo.partner_chat_id) : null;
      const visibilityLabel = { 'public': '🌐 Всем', 'hide_competitors': '🙈 Скрыто от конкурентов' }[promo.visibility_mode] ?? '🌐 Всем';
      const header = (
        `**Новая акция на модерации**\n\n` +
        `🆔 ID: ${promo.id}\n` +
        `📝 Название: ${promo.title || '—'}\n` +
        `💰 Скидка/Стоимость: ${promo.discount_value || promo.service_price || '—'}\n` +
        `🏷️ Тип: ${promo.promotion_type || 'discount'}\n` +
        `📅 До: ${(promo.end_date || '—').toString().slice(0, 10)}\n` +
        `👤 Партнёр: ${partner?.name || promo.partner_chat_id || '—'}\n` +
        `👁 Видимость: ${visibilityLabel}\n\n` +
        `📄 Описание:\n`
      );
      const fullDesc = promo.description || '—';
      const descChunks = splitLongText(fullDesc, TELEGRAM_MAX_MESSAGE_LENGTH - header.length - 50);
      const messageText = header + descChunks[0];
      if (descChunks.length > 1) {
        for (let i = 1; i < descChunks.length; i++) {
          await sendTelegramMessage(env.ADMIN_BOT_TOKEN, chatId, descChunks[i]);
        }
      }

      const keyboard = [
        [{ text: '✏️ Редактировать', callback_data: `promo_mod_edit_${promo.id}` }],
        [
          { text: '🟢 Одобрить', callback_data: `promo_approve_${promo.id}` },
          { text: '🔴 Отклонить', callback_data: `promo_reject_${promo.id}` },
        ],
      ];

      await sendTelegramMessageWithKeyboard(
        env.ADMIN_BOT_TOKEN,
        chatId,
        messageText,
        keyboard,
        { parseMode: 'Markdown' }
      );
    }

    const keyboard = [[{ text: '◀️ Назад', callback_data: 'back_to_main' }]];
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      `⏳ Загружено ${pendingPromotions.length} акций на модерацию.`,
      keyboard
    );

    return { success: true, handled: true, action: 'promotions_moderation', count: pendingPromotions.length };
  } catch (error) {
    logError('handleAdminPromotions', error, { chatId });
    throw error;
  }
}

/**
 * Handle promotion approval/rejection
 */
export async function handlePromotionApproval(env, callbackQuery, promotionId, newStatus) {
  const chatId = String(callbackQuery.message.chat.id);

  try {
    promotionId = String(promotionId).trim();
    const success = await updatePromotionApprovalStatus(env, promotionId, newStatus);

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

      const promo = await getPromotionById(env, promotionId);
      if (promo && promo.partner_chat_id) {
        if (newStatus === 'Approved') {
          await sendPartnerNotification(
            env,
            promo.partner_chat_id,
            `✅ **Ваша акция одобрена!**\n\n` +
            `Акция "${promo.title || 'N/A'}" теперь доступна клиентам.`
          );
        } else {
          await sendPartnerNotification(
            env,
            promo.partner_chat_id,
            `❌ **Ваша акция отклонена**\n\n` +
            `Акция "${promo.title || 'N/A'}" была отклонена администратором.`
          );
        }
      }

      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: resultText });
      return { success: true, handled: true, action: 'promotion_updated', status: newStatus };
    } else {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка при обновлении статуса в БД', show_alert: true });
      return { success: false, handled: true, action: 'promotion_update_failed' };
    }
  } catch (error) {
    logError('handlePromotionApproval', error, { promotionId, newStatus });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Произошла ошибка', show_alert: true });
    throw error;
  }
}

/**
 * Handle edit promotion from moderation - show field selection
 */
export async function handleModerationEditPromotionStart(env, callbackQuery, promotionId) {
  const chatId = String(callbackQuery.message.chat.id);

  try {
    const promo = await getPromotionById(env, promotionId);

    if (!promo) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Акция не найдена', show_alert: true });
      return { success: false, handled: true };
    }

    const keyboard = [
      [{ text: '📝 Название', callback_data: `promo_edit_field_title_${promotionId}` }],
      [{ text: '📄 Описание', callback_data: `promo_edit_field_description_${promotionId}` }],
      [{ text: '💰 Скидка/Стоимость', callback_data: `promo_edit_field_discount_${promotionId}` }],
      [{ text: '📅 Дата окончания', callback_data: `promo_edit_field_end_date_${promotionId}` }],
      [{ text: '◀️ К модерации', callback_data: 'admin_promotions' }],
    ];

    const descText = (promo.description || '—').slice(0, 500);
    const text = (
      `✏️ **Редактирование акции (модерация)**\n\n` +
      `📝 Название: ${promo.title || '—'}\n` +
      `📄 Описание: ${descText}${(promo.description || '').length > 500 ? '...' : ''}\n` +
      `💰 Скидка: ${promo.discount_value || promo.service_price || '—'}\n` +
      `📅 До: ${(promo.end_date || '—').toString().slice(0, 10)}\n\n` +
      `Выберите поле для изменения:`
    );

    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      text,
      keyboard,
      { parseMode: 'Markdown' }
    );

    await setBotState(env, chatId, 'promo_mod_editing', { from_moderation: true, editing_promotion_id: promotionId });

    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id);
    return { success: true, handled: true, action: 'promotion_moderation_edit_menu' };
  } catch (error) {
    logError('handleModerationEditPromotionStart', error, { chatId, promotionId });
    throw error;
  }
}

/**
 * Handle promotion edit field - prompt for new value
 */
export async function handlePromotionEditField(env, callbackQuery, field, promotionId) {
  const chatId = String(callbackQuery.message.chat.id);

  const fieldMap = {
    title: 'название',
    description: 'описание',
    discount: 'скидку/стоимость',
    end_date: 'дату окончания (YYYY-MM-DD)',
  };
  const dbField = field === 'discount' ? 'discount_value' : (field === 'end_date' ? 'end_date' : field);

  await editMessageText(
    env.ADMIN_BOT_TOKEN,
    chatId,
    callbackQuery.message.message_id,
    `✏️ **Редактирование: ${fieldMap[field] || field}**\n\nВведите новое значение:`,
    [[{ text: '❌ Отмена', callback_data: 'promo_mod_cancel' }]],
    { parseMode: 'Markdown' }
  );

  const currentState = await getBotState(env, chatId);
  await setBotState(env, chatId, 'promo_waiting_new_value', {
    from_moderation: currentState?.data?.from_moderation,
    editing_promotion_id: promotionId,
    editing_field: dbField,
  });

  await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id);
  return { success: true, handled: true, action: 'promotion_edit_field_prompt' };
}

/**
 * Handle promotion moderation cancel
 */
export async function handlePromotionModerationCancel(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  await clearBotState(env, chatId);
  await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Отменено' });
  const { showMainMenu } = await import('../admin.js');
  await showMainMenu(env, chatId);
  return { success: true, handled: true, action: 'promotion_edit_cancelled' };
}

/**
 * Handle FSM messages for promotions (edit from moderation)
 */
export async function handleMessage(env, update, stateData) {
  const message = update.message;
  const chatId = String(message.chat.id);
  const text = (message.text || '').trim();
  const state = (await getBotState(env, chatId))?.state;

  try {
    if (state === 'promo_waiting_new_value') {
      if (!text || text.length === 0) {
        await sendTelegramMessage(env.ADMIN_BOT_TOKEN, chatId, '❌ Значение не может быть пустым. Введите значение:');
        return { success: true, handled: true };
      }

      const currentState = await getBotState(env, chatId);
      const promotionId = currentState?.data?.editing_promotion_id;
      const field = currentState?.data?.editing_field;

      if (!promotionId || !field) {
        await sendTelegramMessage(env.ADMIN_BOT_TOKEN, chatId, '❌ Ошибка: данные редактирования потеряны');
        await clearBotState(env, chatId);
        return { success: false, handled: true };
      }

      const updateData = { [field]: text };
      const success = await updatePromotion(env, promotionId, updateData);

      if (success) {
        await sendTelegramMessage(env.ADMIN_BOT_TOKEN, chatId, `✅ Поле "${field}" обновлено!`);

        if (currentState?.data?.from_moderation) {
          const promo = await getPromotionById(env, promotionId);
          if (promo) {
            const partner = promo.partner_chat_id ? await getPartnerByChatId(env, promo.partner_chat_id) : null;
            const header = (
              `**Акция на модерации (обновлено)**\n\n` +
              `🆔 ID: ${promo.id}\n` +
              `📝 Название: ${promo.title || '—'}\n` +
              `💰 Скидка: ${promo.discount_value || promo.service_price || '—'}\n` +
              `👤 Партнёр: ${partner?.name || promo.partner_chat_id || '—'}\n\n` +
              `📄 Описание: ${(promo.description || '—').slice(0, 3500)}${(promo.description || '').length > 3500 ? '...' : ''}`
            );
            const keyboard = [
              [{ text: '✏️ Редактировать', callback_data: `promo_mod_edit_${promotionId}` }],
              [
                { text: '🟢 Одобрить', callback_data: `promo_approve_${promo.id}` },
                { text: '🔴 Отклонить', callback_data: `promo_reject_${promo.id}` },
              ],
            ];
            await sendTelegramMessageWithKeyboard(env.ADMIN_BOT_TOKEN, chatId, header, keyboard, { parseMode: 'Markdown' });
          }
        }
        await clearBotState(env, chatId);
        return { success: true, handled: true, action: 'promotion_field_updated' };
      } else {
        await sendTelegramMessage(env.ADMIN_BOT_TOKEN, chatId, '❌ Ошибка при обновлении акции');
        return { success: false, handled: true };
      }
    }

    return { success: true, handled: false };
  } catch (error) {
    logError('promotions.handleMessage', error, { chatId, state });
    await sendTelegramMessage(env.ADMIN_BOT_TOKEN, chatId, `Ошибка: ${error.message}`);
    return { success: false, handled: true, error: error.message };
  }
}
