/**
 * Admin bot handlers for Cloudflare Workers
 * Handles all admin bot commands and callbacks
 */

import { 
  supabaseRequest,
  updateServiceApprovalStatus,
  getServiceById,
  getBotState,
  setBotState,
  clearBotState,
  updateBotStateData,
} from './supabase.js';
import {
  sendTelegramMessage,
  sendTelegramMessageWithKeyboard,
  answerCallbackQuery,
  editMessageText,
} from './telegram.js';
import {
  logError,
} from './common.js';

/**
 * Check if user is admin
 */
function isAdmin(env, chatId) {
  const adminIds = (env.ADMIN_CHAT_ID || '').split(',').map(id => String(id.trim()));
  return adminIds.includes(String(chatId));
}

/**
 * Send notification to partner via partner bot
 * (adds a reply button so партнёр может ответить администратору)
 */
async function sendPartnerNotification(env, partnerChatId, text) {
  if (!env.TOKEN_PARTNER) {
    return;
  }
  try {
    const keyboard = [[
      { text: '💬 Ответить администратору', callback_data: 'reply_to_admin' },
    ]];

    await sendTelegramMessageWithKeyboard(
      env.TOKEN_PARTNER,
      String(partnerChatId),
      text,
      keyboard
    );
  } catch (error) {
    logError('sendPartnerNotification', error, { partnerChatId });
  }
}

/**
 * Get all partner applications from partner_applications table
 */
async function getAllPartnerApplications(env) {
  try {
    const result = await supabaseRequest(env, 'partner_applications?select=*&order=created_at.desc');
    return result || [];
  } catch (error) {
    logError('getAllPartnerApplications', error, {});
    return [];
  }
}

/**
 * Get all approved partners from partners table
 */
async function getAllApprovedPartners(env) {
  try {
    const result = await supabaseRequest(env, 'partners?select=*&order=created_at.desc');
    return result || [];
  } catch (error) {
    logError('getAllApprovedPartners', error, {});
    return [];
  }
}

/**
 * Update partner status in partner_applications
 */
async function updatePartnerStatus(env, partnerId, newStatus) {
  try {
    const partnerIdStr = String(partnerId);
    
    // Check if application exists
    const checkResult = await supabaseRequest(env, `partner_applications?chat_id=eq.${partnerIdStr}&select=*`);
    if (!checkResult || checkResult.length === 0) {
      logError('updatePartnerStatus', new Error('Application not found'), { partnerId: partnerIdStr });
      return false;
    }
    
    // Update status using PATCH with proper filter
    const config = {
      url: env.SUPABASE_URL,
      key: env.SUPABASE_KEY,
    };
    const url = `${config.url}/rest/v1/partner_applications?chat_id=eq.${partnerIdStr}`;
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'apikey': config.key,
        'Authorization': `Bearer ${config.key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({ status: newStatus }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Supabase error: ${response.status} - ${errorText}`);
    }
    
    // If approved, ensure partner record exists in partners table
    if (newStatus === 'Approved') {
      await ensurePartnerRecord(env, partnerIdStr);
    }
    
    return true;
  } catch (error) {
    logError('updatePartnerStatus', error, { partnerId, newStatus });
    return false;
  }
}

/**
 * Ensure partner record exists in partners table (for FK references)
 */
