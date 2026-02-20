/**
 * Service management and moderation handlers
 */

import { 
  supabaseRequest,
  updateServiceApprovalStatus,
  getServiceById,
  getPendingServices,
  getServicesByPartner,
  getServiceCategories,
  addService,
  updateService,
  deleteService,
  updatePartnerField,
  getDistinctCitiesFromPartners,
  getDistrictsForCity,
  getPartnerByChatId,
  getBotState,
  setBotState,
  clearBotState,
  updateBotStateData,
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
import { showMainMenu } from '../admin.js';

/**
 * Handle service moderation menu
 */
export async function handleAdminServices(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const pendingServices = await getPendingServices(env);
    
    if (pendingServices.length === 0) {
      const keyboard = [[{ text: '◀️ Назад', callback_data: 'back_to_main' }]];
      await editMessageText(
        env.ADMIN_BOT_TOKEN,
        chatId,
        callbackQuery.message.message_id,
        '✅ Нет услуг на модерации.',
        keyboard
      );
      return { success: true, handled: true, action: 'no_pending_services' };
    }
    
    for (const service of pendingServices) {
      const messageText = (
        `**Новая услуга на модерации**\n\n` +
        `🆔 ID: ${service.id}\n` +
        `📝 Название: ${service.title || '—'}\n` +
        `📄 Описание: ${service.description || '—'}\n` +
        `💰 Цена: ${service.price || '—'}\n` +
        `📂 Категория: ${service.category || '—'}\n` +
        `👤 Партнёр: ${service.partner_chat_id || '—'}`
      );
      
      const keyboard = [
        [
          { text: '🟢 Одобрить', callback_data: `service_approve_${service.id}` },
          { text: '🔴 Отклонить', callback_data: `service_reject_${service.id}` },
        ],
      ];
      
      await sendTelegramMessageWithKeyboard(
        env.ADMIN_BOT_TOKEN,
        chatId,
        messageText,
        keyboard
      );
    }
    
    const keyboard = [[{ text: '◀️ Назад', callback_data: 'back_to_main' }]];
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      `⏳ Загружено ${pendingServices.length} услуг на модерацию.`,
      keyboard
    );
    
    return { success: true, handled: true, action: 'services_moderation', count: pendingServices.length };
  } catch (error) {
    logError('handleAdminServices', error, { chatId });
    throw error;
  }
}

/**
 * Handle service approval/rejection
 */
export async function handleServiceApproval(env, callbackQuery, serviceId, newStatus) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    serviceId = String(serviceId).trim();
    console.log('[handleServiceApproval] Processing:', { serviceId, newStatus, chatId });
    
    const success = await updateServiceApprovalStatus(env, serviceId, newStatus);
    
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
      
      const service = await getServiceById(env, serviceId);
      if (service && service.partner_chat_id) {
        if (newStatus === 'Approved') {
          await sendPartnerNotification(
            env,
            service.partner_chat_id,
            `✅ **Ваша услуга одобрена!**\n\n` +
            `Услуга "${service.title || 'N/A'}" теперь доступна клиентам.`
          );
        } else {
          await sendPartnerNotification(
            env,
            service.partner_chat_id,
            `❌ **Ваша услуга отклонена**\n\n` +
            `Услуга "${service.title || 'N/A'}" была отклонена администратором.`
          );
        }
      }
      
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: resultText });
      return { success: true, handled: true, action: 'service_updated', status: newStatus };
    } else {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка при обновлении статуса в БД', show_alert: true });
      return { success: false, handled: true, action: 'service_update_failed' };
    }
  } catch (error) {
    console.error('[handleServiceApproval] Error:', error);
    logError('handleServiceApproval', error, { serviceId, newStatus });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Произошла ошибка', show_alert: true });
    throw error;
  }
}

/**
 * Handle partner services management menu
 */
export async function handleManageServices(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  await editMessageText(
    env.ADMIN_BOT_TOKEN,
    chatId,
    callbackQuery.message.message_id,
    '🛠 <b>Управление услугами партнёра</b>\n\nВведите chat_id партнёра:',
    [[{ text: '❌ Отмена', callback_data: 'back_to_main' }]],
    { parseMode: 'HTML' }
  );
  
  await setBotState(env, chatId, 'svc_selecting_partner', {});
  
  return { success: true, handled: true, action: 'manage_services_start' };
}

/**
 * Handle partner menu after selecting partner
 */
