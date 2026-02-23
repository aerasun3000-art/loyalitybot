/**
 * Statistics handlers
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
import { getAllPartnerApplications, getAllApprovedPartners } from './partners.js';

/**
 * Handle admin stats — menu
 */
export async function handleAdminStats(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  const keyboard = [
    [{ text: '📊 Общая статистика', callback_data: 'stats_general' }],
    [{ text: '🏅 Тиры пользователей', callback_data: 'stats_tiers' }],
    [{ text: '🌱 Карма пользователей', callback_data: 'stats_karma' }],
    [{ text: '◀️  Назад', callback_data: 'back_to_main' }],
  ];
  await editMessageText(
    env.ADMIN_BOT_TOKEN, chatId, callbackQuery.message.message_id,
    '📊 **Статистика**\n\nВыберите раздел:',
    keyboard,
    { parseMode: 'Markdown' }
  );
  return { success: true, handled: true, action: 'stats_menu' };
}

/**
 * Handle general stats (partners, services, news, ugc, promoters, deals)
 */
export async function handleStatsGeneral(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  try {
    const allApplications = await getAllPartnerApplications(env);
    const allPartners = await getAllApprovedPartners(env);

    const totalPartners = allPartners.length;
    const approved = allApplications.filter(p => (p.status || '').toLowerCase() === 'approved').length;
    const pending = allApplications.filter(p => (p.status || 'pending').toLowerCase() === 'pending').length;

    const services = await supabaseRequest(env, 'services?select=approval_status');
    const news = await supabaseRequest(env, 'news?select=is_published');
    const ugc = await supabaseRequest(env, 'ugc_content?select=status');
    const promoters = await supabaseRequest(env, 'promoters?select=id');
    const deals = await supabaseRequest(env, 'partner_deals?select=status');

    const servicesTotal = services?.length || 0;
    const servicesPending = services?.filter(s => s.approval_status === 'Pending').length || 0;
    const newsTotal = news?.length || 0;
    const newsPublished = news?.filter(n => n.is_published).length || 0;
    const ugcTotal = ugc?.length || 0;
    const ugcPending = ugc?.filter(u => u.status === 'pending').length || 0;
    const promotersTotal = promoters?.length || 0;
    const dealsTotal = deals?.length || 0;
    const dealsPending = deals?.filter(d => d.status === 'pending').length || 0;

    const text = (
      '📊 *Расширенная статистика*\n\n' +
      `*ПАРТНЁРЫ:*\n` +
      `├─ Всего: ${totalPartners}\n` +
      `├─ Одобрено: ${approved}\n` +
      `└─ На модерации: ${pending}\n\n` +
      `*УСЛУГИ:*\n` +
      `├─ Всего: ${servicesTotal}\n` +
      `└─ На модерации: ${servicesPending}\n\n` +
      `*НОВОСТИ:*\n` +
      `├─ Всего: ${newsTotal}\n` +
      `└─ Опубликовано: ${newsPublished}\n\n` +
      `*UGC:*\n` +
      `├─ Всего: ${ugcTotal}\n` +
      `└─ На модерации: ${ugcPending}\n\n` +
      `*ПРОМОУТЕРЫ:* ${promotersTotal}\n\n` +
      `*B2B СДЕЛКИ:*\n` +
      `├─ Всего: ${dealsTotal}\n` +
      `└─ На модерации: ${dealsPending}`
    );

    const keyboard = [[{ text: '◀️  Назад', callback_data: 'admin_stats' }]];

    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id);

    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      text,
      keyboard,
      { parseMode: 'Markdown' }
    );

    return { success: true, handled: true, action: 'stats_general' };
  } catch (error) {
    logError('handleStatsGeneral', error, { chatId });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка при загрузке статистики', show_alert: true });
    throw error;
  }
}

/**
 * Handle tiers stats
 */
