/**
 * Ambassador management handlers for admin bot
 */

import {
  supabaseRequest,
  getBotState,
  setBotState,
  clearBotState,
  getAmbassadorByChatId,
  getAmbassadorPartners,
  updateAmbassador,
} from '../supabase.js';
import {
  sendTelegramMessage,
  sendTelegramMessageWithKeyboard,
  answerCallbackQuery,
  editMessageText,
} from '../telegram.js';
import { logError } from '../common.js';

function statusEmoji(status) {
  if (status === 'active') return '✅';
  if (status === 'suspended') return '⏸';
  if (status === 'blocked') return '🚫';
  return '❓';
}

/**
 * Handle Ambassadors menu
 */
export async function handleAmbassadorsMenu(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);

  const keyboard = [
    [{ text: '📋 Список амбассадоров', callback_data: 'admin_amb_list' }],
    [{ text: '⏳ Ожидают выплаты', callback_data: 'admin_amb_pending_payout' }],
    [{ text: '◀️  Назад', callback_data: 'back_to_main' }],
  ];

  await editMessageText(
    env.ADMIN_BOT_TOKEN,
    chatId,
    callbackQuery.message.message_id,
    '🌟 **Амбассадоры**\n\nВыберите действие:',
    keyboard,
    { parseMode: 'Markdown' }
  );

  return { success: true, handled: true, action: 'ambassadors_menu' };
}

/**
 * Handle Ambassadors list
 */
export async function handleAmbassadorsList(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);

  try {
    const list = await supabaseRequest(env, 'ambassadors?select=*&order=total_earnings.desc&limit=30');
    const ambassadors = list || [];

    if (ambassadors.length === 0) {
      const keyboard = [[{ text: '◀️  Назад', callback_data: 'admin_ambassadors' }]];
      await editMessageText(
        env.ADMIN_BOT_TOKEN,
        chatId,
        callbackQuery.message.message_id,
        '📭 Список амбассадоров пуст.',
        keyboard
      );
      return { success: true, handled: true, action: 'amb_list_empty' };
    }

    let text = '🌟 **Список амбассадоров**\n\n';
    const buttons = [];

    for (let i = 0; i < ambassadors.length; i++) {
      const a = ambassadors[i];
      const partnersResult = await supabaseRequest(env,
        `ambassador_partners?ambassador_chat_id=eq.${a.chat_id}&select=id`);
      const partnersCount = partnersResult ? partnersResult.length : 0;
      const emoji = statusEmoji(a.status || 'active');
      const chatIdShort = String(a.chat_id).substring(0, 10);
      const earnings = Number(a.total_earnings || 0);
      const tier = a.tier_at_signup || '—';
      text += `${emoji} #${i + 1} ${chatIdShort} | ${tier} | партнёров: ${partnersCount} | заработано: ${Math.round(earnings)}\n`;
      buttons.push([{
        text: `#${i + 1} ${chatIdShort}`,
        callback_data: `amb_detail_${a.chat_id}`,
      }]);
    }

    buttons.push([{ text: '◀️  Назад', callback_data: 'admin_ambassadors' }]);

    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      text.substring(0, 4000),
      buttons,
      { parseMode: 'Markdown' }
    );

    return { success: true, handled: true, action: 'amb_list', count: ambassadors.length };
  } catch (error) {
    logError('handleAmbassadorsList', error, { chatId });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка загрузки', show_alert: true });
    throw error;
  }
}

/**
 * Handle Ambassador detail
 */