async function ensurePartnerRecord(env, partnerChatId) {
  try {
    // Get application data
    const appResult = await supabaseRequest(env, `partner_applications?chat_id=eq.${partnerChatId}&select=*`);
    if (!appResult || appResult.length === 0) {
      logError('ensurePartnerRecord', new Error('Application not found'), { partnerChatId });
      return false;
    }
    
    const appData = appResult[0];
    
    // Create/update partner record
    const partnerRecord = {
      chat_id: String(partnerChatId),
      name: appData.name || appData.contact_person || 'Партнер',
      company_name: appData.company_name || '',
      business_type: appData.business_type || null,
      city: appData.city || '',
      district: appData.district || '',
      username: appData.username || null,
      booking_url: appData.booking_url || null,
      referred_by_chat_id: appData.referred_by_chat_id || null,
    };
    
    // Upsert to partners table
    await supabaseRequest(env, 'partners', {
      method: 'POST',
      headers: {
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify(partnerRecord),
    });
    
    return true;
  } catch (error) {
    logError('ensurePartnerRecord', error, { partnerChatId });
    return false;
  }
}

/**
 * Delete partner and all related data
 */
async function deletePartner(env, partnerChatId) {
  try {
    const partnerChatIdStr = String(partnerChatId);
    
    // Delete services
    try {
      await supabaseRequest(env, `services?partner_chat_id=eq.${partnerChatIdStr}`, {
        method: 'DELETE',
      });
    } catch (error) {
      logError('deletePartner.services', error, { partnerChatId: partnerChatIdStr });
    }
    
    // Delete promotions
    try {
      await supabaseRequest(env, `promotions?partner_chat_id=eq.${partnerChatIdStr}`, {
        method: 'DELETE',
      });
    } catch (error) {
      logError('deletePartner.promotions', error, { partnerChatId: partnerChatIdStr });
    }
    
    // Delete from partners table
    try {
      await supabaseRequest(env, `partners?chat_id=eq.${partnerChatIdStr}`, {
        method: 'DELETE',
      });
    } catch (error) {
      logError('deletePartner.partners', error, { partnerChatId: partnerChatIdStr });
    }
    
    // Delete from partner_applications
    try {
      await supabaseRequest(env, `partner_applications?chat_id=eq.${partnerChatIdStr}`, {
        method: 'DELETE',
      });
    } catch (error) {
      logError('deletePartner.applications', error, { partnerChatId: partnerChatIdStr });
    }
    
    return true;
  } catch (error) {
    logError('deletePartner', error, { partnerChatId });
    return false;
  }
}

/**
 * Show main admin menu
 */
async function showMainMenu(env, chatId) {
  try {
    console.log('[showMainMenu] Showing menu for chatId:', chatId);
    console.log('[showMainMenu] ADMIN_BOT_TOKEN exists:', !!env.ADMIN_BOT_TOKEN);
    
    const keyboard = [
      [
        { text: '📢 Массовая рассылка партнёрам', callback_data: 'admin_broadcast' },
      ],
      [
        { text: '🤝 Заявки Партнеров', callback_data: 'admin_partners' },
        { text: '🛠 Услуги Партнёров', callback_data: 'admin_manage_services' },
      ],
      [
        { text: '✨ Модерация Услуг', callback_data: 'admin_services' },
        { text: '📰 Управление Новостями', callback_data: 'admin_news' },
      ],
      [
        { text: '📸 Модерация UGC', callback_data: 'admin_ugc' },
        { text: '🎯 Промоутеры', callback_data: 'admin_promoters' },
      ],
      [
        { text: '📊 Общая статистика', callback_data: 'admin_stats' },
        { text: '🏆 Лидерборд', callback_data: 'admin_leaderboard' },
        { text: '💎 MLM Revenue Share', callback_data: 'admin_mlm' },
      ],
      [
        { text: '🤝 B2B Сделки', callback_data: 'admin_b2b_deals' },
      ],
      [
        { text: '📈 Дашборд Админа', callback_data: 'admin_dashboard' },
        { text: '📄 Одностраничники', callback_data: 'admin_onepagers' },
        { text: '🎨 Смена Фона', callback_data: 'admin_background' },
      ],
    ];
    
    console.log('[showMainMenu] Calling sendTelegramMessageWithKeyboard');
    const result = await sendTelegramMessageWithKeyboard(
      env.ADMIN_BOT_TOKEN,
      String(chatId),
      '👋 **Админ-панель**\n\nВыберите раздел для управления системой лояльности:',
      keyboard,
      { parseMode: 'Markdown' }
    );
    console.log('[showMainMenu] Message sent successfully:', result.ok);
    return result;
  } catch (error) {
    console.error('[showMainMenu] Error:', error);
    throw error;
  }
}

/**
 * Handle /start command for admin bot
 */
export async function handleStart(env, update) {
  const message = update.message;
  const chatId = String(message.chat.id);
  
  try {
    console.log('[handleStart] Starting for chatId:', chatId);
    console.log('[handleStart] ADMIN_CHAT_ID:', env.ADMIN_CHAT_ID);
    console.log('[handleStart] isAdmin:', isAdmin(env, chatId));
    
    // Check admin rights
    if (!isAdmin(env, chatId)) {
      console.log('[handleStart] Access denied for chatId:', chatId);
      await sendTelegramMessage(
        env.ADMIN_BOT_TOKEN,
        chatId,
        'У вас нет прав администратора для доступа к этой панели.'
      );
      return { success: true, handled: true, action: 'access_denied' };
    }
    
    console.log('[handleStart] Access granted, showing main menu');
    await showMainMenu(env, chatId);
    console.log('[handleStart] Main menu shown successfully');
    return { success: true, handled: true, action: 'main_menu' };
  } catch (error) {
    console.error('[handleStart] Error:', error);
    logError('handleStart (admin)', error, { chatId });
    // Try to send error message to user
    try {
      await sendTelegramMessage(
        env.ADMIN_BOT_TOKEN,
        chatId,
        `Ошибка: ${error.message}`
      );
    } catch (e) {
      console.error('[handleStart] Failed to send error message:', e);
    }
    return { success: false, handled: true, error: error.message };
  }
}

/**
 * Handle callback queries
 */
export async function handleCallbackQuery(env, update) {
  const callbackQuery = update.callback_query;
  const chatId = String(callbackQuery.message.chat.id);
  const data = callbackQuery.data;
  
  try {
    // Check admin rights
    if (!isAdmin(env, chatId)) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, 'У вас нет прав администратора', true);
      return { success: true, handled: true, action: 'access_denied' };
    }
    
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, 'Загрузка...');
    
    // Route to appropriate handler
    if (data === 'back_to_main') {
      await showMainMenu(env, chatId);
      return { success: true, handled: true, action: 'main_menu' };
    }
    
    if (data === 'admin_partners') {
      return await handleAdminPartners(env, callbackQuery);
    }
    
    if (data === 'admin_partners_pending') {
      return await handleAdminPartnersPending(env, callbackQuery);
    }
    
    if (data === 'admin_partners_delete') {
      return await handleAdminPartnersDelete(env, callbackQuery);
    }
    
    if (data.startsWith('partner_approve_')) {
      const partnerId = data.replace('partner_approve_', '');
      return await handlePartnerApproval(env, callbackQuery, partnerId, 'Approved');
    }
    
    if (data.startsWith('partner_reject_')) {
      const partnerId = data.replace('partner_reject_', '');
      return await handlePartnerApproval(env, callbackQuery, partnerId, 'Rejected');
    }
    
    if (data.startsWith('partner_delete_select_')) {
      const partnerId = data.replace('partner_delete_select_', '');
      return await handlePartnerDeleteSelect(env, callbackQuery, partnerId);
    }
    
    if (data.startsWith('partner_delete_confirm_')) {
      const partnerId = data.replace('partner_delete_confirm_', '');
      return await handlePartnerDeleteConfirm(env, callbackQuery, partnerId);
    }
    
    // Handle service approval/rejection
    if (data.startsWith('service_approve_')) {
      const serviceId = data.replace('service_approve_', '');
      return await handleServiceApproval(env, callbackQuery, serviceId, 'Approved');
    }
    
    if (data.startsWith('service_reject_')) {
      const serviceId = data.replace('service_reject_', '');
      return await handleServiceApproval(env, callbackQuery, serviceId, 'Rejected');
    }
    
    // Handle broadcast callbacks
    if (data === 'admin_broadcast') {
      return await handleBroadcastStart(env, callbackQuery);
    }
    
    if (data === 'broadcast_all') {
      return await handleBroadcastAll(env, callbackQuery);
    }
    
    if (data === 'broadcast_select_city') {
      return await handleBroadcastSelectCity(env, callbackQuery);
    }
    
    if (data.startsWith('broadcast_city_')) {
      const cityBase64 = data.replace('broadcast_city_', '');
      return await handleBroadcastCity(env, callbackQuery, cityBase64);
    }
    
    if (data === 'broadcast_select_category') {
      return await handleBroadcastSelectCategory(env, callbackQuery);
    }
    
    if (data.startsWith('broadcast_category_')) {
      const category = data.replace('broadcast_category_', '');
      return await handleBroadcastCategory(env, callbackQuery, category);
    }
    
    if (data === 'cancel_broadcast') {
      return await handleCancelBroadcast(env, callbackQuery);
    }
    
    // Default: show main menu
    await showMainMenu(env, chatId);
    return { success: true, handled: true, action: 'main_menu' };
  } catch (error) {
    logError('handleCallbackQuery (admin)', error, { chatId, data });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, 'Произошла ошибка', true);
    throw error;
  }
}