export async function showPartnerServicesMenu(env, chatId, partnerChatId, messageId = null) {
  const partner = await getPartnerByChatId(env, partnerChatId);
  
  if (!partner) {
    const text = '❌ Партнёр не найден. Введите корректный chat_id:';
    if (messageId) {
      await editMessageText(env.ADMIN_BOT_TOKEN, chatId, messageId, text, [[{ text: '❌ Отмена', callback_data: 'back_to_main' }]]);
    } else {
      await sendTelegramMessage(env.ADMIN_BOT_TOKEN, chatId, text);
    }
    return;
  }
  
  const text = (
    `👤 <b>Партнёр:</b> ${partner.name || 'N/A'}\n` +
    `🏢 <b>Компания:</b> ${partner.company_name || 'N/A'}\n` +
    `📂 <b>Категория:</b> ${partner.business_type || 'N/A'}\n` +
    `🏙 <b>Локация:</b> ${partner.city || 'N/A'}, ${partner.district || 'N/A'}\n\n` +
    `Выберите действие:`
  );

  const keyboard = [
    [{ text: '📂 Изменить категорию бизнеса', callback_data: 'svc_edit_category' }],
    [{ text: '🏙 Изменить локацию', callback_data: 'svc_edit_location' }],
    [{ text: '🛠 Управление услугами', callback_data: 'svc_manage_services' }],
    [{ text: '◀️ Назад', callback_data: 'back_to_main' }],
  ];

  if (messageId) {
    await editMessageText(env.ADMIN_BOT_TOKEN, chatId, messageId, text, keyboard, { parseMode: 'HTML' });
  } else {
    await sendTelegramMessageWithKeyboard(env.ADMIN_BOT_TOKEN, chatId, text, keyboard, { parseMode: 'HTML' });
  }
  
  await setBotState(env, chatId, 'svc_partner_menu', { partner_chat_id: partnerChatId });
}

/**
 * Handle edit category
 */
export async function handleEditCategory(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const categories = await getServiceCategories(env);
    
    if (categories.length === 0) {
      await sendTelegramMessage(env.ADMIN_BOT_TOKEN, chatId, '❌ Категории не найдены. Добавьте категории в базу данных.');
      return { success: false, handled: true };
    }
    
    const keyboard = categories.map(cat => [{
      text: `${cat.emoji || '📂'} ${cat.name}`,
      callback_data: `svc_set_cat_${cat.name}`.slice(0, 64),
    }]);
    
    keyboard.push([{ text: '◀️ Назад', callback_data: 'svc_back_to_partner' }]);
    
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      '📂 **Выберите категорию бизнеса:**',
      keyboard,
      { parseMode: 'Markdown' }
    );
    
    return { success: true, handled: true, action: 'edit_category' };
  } catch (error) {
    logError('handleEditCategory', error, { chatId });
    throw error;
  }
}

/**
 * Handle set category
 */
export async function handleSetCategory(env, callbackQuery, category) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const state = await getBotState(env, chatId);
    const partnerChatId = state?.data?.partner_chat_id;
    
    if (!partnerChatId) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка: партнёр не найден в состоянии', show_alert: true });
      return { success: false, handled: true };
    }
    
    const success = await updatePartnerField(env, partnerChatId, 'business_type', category);
    
    if (success) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: `✅ Категория изменена на: ${decodedCategory}` });
      await showPartnerServicesMenu(env, chatId, partnerChatId, callbackQuery.message.message_id);
      return { success: true, handled: true, action: 'category_updated' };
    } else {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка обновления', show_alert: true });
      return { success: false, handled: true };
    }
  } catch (error) {
    logError('handleSetCategory', error, { chatId, category });
    throw error;
  }
}

/**
 * Handle services menu for partner
 */
export async function handleServicesMenu(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const state = await getBotState(env, chatId);
    const partnerChatId = state?.data?.partner_chat_id;
    
    if (!partnerChatId) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка: партнёр не найден', show_alert: true });
      return { success: false, handled: true };
    }
    
    const keyboard = [
      [{ text: '➕ Добавить услугу', callback_data: 'svc_add' }],
      [{ text: '✏️ Редактировать услугу', callback_data: 'svc_edit' }],
      [{ text: '🗑 Удалить услугу', callback_data: 'svc_delete' }],
      [{ text: '◀️ Назад', callback_data: 'svc_back_to_partner' }],
    ];
    
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      '🛠 **Управление услугами**\n\nВыберите действие:',
      keyboard,
      { parseMode: 'Markdown' }
    );
    
    return { success: true, handled: true, action: 'services_menu' };
  } catch (error) {
    logError('handleServicesMenu', error, { chatId });
    throw error;
  }
}