export async function handleStatsTiers(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  try {
    const users = await supabaseRequest(env, 'users?select=tier');
    const total = users?.length || 0;

    const counts = {
      bronze: 0,
      silver: 0,
      gold: 0,
      platinum: 0,
      diamond: 0,
    };
    for (const u of users || []) {
      const t = (u.tier || '').toLowerCase();
      if (counts[t] !== undefined) counts[t]++;
    }

    const pct = (n) => total === 0 ? 0 : Math.round(n / total * 100);
    const text = (
      '🏅 **ТИРЫ ПОЛЬЗОВАТЕЛЕЙ**\n\n' +
      `Всего пользователей: ${total}\n\n` +
      `🥉 Bronze  (<500 баллов):   ${counts.bronze} (${pct(counts.bronze)}%)\n` +
      `🥈 Silver  (500–1999):       ${counts.silver} (${pct(counts.silver)}%)\n` +
      `🥇 Gold    (2000–4999):      ${counts.gold} (${pct(counts.gold)}%)\n` +
      `💎 Platinum (5000–9999):     ${counts.platinum} (${pct(counts.platinum)}%)\n` +
      `💠 Diamond  (≥10000):        ${counts.diamond} (${pct(counts.diamond)}%)`
    );

    const keyboard = [[{ text: '◀️  Назад', callback_data: 'admin_stats' }]];

    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id);

    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      text,
      keyboard,
      { parseMode: 'Markdown' }
    );

    return { success: true, handled: true, action: 'stats_tiers' };
  } catch (error) {
    logError('handleStatsTiers', error, { chatId });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка при загрузке статистики', show_alert: true });
    throw error;
  }
}

/**
 * Handle karma stats
 */
export async function handleStatsKarma(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  try {
    const users = await supabaseRequest(env, 'users?select=karma_level,karma_score');
    const total = users?.length || 0;

    const counts = { sprout: 0, reliable: 0, regular: 0, golden: 0 };
    let sumScore = 0;
    for (const u of users || []) {
      const l = (u.karma_level || 'reliable').toLowerCase();
      if (counts[l] !== undefined) counts[l]++;
      const s = parseFloat(u.karma_score);
      if (!isNaN(s)) sumScore += s;
    }

    const pct = (n) => total === 0 ? 0 : Math.round(n / total * 100);
    const avg = total === 0 ? '—' : (sumScore / total).toFixed(1);
    const text = (
      '🌱 **КАРМА ПОЛЬЗОВАТЕЛЕЙ**\n\n' +
      `Всего пользователей: ${total}\n\n` +
      `🌱 Росток   (0–25):   ${counts.sprout} (${pct(counts.sprout)}%)\n` +
      `🌿 Надёжный (26–50):  ${counts.reliable} (${pct(counts.reliable)}%)\n` +
      `🌳 Постоянник (51–75): ${counts.regular} (${pct(counts.regular)}%)\n` +
      `👑 Золотой  (76–100): ${counts.golden} (${pct(counts.golden)}%)\n\n` +
      `Средний karma_score: ${avg}`
    );

    const keyboard = [[{ text: '◀️  Назад', callback_data: 'admin_stats' }]];

    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id);

    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      text,
      keyboard,
      { parseMode: 'Markdown' }
    );

    return { success: true, handled: true, action: 'stats_karma' };
  } catch (error) {
    logError('handleStatsKarma', error, { chatId });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка при загрузке статистики', show_alert: true });
    throw error;
  }
}

/**
 * Handle dashboard
 */
export async function handleDashboard(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  const dashboardUrl = env.DASHBOARD_URL;
  
  const keyboard = [];
  if (dashboardUrl) {
    keyboard.push([{ text: '🔗 Открыть дашборд', url: dashboardUrl }]);
  }
  keyboard.push([{ text: '◀️ Назад', callback_data: 'back_to_main' }]);
  
  const text = dashboardUrl
    ? '📈 **Дашборд админа**\n\nНажмите кнопку ниже для просмотра аналитики:'
    : '📈 **Дашборд админа**\n\n⚠️ URL дашборда ещё не настроен.';
  
  await editMessageText(
    env.ADMIN_BOT_TOKEN,
    chatId,
    callbackQuery.message.message_id,
    text,
    keyboard,
    { parseMode: 'Markdown' }
  );
  
  return { success: true, handled: true, action: 'dashboard' };
}

