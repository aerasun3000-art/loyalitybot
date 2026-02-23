/**
 * Referral Commissions management handlers for admin bot
 */

import {
  supabaseRequest,
  getBotState,
  setBotState,
  clearBotState,
  getRefCommissions,
  updateRefRewardStatus,
} from '../supabase.js';
import {
  sendTelegramMessage,
  sendTelegramMessageWithKeyboard,
  answerCallbackQuery,
  editMessageText,
} from '../telegram.js';
import { logError } from '../common.js';

function roundUsd(val) {
  return (Number(val) || 0).toFixed(2);
}

function formatDate(createdAt) {
  if (!createdAt) return '—';
  return String(createdAt).substring(0, 10);
}

function shortId(id) {
  if (!id) return '—';
  return String(id).substring(0, 8);
}

/**
 * Handle Referral Commissions menu
 */
export async function handleRefCommissionsMenu(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);

  const keyboard = [
    [{ text: '📊 Статистика комиссий', callback_data: 'ref_comm_stats' }],
    [{ text: '⏳ Ожидают выплаты', callback_data: 'ref_comm_pending' }],
    [{ text: '❌ Ошибки выплат', callback_data: 'ref_comm_failed' }],
    [{ text: '🔍 По реферреру', callback_data: 'ref_comm_search' }],
    [{ text: '◀️  Назад', callback_data: 'back_to_main' }],
  ];

  await editMessageText(
    env.ADMIN_BOT_TOKEN,
    chatId,
    callbackQuery.message.message_id,
    '💳 **Реферальные комиссии**\n\nВыберите действие:',
    keyboard,
    { parseMode: 'Markdown' }
  );

  return { success: true, handled: true, action: 'ref_comm_menu' };
}

/**
 * Handle Referral Commissions stats
 */
export async function handleRefCommissionsStats(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);

  try {
    const [commissions, rewards] = await Promise.all([
      supabaseRequest(env, 'referral_rewards?reward_type=in.(commission_l1,commission_l2,commission_l3)&select=status,amount_usd,reward_type'),
      supabaseRequest(env, 'referral_rewards?reward_type=in.(registration,transaction,achievement)&select=status,points,reward_type'),
    ]);

    const comm = commissions || [];
    const rew = rewards || [];

    let pending_count = 0, pending_usd = 0;
    let accumulated_count = 0, accumulated_usd = 0;
    let paid_count = 0, paid_usd = 0;
    let failed_count = 0;
    let l1_count = 0, l1_usd = 0;
    let l2_count = 0, l2_usd = 0;
    let l3_count = 0, l3_usd = 0;

    for (const r of comm) {
      const amt = Number(r.amount_usd) || 0;
      if (r.status === 'pending') {
        pending_count++;
        pending_usd += amt;
      } else if (r.status === 'accumulated') {
        accumulated_count++;
        accumulated_usd += amt;
      } else if (r.status === 'paid_ton') {
        paid_count++;
        paid_usd += amt;
      } else if (r.status === 'failed') {
        failed_count++;
      }
      const rt = r.reward_type || '';
      if (rt === 'commission_l1') {
        l1_count++;
        l1_usd += amt;
      } else if (rt === 'commission_l2') {
        l2_count++;
        l2_usd += amt;
      } else if (rt === 'commission_l3') {
        l3_count++;
        l3_usd += amt;
      }
    }

    let reg_count = 0, txn_count = 0, ach_count = 0;
    for (const r of rew) {
      const rt = r.reward_type || '';
      if (rt === 'registration') reg_count++;
      else if (rt === 'transaction') txn_count++;
      else if (rt === 'achievement') ach_count++;
    }

    const total = comm.length;
    const text = (
      '📊 **РЕФЕРАЛЬНЫЕ КОМИССИИ**\n\n' +
      '💰 **КОМИССИИ (USD):**\n' +
      `├─ Всего записей: ${total}\n` +
      `├─ Ожидают выплаты: ${pending_count} (${roundUsd(pending_usd)} USD)\n` +
      `├─ Накоплено: ${accumulated_count} (${roundUsd(accumulated_usd)} USD)\n` +
      `├─ Выплачено (TON): ${paid_count} (${roundUsd(paid_usd)} USD)\n` +
      `└─ Ошибок: ${failed_count}\n\n` +
      '📊 **ПО УРОВНЯМ:**\n' +
      `├─ L1 (прямые): ${l1_count} записей, ${roundUsd(l1_usd)} USD\n` +
      `├─ L2 (2й уровень): ${l2_count} записей, ${roundUsd(l2_usd)} USD\n` +
      `└─ L3 (3й уровень): ${l3_count} записей, ${roundUsd(l3_usd)} USD\n\n` +
      '🎁 **РЕФЕРАЛЬНЫЕ БОНУСЫ (поинты):**\n' +
      `├─ За регистрацию: ${reg_count} записей\n` +
      `├─ За транзакцию: ${txn_count} записей\n` +
      `└─ За достижения: ${ach_count} записей`
    );

    const keyboard = [[{ text: '◀️  Назад', callback_data: 'admin_ref_commissions' }]];
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      text.substring(0, 4000),
      keyboard,
      { parseMode: 'Markdown' }
    );

    return { success: true, handled: true, action: 'ref_comm_stats' };
  } catch (error) {
    logError('handleRefCommissionsStats', error, { chatId });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка загрузки', show_alert: true });
    throw error;
  }
}