/**
 * Handle add service start
 */
export async function handleAddServiceStart(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  await editMessageText(
    env.ADMIN_BOT_TOKEN,
    chatId,
    callbackQuery.message.message_id,
    '➕ **Добавление услуги**\n\nВведите название услуги:',
    [[{ text: '❌ Отмена', callback_data: 'svc_cancel' }]],
    { parseMode: 'Markdown' }
  );
  
  const state = await getBotState(env, chatId);
  await setBotState(env, chatId, 'svc_adding_title', state?.data || {});
  
  return { success: true, handled: true, action: 'add_service_start' };
}

/**
 * Handle edit service start
 */
export async function handleEditServiceStart(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const state = await getBotState(env, chatId);
    const partnerChatId = state?.data?.partner_chat_id;
    
    if (!partnerChatId) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка: партнёр не найден', show_alert: true });
      return { success: false, handled: true };
    }
    
    const services = await getServicesByPartner(env, partnerChatId);
    
    if (services.length === 0) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'У партнёра нет услуг', show_alert: true });
      return { success: false, handled: true };
    }
    
    const keyboard = services.map((svc, idx) => [{
      text: `${idx + 1}. ${svc.title || 'Без названия'} — ${svc.price || '—'}`,
      callback_data: `svc_choose_edit_${svc.id}`,
    }]);
    
    keyboard.push([{ text: '◀️ Назад', callback_data: 'svc_manage_services' }]);
    
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      '✏️ **Выберите услугу для редактирования:**',
      keyboard,
      { parseMode: 'Markdown' }
    );
    
    await setBotState(env, chatId, 'svc_choosing_service_for_edit', state.data);
    
    return { success: true, handled: true, action: 'edit_service_start' };
  } catch (error) {
    logError('handleEditServiceStart', error, { chatId });
    throw error;
  }
}

/**
 * Handle delete service start
 */
export async function handleDeleteServiceStart(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const state = await getBotState(env, chatId);
    const partnerChatId = state?.data?.partner_chat_id;
    
    if (!partnerChatId) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка: партнёр не найден', show_alert: true });
      return { success: false, handled: true };
    }
    
    const services = await getServicesByPartner(env, partnerChatId);
    
    if (services.length === 0) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'У партнёра нет услуг', show_alert: true });
      return { success: false, handled: true };
    }
    
    const keyboard = services.map((svc, idx) => [{
      text: `${idx + 1}. ${svc.title || 'Без названия'} — ${svc.price || '—'}`,
      callback_data: `svc_delete_confirm_${svc.id}`,
    }]);
    
    keyboard.push([{ text: '◀️ Назад', callback_data: 'svc_manage_services' }]);
    
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      '🗑 **Выберите услугу для удаления:**',
      keyboard,
      { parseMode: 'Markdown' }
    );
    
    return { success: true, handled: true, action: 'delete_service_start' };
  } catch (error) {
    logError('handleDeleteServiceStart', error, { chatId });
    throw error;
  }
}

/**
 * Handle service deletion confirmation
 */
export async function handleDeleteServiceConfirm(env, callbackQuery, serviceId) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const service = await getServiceById(env, serviceId);
    
    if (!service) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Услуга не найдена', show_alert: true });
      return { success: false, handled: true };
    }
    
    await deleteService(env, serviceId);
    
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: '✅ Услуга удалена' });
    
    await sendPartnerNotification(
      env,
      service.partner_chat_id,
      `🗑 **Услуга удалена**\n\nУслуга "${service.title}" была удалена администратором.`
    );
    
    const state = await getBotState(env, chatId);
    const partnerChatId = state?.data?.partner_chat_id;
    
    if (partnerChatId) {
      await showPartnerServicesMenu(env, chatId, partnerChatId, callbackQuery.message.message_id);
    } else {
      await clearBotState(env, chatId);
      const keyboard = [[{ text: '◀️ Назад', callback_data: 'back_to_main' }]];
      await editMessageText(
        env.ADMIN_BOT_TOKEN,
        chatId,
        callbackQuery.message.message_id,
        `✅ Услуга "${service.title}" удалена.`,
        keyboard,
        { parseMode: 'Markdown' }
      );
    }
    
    return { success: true, handled: true, action: 'service_deleted' };
  } catch (error) {
    logError('handleDeleteServiceConfirm', error, { chatId, serviceId });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка при удалении', show_alert: true });
    throw error;
  }
}