export async function handleAmbassadorDetail(env, callbackQuery, ambassadorChatId) {
  const chatId = String(callbackQuery.message.chat.id);

  try {
    const ambassador = await getAmbassadorByChatId(env, ambassadorChatId);
    if (!ambassador) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Амбассадор не найден', show_alert: true });
      return { success: false, handled: true };
    }

    const userResult = await supabaseRequest(env, `users?chat_id=eq.${ambassadorChatId}&select=name`);
    const userName = userResult && userResult.length > 0 ? userResult[0].name : null;

    const ambPartners = await getAmbassadorPartners(env, ambassadorChatId);
    const partnerNames = [];
    for (const p of ambPartners.slice(0, 5)) {
      const partnerResult = await supabaseRequest(env,
        `partners?chat_id=eq.${p.partner_chat_id}&select=name,company_name`);
      const partner = partnerResult && partnerResult.length > 0 ? partnerResult[0] : null;
      const name = partner ? (partner.company_name || partner.name || p.partner_chat_id) : p.partner_chat_id;
      partnerNames.push(`• ${name}`);
    }
    const partnersList = partnerNames.length > 0 ? partnerNames.join('\n') : '—';

    const emoji = statusEmoji(ambassador.status || 'active');
    const lastPayout = ambassador.last_payout_at
      ? ambassador.last_payout_at.substring(0, 10)
      : 'не было';

    const detailText = (
      `🌟 **АМБАССАДОР:** ${userName || ambassadorChatId}\n\n` +
      `📋 **ПРОФИЛЬ:**\n` +
      `├─ ID: ${ambassador.chat_id}\n` +
      `├─ Код: ${ambassador.ambassador_code || '—'}\n` +
      `├─ Статус: ${emoji} ${ambassador.status || 'active'}\n` +
      `├─ Тир при входе: ${ambassador.tier_at_signup || '—'}\n` +
      `└─ Лимит партнёров: ${ambPartners.length}/${ambassador.max_partners || 3}\n\n` +
      `💰 **ФИНАНСЫ:**\n` +
      `├─ Заработано всего: ${Number(ambassador.total_earnings || 0)}\n` +
      `├─ Ожидает выплаты: ${Number(ambassador.balance_pending || 0)}\n` +
      `└─ Последняя выплата: ${lastPayout}\n\n` +
      `🏪 **ПАРТНЁРЫ (${ambPartners.length}):**\n${partnersList}`
    );

    const keyboard = [];
    const balancePending = Number(ambassador.balance_pending || 0);
    if (balancePending > 0) {
      keyboard.push([{
        text: `💸 Выплатить ${balancePending}`,
        callback_data: `amb_payout_${ambassadorChatId}`,
      }]);
    }
    keyboard.push([{
      text: '✏️  Изменить лимит',
      callback_data: `amb_set_limit_${ambassadorChatId}`,
    }]);
    if (ambassador.status === 'active') {
      keyboard.push([{
        text: '⏸ Приостановить',
        callback_data: `amb_suspend_${ambassadorChatId}`,
      }]);
    }
    if (ambassador.status === 'suspended') {
      keyboard.push([{
        text: '✅ Активировать',
        callback_data: `amb_activate_${ambassadorChatId}`,
      }]);
    }
    keyboard.push([{ text: '◀️  Назад к списку', callback_data: 'admin_amb_list' }]);

    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      detailText.substring(0, 4000),
      keyboard,
      { parseMode: 'Markdown' }
    );

    return { success: true, handled: true, action: 'amb_detail' };
  } catch (error) {
    logError('handleAmbassadorDetail', error, { ambassadorChatId });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка загрузки', show_alert: true });
    throw error;
  }
}

/**
 * Handle Ambassador payout (confirmation screen)
 */
export async function handleAmbassadorPayout(env, callbackQuery, ambassadorChatId) {
  const chatId = String(callbackQuery.message.chat.id);

  try {
    const ambassador = await getAmbassadorByChatId(env, ambassadorChatId);
    if (!ambassador) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Амбассадор не найден', show_alert: true });
      return { success: false, handled: true };
    }

    const balancePending = Number(ambassador.balance_pending || 0);
    if (balancePending <= 0) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Нет средств для выплаты', show_alert: true });
      return { success: false, handled: true };
    }

    const keyboard = [
      [
        { text: '✅ Подтвердить выплату', callback_data: `amb_payout_confirm_${ambassadorChatId}` },
        { text: '❌ Отмена', callback_data: `amb_detail_${ambassadorChatId}` },
      ],
    ];

    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      `💸 **Подтверждение выплаты**\n\nСумма: **${balancePending}**\n\nПодтвердить?`,
      keyboard,
      { parseMode: 'Markdown' }
    );

    return { success: true, handled: true, action: 'amb_payout_confirm' };
  } catch (error) {
    logError('handleAmbassadorPayout', error, { ambassadorChatId });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка', show_alert: true });
    throw error;
  }
}