/**
 * Handle pending commissions list
 */
export async function handleRefCommissionsPending(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);

  try {
    const list = await getRefCommissions(env, 'status=eq.pending&select=*&limit=20');
    const items = list || [];

    if (items.length === 0) {
      const keyboard = [[{ text: '◀️  Назад', callback_data: 'admin_ref_commissions' }]];
      await editMessageText(
        env.ADMIN_BOT_TOKEN,
        chatId,
        callbackQuery.message.message_id,
        'Нет комиссий, ожидающих выплаты',
        keyboard
      );
      return { success: true, handled: true, action: 'ref_comm_pending_empty' };
    }

    let text = '⏳ **Ожидают выплаты**\n\n';
    const buttons = [];
    for (let i = 0; i < items.length; i++) {
      const r = items[i];
      const level = (r.reward_type || '').replace('commission_l', '') || '?';
      const refShort = String(r.referrer_chat_id || '').substring(0, 12);
      const amt = roundUsd(r.amount_usd);
      const date = formatDate(r.created_at);
      text += `#${i + 1} | L${level} | ${refShort} | ${amt} USD | ${date}\n`;
      buttons.push([{
        text: `#${i + 1} Выплатить`,
        callback_data: `ref_pay_single_${r.id}`,
      }]);
    }
    buttons.push([{
      text: '✅ Отметить все как выплачено',
      callback_data: 'ref_pay_all_pending',
    }]);
    buttons.push([{ text: '◀️  Назад', callback_data: 'admin_ref_commissions' }]);

    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      text.substring(0, 4000),
      buttons,
      { parseMode: 'Markdown' }
    );

    return { success: true, handled: true, action: 'ref_comm_pending', count: items.length };
  } catch (error) {
    logError('handleRefCommissionsPending', error, { chatId });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка загрузки', show_alert: true });
    throw error;
  }
}

/**
 * Handle failed commissions list
 */
export async function handleRefCommissionsFailed(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);

  try {
    const list = await getRefCommissions(env, 'status=eq.failed&select=*&limit=20');
    const items = list || [];

    if (items.length === 0) {
      const keyboard = [[{ text: '◀️  Назад', callback_data: 'admin_ref_commissions' }]];
      await editMessageText(
        env.ADMIN_BOT_TOKEN,
        chatId,
        callbackQuery.message.message_id,
        'Нет ошибочных выплат',
        keyboard
      );
      return { success: true, handled: true, action: 'ref_comm_failed_empty' };
    }

    let text = '❌ **Ошибки выплат**\n\n';
    const buttons = [];
    for (let i = 0; i < items.length; i++) {
      const r = items[i];
      const idShort = shortId(r.id);
      const refShort = String(r.referrer_chat_id || '').substring(0, 12);
      const amt = roundUsd(r.amount_usd);
      const date = formatDate(r.created_at);
      text += `${idShort} | ${refShort} | ${amt} USD | ${date}\n`;
      buttons.push([{
        text: `🔄 Повторить #${i + 1}`,
        callback_data: `ref_retry_${r.id}`,
      }]);
    }
    buttons.push([{ text: '◀️  Назад', callback_data: 'admin_ref_commissions' }]);

    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      text.substring(0, 4000),
      buttons,
      { parseMode: 'Markdown' }
    );

    return { success: true, handled: true, action: 'ref_comm_failed', count: items.length };
  } catch (error) {
    logError('handleRefCommissionsFailed', error, { chatId });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка загрузки', show_alert: true });
    throw error;
  }
}

/**
 * Handle single commission pay (confirmation screen)
 */
