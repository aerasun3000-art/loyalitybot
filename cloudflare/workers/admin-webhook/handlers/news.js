/**
 * News management handlers (stub for now)
 */

import { editMessageText } from '../telegram.js';

/**
 * Generic stub for news feature
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