/**
 * Handle Ambassador payout confirm (execute)
 */
export async function handleAmbassadorPayoutConfirm(env, callbackQuery, ambassadorChatId) {
  const chatId = String(callbackQuery.message.chat.id);

  try {
    const ambassador = await getAmbassadorByChatId(env, ambassadorChatId);
    if (!ambassador) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Амбассадор не найден', show_alert: true });
      return { success: false, handled: true };
    }

    const amount = Number(ambassador.balance_pending || 0);
    if (amount <= 0) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Нет средств для выплаты', show_alert: true });
      return { success: false, handled: true };
    }

    await updateAmbassador(env, ambassadorChatId, {
      balance_pending: 0,
      last_payout_at: new Date().toISOString(),
    });

    const token = env.PARTNER_BOT_TOKEN || env.TOKEN_PARTNER;
    if (token) {
      try {
        await sendTelegramMessage(
          token,
          String(ambassadorChatId),
          `💸 Выплата ${amount} произведена администратором. Спасибо за работу!`
        );
      } catch (notifyErr) {
        logError('handleAmbassadorPayoutConfirm notify', notifyErr, { ambassadorChatId });
      }
    }

    const keyboard = [[{ text: '◀️  Назад', callback_data: `amb_detail_${ambassadorChatId}` }]];
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      `✅ **Выплата выполнена**\n\nСумма: **${amount}**\n\nАмбассадор уведомлён.`,
      keyboard,
      { parseMode: 'Markdown' }
    );

    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: '✅ Выплата выполнена' });
    return { success: true, handled: true, action: 'amb_payout_done' };
  } catch (error) {
    logError('handleAmbassadorPayoutConfirm', error, { ambassadorChatId });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка выплаты', show_alert: true });
    throw error;
  }
}

/**
 * Handle Ambassador set limit (FSM start)
 */
export async function handleAmbassadorSetLimit(env, callbackQuery, ambassadorChatId) {
  const chatId = String(callbackQuery.message.chat.id);

  try {
    const ambassador = await getAmbassadorByChatId(env, ambassadorChatId);
    if (!ambassador) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Амбассадор не найден', show_alert: true });
      return { success: false, handled: true };
    }

    const ambPartners = await getAmbassadorPartners(env, ambassadorChatId);
    const currentCount = ambPartners.length;
    const maxPartners = ambassador.max_partners || 3;

    await setBotState(env, chatId, 'amb_waiting_limit', { ambassadorChatId });

    const keyboard = [[{ text: '❌ Отмена', callback_data: `amb_detail_${ambassadorChatId}` }]];
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      `✏️ **Изменение лимита партнёров**\n\n` +
      `Текущий лимит: **${maxPartners}**\n` +
      `Текущее кол-во партнёров: **${currentCount}**\n\n` +
      `Введите новый лимит (минимум: ${currentCount}):`,
      keyboard,
      { parseMode: 'Markdown' }
    );

    return { success: true, handled: true, action: 'amb_set_limit_start' };
  } catch (error) {
    logError('handleAmbassadorSetLimit', error, { ambassadorChatId });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка', show_alert: true });
    throw error;
  }
}

/**
 * Handle Ambassador toggle status (suspend/activate)
 */
export async function handleAmbassadorToggleStatus(env, callbackQuery, ambassadorChatId, newStatus) {
  const chatId = String(callbackQuery.message.chat.id);

  try {
    const ok = await updateAmbassador(env, ambassadorChatId, { status: newStatus });
    if (!ok) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка обновления', show_alert: true });
      return { success: false, handled: true };
    }

    const msg = newStatus === 'active' ? '✅ Амбассадор активирован' : '⏸ Амбассадор приостановлен';
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: msg });

    return await handleAmbassadorDetail(env, callbackQuery, ambassadorChatId);
  } catch (error) {
    logError('handleAmbassadorToggleStatus', error, { ambassadorChatId, newStatus });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка', show_alert: true });
    throw error;
  }
}