export async function handleRefCommissionPaySingle(env, callbackQuery, rewardId) {
  const chatId = String(callbackQuery.message.chat.id);

  try {
    const result = await supabaseRequest(env, `referral_rewards?id=eq.${rewardId}&select=*`);
    const reward = result && result.length > 0 ? result[0] : null;

    if (!reward || reward.status !== 'pending') {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, {
        text: 'Запись не найдена или уже обработана',
        show_alert: true,
      });
      return { success: false, handled: true };
    }

    const keyboard = [
      [
        { text: '✅ Подтвердить', callback_data: `ref_pay_confirm_${rewardId}` },
        { text: '❌ Отмена', callback_data: 'ref_comm_pending' },
      ],
    ];

    const text = (
      '💸 **Выплата комиссии**\n\n' +
      `Тип: ${reward.reward_type || '—'}\n` +
      `Реферрер: ${reward.referrer_chat_id || '—'}\n` +
      `Сумма: ${roundUsd(reward.amount_usd)} USD\n\n` +
      'Подтвердить?'
    );

    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      text,
      keyboard,
      { parseMode: 'Markdown' }
    );

    return { success: true, handled: true, action: 'ref_pay_single' };
  } catch (error) {
    logError('handleRefCommissionPaySingle', error, { rewardId });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка', show_alert: true });
    throw error;
  }
}

/**
 * Handle single commission pay confirm (execute)
 */
export async function handleRefCommissionPayConfirm(env, callbackQuery, rewardId) {
  const chatId = String(callbackQuery.message.chat.id);

  try {
    const ok = await updateRefRewardStatus(env, rewardId, 'paid_ton');
    if (!ok) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, {
        text: 'Ошибка обновления',
        show_alert: true,
      });
      return { success: false, handled: true };
    }

    const keyboard = [[{ text: '◀️  Назад', callback_data: 'ref_comm_pending' }]];
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      '✅ Комиссия отмечена как выплаченная',
      keyboard,
      { parseMode: 'Markdown' }
    );

    return { success: true, handled: true, action: 'ref_pay_confirm' };
  } catch (error) {
    logError('handleRefCommissionPayConfirm', error, { rewardId });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка', show_alert: true });
    throw error;
  }
}

/**
 * Handle pay all pending (confirmation screen)
 */
export async function handleRefCommissionPayAllPending(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);

  const keyboard = [
    [
      { text: '✅ Подтвердить', callback_data: 'ref_pay_all_confirm' },
      { text: '❌ Отмена', callback_data: 'ref_comm_pending' },
    ],
  ];

  await editMessageText(
    env.ADMIN_BOT_TOKEN,
    chatId,
    callbackQuery.message.message_id,
    'Отметить ВСЕ pending комиссии как выплаченные?',
    keyboard,
    { parseMode: 'Markdown' }
  );

  return { success: true, handled: true, action: 'ref_pay_all_pending' };
}

/**
 * Handle pay all confirm (execute bulk PATCH)
 */
export async function handleRefCommissionPayAllConfirm(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);

  try {
    await supabaseRequest(env, 'referral_rewards?status=eq.pending&reward_type=like.commission_*', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'paid_ton' }),
    });

    const keyboard = [[{ text: '◀️  Назад', callback_data: 'ref_comm_pending' }]];
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      '✅ Все pending комиссии отмечены как выплаченные',
      keyboard,
      { parseMode: 'Markdown' }
    );

    return { success: true, handled: true, action: 'ref_pay_all_confirm' };
  } catch (error) {
    logError('handleRefCommissionPayAllConfirm', error, { chatId });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка', show_alert: true });
    throw error;
  }
}

/**
 * Handle retry failed commission
 */
export async function handleRefCommissionRetry(env, callbackQuery, rewardId) {
  const chatId = String(callbackQuery.message.chat.id);

  try {
    const ok = await updateRefRewardStatus(env, rewardId, 'pending');
    if (!ok) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, {
        text: 'Ошибка обновления',
        show_alert: true,
      });
      return { success: false, handled: true };
    }

    const keyboard = [[{ text: '◀️  Назад', callback_data: 'ref_comm_failed' }]];
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      '🔄 Статус сброшен в pending. Комиссия снова в очереди на выплату.',
      keyboard,
      { parseMode: 'Markdown' }
    );

    return { success: true, handled: true, action: 'ref_retry' };
  } catch (error) {
    logError('handleRefCommissionRetry', error, { rewardId });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка', show_alert: true });
    throw error;
  }
}

/**
 * Handle search by referrer (FSM start)
 */
