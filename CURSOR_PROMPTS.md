# Промпты для Cursor — восстановление функционала админ-бота

> Выполняй промпты **строго по порядку** (каждый следующий зависит от предыдущего).
> Эталон логики — Python-версия в `admin_bot.py`. Портируем на JS для Cloudflare Workers.

---

## Промпт 0 — Модуляризация + убрать Outreach из меню

```
Задача: рефакторинг cloudflare/workers/admin-webhook/admin.js — разбить на модули и убрать Instagram Outreach из меню.

КОНТЕКСТ:
- Сейчас admin.js — монолит на 1293 строки. Он будет расти до 3000+, поэтому нужна модульная структура.
- Instagram Outreach НЕ нужен — убрать кнопку из меню, если она есть.
- Файлы: cloudflare/workers/admin-webhook/admin.js, index.js, supabase.js, telegram.js, common.js

ТРЕБОВАНИЯ:

1. Создай модульную структуру:
   cloudflare/workers/admin-webhook/
   ├── index.js              (без изменений — точка входа)
   ├── admin.js              (главный роутер: showMainMenu, handleCallbackQuery, routeUpdate, handleStart, isAdmin)
   ├── handlers/
   │   ├── partners.js       (всё про партнёров: handleAdminPartners, handleAdminPartnersPending, handlePartnerApproval, handleAdminPartnersDelete, handlePartnerDeleteSelect, handlePartnerDeleteConfirm + хелперы getAllPartnerApplications, getAllApprovedPartners, updatePartnerStatus, ensurePartnerRecord, deletePartner, sendPartnerNotification)
   │   ├── services.js       (модерация услуг: handleServiceApproval + будущий CRUD)
   │   ├── broadcast.js      (рассылка: handleBroadcastStart, handleBroadcastAll, handleBroadcastSelectCity, handleBroadcastCity, handleBroadcastSelectCategory, handleBroadcastCategory, handleBroadcastMessage, handleCancelBroadcast + хелперы getDistinctCities, getDistinctCategories, getPartnersByCity, getPartnersByCategory)
   │   ├── stats.js          (статистика: handleAdminStats)
   │   ├── news.js           (пока пустой, экспортирует заглушку)
   │   ├── ugc.js            (пока пустой, экспортирует заглушку)
   │   ├── promoters.js      (пока пустой, экспортирует заглушку)
   │   ├── leaderboard.js    (пока пустой, экспортирует заглушку)
   │   ├── mlm.js            (пока пустой, экспортирует заглушку)
   │   └── b2b.js            (пока пустой, экспортирует заглушку)
   ├── supabase.js           (без изменений)
   ├── telegram.js           (без изменений)
   ├── common.js             (без изменений)
   └── sentry.js             (без изменений)

2. admin.js — становится тонким роутером:
   - Импортирует обработчики из handlers/*.js
   - showMainMenu() — формирует клавиатуру главного меню (БЕЗ кнопки Outreach)
   - handleCallbackQuery() — роутит callback_data к нужному модулю
   - routeUpdate() — роутит сообщения (проверяет FSM-состояние, вызывает нужный модуль)
   - Экспортирует: handleStart, handleCallbackQuery, routeUpdate

3. Убери из showMainMenu() кнопки:
   - admin_outreach (если есть)
   - admin_dashboard (заглушка — оставь кнопку, но сделай stub в stats.js)
   - admin_onepagers (заглушка — оставь кнопку, но сделай stub в stats.js)
   - admin_background (заглушка — оставь кнопку, но сделай stub в stats.js)

4. Каждый handler-модуль должен:
   - Импортировать из ../supabase.js, ../telegram.js, ../common.js
   - Экспортировать свои функции для использования в admin.js
   - Содержать handleFeatureStub(env, callbackQuery, featureName) для нереализованных фич

5. routeUpdate() в admin.js должен:
   - Получить FSM-состояние через getBotState()
   - По префиксу state роутить к нужному модулю:
     - 'broadcast_*' → broadcast.js
     - 'news_*' → news.js
     - 'svc_*' → services.js
     - 'b2b_*' → b2b.js
   - Каждый модуль экспортирует handleMessage(env, update, state) для обработки текстовых сообщений в FSM

6. НЕ МЕНЯЙ логику существующих обработчиков — только перенос кода между файлами.

7. Проверь, что после рефакторинга все текущие фичи работают:
   - /start → главное меню
   - Партнёры: одобрение/отклонение/удаление
   - Услуги: approve/reject
   - Рассылка: все/город/категория
   - Статистика
```

