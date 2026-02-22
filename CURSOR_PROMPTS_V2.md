# Промпты V2 — исправление багов и дореализация функционала

> **Рекомендация по модели:** Sonnet 4.5 не доделал ~50% работы. Попробуй **Claude Opus 4** (claude-opus-4-20250514) или **Gemini 2.5 Pro**. Opus лучше справляется с длинными многофайловыми задачами и точнее следует инструкциям. Gemini 2.5 Pro тоже хорош для больших контекстов. Если Cursor не поддерживает Opus — используй Gemini 2.5 Pro.
>
> **Важно:** Промпты 1-4 НЕЗАВИСИМЫ — можно выполнять параллельно. Промпт 5 — после всех.
> В каждом промпте указаны КОНКРЕТНЫЕ строки и файлы для изменения.

---

## Промпт 1 — КРИТИЧЕСКИЕ БАГФИКСЫ (сначала этот!)

```
Задача: исправить 4 критических бага в cloudflare/workers/admin-webhook/

КОНТЕКСТ:
Модуляризация уже сделана. Есть структура handlers/*.js. Но есть баги, которые ломают ключевые фичи.

=== БАГ 1: partners.js строка 59 — getAllApprovedPartners() ===

ПРОБЛЕМА: Запрос `partners?select=*&status=eq.Approved` — в таблице `partners` НЕТ поля `status`. Оно есть только в `partner_applications`. Функция ВСЕГДА возвращает пустой массив.

Это ломает: рассылку по городу/категории (broadcast.js), удаление партнёров, статистику.

ИСПРАВЬ строку 59 в handlers/partners.js:
БЫЛО: `const result = await supabaseRequest(env, 'partners?select=*&status=eq.Approved&order=created_at.desc');`
НАДО: `const result = await supabaseRequest(env, 'partners?select=*&order=created_at.desc');`

Таблица `partners` содержит ТОЛЬКО одобренных партнёров (запись создаётся при approve через ensurePartnerRecord). Фильтр по status не нужен.


=== БАГ 2: telegram.js строки 7-14 — safeJsonResponse() ===

ПРОБЛЕМА: После `response.json()` бросает исключение, поток response уже consumed. Вызов `response.text()` в catch тоже упадёт.

ИСПРАВЬ функцию safeJsonResponse в telegram.js:
```js
async function safeJsonResponse(response) {
  try {
    const text = await response.text();
    if (!text || text.trim() === '') {
      return { ok: true };
    }
    return JSON.parse(text);
  } catch (e) {
    console.error('[Telegram API] Failed to parse response:', e.message);
    return { ok: false, error: 'Invalid JSON response' };
  }
}
```


=== БАГ 3: services.js — динамические import() вместо top-level ===

ПРОБЛЕМА: services.js на строках 259, 291, 337, 350, 397, 459, 556, 572, 610, 700, 745 использует:
`await import('../supabase.js').then(m => m.getBotState(env, chatId))`

Это неэффективно и может вызвать проблемы в Cloudflare Workers.

ИСПРАВЬ: getBotState УЖЕ импортирован в services.js на строке 19-21 (setBotState, clearBotState, updateBotStateData). Просто добавь getBotState в этот импорт и замени все динамические import() на прямой вызов.

Строка 19-22 сейчас:
```js
  setBotState,
  clearBotState,
  updateBotStateData,
```
Добавь `getBotState`:
```js
  getBotState,
  setBotState,
  clearBotState,
  updateBotStateData,
```

Затем найди и замени ВСЕ вхождения паттерна:
`await import('../supabase.js').then(m => m.getBotState(env, chatId))`
на просто:
`await getBotState(env, chatId)`

То же самое для строки 597 в handleCancel:
`const { showMainMenu } = await import('../admin.js');`
Замени на top-level import: `import { showMainMenu } from '../admin.js';` в начале файла.


=== БАГ 4: admin.js строка 403 — неполный FSM-роутинг ===

ПРОБЛЕМА: routeUpdate() роутит FSM только для broadcast_, svc_, news_. НЕТ роутинга для b2b_.

ИСПРАВЬ: в admin.js, в routeUpdate(), после строки 402 (news роутинг), добавь:
```js
          if (state.state.startsWith('b2b_')) {
            return await b2b.handleMessage(env, update, state.data);
          }