/**
 * Handle admin partners menu
 */
async function handleAdminPartners(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  const keyboard = [
    [{ text: '⏳ Заявки на модерацию', callback_data: 'admin_partners_pending' }],
    [{ text: '🗑 Удалить партнера', callback_data: 'admin_partners_delete' }],
    [{ text: '◀️ Назад', callback_data: 'back_to_main' }],
  ];
  
  await editMessageText(
    env.ADMIN_BOT_TOKEN,
    chatId,
    callbackQuery.message.message_id,
    '🤝 <b>Управление Партнерами</b>\n\nВыберите действие:',
    keyboard,
    { parseMode: 'HTML' }
  );
  
  return { success: true, handled: true, action: 'admin_partners' };
}

/**
 * Handle pending partners list
 */
async function handleAdminPartnersPending(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const allApplications = await getAllPartnerApplications(env);
    const pendingPartners = allApplications.filter(p => 
      (p.status || 'Pending').toLowerCase() === 'pending'
    );
    
    if (pendingPartners.length === 0) {
      const keyboard = [[{ text: '◀️ Назад', callback_data: 'admin_partners' }]];
      await editMessageText(
        env.ADMIN_BOT_TOKEN,
        chatId,
        callbackQuery.message.message_id,
        '✅ Новых заявок на партнерство нет.',
        keyboard
      );
      return { success: true, handled: true, action: 'no_pending' };
    }
    
    // Send each pending partner application
    for (const partner of pendingPartners) {
      const messageText = (
        `**Новая заявка на Партнерство (ID: ${partner.chat_id})**\n` +
        `👤 Имя: ${partner.name || '—'}\n` +
        `📞 Телефон: ${partner.phone || '—'}\n` +
        `🏢 Компания: ${partner.company_name || '—'}\n` +
        `📅 Дата: ${(partner.created_at || '').substring(0, 10)}`
      );
      
      const keyboard = [
        [
          { text: '🟢 Одобрить', callback_data: `partner_approve_${partner.chat_id}` },
          { text: '🔴 Отклонить', callback_data: `partner_reject_${partner.chat_id}` },
        ],
      ];
      
      await sendTelegramMessageWithKeyboard(
        env.ADMIN_BOT_TOKEN,
        chatId,
        messageText,
        keyboard
      );
    }
    
    const keyboard = [[{ text: '◀️ Назад', callback_data: 'admin_partners' }]];
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      `⏳ Загружено ${pendingPartners.length} заявок на модерацию.`,
      keyboard
    );
    
    return { success: true, handled: true, action: 'pending_list', count: pendingPartners.length };
  } catch (error) {
    logError('handleAdminPartnersPending', error, { chatId });
    throw error;
  }
}