---

## Промпт 1 — Модерация услуг (расширенная) + Управление услугами партнёров

```
Задача: реализовать полноценное управление услугами в cloudflare/workers/admin-webhook/handlers/services.js

КОНТЕКСТ:
- Сейчас в Cloudflare реализован только approve/reject услуг. Нужен полный CRUD.
- Эталон: admin_bot.py строки 513-897 (класс ServiceManage, 12 FSM-состояний)
- FSM хранится в Supabase таблице bot_states через getBotState/setBotState/clearBotState/updateBotStateData из supabase.js

ФУНКЦИОНАЛ ДЛЯ РЕАЛИЗАЦИИ:

### A. Модерация услуг (admin_services)
- Кнопка "Модерация Услуг" → список услуг со статусом Pending
- Для каждой: кнопки "Одобрить" / "Отклонить"
- При одобрении/отклонении — уведомление партнёру через partner-бот
- Supabase запрос: services?approval_status=eq.Pending&select=*,partners(name,company_name)

### B. Управление услугами партнёра (admin_manage_services)
FSM-цепочка из Python (ServiceManage):

1. `admin_manage_services` callback → бот просит ввести chat_id партнёра
   - setState: 'svc_selecting_partner'

2. Пользователь вводит chat_id → бот показывает меню партнёра:
   - "Категория бизнеса" (svc_edit_category)
   - "Локация" (svc_edit_location)
   - "Управление услугами" (svc_manage_services)
   - "Назад"
   - setState: 'svc_partner_menu', data: { partner_chat_id }

3. svc_edit_category → список категорий из service_categories
   - callback: svc_set_cat_{category}
   - Обновляет partners.business_type

4. svc_edit_location → список городов → список районов
   - callbacks: svc_city_{city}, svc_district_{district}
   - Обновляет partners.city, partners.district

5. svc_manage_services → подменю:
   - "Добавить услугу" (svc_add)
   - "Редактировать услугу" (svc_edit)
   - "Удалить услугу" (svc_delete)
   - "Назад"

6. svc_add → FSM-цепочка:
   - waiting: название → описание → цена → категория услуги (кнопки из service_categories)
   - States: svc_adding_title → svc_adding_description → svc_adding_price → svc_adding_category
   - В конце: INSERT в services (partner_chat_id, title, description, price, category, approval_status='Approved', is_active=true)

7. svc_edit → список услуг партнёра → выбор услуги → выбор поля (название/описание/цена/категория) → ввод нового значения → PATCH
   - States: svc_choosing_service_for_edit → svc_choosing_field → svc_waiting_new_value

8. svc_delete → список услуг партнёра → подтверждение → DELETE
   - States: svc_choosing_service_for_delete

SUPABASE ЗАПРОСЫ (добавь в supabase.js):
- getServicesByPartner(env, partnerChatId) → services?partner_chat_id=eq.{id}&select=*
- getServiceCategories(env) → service_categories?select=*&order=name
- addService(env, serviceData) → POST services
- updateService(env, serviceId, data) → PATCH services?id=eq.{id}
- deleteService(env, serviceId) → DELETE services?id=eq.{id}
- updatePartnerField(env, partnerChatId, field, value) → PATCH partners?chat_id=eq.{id}
- getDistinctCitiesFromPartners(env) → partners?select=city (unique)
- getDistrictsForCity(env, city) → partners?city=eq.{city}&select=district (unique)
- getPendingServices(env) → services?approval_status=eq.Pending&select=*

РОУТИНГ В admin.js:
- handleCallbackQuery: добавь роуты для admin_services, admin_manage_services, svc_*
- routeUpdate: при state.startsWith('svc_') → вызывай services.handleMessage(env, update, stateData)

ПАТТЕРН FSM (используй как в broadcast.js):
- setBotState(env, chatId, 'svc_adding_title', { partner_chat_id: '123' })
- В handleMessage проверяй state и вызывай нужный шаг
- В конце цепочки: clearBotState(env, chatId)
- Кнопка "Отмена" в каждом шаге → clearBotState + showMainMenu

НЕ ЗАБУДЬ:
- answerCallbackQuery в начале каждого callback-обработчика
- Кнопку "Назад" на каждом экране
- Уведомление партнёру при добавлении/удалении услуги
```