```

НЕ ЗАБУДЬ: b2b.js должен экспортировать handleMessage — это будет сделано в промпте 3.


=== ДОПОЛНИТЕЛЬНО: удали мёртвый код ===

Удали функцию handleFeatureStub() из ВСЕХ файлов где она есть:
- handlers/news.js (строки 531-546)
- handlers/ugc.js (последние ~15 строк)
- handlers/promoters.js (последние ~15 строк)
- handlers/leaderboard.js (строки 91-106)
- handlers/mlm.js (строки 134-149)
- handlers/b2b.js (строки 137-152)

Эти функции НИГДЕ не вызываются — чистый мёртвый код.
```

---

## Промпт 2 — Дореализация MLM (сейчас 30%)

```
Задача: дореализовать MLM Revenue Share в cloudflare/workers/admin-webhook/handlers/mlm.js

КОНТЕКСТ:
Сейчас mlm.js (150 строк) реализует только:
✅ handleMLMMenu — но в меню нет кнопок "Установить PV" и "Одобрить выплаты"
✅ handleMLMStats — работает
✅ handleMLMNetwork — работает
❌ handleSetPVMenu — НЕ РЕАЛИЗОВАН
❌ handleApprovePayments — НЕ РЕАЛИЗОВАН
❌ handlePaymentAction — НЕ РЕАЛИЗОВАН
❌ /set_pv команда — НЕ РЕАЛИЗОВАНА

Эталон логики: admin_bot.py строки 2495-2851

=== 1. Исправь меню (handleMLMMenu, строка 22-25) ===

Сейчас в keyboard только 2 кнопки. Добавь недостающие:
```js
const keyboard = [
  [{ text: '📊 Статистика MLM', callback_data: 'mlm_stats' }],
  [{ text: '💰 Установить PV', callback_data: 'mlm_set_pv' }],
  [{ text: '✅ Одобрить выплаты', callback_data: 'mlm_approve_payments' }],
  [{ text: '🌳 Сеть партнёров', callback_data: 'mlm_network' }],
  [{ text: '◀️ Назад', callback_data: 'back_to_main' }],
];
```

=== 2. Реализуй handleSetPVMenu ===

```js
export async function handleSetPVMenu(env, callbackQuery) {
  // Показать инструкцию: "Отправьте сообщение в формате: chat_id процент"
  // Пример: 123456789 15
  // setState: 'mlm_waiting_pv'
  // Кнопка "Отмена" → admin_mlm
}
```

=== 3. Реализуй handleMessage для FSM ===

```js
export async function handleMessage(env, update, stateData) {
  const chatId = String(update.message.chat.id);
  const text = update.message.text || '';
  const state = await getBotState(env, chatId);

  if (state?.state === 'mlm_waiting_pv') {
    // Парсинг: "123456789 15"
    const parts = text.trim().split(/\s+/);
    if (parts.length !== 2) {
      // Ошибка формата
      return;
    }
    const [targetChatId, pvStr] = parts;
    const pvPercent = parseFloat(pvStr);

    // Валидация
    if (isNaN(pvPercent) || pvPercent < 0 || pvPercent > 100) {
      // Ошибка: процент 0-100
      return;
    }

    // Проверить что партнёр существует
    const partner = await getPartnerByChatId(env, targetChatId);
    if (!partner) {
      // Ошибка: партнёр не найден
      return;
    }

    // Обновить PV
    await updatePartnerField(env, targetChatId, 'pv_percent', pvPercent);
    await clearBotState(env, chatId);

    // Ответ: "PV для {name} установлен: {pvPercent}%"
    // Кнопка "Назад" → admin_mlm
  }
}
```

=== 4. Реализуй handleApprovePayments ===

```js
export async function handleApprovePayments(env, callbackQuery) {
  // Запрос: revenue_share_payments?status=eq.pending&select=*&order=created_at.desc
  // Если пусто → "Нет выплат на модерации"
  // Для каждой:
  //   Текст: "Партнёр: {chat_id}, Сумма: {amount}, Дата: {date}"
  //   Кнопки: "✅ Одобрить" mlm_pay_approve_{id} / "❌ Отклонить" mlm_pay_reject_{id}
}
```

=== 5. Реализуй handlePaymentAction ===

```js
export async function handlePaymentAction(env, callbackQuery, paymentId, action) {
  // action = 'approve' или 'reject'
  // PATCH revenue_share_payments?id=eq.{paymentId}
  // → { status: action === 'approve' ? 'approved' : 'rejected', processed_at: new Date().toISOString() }
  // Обновить сообщение: "ОДОБРЕНО" / "ОТКЛОНЕНО"
  // Уведомить партнёра через sendPartnerNotification
}
```

=== 6. Добавь роутинг в admin.js ===

В handleCallbackQuery (после строки 331):
```js
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
```

В routeUpdate, после b2b_ FSM роутинга:
```js
if (state.state.startsWith('mlm_')) {
  return await mlm.handleMessage(env, update, state.data);
}
```

=== 7. Добавь Supabase-функции в supabase.js ===

- getPendingPayments(env) → `revenue_share_payments?status=eq.pending&select=*&order=created_at.desc`
- updatePaymentStatus(env, id, status) → PATCH `revenue_share_payments?id=eq.{id}` → { status, processed_at }
- updatePartnerPV(env, chatId, pvPercent) → уже есть updatePartnerField, используй его

Импортируй в mlm.js: getBotState, clearBotState, setBotState, getPartnerByChatId, updatePartnerField из ../supabase.js
Импортируй sendPartnerNotification из ./partners.js
```

