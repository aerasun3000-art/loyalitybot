/**
 * News management handlers
 */

import {
  getAllNews,
  getNewsById,
  createNews,
  updateNews,
  deleteNews,
  setBotState,
  clearBotState,
  updateBotStateData,
  getBotState,
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

/**
 * Handle news menu
 */
export async function handleNewsMenu(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  const keyboard = [
    [{ text: '➕ Создать новость', callback_data: 'news_create' }],
    [{ text: '📋 Список новостей', callback_data: 'news_list' }],
    [{ text: '✏️ Редактировать новость', callback_data: 'news_edit' }],
    [{ text: '🗑 Удалить новость', callback_data: 'news_delete' }],
    [{ text: '◀️ Назад', callback_data: 'back_to_main' }],
  ];
  
  await editMessageText(
    env.ADMIN_BOT_TOKEN,
    chatId,
    callbackQuery.message.message_id,
    '📰 **Управление новостями**\n\nВыберите действие:',
    keyboard,
    { parseMode: 'Markdown' }
  );
  
  return { success: true, handled: true, action: 'news_menu' };
}

/**
 * Handle create news start
 */
export async function handleCreateNews(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  await editMessageText(
    env.ADMIN_BOT_TOKEN,
    chatId,
    callbackQuery.message.message_id,
    '➕ **Создание новости**\n\n**Шаг 1/3:** Введите заголовок новости:',
    [[{ text: '❌ Отмена', callback_data: 'news_cancel' }]],
    { parseMode: 'Markdown' }
  );
  
  await setBotState(env, chatId, 'news_waiting_title', {});
  
  return { success: true, handled: true, action: 'create_news_start' };
}

/**
 * Handle news list
 */
export async function handleNewsList(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const allNews = await getAllNews(env);
    
    if (allNews.length === 0) {
      const keyboard = [[{ text: '◀️ Назад', callback_data: 'admin_news' }]];
      await editMessageText(
        env.ADMIN_BOT_TOKEN,
        chatId,
        callbackQuery.message.message_id,
        '📭 Новостей пока нет.',
        keyboard
      );
      return { success: true, handled: true, action: 'no_news' };
    }
    
    let text = '📰 **Список новостей**\n\n';
    
    allNews.slice(0, 20).forEach((item, idx) => {
      const status = item.is_published ? '✅ Опубликована' : '📝 Черновик';
      const date = (item.created_at || '').substring(0, 10);
      text += `${idx + 1}. **${item.title || 'Без заголовка'}**\n`;
      text += `   ${status} | ${date}\n\n`;
    });
    
    const keyboard = [[{ text: '◀️ Назад', callback_data: 'admin_news' }]];
    
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      text,
      keyboard,
      { parseMode: 'Markdown' }
    );
    
    return { success: true, handled: true, action: 'news_list', count: allNews.length };
  } catch (error) {
    logError('handleNewsList', error, { chatId });
    throw error;
  }
}

/**
 * Handle edit news start
 */
export async function handleEditNewsStart(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const allNews = await getAllNews(env);
    
    if (allNews.length === 0) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Нет новостей', show_alert: true });
      return { success: false, handled: true };
    }
    
    const keyboard = allNews.slice(0, 20).map((item, idx) => [{
      text: `${idx + 1}. ${item.title || 'Без заголовка'}`,
      callback_data: `news_select_edit_${item.id}`,
    }]);
    
    keyboard.push([{ text: '◀️ Назад', callback_data: 'admin_news' }]);
    
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      '✏️ **Выберите новость для редактирования:**',
      keyboard,
      { parseMode: 'Markdown' }
    );
    
    return { success: true, handled: true, action: 'edit_news_start' };
  } catch (error) {
    logError('handleEditNewsStart', error, { chatId });
    throw error;
  }
}

/**
 * Handle select news for edit
 */
export async function handleSelectNewsForEdit(env, callbackQuery, newsId) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const newsItem = await getNewsById(env, newsId);
    
    if (!newsItem) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Новость не найдена', show_alert: true });
      return { success: false, handled: true };
    }
    
    const keyboard = [
      [{ text: '📝 Заголовок', callback_data: `news_edit_field_title_${newsId}` }],
      [{ text: '📄 Контент', callback_data: `news_edit_field_content_${newsId}` }],
      [{ text: '💬 Превью', callback_data: `news_edit_field_preview_${newsId}` }],
      [{ text: newsItem.is_published ? '📝 Снять с публикации' : '✅ Опубликовать', callback_data: `news_toggle_published_${newsId}` }],
      [{ text: '◀️ Назад', callback_data: 'news_edit' }],
    ];
    
    const text = (
      `✏️ **Редактирование новости**\n\n` +
      `📝 Заголовок: ${newsItem.title || '—'}\n` +
      `📄 Контент: ${(newsItem.content || '—').substring(0, 100)}...\n` +
      `💬 Превью: ${newsItem.preview_text || '—'}\n` +
      `📊 Статус: ${newsItem.is_published ? '✅ Опубликована' : '📝 Черновик'}\n\n` +
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
    
    await setBotState(env, chatId, 'news_selecting_field', { news_id: newsId });
    
    return { success: true, handled: true, action: 'news_selected' };
  } catch (error) {
    logError('handleSelectNewsForEdit', error, { chatId, newsId });
    throw error;
  }
}