---

## Промпт 2 — Управление новостями (CRUD без AI и без изображений)

```
Задача: реализовать управление новостями в cloudflare/workers/admin-webhook/handlers/news.js

КОНТЕКСТ:
- Эталон: admin_bot.py строки 898-1417 (NewsCreation, NewsEditing)
- Пока БЕЗ AI-перевода и БЕЗ загрузки изображений (будет позже)
- FSM хранится в Supabase (bot_states)

ФУНКЦИОНАЛ:

### Меню новостей (admin_news callback)
Кнопки:
- "Создать новость" (news_create)
- "Список новостей" (news_list)
- "Редактировать новость" (news_edit)
- "Удалить новость" (news_delete)
- "Назад" (back_to_main)

### Создание новости (news_create)
FSM-цепочка:
1. news_create callback → "Введите заголовок новости:"
   - setState: 'news_waiting_title'
2. Ввод заголовка → "Введите основной текст новости:"
   - setState: 'news_waiting_content', data: { title }
3. Ввод контента → "Введите короткий превью-текст:"
   - setState: 'news_waiting_preview', data: { title, content }
4. Ввод превью → INSERT в news таблицу → "Новость создана!"
   - clearBotState
   - Показать созданную новость и кнопку "Назад"

Supabase INSERT:
POST news → { title, content, preview_text, is_published: false, created_at: now }

### Список новостей (news_list)
- Запрос: news?select=*&order=created_at.desc&limit=20
- Для каждой: заголовок, дата, статус (опубликована/черновик)
- Кнопка "Назад"

### Редактирование новости (news_edit)
FSM-цепочка:
1. news_edit callback → список новостей с номерами → "Введите номер новости:"
   - setState: 'news_selecting'
2. Ввод номера → показать кнопки полей:
   - "Заголовок" (edit_title)
   - "Контент" (edit_content)
   - "Превью" (edit_preview)
   - "Статус публикации" (edit_published) → toggle is_published
   - "Отмена" (cancel_edit)
   - setState: 'news_selecting_field', data: { news_id }
3. edit_title/content/preview → "Введите новое значение:"
   - setState: 'news_waiting_new_value', data: { news_id, field }
4. Ввод значения → PATCH news?id=eq.{news_id} → "Обновлено!"
   - clearBotState

### Удаление новости (news_delete)
1. news_delete callback → список новостей → кнопки delete_news_{id}
2. delete_news_{id} → подтверждение "Вы уверены?" → confirm_delete_{id}
3. confirm_delete_{id} → DELETE news?id=eq.{id} → "Удалено!"

SUPABASE ЗАПРОСЫ (добавь в supabase.js):
- getAllNews(env) → news?select=*&order=created_at.desc
- getNewsById(env, id) → news?id=eq.{id}&select=*
- createNews(env, data) → POST news
- updateNews(env, id, data) → PATCH news?id=eq.{id}
- deleteNews(env, id) → DELETE news?id=eq.{id}

РОУТИНГ В admin.js:
- handleCallbackQuery: admin_news, news_create, news_list, news_edit, news_delete, edit_*, delete_news_*, confirm_delete_*, cancel_edit
- routeUpdate: state.startsWith('news_') → news.handleMessage(env, update, stateData)
```