---

## Промпт 3 — Дореализация B2B (сейчас 40%)

```
Задача: дореализовать B2B сделки в cloudflare/workers/admin-webhook/handlers/b2b.js

КОНТЕКСТ:
Сейчас b2b.js (153 строки) реализует только:
✅ handleB2BMenu — но нет кнопки "Создать сделку"
✅ handleListAll — работает
✅ handleListPending — работает, но нет кнопок approve/reject для каждой сделки
❌ handleCreateStart — НЕ РЕАЛИЗОВАН (FSM создание сделки)
❌ handleDealAction — НЕ РЕАЛИЗОВАН (approve/reject pending)
❌ handleMessage — НЕ РЕАЛИЗОВАН (FSM текстовые сообщения)

Эталон логики: admin_bot.py строки 1530-1986

=== 1. Исправь меню (handleB2BMenu, строка 22-25) ===

Добавь кнопку создания:
```js
const keyboard = [
  [{ text: '📋 Все сделки', callback_data: 'b2b_list_all' }],
  [{ text: '⏳ Ожидающие', callback_data: 'b2b_list_pending' }],
  [{ text: '➕ Создать сделку', callback_data: 'b2b_create' }],
  [{ text: '◀️ Назад', callback_data: 'back_to_main' }],
];
```

=== 2. Исправь handleListPending — добавь кнопки approve/reject ===

Сейчас (строки 110-113) сделки показываются без кнопок действий. Исправь:

Для каждой сделки отправляй ОТДЕЛЬНОЕ сообщение (как в partners pending):
```js
for (const deal of deals) {
  const messageText = (
    `**B2B Сделка #${deal.id}**\n\n` +
    `📤 Продавец: ${deal.source_partner_chat_id}\n` +
    `📥 Покупатель: ${deal.target_partner_chat_id}\n` +
    `💰 Условия продавца: ${deal.seller_pays || '—'}\n` +
    `🎁 Условия покупателя: ${deal.buyer_gets || '—'}\n` +
    `📅 Дата: ${(deal.created_at || '').substring(0, 10)}`
  );

  const keyboard = [
    [
      { text: '✅ Принять', callback_data: `b2b_accept_${deal.id}` },
      { text: '❌ Отклонить', callback_data: `b2b_reject_${deal.id}` },
    ],
  ];

  await sendTelegramMessageWithKeyboard(env.ADMIN_BOT_TOKEN, chatId, messageText, keyboard);
}
```

=== 3. Реализуй handleDealAction ===

```js
export async function handleDealAction(env, callbackQuery, dealId, action) {
  // action = 'accept' или 'reject'
  const newStatus = action === 'accept' ? 'approved' : 'rejected';

  // PATCH partner_deals?id=eq.{dealId} → { status: newStatus }
  // Обновить сообщение: добавить "СТАТУС: ОДОБРЕНО/ОТКЛОНЕНО"
  // Уведомить обоих партнёров через sendPartnerNotification
}
```

=== 4. Реализуй handleCreateStart + handleMessage (FSM) ===

handleCreateStart:
- Текст: "Введите chat_id партнёра-продавца:"
- setBotState(env, chatId, 'b2b_waiting_source', {})
- Кнопка "Отмена" → admin_b2b_deals

handleMessage (экспортировать!):
```js
export async function handleMessage(env, update, stateData) {
  const chatId = String(update.message.chat.id);
  const text = update.message.text || '';
  const currentState = await getBotState(env, chatId);

  switch (currentState?.state) {
    case 'b2b_waiting_source': {
      // Проверить партнёр существует: getPartnerByChatId(env, text.trim())
      // Если нет → "Партнёр не найден"
      // Если да → "Введите chat_id покупателя:"
      // setBotState: 'b2b_waiting_target', data: { source_chat_id, source_name }
      break;
    }
    case 'b2b_waiting_target': {
      // Аналогично — проверить, сохранить
      // → "Введите условия для продавца (что платит):"
      // setBotState: 'b2b_waiting_seller_pays'
      break;
    }
    case 'b2b_waiting_seller_pays': {
      // Сохранить seller_pays
      // → "Введите условия для покупателя (что получает):"
      // setBotState: 'b2b_waiting_buyer_gets'
      break;
    }
    case 'b2b_waiting_buyer_gets': {
      // Сохранить buyer_gets
      // INSERT partner_deals: { source_partner_chat_id, target_partner_chat_id, seller_pays, buyer_gets, status: 'pending' }
      // clearBotState
      // Показать сводку сделки
      // Уведомить обоих партнёров
      break;
    }
  }
}
```

=== 5. Добавь роутинг в admin.js ===

В handleCallbackQuery:
```js
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
```

FSM роутинг в routeUpdate (если ещё не добавлен в промпте 1):
```js
if (state.state.startsWith('b2b_')) {
  return await b2b.handleMessage(env, update, state.data);
}
```

=== 6. Supabase-функции (добавь в supabase.js если нет) ===

- createDeal(env, dealData) → POST partner_deals
- updateDealStatus(env, id, status) → PATCH partner_deals?id=eq.{id}
- getPartnerByChatId(env, chatId) — уже есть

Импорты в b2b.js: getBotState, setBotState, clearBotState, getPartnerByChatId из ../supabase.js
sendPartnerNotification из ./partners.js
sendTelegramMessage, sendTelegramMessageWithKeyboard из ../telegram.js
```

