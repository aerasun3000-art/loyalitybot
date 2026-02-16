/**
 * Leaderboard management handlers
 */

import {
  supabaseRequest,
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
 * Generic stub
 */
export async function handleFeatureStub(env, callbackQuery, featureName) {
  const chatId = String(callbackQuery.message.chat.id);
  
  const keyboard = [[{ text: '◀️ Назад', callback_data: 'back_to_main' }]];
  
  await editMessageText(
    env.ADMIN_BOT_TOKEN,
    chatId,
    callbackQuery.message.message_id,
    `⚠️ **${featureName}**\n\nДанная функция пока не реализована в облачной версии админ-бота.\n\nДля доступа ко всем функциям используйте локальную Python-версию админ-бота.`,
    keyboard,
    { parseMode: 'Markdown' }
  );
  
  return { success: true, handled: true, action: 'feature_not_implemented' };
}