/**
 * Handle service choose for edit
 */
export async function handleChooseServiceForEdit(env, callbackQuery, serviceId) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const service = await getServiceById(env, serviceId);
    
    if (!service) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Услуга не найдена', show_alert: true });
      return { success: false, handled: true };
    }
    
    const keyboard = [
      [{ text: '📝 Название', callback_data: `svc_edit_field_title_${serviceId}` }],
      [{ text: '📄 Описание', callback_data: `svc_edit_field_description_${serviceId}` }],
      [{ text: '💰 Цена', callback_data: `svc_edit_field_price_${serviceId}` }],
      [{ text: '📂 Категория', callback_data: `svc_edit_field_category_${serviceId}` }],
      [{ text: '◀️ Назад', callback_data: 'svc_edit' }],
    ];
    
    const text = (
      `✏️ **Редактирование услуги**\n\n` +
      `📝 Название: ${service.title || '—'}\n` +
      `📄 Описание: ${service.description || '—'}\n` +
      `💰 Цена: ${service.price || '—'}\n` +
      `📂 Категория: ${service.category || '—'}\n\n` +
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
    
    await updateBotStateData(env, chatId, { editing_service_id: serviceId });
    
    return { success: true, handled: true, action: 'choose_field' };
  } catch (error) {
    logError('handleChooseServiceForEdit', error, { chatId, serviceId });
    throw error;
  }
}

/**
 * Handle edit service field
 */
export async function handleEditServiceField(env, callbackQuery, field, serviceId) {
  const chatId = String(callbackQuery.message.chat.id);
  
  const fieldNames = {
    title: 'название',
    description: 'описание',
    price: 'цену',
    category: 'категорию',
  };
  
  await editMessageText(
    env.ADMIN_BOT_TOKEN,
    chatId,
    callbackQuery.message.message_id,
    `✏️ **Редактирование: ${fieldNames[field] || field}**\n\nВведите новое значение:`,
    [[{ text: '❌ Отмена', callback_data: 'svc_cancel' }]],
    { parseMode: 'Markdown' }
  );
  
  const currentState = await getBotState(env, chatId);
  await setBotState(env, chatId, 'svc_waiting_new_value', {
    partner_chat_id: currentState?.data?.partner_chat_id,
    editing_service_id: serviceId,
    editing_field: field,
  });
  
  return { success: true, handled: true, action: 'edit_field_prompt' };
}

/**
 * Handle back to partner menu
 */
export async function handleBackToPartner(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const state = await getBotState(env, chatId);
    const partnerChatId = state?.data?.partner_chat_id;
    
    if (!partnerChatId) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка: партнёр не найден', show_alert: true });
      return { success: false, handled: true };
    }
    
    await showPartnerServicesMenu(env, chatId, partnerChatId, callbackQuery.message.message_id);
    return { success: true, handled: true, action: 'back_to_partner' };
  } catch (error) {
    logError('handleBackToPartner', error, { chatId });
    throw error;
  }
}

/**
 * Handle cancel
 */
export async function handleCancel(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  await clearBotState(env, chatId);
  await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Отменено' });
  
  await showMainMenu(env, chatId);
  
  return { success: true, handled: true, action: 'cancelled' };
}

/**
 * Handle FSM messages for services
 */