---

## Промпт 4 — Дореализация Лидерборд (сейчас 40%) + Услуги (svc_edit_location) + Статистика (промпт 7)

```
Задача: дореализовать 3 недоделанных модуля в cloudflare/workers/admin-webhook/

=== ЧАСТЬ A: Лидерборд (handlers/leaderboard.js) ===

Сейчас реализовано:
✅ handleLeaderboardMenu — но нет кнопок "Создать период" и "Раздать призы"
✅ handleFullLeaderboard — работает
❌ handleCreatePeriod — НЕ РЕАЛИЗОВАН
❌ handleDistributePrizes — НЕ РЕАЛИЗОВАН

Эталон: admin_bot.py строки 2381-2440

1. Исправь меню (handleLeaderboardMenu, строка 22-24):
```js
const keyboard = [
  [{ text: '🏆 Полный рейтинг', callback_data: 'leaderboard_full' }],
  [{ text: '📅 Создать период', callback_data: 'leaderboard_create' }],
  [{ text: '🎁 Раздать призы', callback_data: 'leaderboard_distribute' }],
  [{ text: '◀️ Назад', callback_data: 'back_to_main' }],
];
```

2. Реализуй handleCreatePeriod:
```js
export async function handleCreatePeriod(env, callbackQuery) {
  // 1. Деактивировать текущие: PATCH leaderboard_periods?is_active=eq.true → { is_active: false }
  // 2. Создать новый: POST leaderboard_periods → { name: "Период февраль 2026", start_date: now, is_active: true }
  // 3. Показать: "Новый период создан: {name}"
  // Кнопка "Назад" → admin_leaderboard
}
```

3. Реализуй handleDistributePrizes:
```js
export async function handleDistributePrizes(env, callbackQuery) {
  // 1. Получить активный период: leaderboard_periods?is_active=eq.true&select=*
  // 2. Если нет → "Нет активного периода"
  // 3. Получить топ-3: leaderboard_entries?period_id=eq.{id}&order=points.desc&limit=3
  // 4. Показать: "🥇 {name} — {points}\n🥈 {name} — {points}\n🥉 {name} — {points}"
  // 5. Текст: "Призы распределены!"
  // Кнопка "Назад" → admin_leaderboard
}
```

4. Роутинг в admin.js — добавь после строки 338:
```js
if (data === 'leaderboard_create') {
  return await leaderboard.handleCreatePeriod(env, callbackQuery);
}
if (data === 'leaderboard_distribute') {
  return await leaderboard.handleDistributePrizes(env, callbackQuery);
}
```

5. Supabase (добавь в supabase.js):
- getActiveLeaderboardPeriod(env) → leaderboard_periods?is_active=eq.true&select=*&limit=1
- createLeaderboardPeriod(env, name) → POST leaderboard_periods
- deactivateLeaderboardPeriods(env) → PATCH leaderboard_periods?is_active=eq.true → { is_active: false }


=== ЧАСТЬ B: services.js — добавить handleEditLocation ===

ПРОБЛЕМА: В меню партнёра (строка 201) есть кнопка `svc_edit_location`, но обработчик НЕ РЕАЛИЗОВАН.

Реализуй:
```js
export async function handleEditLocation(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);

  // Получить список уникальных городов
  const cities = await getDistinctCitiesFromPartners(env);

  if (cities.length === 0) {
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Нет городов', show_alert: true });
    return { success: false, handled: true };
  }

  const keyboard = cities.map(city => [{
    text: `🏙 ${city}`,
    callback_data: `svc_city_${encodeURIComponent(city)}`,
  }]);
  keyboard.push([{ text: '◀️ Назад', callback_data: 'svc_back_to_partner' }]);

  await editMessageText(env.ADMIN_BOT_TOKEN, chatId, callbackQuery.message.message_id,
    '🏙 **Выберите город:**', keyboard, { parseMode: 'Markdown' });

  return { success: true, handled: true };
}