---

## Промпт 3 — UGC-модерация + Промоутеры

```
Задача: реализовать модерацию UGC и управление промоутерами в cloudflare/workers/admin-webhook/handlers/ugc.js и handlers/promoters.js

КОНТЕКСТ:
- Эталон: admin_bot.py строки 2077-2293 (UGC + промоутеры)
- Простые обработчики без FSM — только callback queries и отображение данных

### A. UGC-модерация (handlers/ugc.js)

Кнопка admin_ugc → список UGC на модерации

Supabase запрос: ugc_content?status=eq.pending&select=*,promoters(name,username)&order=created_at.desc

Для каждого UGC показать:
- Тип контента (фото/видео/текст)
- Промоутер (имя, username)
- Описание
- Дата
- Кнопки: "Одобрить (+N баллов)" ugc_approve_{id} / "Отклонить" ugc_reject_{id}

ugc_approve_{id}:
- PATCH ugc_content?id=eq.{id} → { status: 'approved', approved_at: now }
- Начислить баллы промоутеру: PATCH promoters?chat_id=eq.{promoter_chat_id} → increment points
  (Или через RPC если есть функция — проверь в Supabase)
- Уведомить промоутера (через partner-бот): "Ваш контент одобрен! +N баллов"
- Обновить сообщение: "ОДОБРЕНО"

ugc_reject_{id}:
- PATCH ugc_content?id=eq.{id} → { status: 'rejected' }
- Уведомить промоутера: "Ваш контент отклонён"
- Обновить сообщение: "ОТКЛОНЕНО"

Если нет UGC на модерации → "Нет контента на модерации"

### B. Промоутеры (handlers/promoters.js)

Кнопка admin_promoters → список промоутеров

Supabase запрос: promoters?select=*&order=points.desc&limit=50

Показать список кнопок: "{имя} — {points} баллов" → promoter_info_{chat_id}

promoter_info_{chat_id}:
- Запрос: promoters?chat_id=eq.{chat_id}&select=*
- Запрос UGC: ugc_content?promoter_chat_id=eq.{chat_id}&select=*&order=created_at.desc&limit=10
- Показать:
  - Имя, username
  - Баллы
  - Количество UGC (всего / одобрено / на модерации / отклонено)
  - Последние 5 UGC с датами и статусами
- Кнопка "Назад" → admin_promoters

SUPABASE ЗАПРОСЫ (добавь в supabase.js):
- getPendingUGC(env) → ugc_content?status=eq.pending&select=*&order=created_at.desc
- updateUGCStatus(env, id, status) → PATCH ugc_content?id=eq.{id}
- getPromoters(env) → promoters?select=*&order=points.desc
- getPromoterByChat(env, chatId) → promoters?chat_id=eq.{chatId}&select=*
- getPromoterUGC(env, chatId) → ugc_content?promoter_chat_id=eq.{chatId}&select=*&order=created_at.desc

РОУТИНГ В admin.js:
- admin_ugc → ugc.handleAdminUGC
- ugc_approve_* → ugc.handleUGCApproval (id, 'approved')
- ugc_reject_* → ugc.handleUGCApproval (id, 'rejected')
- admin_promoters → promoters.handleAdminPromoters
- promoter_info_* → promoters.handlePromoterInfo
```

---

## Промпт 4 — MLM Revenue Share