/**
 * Handle pending payouts list
 */
export async function handlePendingPayouts(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);

  try {
    const list = await supabaseRequest(env,
      'ambassadors?balance_pending=gt.0&select=*&order=balance_pending.desc');
    const ambassadors = list || [];

    if (ambassadors.length === 0) {
      const keyboard = [[{ text: '◀️  Назад', callback_data: 'admin_ambassadors' }]];
      await editMessageText(
        env.ADMIN_BOT_TOKEN,
        chatId,
        callbackQuery.message.message_id,
        'Нет амбассадоров с ожидающими выплатами.',
        keyboard
      );
      return { success: true, handled: true, action: 'amb_pending_empty' };
    }

    let text = '⏳ **Ожидают выплаты**\n\n';
    const buttons = ambassadors.map(a => [{
      text: `${a.chat_id} — ${Number(a.balance_pending || 0)}`,
      callback_data: `amb_detail_${a.chat_id}`,
    }]);
    buttons.push([{ text: '◀️  Назад', callback_data: 'admin_ambassadors' }]);

    for (const a of ambassadors) {
      text += `• ${a.chat_id}: **${Number(a.balance_pending || 0)}**\n`;
    }

    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      text.substring(0, 4000),
      buttons,
      { parseMode: 'Markdown' }
    );

    return { success: true, handled: true, action: 'amb_pending_list', count: ambassadors.length };
  } catch (error) {
    logError('handlePendingPayouts', error, { chatId });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка загрузки', show_alert: true });
    throw error;
  }
}

/**
 * Handle FSM messages for ambassadors
 */
export async function handleMessage(env, update, stateData) {
  const message = update.message;
  const chatId = String(message.chat.id);
  const text = (message.text || '').trim();
  const stateObj = await getBotState(env, chatId);
  const state = stateObj?.state;

  try {
    if (state === 'amb_waiting_limit') {
      const ambassadorChatId = stateData?.ambassadorChatId;
      if (!ambassadorChatId) {
        await clearBotState(env, chatId);
        await sendTelegramMessage(env.ADMIN_BOT_TOKEN, chatId, '❌ Ошибка: данные сессии потеряны.');
        return { success: true, handled: true };
      }

      const limit = parseInt(text, 10);
      if (isNaN(limit) || limit < 1) {
        await sendTelegramMessage(
          env.ADMIN_BOT_TOKEN,
          chatId,
          '❌ Введите целое число больше 0.'
        );
        return { success: true, handled: true };
      }

      const ambPartners = await getAmbassadorPartners(env, ambassadorChatId);
      const currentCount = ambPartners.length;
      if (limit < currentCount) {
        await sendTelegramMessage(
          env.ADMIN_BOT_TOKEN,
          chatId,
          `❌ Минимум: ${currentCount} (текущее кол-во партнёров).`
        );
        return { success: true, handled: true };
      }

      await updateAmbassador(env, ambassadorChatId, { max_partners: limit });
      await clearBotState(env, chatId);

      const keyboard = [[{ text: '◀️  Назад', callback_data: `amb_detail_${ambassadorChatId}` }]];
      await sendTelegramMessageWithKeyboard(
        env.ADMIN_BOT_TOKEN,
        chatId,
        `✅ **Лимит обновлён!**\n\nНовый лимит партнёров: **${limit}**`,
        keyboard,
        { parseMode: 'Markdown' }
      );

      return { success: true, handled: true, action: 'amb_limit_set' };
    }

    return { success: true, handled: false };
  } catch (error) {
    logError('ambassadors.handleMessage', error, { chatId, state });
    await sendTelegramMessage(env.ADMIN_BOT_TOKEN, chatId, `Ошибка: ${error.message}`);
    return { success: false, handled: true, error: error.message };
  }
}