export async function handleSetCity(env, callbackQuery, city) {
  const chatId = String(callbackQuery.message.chat.id);
  const decodedCity = decodeURIComponent(city);

  const state = await getBotState(env, chatId);
  const partnerChatId = state?.data?.partner_chat_id;
  if (!partnerChatId) return { success: false, handled: true };

  // Показать районы для города
  const districts = await getDistrictsForCity(env, decodedCity);

  if (districts.length === 0) {
    // Нет районов — сохранить только город
    await updatePartnerField(env, partnerChatId, 'city', decodedCity);
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: `✅ Город: ${decodedCity}` });
    await showPartnerServicesMenu(env, chatId, partnerChatId, callbackQuery.message.message_id);
    return { success: true, handled: true };
  }

  const keyboard = districts.map(d => [{
    text: `📍 ${d}`,
    callback_data: `svc_district_${encodeURIComponent(decodedCity)}_${encodeURIComponent(d)}`,
  }]);
  keyboard.push([{ text: '◀️ Назад', callback_data: 'svc_edit_location' }]);

  await editMessageText(env.ADMIN_BOT_TOKEN, chatId, callbackQuery.message.message_id,
    `🏙 Город: **${decodedCity}**\n\n📍 Выберите район:`, keyboard, { parseMode: 'Markdown' });

  return { success: true, handled: true };
}