/**
 * Handle edit news field
 */
export async function handleEditNewsField(env, callbackQuery, field, newsId) {
  const chatId = String(callbackQuery.message.chat.id);
  
  const fieldNames = {
    title: 'заголовок',
    content: 'контент',
    preview: 'превью',
  };
  
  await editMessageText(
    env.ADMIN_BOT_TOKEN,
    chatId,
    callbackQuery.message.message_id,
    `✏️ **Редактирование: ${fieldNames[field] || field}**\n\nВведите новое значение:`,
    [[{ text: '❌ Отмена', callback_data: 'news_cancel' }]],
    { parseMode: 'Markdown' }
  );
  
  const dbField = field === 'preview' ? 'preview_text' : field;
  
  await setBotState(env, chatId, 'news_waiting_new_value', {
    news_id: newsId,
    editing_field: dbField,
  });
  
  return { success: true, handled: true, action: 'edit_field_prompt' };
}

/**
 * Handle toggle published status
 */
export async function handleTogglePublished(env, callbackQuery, newsId) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const newsItem = await getNewsById(env, newsId);
    
    if (!newsItem) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Новость не найдена', show_alert: true });
      return { success: false, handled: true };
    }
    
    const newStatus = !newsItem.is_published;
    const success = await updateNews(env, newsId, { is_published: newStatus });
    
    if (success) {
      const statusText = newStatus ? '✅ Опубликована' : '📝 Снята с публикации';
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: statusText });
      
      await handleSelectNewsForEdit(env, callbackQuery, newsId);
      
      return { success: true, handled: true, action: 'published_toggled' };
    } else {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка обновления', show_alert: true });
      return { success: false, handled: true };
    }
  } catch (error) {
    logError('handleTogglePublished', error, { chatId, newsId });
    throw error;
  }
}

/**
 * Handle delete news start
 */
export async function handleDeleteNewsStart(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const allNews = await getAllNews(env);
    
    if (allNews.length === 0) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Нет новостей', show_alert: true });
      return { success: false, handled: true };
    }
    
    const keyboard = allNews.slice(0, 20).map((item, idx) => [{
      text: `${idx + 1}. ${item.title || 'Без заголовка'}`,
      callback_data: `news_delete_select_${item.id}`,
    }]);
    
    keyboard.push([{ text: '◀️ Назад', callback_data: 'admin_news' }]);
    
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      '🗑 **Выберите новость для удаления:**',
      keyboard,
      { parseMode: 'Markdown' }
    );
    
    return { success: true, handled: true, action: 'delete_news_start' };
  } catch (error) {
    logError('handleDeleteNewsStart', error, { chatId });
    throw error;
  }
}

/**
 * Handle delete news select
 */
export async function handleDeleteNewsSelect(env, callbackQuery, newsId) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const newsItem = await getNewsById(env, newsId);
    
    if (!newsItem) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Новость не найдена', show_alert: true });
      return { success: false, handled: true };
    }
    
    const keyboard = [
      [
        { text: '✅ Да, удалить', callback_data: `news_delete_confirm_${newsId}` },
        { text: '❌ Отмена', callback_data: 'news_delete' },
      ],
    ];
    
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      `⚠️ **Подтверждение удаления**\n\nВы уверены, что хотите удалить новость?\n\n**Заголовок:** ${newsItem.title}\n\n**Это действие нельзя отменить!**`,
      keyboard,
      { parseMode: 'Markdown' }
    );
    
    return { success: true, handled: true, action: 'delete_confirmation' };
  } catch (error) {
    logError('handleDeleteNewsSelect', error, { chatId, newsId });
    throw error;
  }
}

/**
 * Handle delete news confirm
 */
export async function handleDeleteNewsConfirm(env, callbackQuery, newsId) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const newsItem = await getNewsById(env, newsId);
    
    if (!newsItem) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Новость не найдена', show_alert: true });
      return { success: false, handled: true };
    }
    
    await deleteNews(env, newsId);
    
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: '✅ Новость удалена' });
    
    const keyboard = [[{ text: '◀️ Назад', callback_data: 'admin_news' }]];
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      `✅ Новость "${newsItem.title}" удалена.`,
      keyboard,
      { parseMode: 'Markdown' }
    );
    
    return { success: true, handled: true, action: 'news_deleted' };
  } catch (error) {
    logError('handleDeleteNewsConfirm', error, { chatId, newsId });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка при удалении', show_alert: true });
    throw error;
  }
}

/**
 * Handle cancel news
 */
export async function handleCancelNews(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  await clearBotState(env, chatId);
  await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Отменено' });
  
  await handleNewsMenu(env, callbackQuery);
  
  return { success: true, handled: true, action: 'news_cancelled' };
}