/**
 * Handle partner approval/rejection
 */
async function handlePartnerApproval(env, callbackQuery, partnerId, newStatus) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const success = await updatePartnerStatus(env, partnerId, newStatus);
    
    if (success) {
      const resultText = newStatus === 'Approved' ? '🟢 Одобрена' : '🔴 Отклонена';
      const originalText = callbackQuery.message.text || '';
      const processedText = originalText.split('\n')[0];
      
      await editMessageText(
        env.ADMIN_BOT_TOKEN,
        chatId,
        callbackQuery.message.message_id,
        `${processedText}\n\n**СТАТУС: ${resultText}**`
      );
      
      // Send notification to partner
      if (newStatus === 'Approved') {
        await sendPartnerNotification(
          env,
          partnerId,
          '🎉 **Поздравляем!** Ваш аккаунт партнера одобрен. Нажмите /start в партнерском боте.'
        );
      } else {
        await sendPartnerNotification(
          env,
          partnerId,
          '❌ Ваша заявка Партнера была отклонена. Свяжитесь с администратором.'
        );
      }
      
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, resultText);
      return { success: true, handled: true, action: 'partner_updated', status: newStatus };
    } else {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, 'Ошибка при обновлении статуса в БД', true);
      return { success: false, handled: true, action: 'partner_update_failed' };
    }
  } catch (error) {
    logError('handlePartnerApproval', error, { partnerId, newStatus });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, 'Произошла ошибка', true);
    throw error;
  }
}

/**
 * Handle partners list for deletion
 */