```
Задача: реализовать управление MLM Revenue Share в cloudflare/workers/admin-webhook/handlers/mlm.js

КОНТЕКСТ:
- Эталон: admin_bot.py строки 2495-2851
- Включает: статистику, установку PV, одобрение выплат, просмотр сети
- Таблицы Supabase: partner_network, partners, revenue_share_payments (проверь наличие)

ФУНКЦИОНАЛ:

### Меню MLM (admin_mlm callback)
Кнопки:
- "📊 Статистика MLM" (mlm_stats)
- "💰 Установить PV" (mlm_set_pv)
- "✅ Одобрить выплаты" (mlm_approve_payments)
- "🌳 Сеть партнёров" (mlm_network)
- "◀️ Назад" (back_to_main)

### Статистика MLM (mlm_stats)
Supabase запросы:
- partners?select=chat_id,pv_percent — все партнёры с PV
- partner_network?select=* — вся сеть
- revenue_share_payments?select=* — все выплаты

Показать:
- Всего партнёров в MLM (у кого pv_percent > 0)
- Средний PV процент
- Всего рефералов (записей в partner_network)
- Выплаты: всего / pending / approved / сумма approved
- Кнопка "Назад" → admin_mlm

### Установить PV (mlm_set_pv)
Показать текст: "Введите команду в формате: /set_pv <chat_id> <процент>"
Пример: /set_pv 123456789 15

Обработка команды /set_pv в routeUpdate:
- Парсинг аргументов
- Валидация: chat_id существует в partners, процент 0-100
- PATCH partners?chat_id=eq.{id} → { pv_percent: value }
- Ответ: "PV для партнёра {name} установлен: {value}%"

### Одобрить выплаты (mlm_approve_payments)
Запрос: revenue_share_payments?status=eq.pending&select=*,partners(name,company_name)&order=created_at.desc

Для каждой выплаты:
- Партнёр, сумма, дата, описание
- Кнопки: "Одобрить" mlm_pay_approve_{id} / "Отклонить" mlm_pay_reject_{id}

mlm_pay_approve_{id}:
- PATCH revenue_share_payments?id=eq.{id} → { status: 'approved', approved_at: now }
- Уведомить партнёра

mlm_pay_reject_{id}:
- PATCH revenue_share_payments?id=eq.{id} → { status: 'rejected' }
- Уведомить партнёра

### Сеть партнёров (mlm_network)
Запрос: partner_network?select=*,partners!partner_network_partner_chat_id_fkey(name,company_name)&order=level

Показать дерево (текстовое):
- Уровень 1: {name} — {кол-во рефералов}
- Уровень 2: ↳ {name} — {кол-во рефералов}
- ...
(Максимум 3 уровня, максимум 50 записей)

SUPABASE ЗАПРОСЫ (добавь в supabase.js):
- getMLMStats(env) — агрегация по partner_network и revenue_share_payments
- getPendingPayments(env) → revenue_share_payments?status=eq.pending&select=*
- updatePaymentStatus(env, id, status) → PATCH revenue_share_payments?id=eq.{id}
- updatePartnerPV(env, chatId, pvPercent) → PATCH partners?chat_id=eq.{chatId}
- getPartnerNetwork(env) → partner_network?select=*&order=level

РОУТИНГ В admin.js:
- admin_mlm → mlm.handleMLMMenu
- mlm_stats → mlm.handleMLMStats
- mlm_set_pv → mlm.handleSetPVMenu
- mlm_approve_payments → mlm.handleApprovePayments
- mlm_pay_approve_* / mlm_pay_reject_* → mlm.handlePaymentAction
- mlm_network → mlm.handleMLMNetwork
- Команда /set_pv в routeUpdate → mlm.handleSetPVCommand
```

---

## Промпт 5 — Лидерборд