export async function handleSetDistrict(env, callbackQuery, city, district) {
  const chatId = String(callbackQuery.message.chat.id);
  const state = await getBotState(env, chatId);
  const partnerChatId = state?.data?.partner_chat_id;
  if (!partnerChatId) return { success: false, handled: true };

  await updatePartnerField(env, partnerChatId, 'city', decodeURIComponent(city));
  await updatePartnerField(env, partnerChatId, 'district', decodeURIComponent(district));
  await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: '✅ Локация обновлена' });
  await showPartnerServicesMenu(env, chatId, partnerChatId, callbackQuery.message.message_id);

  return { success: true, handled: true };
}
```

Роутинг в admin.js — добавь:
```js
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
```


=== ЧАСТЬ C: Расширенная статистика + дашборд + onepagers + фон (stats.js) ===

Сейчас stats.js — 85 строк, только handleAdminStats. Расширенная статистика уже реализована (с динамическим import — замени на top-level). Нужно добавить дашборд, one-pagers, фон.

1. Добавь в stats.js top-level import (заменив динамический на строке 29):
```js
import { supabaseRequest } from '../supabase.js';
```

2. Добавь кнопки в главное меню admin.js (showMainMenu):
```js
[
  { text: '📈 Дашборд', callback_data: 'admin_dashboard' },
  { text: '📄 Одностраничники', callback_data: 'admin_onepagers' },
  { text: '🎨 Смена фона', callback_data: 'admin_background' },
],
```

3. Реализуй в stats.js:
```js
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

  await editMessageText(env.ADMIN_BOT_TOKEN, chatId, callbackQuery.message.message_id, text, keyboard, { parseMode: 'Markdown' });
  return { success: true, handled: true };
}

export async function handleOnepagers(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  const keyboard = [
    [{ text: '🤝 Для партнёров', callback_data: 'onepager_partner' }],
    [{ text: '👥 Для клиентов', callback_data: 'onepager_client' }],
    [{ text: '💼 Для инвесторов', callback_data: 'onepager_investor' }],
    [{ text: '◀️ Назад', callback_data: 'back_to_main' }],
  ];
  await editMessageText(env.ADMIN_BOT_TOKEN, chatId, callbackQuery.message.message_id,
    '📄 **Одностраничники**\n\nВыберите тип:', keyboard, { parseMode: 'Markdown' });
  return { success: true, handled: true };
}

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

  await editMessageText(env.ADMIN_BOT_TOKEN, chatId, callbackQuery.message.message_id, text, keyboard, { parseMode: 'Markdown' });
  return { success: true, handled: true };
}

export async function handleBackgroundMenu(env, callbackQuery) {
  const chatId = String(callbackQuery.message.chat.id);
  const keyboard = [
    [{ text: '🌅 Стандартный', callback_data: 'bg_set_default' }],
    [{ text: '🌙 Тёмный', callback_data: 'bg_set_dark' }],
    [{ text: '🌈 Градиент', callback_data: 'bg_set_gradient' }],
    [{ text: '⬜ Минимализм', callback_data: 'bg_set_minimal' }],
    [{ text: '◀️ Назад', callback_data: 'back_to_main' }],
  ];
  await editMessageText(env.ADMIN_BOT_TOKEN, chatId, callbackQuery.message.message_id,
    '🎨 **Смена фона Mini App**\n\nВыберите тему:', keyboard, { parseMode: 'Markdown' });
  return { success: true, handled: true };
}

export async function handleSetBackground(env, callbackQuery, theme) {
  const chatId = String(callbackQuery.message.chat.id);
  const names = { default: 'Стандартный', dark: 'Тёмный', gradient: 'Градиент', minimal: 'Минимализм' };

  // Сохранить: UPSERT app_settings
  await supabaseRequest(env, 'app_settings', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify({ key: 'background_theme', value: theme }),
  });

  await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: `✅ Фон: ${names[theme] || theme}` });

  const keyboard = [[{ text: '◀️ Назад', callback_data: 'admin_background' }]];
  await editMessageText(env.ADMIN_BOT_TOKEN, chatId, callbackQuery.message.message_id,
    `✅ Фон изменён на: **${names[theme] || theme}**`, keyboard, { parseMode: 'Markdown' });
  return { success: true, handled: true };
}
```

4. Роутинг в admin.js:
```js
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
```
```