async function handleAdminPartnersDelete(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    // Get all partners (from both tables)
    const applications = await getAllPartnerApplications(env);
    const approved = await getAllApprovedPartners(env);
    
    // Combine and deduplicate
    const allPartners = [...applications, ...approved];
    const uniquePartners = Array.from(
      new Map(allPartners.map(p => [p.chat_id, p])).values()
    ).slice(0, 50); // Limit to 50
    
    if (uniquePartners.length === 0) {
      const keyboard = [[{ text: '◀️ Назад', callback_data: 'admin_partners' }]];
      await editMessageText(
        env.ADMIN_BOT_TOKEN,
        chatId,
        callbackQuery.message.message_id,
        '📭 Партнеров нет.',
        keyboard
      );
      return { success: true, handled: true, action: 'no_partners' };
    }
    
    const keyboard = uniquePartners.map(partner => {
      const name = partner.name || 'Без имени';
      const company = (partner.company_name || 'Без компании').substring(0, 30);
      const status = partner.status || (partner.chat_id ? 'Approved' : 'Unknown');
      const statusEmoji = { 'Approved': '✅', 'Pending': '⏳', 'Rejected': '❌' }[status] || '❓';
      
      return [{
        text: `${statusEmoji} ${name} (${company})`,
        callback_data: `partner_delete_select_${partner.chat_id}`,
      }];
    });
    
    keyboard.push([{ text: '◀️ Назад', callback_data: 'admin_partners' }]);
    
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      '🗑 **Удаление партнера**\n\nВыберите партнера для удаления:',
      keyboard
    );
    
    return { success: true, handled: true, action: 'delete_list', count: uniquePartners.length };
  } catch (error) {
    logError('handleAdminPartnersDelete', error, { chatId });
    throw error;
  }
}

/**
 * Handle partner deletion selection
 */
async function handlePartnerDeleteSelect(env, callbackQuery, partnerId) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    // Get partner info
    const applications = await getAllPartnerApplications(env);
    const approved = await getAllApprovedPartners(env);
    const partner = [...applications, ...approved].find(p => p.chat_id === partnerId);
    
    if (!partner) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, 'Партнер не найден', true);
      return { success: false, handled: true };
    }
    
    const name = partner.name || 'Без имени';
    const company = partner.company_name || 'Без компании';
    
    const keyboard = [
      [
        { text: '✅ Да, удалить', callback_data: `partner_delete_confirm_${partnerId}` },
        { text: '❌ Отмена', callback_data: 'admin_partners_delete' },
      ],
    ];
    
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      (
        `⚠️ **Подтверждение удаления**\n\n` +
        `Вы уверены, что хотите удалить партнера?\n\n` +
        `**ID:** ${partnerId}\n` +
        `**Имя:** ${name}\n` +
        `**Компания:** ${company}\n\n` +
        `⚠️ Это действие удалит:\n` +
        `• Профиль партнера\n` +
        `• Все услуги партнера\n` +
        `• Все акции партнера\n` +
        `• Заявку партнера\n\n` +
        `**Это действие нельзя отменить!**`
      ),
      keyboard
    );
    
    return { success: true, handled: true, action: 'delete_confirmation' };
  } catch (error) {
    logError('handlePartnerDeleteSelect', error, { partnerId });
    throw error;
  }
}

/**
 * Handle partner deletion confirmation
 */
async function handlePartnerDeleteConfirm(env, callbackQuery, partnerId) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const success = await deletePartner(env, partnerId);
    
    if (success) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, '✅ Партнер удален');
      const keyboard = [[{ text: '◀️ Назад', callback_data: 'admin_partners' }]];
      await editMessageText(
        env.ADMIN_BOT_TOKEN,
        chatId,
        callbackQuery.message.message_id,
        (
          `✅ Партнер ID ${partnerId} успешно удален из базы данных.\n\n` +
          `Удалены все связанные данные (услуги, акции, заявки).`
        ),
        keyboard
      );
      return { success: true, handled: true, action: 'partner_deleted' };
    } else {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, '❌ Ошибка удаления', true);
      const keyboard = [[{ text: '◀️ Назад', callback_data: 'admin_partners' }]];
      await editMessageText(
        env.ADMIN_BOT_TOKEN,
        chatId,
        callbackQuery.message.message_id,
        `❌ Ошибка при удалении партнера ID ${partnerId}. Проверьте логи.`,
        keyboard
      );
      return { success: false, handled: true, action: 'delete_failed' };
    }
  } catch (error) {
    logError('handlePartnerDeleteConfirm', error, { partnerId });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, 'Произошла ошибка', true);
    throw error;
  }
}