/**
 * Handle onepagers menu
 */
export async function handleOnepagers(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  const keyboard = [
    [{ text: '🤝 Для партнёров', callback_data: 'onepager_partner' }],
    [{ text: '👥 Для клиентов', callback_data: 'onepager_client' }],
    [{ text: '💼 Для инвесторов', callback_data: 'onepager_investor' }],
    [{ text: '◀️ Назад', callback_data: 'back_to_main' }],
  ];
  
  await editMessageText(
    env.ADMIN_BOT_TOKEN,
    chatId,
    callbackQuery.message.message_id,
    '📄 **Одностраничники**\n\nВыберите тип:',
    keyboard,
    { parseMode: 'Markdown' }
  );
  
  return { success: true, handled: true, action: 'onepagers_menu' };
}

/**
 * Handle onepager view
 */
export async function handleOnepagerView(env, callbackQuery, type) {
  const chatId = String(callbackQuery.message.chat.id);
  
  const urls = {
    partner: env.ONEPAGER_PARTNER_URL,
    client: env.ONEPAGER_CLIENT_URL,
    investor: env.ONEPAGER_INVESTOR_URL,
  };
  const names = { partner: 'партнёров', client: 'клиентов', investor: 'инвесторов' };
  const url = urls[type];
  
  const keyboard = [];
  if (url) keyboard.push([{ text: '🔗 Открыть', url }]);
  keyboard.push([{ text: '◀️ Назад', callback_data: 'admin_onepagers' }]);
  
  const text = url
    ? `📄 **Одностраничник для ${names[type]}**\n\nНажмите кнопку для просмотра:`
    : `📄 **Одностраничник для ${names[type]}**\n\n⚠️ Ссылка ещё не настроена.`;
  
  await editMessageText(
    env.ADMIN_BOT_TOKEN,
    chatId,
    callbackQuery.message.message_id,
    text,
    keyboard,
    { parseMode: 'Markdown' }
  );
  
  return { success: true, handled: true, action: 'onepager_view' };
}

/**
 * Handle background menu
 */
export async function handleBackgroundMenu(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  
  const keyboard = [
    [{ text: '🌅 Стандартный', callback_data: 'bg_set_default' }],
    [{ text: '🌙 Тёмный', callback_data: 'bg_set_dark' }],
    [{ text: '🌈 Градиент', callback_data: 'bg_set_gradient' }],
    [{ text: '⬜ Минимализм', callback_data: 'bg_set_minimal' }],
    [{ text: '◀️ Назад', callback_data: 'back_to_main' }],
  ];
  
  await editMessageText(
    env.ADMIN_BOT_TOKEN,
    chatId,
    callbackQuery.message.message_id,
    '🎨 **Смена фона Mini App**\n\nВыберите тему:',
    keyboard,
    { parseMode: 'Markdown' }
  );
  
  return { success: true, handled: true, action: 'background_menu' };
}

/**
 * Handle set background
 */
export async function handleSetBackground(env, callbackQuery, theme) {
  const chatId = String(callbackQuery.message.chat.id);
  const names = { default: 'Стандартный', dark: 'Тёмный', gradient: 'Градиент', minimal: 'Минимализм' };
  
  try {
    // Save to app_settings
    await supabaseRequest(env, 'app_settings', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify({ key: 'background_theme', value: theme }),
    });
    
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: `✅ Фон: ${names[theme] || theme}` });
    
    const keyboard = [[{ text: '◀️ Назад', callback_data: 'admin_background' }]];
    await editMessageText(
      env.ADMIN_BOT_TOKEN,
      chatId,
      callbackQuery.message.message_id,
      `✅ Фон изменён на: **${names[theme] || theme}**`,
      keyboard,
      { parseMode: 'Markdown' }
    );
    
    return { success: true, handled: true, action: 'background_set' };
  } catch (error) {
    logError('handleSetBackground', error, { chatId, theme });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка', show_alert: true });
    throw error;
  }
}