---

## Промпт 5 — Финальная проверка (после промптов 1-4)

```
Задача: финальная проверка и чистка cloudflare/workers/admin-webhook/

ПРОВЕРЬ ВСЕ СЛЕДУЮЩИЕ ПУНКТЫ:

=== РОУТИНГ (admin.js) ===

1. Открой admin.js → handleCallbackQuery(). Проверь что КАЖДАЯ кнопка из showMainMenu() имеет обработчик:
   - admin_broadcast ✅ (broadcast.js)
   - admin_partners ✅ (partners.js)
   - admin_stats ✅ (stats.js)
   - admin_news ✅ (news.js)
   - admin_ugc ✅ (ugc.js)
   - admin_promoters ✅ (promoters.js)
   - admin_leaderboard ✅ (leaderboard.js)
   - admin_mlm ✅ (mlm.js)
   - admin_b2b_deals ✅ (b2b.js)
   - admin_dashboard → stats.handleDashboard
   - admin_onepagers → stats.handleOnepagers
   - admin_background → stats.handleBackgroundMenu

   Если какой-то маршрут ведёт в никуда — ДОБАВЬ.

2. Проверь routeUpdate() → FSM роутинг. Должны быть ВСЕ:
   - broadcast_ → broadcast.handleBroadcastMessage
   - svc_ → services.handleMessage
   - news_ → news.handleMessage
   - b2b_ → b2b.handleMessage
   - mlm_ → mlm.handleMessage

3. Проверь что /set_pv обрабатывается, если решили оставить как команду.


=== ИМПОРТЫ ===

4. Убедись что НИГДЕ нет динамических import() — все должны быть top-level:
   - services.js: НЕ ДОЛЖНО быть `await import('../supabase.js')` или `await import('../admin.js')`
   - stats.js: НЕ ДОЛЖНО быть `await import('../supabase.js')`
   - Все остальные модули тоже

5. Проверь что каждый модуль импортирует ТОЛЬКО то, что использует.


=== МЁРТВЫЙ КОД ===

6. Удали handleFeatureStub() из ВСЕХ модулей где она осталась.
7. Удали лишние console.log (оставь только console.error для ошибок).


=== КНОПКИ ===

8. Проверь что КАЖДЫЙ экран имеет кнопку "Назад" или "Отмена".
9. Проверь что КАЖДЫЙ FSM-шаг имеет кнопку "Отмена" → clearBotState.


=== SUPABASE ===

10. Проверь что ВСЕ функции, вызываемые из handlers, существуют и экспортированы в supabase.js.
    Сделай grep по всем handlers/*.js на вызовы `await ...Request` и `await get/update/create/delete` и убедись что каждая функция есть в supabase.js.

11. Проверь что getAllApprovedPartners() запрашивает `partners?select=*&order=created_at.desc` БЕЗ фильтра по status.


=== РЕЗУЛЬТАТ ===

После проверки — кратко напиши что исправлено, что не нашёл проблем.
НЕ добавляй новый функционал. Только чистка и исправления.
```

---

## Порядок выполнения

```
Промпт 1 → ОБЯЗАТЕЛЬНО ПЕРВЫЙ (багфиксы)
Промпты 2, 3, 4 → можно параллельно (независимые модули)
Промпт 5 → ПОСЛЕДНИЙ (финальная проверка)
```

| # | Что | Файлы | Размер |
|---|-----|-------|--------|
| 1 | Багфиксы | partners.js, telegram.js, services.js, admin.js, все handlers | ~30 мин |
| 2 | MLM дореализация | mlm.js, admin.js, supabase.js | ~20 мин |
| 3 | B2B дореализация | b2b.js, admin.js, supabase.js | ~20 мин |
| 4 | Лидерборд + Location + Stats | leaderboard.js, services.js, stats.js, admin.js | ~30 мин |
| 5 | Финальная проверка | все файлы | ~15 мин |