/**
 * Handle FSM messages for news
 */
export async function handleMessage(env, update, stateData) {
  const message = update.message;
  const chatId = String(message.chat.id);
  const text = message.text || '';
  const state = (await getBotState(env, chatId))?.state;
  
  try {
    // Handle title input
    if (state === 'news_waiting_title') {
      if (!text || text.trim().length === 0) {
        await sendTelegramMessage(env.ADMIN_BOT_TOKEN, chatId, '❌ Заголовок не может быть пустым. Введите заголовок:');
        return { success: true, handled: true };
      }
      
      await updateBotStateData(env, chatId, { title: text.trim() });
      await setBotState(env, chatId, 'news_waiting_content', stateData);
      
      await sendTelegramMessage(
        env.ADMIN_BOT_TOKEN,
        chatId,
        '✅ Заголовок сохранён!\n\n**Шаг 2/3:** Введите основной текст новости:'
      );
      
      return { success: true, handled: true, action: 'title_saved' };
    }
    
    // Handle content input
    if (state === 'news_waiting_content') {
      if (!text || text.trim().length === 0) {
        await sendTelegramMessage(env.ADMIN_BOT_TOKEN, chatId, '❌ Текст не может быть пустым. Введите текст новости:');
        return { success: true, handled: true };
      }
      
      await updateBotStateData(env, chatId, { content: text.trim() });
      await setBotState(env, chatId, 'news_waiting_preview', stateData);
      
      await sendTelegramMessage(
        env.ADMIN_BOT_TOKEN,
        chatId,
        '✅ Текст сохранён!\n\n**Шаг 3/3:** Введите короткий превью-текст:'
      );
      
      return { success: true, handled: true, action: 'content_saved' };
    }
    
    // Handle preview input and create news
    if (state === 'news_waiting_preview') {
      const currentState = await getBotState(env, chatId);
      const newsData = {
        title: currentState.data?.title,
        content: currentState.data?.content,
        preview_text: text.trim() || null,
      };
      
      const newNews = await createNews(env, newsData);
      
      if (newNews) {
        await clearBotState(env, chatId);
        
        const keyboard = [[{ text: '◀️ Назад', callback_data: 'admin_news' }]];
        
        await sendTelegramMessageWithKeyboard(
          env.ADMIN_BOT_TOKEN,
          chatId,
          (
            `✅ **Новость успешно создана!**\n\n` +
            `🆔 ID: ${newNews.id}\n` +
            `📰 Заголовок: ${newNews.title}\n` +
            `📊 Статус: Черновик (не опубликована)\n\n` +
            `Используйте "Редактировать новость" для публикации.`
          ),
          keyboard,
          { parseMode: 'Markdown' }
        );
        
        return { success: true, handled: true, action: 'news_created' };
      } else {
        await sendTelegramMessage(env.ADMIN_BOT_TOKEN, chatId, '❌ Ошибка при создании новости');
        await clearBotState(env, chatId);
        return { success: false, handled: true };
      }
    }
    
    // Handle editing field
    if (state === 'news_waiting_new_value') {
      if (!text || text.trim().length === 0) {
        await sendTelegramMessage(env.ADMIN_BOT_TOKEN, chatId, '❌ Значение не может быть пустым. Введите значение:');
        return { success: true, handled: true };
      }
      
      const currentState = await getBotState(env, chatId);
      const newsId = currentState?.data?.news_id;
      const field = currentState?.data?.editing_field;
      
      if (!newsId || !field) {
        await sendTelegramMessage(env.ADMIN_BOT_TOKEN, chatId, '❌ Ошибка: данные редактирования потеряны');
        await clearBotState(env, chatId);
        return { success: false, handled: true };
      }
      
      const updateData = { [field]: text.trim() };
      const success = await updateNews(env, newsId, updateData);
      
      if (success) {
        await sendTelegramMessage(env.ADMIN_BOT_TOKEN, chatId, `✅ Поле "${field}" обновлено!`);
        await clearBotState(env, chatId);
        
        const keyboard = [[{ text: '◀️ Назад', callback_data: 'admin_news' }]];
        await sendTelegramMessageWithKeyboard(
          env.ADMIN_BOT_TOKEN,
          chatId,
          '✅ Новость обновлена!',
          keyboard
        );
        
        return { success: true, handled: true, action: 'field_updated' };
      } else {
        await sendTelegramMessage(env.ADMIN_BOT_TOKEN, chatId, '❌ Ошибка при обновлении новости');
        return { success: false, handled: true };
      }
    }
    
    return { success: true, handled: false };
  } catch (error) {
    logError('news.handleMessage', error, { chatId, state });
    await sendTelegramMessage(env.ADMIN_BOT_TOKEN, chatId, `Ошибка: ${error.message}`);
    return { success: false, handled: true, error: error.message };
  }
}

/**
 * Generic stub for unimplemented features
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