```
Задача: реализовать управление лидербордом в cloudflare/workers/admin-webhook/handlers/leaderboard.js

КОНТЕКСТ:
- Эталон: admin_bot.py строки 2294-2440
- Таблицы: leaderboard_periods, leaderboard_entries (или аналогичные — проверь схему)

ФУНКЦИОНАЛ:

### Меню лидерборда (admin_leaderboard callback)
Кнопки:
- "🏆 Полный рейтинг" (leaderboard_full)
- "📅 Создать период" (leaderboard_create)
- "🎁 Раздать призы" (leaderboard_distribute_prizes)
- "◀️ Назад" (back_to_main)

### Полный рейтинг (leaderboard_full)
Запрос: leaderboard текущего активного периода, топ-50 по баллам

Показать таблицу:
```
🏆 Лидерборд — {название периода}

1. 🥇 {name} — {points} баллов
2. 🥈 {name} — {points} баллов
3. 🥉 {name} — {points} баллов
4. {name} — {points} баллов
...
```

Если нет активного периода → "Нет активного периода лидерборда"

### Создать период (leaderboard_create)
- INSERT leaderboard_periods → { name: "Период {месяц} {год}", start_date: now, is_active: true }
- Деактивировать предыдущие периоды: PATCH leaderboard_periods?is_active=eq.true → { is_active: false } (перед созданием)
- Ответ: "Новый период создан: {name}"

### Раздать призы (leaderboard_distribute_prizes)
- Получить активный период
- Получить топ-3
- Начислить бонусные баллы (если есть такая логика)
- Показать результат: кто получил сколько

SUPABASE ЗАПРОСЫ (добавь в supabase.js):
- getActiveLeaderboardPeriod(env)
- getLeaderboardTop(env, periodId, limit)
- createLeaderboardPeriod(env, name)
- deactivateLeaderboardPeriods(env)
- distributeLeaderboardPrizes(env, periodId)

РОУТИНГ В admin.js:
- admin_leaderboard → leaderboard.handleLeaderboardMenu
- leaderboard_full → leaderboard.handleFullLeaderboard
- leaderboard_create → leaderboard.handleCreatePeriod
- leaderboard_distribute_prizes → leaderboard.handleDistributePrizes
```

---

## Промпт 6 — B2B Сделки

```
Задача: реализовать управление B2B-сделками в cloudflare/workers/admin-webhook/handlers/b2b.js

КОНТЕКСТ:
- Эталон: admin_bot.py строки 1530-1986 (B2BDealCreation FSM + обработчики)
- Таблица: partner_deals
- FSM для создания сделки (4 шага)

ФУНКЦИОНАЛ:

### Меню B2B (admin_b2b_deals callback)
Кнопки:
- "📋 Все сделки" (b2b_list_all)
- "⏳ Ожидающие" (b2b_list_pending)
- "➕ Создать сделку" (b2b_create)
- "◀️ Назад" (back_to_main)

### Все сделки (b2b_list_all)
Запрос: partner_deals?select=*&order=created_at.desc&limit=20

Для каждой сделки показать:
- Партнёр-источник → Партнёр-получатель
- Условия: seller_pays, buyer_gets
- Статус (pending/approved/rejected/completed)
- Дата

### Ожидающие сделки (b2b_list_pending)
Запрос: partner_deals?status=eq.pending&select=*&order=created_at.desc

Для каждой — кнопки:
- "✅ Принять" b2b_pending_accept_{id}
- "❌ Отклонить" b2b_pending_reject_{id}

b2b_pending_accept_{id}:
- PATCH partner_deals?id=eq.{id} → { status: 'approved' }
- Уведомить обоих партнёров

b2b_pending_reject_{id}:
- PATCH partner_deals?id=eq.{id} → { status: 'rejected' }
- Уведомить обоих партнёров

### Создать сделку (b2b_create)
FSM-цепочка:

1. b2b_create callback → "Введите chat_id партнёра-источника (продавец):"
   - setState: 'b2b_waiting_source'

2. Ввод source → проверить что партнёр существует → "Введите chat_id партнёра-получателя (покупатель):"
   - setState: 'b2b_waiting_target', data: { source_partner_id, source_name }

3. Ввод target → проверить → "Введите условия для продавца (что платит):"
   - setState: 'b2b_waiting_seller_pays', data: { ..., target_partner_id, target_name }

4. Ввод seller_pays → "Введите условия для покупателя (что получает):"
   - setState: 'b2b_waiting_buyer_gets', data: { ..., seller_pays }

5. Ввод buyer_gets → INSERT partner_deals → показать сводку → "Сделка создана!"
   - clearBotState
   - Уведомить обоих партнёров

SUPABASE ЗАПРОСЫ (добавь в supabase.js):
- getAllDeals(env) → partner_deals?select=*&order=created_at.desc
- getPendingDeals(env) → partner_deals?status=eq.pending&select=*
- createDeal(env, dealData) → POST partner_deals
- updateDealStatus(env, id, status) → PATCH partner_deals?id=eq.{id}
- getPartnerByChat(env, chatId) — уже есть, переиспользуй

РОУТИНГ В admin.js:
- admin_b2b_deals → b2b.handleB2BMenu
- b2b_list_all → b2b.handleListAll
- b2b_list_pending → b2b.handleListPending
- b2b_create → b2b.handleCreateStart
- b2b_pending_accept_* / b2b_pending_reject_* → b2b.handleDealAction
- routeUpdate: state.startsWith('b2b_') → b2b.handleMessage
```

