/**
 * Admin bot main router for Cloudflare Workers
 */

import { getBotState } from './supabase.js';
import {
  sendTelegramMessage,
  sendTelegramMessageWithKeyboard,
  answerCallbackQuery,
} from './telegram.js';
import { logError } from './common.js';

// Import handlers
import * as partners from './handlers/partners.js';
import * as services from './handlers/services.js';
import * as broadcast from './handlers/broadcast.js';
import * as stats from './handlers/stats.js';
import * as news from './handlers/news.js';
import * as ugc from './handlers/ugc.js';
import * as promoters from './handlers/promoters.js';
import * as leaderboard from './handlers/leaderboard.js';
import * as mlm from './handlers/mlm.js';
import * as b2b from './handlers/b2b.js';

/**
 * Check if user is admin
 */
function isAdmin(env, chatId) {
  const adminIds = (env.ADMIN_CHAT_ID || '').split(',').map(id => String(id.trim()));
  return adminIds.includes(String(chatId));
}

/**
 * Show main admin menu
 */
export async function showMainMenu(env, chatId) {
  try {
    console.log('[showMainMenu] Showing menu for chatId:', chatId);
    
    const keyboard = [
      [
        { text: '📢 Массовая рассылка партнёрам', callback_data: 'admin_broadcast' },
      ],
      [
        { text: '🤝 Заявки Партнеров', callback_data: 'admin_partners' },
        { text: '📊 Общая статистика', callback_data: 'admin_stats' },
      ],
      [
        { text: '📰 Управление Новостями', callback_data: 'admin_news' },
        { text: '📸 Модерация UGC', callback_data: 'admin_ugc' },
      ],
      [
        { text: '🎯 Промоутеры', callback_data: 'admin_promoters' },
        { text: '🏆 Лидерборд', callback_data: 'admin_leaderboard' },
      ],
      [
        { text: '💎 MLM Revenue Share', callback_data: 'admin_mlm' },
        { text: '🤝 B2B Сделки', callback_data: 'admin_b2b_deals' },
      ],
      [
        { text: '📈 Дашборд', callback_data: 'admin_dashboard' },
        { text: '📄 Одностраничники', callback_data: 'admin_onepagers' },
        { text: '🎨 Смена фона', callback_data: 'admin_background' },
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
 * Handle /start command
 */
export async function handleStart(env, update) {
  const message = update.message;
  const chatId = String(message.chat.id);
  
  try {
    console.log('[handleStart] Starting for chatId:', chatId);
    
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
 * Handle callback queries - main router
 */
export async function handleCallbackQuery(env, update) {
  const callbackQuery = update.callback_query;
  const chatId = String(callbackQuery.message.chat.id);
  const data = callbackQuery.data;
  
  try {
    if (!isAdmin(env, chatId)) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'У вас нет прав администратора', show_alert: true });
      return { success: true, handled: true, action: 'access_denied' };
    }
    
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Загрузка...' });
    
    // Main menu
    if (data === 'back_to_main') {
      await showMainMenu(env, chatId);
      return { success: true, handled: true, action: 'main_menu' };
    }
    
    // Partners
    if (data === 'admin_partners') {
      return await partners.handleAdminPartners(env, callbackQuery);
    }
    if (data === 'admin_partners_pending') {
      return await partners.handleAdminPartnersPending(env, callbackQuery);
    }
    if (data === 'admin_partners_delete') {
      return await partners.handleAdminPartnersDelete(env, callbackQuery);
    }
    if (data.startsWith('partner_approve_')) {
      const partnerId = data.replace('partner_approve_', '');
      return await partners.handlePartnerApproval(env, callbackQuery, partnerId, 'Approved');
    }
    if (data.startsWith('partner_reject_')) {
      const partnerId = data.replace('partner_reject_', '');
      return await partners.handlePartnerApproval(env, callbackQuery, partnerId, 'Rejected');
    }
    if (data.startsWith('partner_delete_select_')) {
      const partnerId = data.replace('partner_delete_select_', '');
      return await partners.handlePartnerDeleteSelect(env, callbackQuery, partnerId);
    }
    if (data.startsWith('partner_delete_confirm_')) {
      const partnerId = data.replace('partner_delete_confirm_', '');
      return await partners.handlePartnerDeleteConfirm(env, callbackQuery, partnerId);
    }
    
    // Services - moderation
    if (data === 'admin_services') {
      return await services.handleAdminServices(env, callbackQuery);
    }
    if (data.startsWith('service_approve_')) {
      const serviceId = data.replace('service_approve_', '');
      return await services.handleServiceApproval(env, callbackQuery, serviceId, 'Approved');
    }
    if (data.startsWith('service_reject_')) {
      const serviceId = data.replace('service_reject_', '');
      return await services.handleServiceApproval(env, callbackQuery, serviceId, 'Rejected');
    }
    
    // Services - management
    if (data === 'admin_manage_services') {
      return await services.handleManageServices(env, callbackQuery);
    }
    if (data === 'svc_edit_category') {
      return await services.handleEditCategory(env, callbackQuery);
    }
    if (data.startsWith('svc_set_cat_')) {
      const category = data.replace('svc_set_cat_', '');
      return await services.handleSetCategory(env, callbackQuery, category);
    }
    if (data === 'svc_manage_services') {
      return await services.handleServicesMenu(env, callbackQuery);
    }
    if (data === 'svc_add') {
      return await services.handleAddServiceStart(env, callbackQuery);
    }
    if (data === 'svc_edit') {
      return await services.handleEditServiceStart(env, callbackQuery);
    }
    if (data === 'svc_delete') {
      return await services.handleDeleteServiceStart(env, callbackQuery);
    }
    if (data.startsWith('svc_delete_confirm_')) {
      const serviceId = data.replace('svc_delete_confirm_', '');
      return await services.handleDeleteServiceConfirm(env, callbackQuery, serviceId);
    }
    if (data.startsWith('svc_choose_edit_')) {
      const serviceId = data.replace('svc_choose_edit_', '');
      return await services.handleChooseServiceForEdit(env, callbackQuery, serviceId);
    }
    if (data.startsWith('svc_edit_field_')) {
      const parts = data.replace('svc_edit_field_', '').split('_');
      const field = parts[0];
      const serviceId = parts.slice(1).join('_');
      return await services.handleEditServiceField(env, callbackQuery, field, serviceId);
    }
    if (data.startsWith('svc_set_service_cat_')) {
      const category = data.replace('svc_set_service_cat_', '');
      return await services.handleSetServiceCategory(env, callbackQuery, category);
    }
    if (data === 'svc_back_to_partner') {
      return await services.handleBackToPartner(env, callbackQuery);
    }
    if (data === 'svc_cancel') {
      return await services.handleCancel(env, callbackQuery);
    }
    if (data === 'svc_edit_location') {
      return await services.handleEditLocation(env, callbackQuery);
    }
    if (data.startsWith('svc_city_')) {
      const city = data.replace('svc_city_', '');
      return await services.handleSetCity(env, callbackQuery, city);
    }
    if (data.startsWith('svc_district_')) {
      const parts = data.replace('svc_district_', '').split('_');
      const city = parts[0];
      const district = parts.slice(1).join('_');
      return await services.handleSetDistrict(env, callbackQuery, city, district);
    }
    
    // Broadcast
    if (data === 'admin_broadcast') {
      return await broadcast.handleBroadcastStart(env, callbackQuery);
    }
    if (data === 'broadcast_all') {
      return await broadcast.handleBroadcastAll(env, callbackQuery);
    }
    if (data === 'broadcast_select_city') {
      return await broadcast.handleBroadcastSelectCity(env, callbackQuery);
    }
    if (data.startsWith('broadcast_city_')) {
      const cityBase64 = data.replace('broadcast_city_', '');
      return await broadcast.handleBroadcastCity(env, callbackQuery, cityBase64);
    }
    if (data === 'broadcast_select_category') {
      return await broadcast.handleBroadcastSelectCategory(env, callbackQuery);
    }
    if (data.startsWith('broadcast_category_')) {
      const category = data.replace('broadcast_category_', '');
      return await broadcast.handleBroadcastCategory(env, callbackQuery, category);
    }
    if (data === 'cancel_broadcast') {
      return await broadcast.handleCancelBroadcast(env, callbackQuery);
    }
    
    // Stats
    if (data === 'admin_stats') {
      return await stats.handleAdminStats(env, callbackQuery);
    }
    if (data === 'admin_dashboard') {
      return await stats.handleDashboard(env, callbackQuery);
    }
    if (data === 'admin_onepagers') {
      return await stats.handleOnepagers(env, callbackQuery);
    }
    if (data.startsWith('onepager_')) {
      const type = data.replace('onepager_', '');
      return await stats.handleOnepagerView(env, callbackQuery, type);
    }
    if (data === 'admin_background') {
      return await stats.handleBackgroundMenu(env, callbackQuery);
    }
    if (data.startsWith('bg_set_')) {
      const theme = data.replace('bg_set_', '');
      return await stats.handleSetBackground(env, callbackQuery, theme);
    }
    
    // News
    if (data === 'admin_news') {
      return await news.handleNewsMenu(env, callbackQuery);
    }
    if (data === 'news_create') {
      return await news.handleCreateNews(env, callbackQuery);
    }
    if (data === 'news_list') {
      return await news.handleNewsList(env, callbackQuery);
    }
    if (data === 'news_edit') {
      return await news.handleEditNewsStart(env, callbackQuery);
    }
    if (data.startsWith('news_select_edit_')) {
      const newsId = data.replace('news_select_edit_', '');
      return await news.handleSelectNewsForEdit(env, callbackQuery, newsId);
    }
    if (data.startsWith('news_edit_field_')) {
      const parts = data.replace('news_edit_field_', '').split('_');
      const field = parts[0];
      const newsId = parts.slice(1).join('_');
      return await news.handleEditNewsField(env, callbackQuery, field, newsId);
    }
    if (data.startsWith('news_toggle_published_')) {
      const newsId = data.replace('news_toggle_published_', '');
      return await news.handleTogglePublished(env, callbackQuery, newsId);
    }
    if (data === 'news_delete') {
      return await news.handleDeleteNewsStart(env, callbackQuery);
    }
    if (data.startsWith('news_delete_select_')) {
      const newsId = data.replace('news_delete_select_', '');
      return await news.handleDeleteNewsSelect(env, callbackQuery, newsId);
    }
    if (data.startsWith('news_delete_confirm_')) {
      const newsId = data.replace('news_delete_confirm_', '');
      return await news.handleDeleteNewsConfirm(env, callbackQuery, newsId);
    }
    if (data === 'news_cancel') {
      return await news.handleCancelNews(env, callbackQuery);
    }
    
    // UGC
    if (data === 'admin_ugc') {
      return await ugc.handleAdminUGC(env, callbackQuery);
    }
    if (data.startsWith('ugc_approve_')) {
      const ugcId = data.replace('ugc_approve_', '');
      return await ugc.handleUGCApproval(env, callbackQuery, ugcId, 'approved');
    }
    if (data.startsWith('ugc_reject_')) {
      const ugcId = data.replace('ugc_reject_', '');
      return await ugc.handleUGCApproval(env, callbackQuery, ugcId, 'rejected');
    }
    
    // Promoters
    if (data === 'admin_promoters') {
      return await promoters.handleAdminPromoters(env, callbackQuery);
    }
    if (data.startsWith('promoter_info_')) {
      const promoterChatId = data.replace('promoter_info_', '');
      return await promoters.handlePromoterInfo(env, callbackQuery, promoterChatId);
    }
    
    // MLM
    if (data === 'admin_mlm') {
      return await mlm.handleMLMMenu(env, callbackQuery);
    }
    if (data === 'mlm_stats') {
      return await mlm.handleMLMStats(env, callbackQuery);
    }
    if (data === 'mlm_network') {
      return await mlm.handleMLMNetwork(env, callbackQuery);
    }
    if (data === 'mlm_set_pv') {
      return await mlm.handleSetPVMenu(env, callbackQuery);
    }
    if (data === 'mlm_approve_payments') {
      return await mlm.handleApprovePayments(env, callbackQuery);
    }
    if (data.startsWith('mlm_pay_approve_')) {
      const paymentId = data.replace('mlm_pay_approve_', '');
      return await mlm.handlePaymentAction(env, callbackQuery, paymentId, 'approve');
    }
    if (data.startsWith('mlm_pay_reject_')) {
      const paymentId = data.replace('mlm_pay_reject_', '');
      return await mlm.handlePaymentAction(env, callbackQuery, paymentId, 'reject');
    }
    
    // Leaderboard
    if (data === 'admin_leaderboard') {
      return await leaderboard.handleLeaderboardMenu(env, callbackQuery);
    }
    if (data === 'leaderboard_full') {
      return await leaderboard.handleFullLeaderboard(env, callbackQuery);
    }
    if (data === 'leaderboard_create') {
      return await leaderboard.handleCreatePeriod(env, callbackQuery);
    }
    if (data === 'leaderboard_distribute') {
      return await leaderboard.handleDistributePrizes(env, callbackQuery);
    }
    
    // B2B
    if (data === 'admin_b2b_deals') {
      return await b2b.handleB2BMenu(env, callbackQuery);
    }
    if (data === 'b2b_list_all') {
      return await b2b.handleListAll(env, callbackQuery);
    }
    if (data === 'b2b_list_pending') {
      return await b2b.handleListPending(env, callbackQuery);
    }
    if (data === 'b2b_create') {
      return await b2b.handleCreateStart(env, callbackQuery);
    }
    if (data.startsWith('b2b_accept_')) {
      const dealId = data.replace('b2b_accept_', '');
      return await b2b.handleDealAction(env, callbackQuery, dealId, 'accept');
    }
    if (data.startsWith('b2b_reject_')) {
      const dealId = data.replace('b2b_reject_', '');
      return await b2b.handleDealAction(env, callbackQuery, dealId, 'reject');
    }
    
    // Default: show main menu
    await showMainMenu(env, chatId);
    return { success: true, handled: true, action: 'main_menu' };
  } catch (error) {
    logError('handleCallbackQuery (admin)', error, { chatId, data });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Произошла ошибка', show_alert: true });
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
      
      console.log('[routeUpdate] Received message:', {
        chatId,
        text,
        isAdmin: isAdmin(env, chatId),
      });
      
      // Handle commands
      if (text.startsWith('/start') || text.startsWith('/admin')) {
        console.log('[routeUpdate] Handling /start command');
        return await handleStart(env, update);
      }
      
      // Check if admin is in FSM state
      if (isAdmin(env, chatId)) {
        const state = await getBotState(env, chatId);
        if (state && state.state) {
          // Route to appropriate handler based on state prefix
          if (state.state.startsWith('broadcast_')) {
            return await broadcast.handleBroadcastMessage(env, update, state.data);
          }
          if (state.state.startsWith('svc_')) {
            return await services.handleMessage(env, update, state.data);
          }
          if (state.state.startsWith('news_')) {
            return await news.handleMessage(env, update, state.data);
          }
          if (state.state.startsWith('b2b_')) {
            return await b2b.handleMessage(env, update, state.data);
          }
          if (state.state.startsWith('mlm_')) {
            return await mlm.handleMessage(env, update, state.data);
          }
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
    return { success: false, handled: false, error: error.message };
  }
}