/**
 * Handle service approval/rejection
 */
async function handleServiceApproval(env, callbackQuery, serviceId, newStatus) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    // Clean serviceId - remove any whitespace
    serviceId = String(serviceId).trim();
    console.log('[handleServiceApproval] Processing:', { serviceId, newStatus, chatId });
    
    const success = await updateServiceApprovalStatus(env, serviceId, newStatus);
    
    if (success) {
      const resultText = newStatus === 'Approved' ? '🟢 Одобрена' : '🔴 Отклонена';
      const originalText = callbackQuery.message.text || '';
      const processedText = originalText.split('\n')[0];
      
      // Update message (remove inline keyboard)
      await editMessageText(
        env.ADMIN_BOT_TOKEN,
        chatId,
        callbackQuery.message.message_id,
        `${processedText}\n\n**СТАТУС: ${resultText}**`,
        { parseMode: 'Markdown' }
      );
      
      // Get service info to notify partner
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
      
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, resultText);
      return { success: true, handled: true, action: 'service_updated', status: newStatus };
    } else {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, 'Ошибка при обновлении статуса в БД', true);
      return { success: false, handled: true, action: 'service_update_failed' };
    }
  } catch (error) {
    console.error('[handleServiceApproval] Error:', error);
    logError('handleServiceApproval', error, { serviceId, newStatus });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, 'Произошла ошибка', true);
    throw error;
  }
}

/**
 * Get distinct cities from partners
 */
async function getDistinctCities(env) {
  try {
    const partners = await getAllApprovedPartners(env);
    const cities = [...new Set(partners.map(p => p.city).filter(c => c && c.trim()))];
    return cities.sort();
  } catch (error) {
    logError('getDistinctCities', error, {});
    return [];
  }
}

/**
 * Get distinct service categories
 */
async function getDistinctCategories(env) {
  try {
    const result = await supabaseRequest(env, 'services?select=category&is_active=eq.true');
    const categories = [...new Set(result.map(s => s.category).filter(c => c && c.trim()))];
    return categories.sort();
  } catch (error) {
    logError('getDistinctCategories', error, {});
    return [];
  }
}

/**
 * Get partners by city
 */
async function getPartnersByCity(env, city) {
  try {
    const partners = await getAllApprovedPartners(env);
    return partners.filter(p => p.city === city && p.chat_id);
  } catch (error) {
    logError('getPartnersByCity', error, { city });
    return [];
  }
}

/**
 * Get partners by category
 */
async function getPartnersByCategory(env, category) {
  try {
    const services = await supabaseRequest(env, `services?category=eq.${encodeURIComponent(category)}&is_active=eq.true&select=partner_chat_id`);
    const partnerChatIds = [...new Set(services.map(s => s.partner_chat_id).filter(id => id))];
    const allPartners = await getAllApprovedPartners(env);
    return allPartners.filter(p => partnerChatIds.includes(p.chat_id));
  } catch (error) {
    logError('getPartnersByCategory', error, { category });
    return [];
  }
}

/**
 * Handle broadcast start
 */
async function handleBroadcastStart(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  const keyboard = [
    [{ text: '🌍 Все партнёры', callback_data: 'broadcast_all' }],
    [{ text: '🏙 По городу', callback_data: 'broadcast_select_city' }],
    [{ text: '📂 По категории услуг', callback_data: 'broadcast_select_category' }],
    [{ text: '◀️ Назад', callback_data: 'back_to_main' }],
  ];
  
  await editMessageText(
    env.ADMIN_BOT_TOKEN,
    chatId,
    callbackQuery.message.message_id,
    '📢 <b>Массовая рассылка партнёрам</b>\n\nВыберите группу партнёров для рассылки:',
    keyboard,
    { parseMode: 'HTML' }
  );
  
  return { success: true, handled: true, action: 'broadcast_start' };
}

/**
 * Handle broadcast all partners
 */