export async function handleMessage(env, update, stateData) {
  const message = update.message;
  const chatId = String(message.chat.id);
  const text = message.text || '';
  const state = (await getBotState(env, chatId))?.state;
  
  try {
    // Handle selecting partner
    if (state === 'svc_selecting_partner') {
      if (!text || !text.trim().match(/^\d+$/)) {
        await sendTelegramMessage(env.ADMIN_BOT_TOKEN, chatId, '❌ Введите корректный chat_id (только цифры):');
        return { success: true, handled: true };
      }
      
      const partnerChatId = text.trim();
      await showPartnerServicesMenu(env, chatId, partnerChatId);
      return { success: true, handled: true, action: 'partner_selected' };
    }
    
    // Handle adding service - title
    if (state === 'svc_adding_title') {
      if (!text || text.trim().length === 0) {
        await sendTelegramMessage(env.ADMIN_BOT_TOKEN, chatId, '❌ Название не может быть пустым. Введите название:');
        return { success: true, handled: true };
      }
      
      await updateBotStateData(env, chatId, { title: text.trim() });
      await setBotState(env, chatId, 'svc_adding_description', stateData);
      
      await sendTelegramMessage(
        env.ADMIN_BOT_TOKEN,
        chatId,
        '✅ Название сохранено!\n\nТеперь введите описание услуги:'
      );
      
      return { success: true, handled: true, action: 'title_saved' };
    }
    
    // Handle adding service - description
    if (state === 'svc_adding_description') {
      if (!text || text.trim().length === 0) {
        await sendTelegramMessage(env.ADMIN_BOT_TOKEN, chatId, '❌ Описание не может быть пустым. Введите описание:');
        return { success: true, handled: true };
      }
      
      await updateBotStateData(env, chatId, { description: text.trim() });
      await setBotState(env, chatId, 'svc_adding_price', stateData);
      
      await sendTelegramMessage(
        env.ADMIN_BOT_TOKEN,
        chatId,
        '✅ Описание сохранено!\n\nТеперь введите цену услуги (например: 1000 или "договорная"):'
      );
      
      return { success: true, handled: true, action: 'description_saved' };
    }
    
    // Handle adding service - price
    if (state === 'svc_adding_price') {
      if (!text || text.trim().length === 0) {
        await sendTelegramMessage(env.ADMIN_BOT_TOKEN, chatId, '❌ Цена не может быть пустой. Введите цену:');
        return { success: true, handled: true };
      }
      
      await updateBotStateData(env, chatId, { price: text.trim() });
      
      const categories = await getServiceCategories(env);
      const keyboard = categories.map(cat => [{
        text: `${cat.emoji || '📂'} ${cat.name}`,
        callback_data: `svc_set_service_cat_${cat.name}`.slice(0, 64),
      }]);
      
      keyboard.push([{ text: '❌ Отмена', callback_data: 'svc_cancel' }]);
      
      await sendTelegramMessageWithKeyboard(
        env.ADMIN_BOT_TOKEN,
        chatId,
        '✅ Цена сохранена!\n\n📂 **Выберите категорию услуги:**',
        keyboard,
        { parseMode: 'Markdown' }
      );
      
      await setBotState(env, chatId, 'svc_adding_category', stateData);
      
      return { success: true, handled: true, action: 'price_saved' };
    }
    
    // Handle editing service - new value
    if (state === 'svc_waiting_new_value') {
      if (!text || text.trim().length === 0) {
        await sendTelegramMessage(env.ADMIN_BOT_TOKEN, chatId, '❌ Значение не может быть пустым. Введите значение:');
        return { success: true, handled: true };
      }
      
      const currentState = await getBotState(env, chatId);
      const serviceId = currentState?.data?.editing_service_id;
      const field = currentState?.data?.editing_field;
      const partnerChatId = currentState?.data?.partner_chat_id;
      
      if (!serviceId || !field) {
        await sendTelegramMessage(env.ADMIN_BOT_TOKEN, chatId, '❌ Ошибка: данные редактирования потеряны');
        await clearBotState(env, chatId);
        return { success: false, handled: true };
      }
      
      const updateData = { [field]: text.trim() };
      const success = await updateService(env, serviceId, updateData);
      
      if (success) {
        await sendTelegramMessage(env.ADMIN_BOT_TOKEN, chatId, `✅ Поле "${field}" обновлено!`);
        
        if (partnerChatId) {
          await showPartnerServicesMenu(env, chatId, partnerChatId);
        } else {
          await clearBotState(env, chatId);
        }
        
        return { success: true, handled: true, action: 'field_updated' };
      } else {
        await sendTelegramMessage(env.ADMIN_BOT_TOKEN, chatId, '❌ Ошибка при обновлении услуги');
        return { success: false, handled: true };
      }
    }
    
    return { success: true, handled: false };
  } catch (error) {
    logError('services.handleMessage', error, { chatId, state });
    await sendTelegramMessage(env.ADMIN_BOT_TOKEN, chatId, `Ошибка: ${error.message}`);
    return { success: false, handled: true, error: error.message };
  }
}

/**
 * Handle set service category (during add)
 */