---

## Промпт 7 — Расширенная статистика + дашборд + one-pagers + фон

```
Задача: реализовать расширенную статистику, ссылки на дашборд, one-pagers и смену фона в cloudflare/workers/admin-webhook/handlers/stats.js

КОНТЕКСТ:
- Эталон: admin_bot.py строки 971-998 (статистика), 1418-1530 (дашборд, фон), 1987-2076 (one-pagers)
- Эти фичи простые: в основном отображение данных и ссылок

ФУНКЦИОНАЛ:

### Расширенная статистика (admin_stats — заменить текущую заглушку)
Добавь в текущий handleAdminStats больше данных:
- Партнёров: всего / одобрено / pending / отклонено
- Услуг: всего / активных / на модерации
- Новостей: всего / опубликованных
- UGC: всего / на модерации / одобрено
- Промоутеров: всего / активных
- B2B сделок: всего / pending / approved

Supabase запросы (каждый — простой select с count):
- partners?select=count
- services?select=count, services?approval_status=eq.Pending&select=count
- news?select=count, news?is_published=eq.true&select=count
- ugc_content?select=count, ugc_content?status=eq.pending&select=count
- promoters?select=count
- partner_deals?select=count, partner_deals?status=eq.pending&select=count

### Дашборд (admin_dashboard)
Показать сообщение с ссылкой на Mini App / внешний дашборд:
- Текст: "📈 Дашборд админа\n\nДля просмотра полной аналитики перейдите по ссылке:"
- Кнопка URL (если есть env.DASHBOARD_URL): { text: "Открыть дашборд", url: env.DASHBOARD_URL }
- Если нет URL: "Дашборд будет доступен позже"

### One-pagers (admin_onepagers)
Меню с кнопками:
- "Для партнёров" (onepager_partner)
- "Для клиентов" (onepager_client)
- "Для инвесторов" (onepager_investor)
- "Назад" (back_to_main)

Каждая кнопка → текст-описание программы + ссылка (из env.ONEPAGER_PARTNER_URL, env.ONEPAGER_CLIENT_URL, env.ONEPAGER_INVESTOR_URL)
Если URL не настроен → "Ссылка будет добавлена позже"

### Смена фона (admin_background)
Показать кнопки с вариантами фона:
- "Стандартный" (bg_set_default)
- "Тёмный" (bg_set_dark)
- "Градиент" (bg_set_gradient)
- "Минимализм" (bg_set_minimal)

bg_set_{theme}:
- Сохранить в Supabase: UPSERT app_settings → { key: 'background_theme', value: theme }
- Ответ: "Фон изменён на: {theme}"

SUPABASE ЗАПРОСЫ (добавь в supabase.js):
- getTableCount(env, table, filter?) — универсальный счётчик
- getAppSetting(env, key) → app_settings?key=eq.{key}&select=value
- setAppSetting(env, key, value) → UPSERT app_settings

РОУТИНГ В admin.js:
- admin_dashboard → stats.handleDashboard
- admin_onepagers → stats.handleOnepagers
- onepager_* → stats.handleOnepagerView
- admin_background → stats.handleBackgroundMenu
- bg_set_* → stats.handleSetBackground
```