async function handleBroadcastAll(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const partners = await getAllApprovedPartners(env);
    const partnerChatIds = partners.map(p => p.chat_id).filter(id => id);
    
    if (partnerChatIds.length === 0) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, 'Нет партнёров для рассылки', true);
      return { success: false, handled: true };
    }
    
    await setBotState(env, chatId, 'broadcast_waiting_message', {
      type: 'all',
      partner_chat_ids: partnerChatIds,
    });
    
    const keyboard = [[{ text: '❌ Отмена', callback_data: 'cancel_broadcast' }]];
    
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      `📢 <b>Рассылка всем партнёрам</b>\n\nПартнёров: ${partnerChatIds.length}\n\nВведите сообщение для рассылки:`,
      keyboard,
      { parseMode: 'HTML' }
    );
    
    return { success: true, handled: true, action: 'broadcast_all', count: partnerChatIds.length };
  } catch (error) {
    logError('handleBroadcastAll', error, { chatId });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, 'Ошибка', true);
    throw error;
  }
}

/**
 * Handle broadcast city selection
 */
async function handleBroadcastSelectCity(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const cities = await getDistinctCities(env);
    
    if (cities.length === 0) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, 'Нет городов', true);
      return { success: false, handled: true };
    }
    
    const keyboard = cities.map(city => {
      const cityBase64 = btoa(encodeURIComponent(city));
      return [{ text: `🏙 ${city}`, callback_data: `broadcast_city_${cityBase64}` }];
    });
    
    keyboard.push([{ text: '◀️ Назад', callback_data: 'admin_broadcast' }]);
    
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      '🏙 <b>Выберите город</b>\n\nВыберите город для рассылки:',
      keyboard,
      { parseMode: 'HTML' }
    );
    
    return { success: true, handled: true, action: 'broadcast_select_city' };
  } catch (error) {
    logError('handleBroadcastSelectCity', error, { chatId });
    throw error;
  }
}

/**
 * Handle broadcast city selected
 */
async function handleBroadcastCity(env, callbackQuery, cityBase64) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const city = decodeURIComponent(atob(cityBase64));
    const partners = await getPartnersByCity(env, city);
    const partnerChatIds = partners.map(p => p.chat_id).filter(id => id);
    
    if (partnerChatIds.length === 0) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, 'Нет партнёров в этом городе', true);
      return { success: false, handled: true };
    }
    
    await setBotState(env, chatId, 'broadcast_waiting_message', {
      type: 'city',
      city: city,
      partner_chat_ids: partnerChatIds,
    });
    
    const keyboard = [[{ text: '❌ Отмена', callback_data: 'cancel_broadcast' }]];
    
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      `📢 <b>Рассылка партнёрам города: ${city}</b>\n\nПартнёров: ${partnerChatIds.length}\n\nВведите сообщение для рассылки:`,
      keyboard,
      { parseMode: 'HTML' }
    );
    
    return { success: true, handled: true, action: 'broadcast_city', city, count: partnerChatIds.length };
  } catch (error) {
    logError('handleBroadcastCity', error, { chatId, cityBase64 });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, 'Ошибка', true);
    throw error;
  }
}

/**
 * Handle broadcast category selection
 */
async function handleBroadcastSelectCategory(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const categories = await getDistinctCategories(env);
    
    if (categories.length === 0) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, 'Нет категорий', true);
      return { success: false, handled: true };
    }
    
    const keyboard = categories.map(category => {
      return [{ text: `📂 ${category}`, callback_data: `broadcast_category_${encodeURIComponent(category)}` }];
    });
    
    keyboard.push([{ text: '◀️ Назад', callback_data: 'admin_broadcast' }]);
    
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      '📂 <b>Выберите категорию услуг</b>\n\nВыберите категорию для рассылки:',
      keyboard,
      { parseMode: 'HTML' }
    );
    
    return { success: true, handled: true, action: 'broadcast_select_category' };
  } catch (error) {
    logError('handleBroadcastSelectCategory', error, { chatId });
    throw error;
  }
}

/**
 * Handle broadcast category selected
 */
async function handleBroadcastCategory(env, callbackQuery, category) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const decodedCategory = decodeURIComponent(category);
    const partners = await getPartnersByCategory(env, decodedCategory);
    const partnerChatIds = partners.map(p => p.chat_id).filter(id => id);
    
    if (partnerChatIds.length === 0) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, 'Нет партнёров в этой категории', true);
      return { success: false, handled: true };
    }
    
    await setBotState(env, chatId, 'broadcast_waiting_message', {
      type: 'category',
      category: decodedCategory,
      partner_chat_ids: partnerChatIds,
    });
    
    const keyboard = [[{ text: '❌ Отмена', callback_data: 'cancel_broadcast' }]];
    
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      `📢 <b>Рассылка партнёрам категории: ${decodedCategory}</b>\n\nПартнёров: ${partnerChatIds.length}\n\nВведите сообщение для рассылки:`,
      keyboard,
      { parseMode: 'HTML' }
    );
    
    return { success: true, handled: true, action: 'broadcast_category', category: decodedCategory, count: partnerChatIds.length };
  } catch (error) {
    logError('handleBroadcastCategory', error, { chatId, category });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, 'Ошибка', true);
    throw error;
  }
}