export async function handleSetServiceCategory(env, callbackQuery, category) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const state = await getBotState(env, chatId);
    const stateData = state?.data || {};
    const partnerChatId = stateData.partner_chat_id;
    
    if (!partnerChatId) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка: партнёр не найден', show_alert: true });
      return { success: false, handled: true };
    }
    
    const decodedCategory = category;
    
    const serviceData = {
      partner_chat_id: partnerChatId,
      title: stateData.title,
      description: stateData.description,
      price: stateData.price,
      category: decodedCategory,
      approval_status: 'Approved',
      is_active: true,
    };
    
    const newService = await addService(env, serviceData);
    
    if (newService) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: '✅ Услуга добавлена' });
      
      await sendPartnerNotification(
        env,
        partnerChatId,
        `✅ **Новая услуга добавлена!**\n\n` +
        `Услуга "${serviceData.title}" добавлена в ваш профиль и доступна клиентам.`
      );
      
      await showPartnerServicesMenu(env, chatId, partnerChatId, callbackQuery.message.message_id);
      
      return { success: true, handled: true, action: 'service_added' };
    } else {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка создания', show_alert: true });
      return { success: false, handled: true };
    }
  } catch (error) {
    logError('handleSetServiceCategory', error, { chatId, category });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка', show_alert: true });
    throw error;
  }
}

/**
 * Handle edit location
 */
export async function handleEditLocation(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const cities = await getDistinctCitiesFromPartners(env);
    
    if (cities.length === 0) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Нет городов', show_alert: true });
      return { success: false, handled: true };
    }
    
    const keyboard = cities.map(city => [{
      text: `🏙 ${city}`,
      callback_data: `svc_city_${city}`.slice(0, 64),
    }]);
    keyboard.push([{ text: '◀️ Назад', callback_data: 'svc_back_to_partner' }]);
    
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      '🏙 **Выберите город:**',
      keyboard,
      { parseMode: 'Markdown' }
    );
    
    return { success: true, handled: true, action: 'edit_location' };
  } catch (error) {
    logError('handleEditLocation', error, { chatId });
    throw error;
  }
}

/**
 * Handle set city
 */
export async function handleSetCity(env, callbackQuery, city) {
  const chatId = String(callbackQuery.message.chat.id);
  const decodedCity = city;
  
  try {
    const state = await getBotState(env, chatId);
    const partnerChatId = state?.data?.partner_chat_id;
    
    if (!partnerChatId) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка: партнёр не найден', show_alert: true });
      return { success: false, handled: true };
    }
    
    // Get districts for this city
    const districts = await getDistrictsForCity(env, decodedCity);
    
    if (districts.length === 0) {
      // No districts - save city only
      await updatePartnerField(env, partnerChatId, 'city', decodedCity);
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: `✅ Город: ${decodedCity}` });
      await showPartnerServicesMenu(env, chatId, partnerChatId, callbackQuery.message.message_id);
      return { success: true, handled: true, action: 'city_set' };
    }
    
    const keyboard = districts.map(d => [{
      text: `📍 ${d}`,
      callback_data: `svc_district_${decodedCity}_${d}`.slice(0, 64),
    }]);
    keyboard.push([{ text: '◀️ Назад', callback_data: 'svc_edit_location' }]);
    
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      `🏙 Город: **${decodedCity}**\n\n📍 Выберите район:`,
      keyboard,
      { parseMode: 'Markdown' }
    );
    
    return { success: true, handled: true, action: 'city_selected' };
  } catch (error) {
    logError('handleSetCity', error, { chatId, city });
    throw error;
  }
}

/**
 * Handle set district
 */
export async function handleSetDistrict(env, callbackQuery, city, district) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const state = await getBotState(env, chatId);
    const partnerChatId = state?.data?.partner_chat_id;
    
    if (!partnerChatId) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка: партнёр не найден', show_alert: true });
      return { success: false, handled: true };
    }
    
    await updatePartnerField(env, partnerChatId, 'city', city);
    await updatePartnerField(env, partnerChatId, 'district', district);
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: '✅ Локация обновлена' });
    await showPartnerServicesMenu(env, chatId, partnerChatId, callbackQuery.message.message_id);
    
    return { success: true, handled: true, action: 'location_updated' };
  } catch (error) {
    logError('handleSetDistrict', error, { chatId, city, district });
    throw error;
  }
}
