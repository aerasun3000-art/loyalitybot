/**
 * Partner management handlers for admin bot
 */

import { 
  supabaseRequest,
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
 * Send notification to partner via partner bot
 */
export async function sendPartnerNotification(env, partnerChatId, text) {
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
 * Get all partner applications
 */
export async function getAllPartnerApplications(env) {
  try {
    const result = await supabaseRequest(env, 'partner_applications?select=*&order=created_at.desc');
    return result || [];
  } catch (error) {
    logError('getAllPartnerApplications', error, {});
    return [];
  }
}

/**
 * Get all approved partners
 */
export async function getAllApprovedPartners(env) {
  try {
    const result = await supabaseRequest(env, 'partners?select=*&order=created_at.desc');
    return result || [];
  } catch (error) {
    logError('getAllApprovedPartners', error, {});
    return [];
  }
}

/**
 * Update partner status
 */
async function updatePartnerStatus(env, partnerId, newStatus) {
  try {
    const partnerIdStr = String(partnerId);
    
    const checkResult = await supabaseRequest(env, `partner_applications?chat_id=eq.${partnerIdStr}&select=*`);
    if (!checkResult || checkResult.length === 0) {
      logError('updatePartnerStatus', new Error('Application not found'), { partnerId: partnerIdStr });
      return false;
    }
    
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
 * Ensure partner record exists in partners table
 */
async function ensurePartnerRecord(env, partnerChatId) {
  try {
    const appResult = await supabaseRequest(env, `partner_applications?chat_id=eq.${partnerChatId}&select=*`);
    if (!appResult || appResult.length === 0) {
      logError('ensurePartnerRecord', new Error('Application not found'), { partnerChatId });
      return false;
    }
    
    const appData = appResult[0];
    
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
    
    try {
      await supabaseRequest(env, `services?partner_chat_id=eq.${partnerChatIdStr}`, {
        method: 'DELETE',
      });
    } catch (error) {
      logError('deletePartner.services', error, { partnerChatId: partnerChatIdStr });
    }
    
    try {
      await supabaseRequest(env, `promotions?partner_chat_id=eq.${partnerChatIdStr}`, {
        method: 'DELETE',
      });
    } catch (error) {
      logError('deletePartner.promotions', error, { partnerChatId: partnerChatIdStr });
    }
    
    try {
      await supabaseRequest(env, `partners?chat_id=eq.${partnerChatIdStr}`, {
        method: 'DELETE',
      });
    } catch (error) {
      logError('deletePartner.partners', error, { partnerChatId: partnerChatIdStr });
    }
    
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
 * Handle admin partners menu
 */
export async function handleAdminPartners(env, callbackQuery) {
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
export async function handleAdminPartnersPending(env, callbackQuery) {
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
export async function handlePartnerApproval(env, callbackQuery, partnerId, newStatus) {
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
      
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: resultText });
      return { success: true, handled: true, action: 'partner_updated', status: newStatus };
    } else {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка при обновлении статуса в БД', show_alert: true });
      return { success: false, handled: true, action: 'partner_update_failed' };
    }
  } catch (error) {
    logError('handlePartnerApproval', error, { partnerId, newStatus });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Произошла ошибка', show_alert: true });
    throw error;
  }
}

/**
 * Handle partners list for deletion
 */
export async function handleAdminPartnersDelete(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const applications = await getAllPartnerApplications(env);
    const approved = await getAllApprovedPartners(env);
    
    const allPartners = [...applications, ...approved];
    const uniquePartners = Array.from(
      new Map(allPartners.map(p => [p.chat_id, p])).values()
    ).slice(0, 50);
    
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
export async function handlePartnerDeleteSelect(env, callbackQuery, partnerId) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const applications = await getAllPartnerApplications(env);
    const approved = await getAllApprovedPartners(env);
    const partner = [...applications, ...approved].find(p => p.chat_id === partnerId);
    
    if (!partner) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Партнер не найден', show_alert: true });
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
export async function handlePartnerDeleteConfirm(env, callbackQuery, partnerId) {
  const chatId = String(callbackQuery.message.chat.id);
  
  try {
    const success = await deletePartner(env, partnerId);
    
    if (success) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: '✅ Партнер удален' });
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
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: '❌ Ошибка удаления', show_alert: true });
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
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Произошла ошибка', show_alert: true });
    throw error;
  }
}