/**
 * Handle broadcast message
 */
async function handleBroadcastMessage(env, update, stateData) {
  const message = update.message;
  const chatId = String(message.chat.id);
  const text = message.text || '';
  
  try {
    if (!text || text.trim().length === 0) {
      await sendTelegramMessage(env.ADMIN_BOT_TOKEN, chatId, 'Сообщение не может быть пустым. Введите сообщение или отмените рассылку.');
      return { success: true, handled: true };
    }
    
    const partnerChatIds = stateData.partner_chat_ids || [];
    let sent = 0;
    let failed = 0;
    
    await sendTelegramMessage(env.ADMIN_BOT_TOKEN, chatId, `📤 Начинаю рассылку ${partnerChatIds.length} партнёрам...`);
    
    for (const partnerChatId of partnerChatIds) {
      try {
        await sendPartnerNotification(env, partnerChatId, text);
        sent++;
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        failed++;
        logError('handleBroadcastMessage.send', error, { partnerChatId });
      }
    }
    
    await clearBotState(env, chatId);
    
    const keyboard = [[{ text: '◀️ Главное меню', callback_data: 'back_to_main' }]];
    
    await sendTelegramMessageWithKeyboard(
      env.ADMIN_BOT_TOKEN,
      chatId,
      `✅ <b>Рассылка завершена</b>\n\nОтправлено: ${sent}\nОшибок: ${failed}\nВсего: ${partnerChatIds.length}`,
      keyboard,
      { parseMode: 'HTML' }
    );
    
    return { success: true, handled: true, action: 'broadcast_complete', sent, failed };
  } catch (error) {
    logError('handleBroadcastMessage', error, { chatId });
    await clearBotState(env, chatId);
    await sendTelegramMessage(env.ADMIN_BOT_TOKEN, chatId, `Ошибка при рассылке: ${error.message}`);
    return { success: false, handled: true, error: error.message };
  }
}

/**
 * Handle cancel broadcast
 */
async function handleCancelBroadcast(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    await clearBotState(env, chatId);
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, 'Рассылка отменена');
    await showMainMenu(env, chatId);
    return { success: true, handled: true, action: 'broadcast_cancelled' };
  } catch (error) {
    logError('handleCancelBroadcast', error, { chatId });
    throw error;
  }
}

/**
 * Route update to appropriate handler
 */
export async function routeUpdate(env, update) {
  try {
    // Handle callback queries
    if (update.callback_query) {
      return await handleCallbackQuery(env, update);
    }
    
    // Handle messages
    if (update.message) {
      const text = update.message.text || '';
      const chatId = String(update.message.chat.id);
      
      // Log incoming message for debugging
      console.log('[routeUpdate] Received message:', {
        chatId,
        text,
        isAdmin: isAdmin(env, chatId),
        hasAdminChatId: !!env.ADMIN_CHAT_ID,
      });
      
      // Handle commands
      if (text.startsWith('/start') || text.startsWith('/admin')) {
        console.log('[routeUpdate] Handling /start command');
        return await handleStart(env, update);
      }
      
      // Check if admin is in broadcast state
      if (isAdmin(env, chatId)) {
        const state = await getBotState(env, chatId);
        if (state && state.state === 'broadcast_waiting_message') {
          return await handleBroadcastMessage(env, update, state.data);
        }
      }
      
      // Default: show main menu for admin users
      if (isAdmin(env, chatId)) {
        console.log('[routeUpdate] Showing main menu for admin');
        await showMainMenu(env, chatId);
      }
      
      return { success: true, handled: true };
    }
    
    return { success: true, handled: false };
  } catch (error) {
    logError('routeUpdate (admin)', error, {
      updateType: update.callback_query ? 'callback_query' : update.message ? 'message' : 'unknown',
    });
    // Don't throw - return error response instead
    return { success: false, handled: false, error: error.message };
  }
}