export async function handleRefCommissionSearch(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);

  try {
    await setBotState(env, chatId, 'ref_comm_waiting_search', {});

    const keyboard = [[{ text: '❌ Отмена', callback_data: 'admin_ref_commissions' }]];
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      'Введите chat_id реферрера для поиска его комиссий:',
      keyboard,
      { parseMode: 'Markdown' }
    );

    return { success: true, handled: true, action: 'ref_comm_search_start' };
  } catch (error) {
    logError('handleRefCommissionSearch', error, { chatId });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка', show_alert: true });
    throw error;
  }
}

/**
 * Handle search result (called from FSM when user sends chat_id)
 */
export async function handleRefCommissionSearchResult(env, update, referrerChatId) {
  const chatId = String(update.message.chat.id);

  try {
    const list = await supabaseRequest(env,
      `referral_rewards?referrer_chat_id=eq.${encodeURIComponent(referrerChatId)}&order=created_at.desc&limit=30&select=*`);
    const items = list || [];

    if (items.length === 0) {
      const keyboard = [[{ text: '◀️  Назад', callback_data: 'admin_ref_commissions' }]];
      await sendTelegramMessageWithKeyboard(
        env.ADMIN_BOT_TOKEN,
        chatId,
        `Комиссий для ${referrerChatId} не найдено`,
        keyboard,
        { parseMode: 'Markdown' }
      );
      return { success: true, handled: true, action: 'ref_comm_search_empty' };
    }

    let pending_count = 0, pending_usd = 0;
    let paid_count = 0, paid_usd = 0;
    let failed_count = 0;

    for (const r of items) {
      const amt = Number(r.amount_usd) || 0;
      if (r.reward_type && r.reward_type.startsWith('commission_')) {
        if (r.status === 'pending') {
          pending_count++;
          pending_usd += amt;
        } else if (r.status === 'paid_ton') {
          paid_count++;
          paid_usd += amt;
        } else if (r.status === 'failed') {
          failed_count++;
        }
      }
    }

    let text = (
      `🔍 **Комиссии реферрера:** ${referrerChatId}\n\n` +
      `Всего записей: ${items.length}\n` +
      `├─ pending: ${pending_count} (${roundUsd(pending_usd)} USD)\n` +
      `├─ paid_ton: ${paid_count} (${roundUsd(paid_usd)} USD)\n` +
      `└─ failed: ${failed_count}\n\n` +
      '**Последние 10:**\n'
    );

    const last10 = items.slice(0, 10);
    for (const r of last10) {
      const date = formatDate(r.created_at);
      const type = r.reward_type || '—';
      const amt = r.amount_usd != null ? roundUsd(r.amount_usd) : '—';
      const status = r.status || '—';
      text += `${date} | ${type} | ${amt} | ${status}\n`;
    }

    const keyboard = [[{ text: '◀️  Назад', callback_data: 'admin_ref_commissions' }]];
    await sendTelegramMessageWithKeyboard(
      env.ADMIN_BOT_TOKEN,
      chatId,
      text.substring(0, 4000),
      keyboard,
      { parseMode: 'Markdown' }
    );

    return { success: true, handled: true, action: 'ref_comm_search_result' };
  } catch (error) {
    logError('handleRefCommissionSearchResult', error, { chatId, referrerChatId });
    await sendTelegramMessage(env.ADMIN_BOT_TOKEN, chatId, `Ошибка: ${error.message}`);
    throw error;
  }
}

/**
 * Handle FSM messages for referral commissions
 */
export async function handleMessage(env, update, stateData) {
  const message = update.message;
  const chatId = String(message.chat.id);
  const text = (message.text || '').trim();
  const stateObj = await getBotState(env, chatId);
  const state = stateObj?.state;

  try {
    if (state === 'ref_comm_waiting_search') {
      const referrerChatId = text.trim();
      if (!referrerChatId) {
        await sendTelegramMessage(
          env.ADMIN_BOT_TOKEN,
          chatId,
          'Введите chat_id реферрера (не пустое значение).'
        );
        return { success: true, handled: true };
      }
      await clearBotState(env, chatId);
      await handleRefCommissionSearchResult(env, update, referrerChatId);
      return { success: true, handled: true, action: 'ref_comm_search_done' };
    }

    return { success: true, handled: false };
  } catch (error) {
    logError('referral_commissions.handleMessage', error, { chatId, state });
    await sendTelegramMessage(env.ADMIN_BOT_TOKEN, chatId, `Ошибка: ${error.message}`);
    return { success: false, handled: true, error: error.message };
  }
}
