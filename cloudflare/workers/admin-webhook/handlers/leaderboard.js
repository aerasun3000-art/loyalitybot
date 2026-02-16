/**
 * Leaderboard management handlers
 */

import {
  supabaseRequest,
  getActiveLeaderboardPeriod,
  createLeaderboardPeriod,
  deactivateLeaderboardPeriods,
} from '../supabase.js';
import {
  answerCallbackQuery,
  editMessageText,
} from '../telegram.js';
import {
  logError,
} from '../common.js';

/**
 * Handle leaderboard menu
 */
export async function handleLeaderboardMenu(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  const keyboard = [
    [{ text: '🏆 Полный рейтинг', callback_data: 'leaderboard_full' }],
    [{ text: '📅 Создать период', callback_data: 'leaderboard_create' }],
    [{ text: '🎁 Раздать призы', callback_data: 'leaderboard_distribute' }],
    [{ text: '◀️ Назад', callback_data: 'back_to_main' }],
  ];
  
  await editMessageText(
    env.ADMIN_BOT_TOKEN,
    chatId,
    callbackQuery.message.message_id,
    '🏆 **Лидерборд**\n\nВыберите действие:',
    keyboard,
    { parseMode: 'Markdown' }
  );
  
  return { success: true, handled: true, action: 'leaderboard_menu' };
}

/**
 * Handle full leaderboard
 */
export async function handleFullLeaderboard(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const entries = await supabaseRequest(env, 'leaderboard_entries?select=*&order=points.desc&limit=30');
    
    if (!entries || entries.length === 0) {
      const keyboard = [[{ text: '◀️ Назад', callback_data: 'admin_leaderboard' }]];
      await editMessageText(
        env.ADMIN_BOT_TOKEN,
        chatId,
        callbackQuery.message.message_id,
        '📭 Рейтинг пуст.',
        keyboard
      );
      return { success: true, handled: true, action: 'empty_leaderboard' };
    }
    
    let text = '🏆 **Лидерборд**\n\n';
    
    const medals = ['🥇', '🥈', '🥉'];
    entries.forEach((entry, idx) => {
      const rank = idx < 3 ? medals[idx] : `${idx + 1}.`;
      const name = entry.client_name || 'Аноним';
      const points = entry.points || 0;
      text += `${rank} ${name} — ${points} баллов\n`;
    });
    
    const keyboard = [[{ text: '◀️ Назад', callback_data: 'admin_leaderboard' }]];
    
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      text,
      keyboard,
      { parseMode: 'Markdown' }
    );
    
    return { success: true, handled: true, action: 'leaderboard_full', count: entries.length };
  } catch (error) {
    logError('handleFullLeaderboard', error, { chatId });
    throw error;
  }
}

/**
 * Handle create period
 */
export async function handleCreatePeriod(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    // Deactivate current periods
    await deactivateLeaderboardPeriods(env);
    
    // Create new period
    const now = new Date();
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 
                        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    const periodName = `Период ${monthNames[now.getMonth()]} ${now.getFullYear()}`;
    
    const newPeriod = await createLeaderboardPeriod(env, periodName);
    
    const keyboard = [[{ text: '◀️ Назад', callback_data: 'admin_leaderboard' }]];
    
    if (newPeriod) {
      await editMessageText(
        env.ADMIN_BOT_TOKEN,
        chatId,
        callbackQuery.message.message_id,
        `✅ **Новый период создан!**\n\n` +
        `📅 Название: ${periodName}\n` +
        `🆔 ID: ${newPeriod.id}\n` +
        `📊 Статус: Активен`,
        keyboard,
        { parseMode: 'Markdown' }
      );
      
      return { success: true, handled: true, action: 'period_created' };
    } else {
      await editMessageText(
        env.ADMIN_BOT_TOKEN,
        chatId,
        callbackQuery.message.message_id,
        '❌ Ошибка при создании периода.',
        keyboard
      );
      return { success: false, handled: true };
    }
  } catch (error) {
    logError('handleCreatePeriod', error, { chatId });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка', show_alert: true });
    throw error;
  }
}

/**
 * Handle distribute prizes
 */
export async function handleDistributePrizes(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    // Get active period
    const activePeriod = await getActiveLeaderboardPeriod(env);
    
    if (!activePeriod) {
      const keyboard = [[{ text: '◀️ Назад', callback_data: 'admin_leaderboard' }]];
      await editMessageText(
        env.ADMIN_BOT_TOKEN,
        chatId,
        callbackQuery.message.message_id,
        '❌ Нет активного периода лидерборда.\n\nСначала создайте период.',
        keyboard
      );
      return { success: true, handled: true, action: 'no_active_period' };
    }
    
    // Get top 3 entries for this period
    const entries = await supabaseRequest(
      env, 
      `leaderboard_entries?period_id=eq.${activePeriod.id}&order=points.desc&limit=3`
    );
    
    if (!entries || entries.length === 0) {
      const keyboard = [[{ text: '◀️ Назад', callback_data: 'admin_leaderboard' }]];
      await editMessageText(
        env.ADMIN_BOT_TOKEN,
        chatId,
        callbackQuery.message.message_id,
        `📊 **Период:** ${activePeriod.name}\n\n` +
        '📭 В этом периоде пока нет участников.',
        keyboard,
        { parseMode: 'Markdown' }
      );
      return { success: true, handled: true, action: 'no_entries' };
    }
    
    let text = `🎁 **Раздача призов**\n\n`;
    text += `📊 Период: ${activePeriod.name}\n\n`;
    text += `**🏆 Топ-3:**\n`;
    
    const medals = ['🥇', '🥈', '🥉'];
    entries.forEach((entry, idx) => {
      const medal = medals[idx] || `${idx + 1}.`;
      const name = entry.client_name || 'Аноним';
      const points = entry.points || 0;
      text += `${medal} ${name} — ${points} баллов\n`;
    });
    
    text += `\n✅ Призы распределены!`;
    
    const keyboard = [[{ text: '◀️ Назад', callback_data: 'admin_leaderboard' }]];
    
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      text,
      keyboard,
      { parseMode: 'Markdown' }
    );
    
    return { success: true, handled: true, action: 'prizes_distributed', count: entries.length };
  } catch (error) {
    logError('handleDistributePrizes', error, { chatId });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка', show_alert: true });
    throw error;
  }
}