---

## Промпт 8 — Финальная проверка и cleanup

```
Задача: финальная проверка всех модулей админ-бота и cleanup

КОНТЕКСТ:
- Все 8 модулей реализованы в cloudflare/workers/admin-webhook/handlers/
- Нужно убедиться что всё работает корректно

ПРОВЕРЬ:

1. Все callback_data в showMainMenu() имеют соответствующие обработчики в handleCallbackQuery()
2. Все FSM-состояния обрабатываются в routeUpdate() → правильный модуль
3. Нет дублирования кода между модулями
4. Каждый callback-обработчик вызывает answerCallbackQuery
5. Каждый экран имеет кнопку "Назад"
6. clearBotState вызывается в конце каждой FSM-цепочки и при "Отмена"
7. Все Supabase-запросы в supabase.js имеют обработку ошибок
8. Нет console.log с чувствительными данными (токены, ключи)
9. Нет кнопки Instagram Outreach в меню
10. Все модули правильно импортируют зависимости

CLEANUP:
- Убери лишние console.log (оставь только ошибки и ключевые действия)
- Убери дублирующиеся функции (если есть)
- Проверь что wrangler.toml не нужно обновлять (main = "index.js" — ОК)
- Добавь JSDoc комментарии к экспортируемым функциям модулей

ИТОГОВАЯ СТРУКТУРА должна быть:
cloudflare/workers/admin-webhook/
├── index.js                  — точка входа (без изменений)
├── admin.js                  — роутер (~200 строк)
├── handlers/
│   ├── partners.js           — партнёры (~300 строк)
│   ├── services.js           — услуги + модерация (~500 строк)
│   ├── broadcast.js          — рассылка (~300 строк)
│   ├── news.js               — новости CRUD (~350 строк)
│   ├── ugc.js                — UGC модерация (~200 строк)
│   ├── promoters.js          — промоутеры (~150 строк)
│   ├── leaderboard.js        — лидерборд (~250 строк)
│   ├── mlm.js                — MLM revenue share (~350 строк)
│   ├── b2b.js                — B2B сделки (~400 строк)
│   └── stats.js              — статистика + дашборд + onepagers + фон (~300 строк)
├── supabase.js               — все Supabase запросы (~500 строк)
├── telegram.js               — Telegram API (без изменений)
├── common.js                 — утилиты (без изменений)
└── sentry.js                 — мониторинг (без изменений)

Общий объём: ~3500-4000 строк (было 1293 в одном файле)
```

---

## Порядок выполнения

| # | Промпт | Зависит от | Что делает |
|---|--------|-----------|------------|
| 0 | Модуляризация | — | Разбивает admin.js на модули, убирает Outreach |
| 1 | Услуги | 0 | CRUD услуг + расширенная модерация |
| 2 | Новости | 0 | CRUD новостей (без AI, без картинок) |
| 3 | UGC + Промоутеры | 0 | Модерация контента + список промоутеров |
| 4 | MLM | 0 | Revenue share, PV, выплаты, сеть |
| 5 | Лидерборд | 0 | Рейтинг, периоды, призы |
| 6 | B2B | 0 | Сделки между партнёрами |
| 7 | Статистика+ | 1-6 | Расширенная статистика + дашборд + onepagers + фон |
| 8 | Cleanup | 0-7 | Финальная проверка и чистка |
