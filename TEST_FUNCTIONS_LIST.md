# 📋 Полный список функций для тестирования

Документ содержит все функции системы, которые должны быть протестированы.

---

## 🤝 Партнёрский бот (bot.py)

### Регистрация и доступ
- [ ] `handle_partner_start(message)` - `/start`, `/partner_start`
  - Проверка существования партнёра
  - Проверка статуса (Pending/Approved/Rejected)
  - Перенаправление в соответствующий интерфейс

### Главное меню
- [ ] `get_partner_keyboard()` - Генерация клавиатуры
- [ ] `partner_main_menu(chat_id, message_text)` - Отправка главного меню

### Начисление баллов
- [ ] `handle_partner_menu_buttons(message)` → "➕ Начислить баллы"
- [ ] `process_client_id(message)` - Обработка ID клиента
- [ ] `process_amount(message)` - Обработка суммы чека
- [ ] `complete_partner_transaction()` - Завершение транзакции начисления

### Списание баллов
- [ ] `handle_partner_menu_buttons(message)` → "➖ Списать баллы"
- [ ] Проверка достаточности баланса
- [ ] Запись транзакции списания

### Офлайн-очередь операций
- [ ] `show_offline_queue(chat_id)` - Просмотр очереди
- [ ] `handle_queue_callbacks(call)` - Обработка действий с очередью
- [ ] `process_offline_client_id(message)` - Ввод ID клиента
- [ ] `handle_offline_type(call)` - Выбор типа операции
- [ ] `process_offline_amount(message)` - Ввод суммы
- [ ] `prompt_transaction_amount()` - Запрос суммы транзакции
- [ ] `handle_template_selection(call)` - Выбор шаблона
- [ ] `handle_manual_selection(call)` - Ручной ввод

### Приглашение клиентов (Реферальная система)
- [ ] `handle_invite_start(message)` → "👥 Пригласить клиента"
- [ ] `handle_invite_callbacks(call)` - Обработка callback'ов
- [ ] Генерация реферальной ссылки
- [ ] `decode_qr_from_photo(file_id)` - Декодирование QR из фото
- [ ] `process_qr_photo(message)` - Обработка QR-фото

### Статистика партнёра
- [ ] `handle_partner_stats(message)` → "📊 Моя статистика"
- [ ] `handle_stats_callbacks(call)` - Callback обработчики статистики
- [ ] `handle_export_data(chat_id)` - Экспорт данных в CSV
- [ ] `handle_cohort_analysis(chat_id)` - Когортный анализ

### Дашборд
- [ ] `handle_partner_dashboard(message)` → "📈 Дашборд"
- [ ] Генерация URL дашборда
- [ ] Открытие WebView с дашбордом

### Управление акциями
- [ ] `handle_promotions_menu(message)` → "🌟 Акции"
- [ ] `handle_promo_callbacks(call)` - Callback обработчики
- [ ] `process_promo_title(message)` - Ввод заголовка
- [ ] `process_promo_description(message)` - Ввод описания
- [ ] `process_promo_discount(message)` - Ввод размера скидки
- [ ] `process_promo_end_date(message)` - Ввод даты окончания
- [ ] `process_promo_photo(message)` - Загрузка фото
- [ ] `save_promotion(chat_id)` - Сохранение акции
- [ ] `handle_promo_manage_list(chat_id)` - Список акций
- [ ] `handle_delete_promo(message)` - Удаление акции `/delete_promo ID`

### Управление услугами
- [ ] `handle_services_menu(message)` → "🛠️ Услуги"
- [ ] `handle_service_callbacks(call)` - Callback обработчики
- [ ] `process_service_title(message)` - Ввод названия
- [ ] `process_service_description(message)` - Ввод описания
- [ ] `process_service_price(message)` - Ввод стоимости
- [ ] `process_service_category_save(chat_id, category)` - Сохранение категории
- [ ] `handle_service_status_list(chat_id)` - Список услуг со статусами
- [ ] `handle_service_edit_list(chat_id)` - Список для редактирования
- [ ] `handle_service_edit_menu(chat_id, service_id)` - Меню редактирования
- [ ] `handle_service_field_edit(chat_id, service_id, field)` - Редактирование поля
- [ ] `handle_service_edit_callbacks(call)` - Callback редактирования
- [ ] `process_service_edit_title(message)` - Редактирование названия
- [ ] `process_service_edit_description(message)` - Редактирование описания
- [ ] `process_service_edit_price(message)` - Редактирование цены

### Поиск клиента
- [ ] `handle_find_client(message)` → "👤 Найти клиента"
- [ ] `process_client_phone_search(message)` - Поиск по телефону

### Настройки партнёра
- [ ] `handle_partner_settings(message)` → "⚙️ Настройки"
- [ ] `handle_settings_callbacks(call)` - Callback обработчики
- [ ] `handle_edit_callbacks(call)` - Редактирование данных
- [ ] `process_edit_name(message)` - Изменение имени
- [ ] `process_edit_company(message)` - Изменение компании
- [ ] `process_edit_phone(message)` - Изменение телефона

### Обработка всех сообщений
- [ ] `handle_partner_all_messages(message)` - Fallback обработчик

---

## 👤 Клиентский бот (client_handler.py)

### Регистрация
- [ ] `handle_new_user_start(message)` - `/start`, `/help`
  - Новый клиент без реферальной ссылки
  - Новый клиент по реферальной ссылке партнёра
  - Новый клиент по реферальному коду клиента
  - Существующий клиент
  - Обновление временного ID (VIA_PARTNER_xxx)

### NPS оценки
- [ ] `send_nps_request(chat_id, partner_chat_id)` - Отправка запроса NPS
- [ ] `callback_nps_rating(call)` - Обработка оценки (0-10)
- [ ] Автоматическое создание промоутера при NPS=10

### Реферальная система
- [ ] `handle_referral_command(message)` - `/referral`
- [ ] `generate_qr_code(data)` - Генерация QR-кода
- [ ] `handle_show_qr_code(call)` - Показ QR-кода
- [ ] `handle_referral_qr(call)` - QR для реферальной ссылки
- [ ] Регистрация по реферальному коду клиента
- [ ] Начисление бонусов за рефералов
- [ ] Статистика рефералов

### Промоутеры и UGC
- [ ] `handle_promoter_command(message)` - `/promoter`
- [ ] `handle_ugc_command(message)` - `/ugc`
- [ ] `handle_ugc_add_command(message)` - Добавление UGC контента
- [ ] `callback_add_ugc_content(call)` - Callback добавления
- [ ] `callback_promo_materials(call)` - Промо-материалы
- [ ] Статус промоутера
- [ ] Статистика UGC контента

### Лидерборд
- [ ] `handle_leaderboard_command(message)` - `/leaderboard`
- [ ] `callback_view_leaderboard(call)` - Просмотр лидерборда
- [ ] Топ промоутеров
- [ ] Призы и награды

### AI помощник
- [ ] `handle_ask_command(message)` - `/ask`
- [ ] `handle_ai_question(message)` - Обработка вопроса
- [ ] Интеграция с GigaChat

### Поддержка
- [ ] `handle_support_request(message)` - Запрос поддержки
- [ ] Отправка сообщения администратору

### GDPR и экспорт данных
- [ ] `handle_export_data(message)` - Экспорт данных пользователя
- [ ] `handle_delete_account_request(message)` - Запрос удаления аккаунта
- [ ] `handle_gdpr_delete_callback(call)` - Подтверждение удаления

### Обработка всех сообщений
- [ ] `handle_all_messages(message)` - Fallback обработчик

---

## 👨‍💼 Админский бот (admin_bot.py)

### Доступ и авторизация
- [ ] `is_admin(chat_id)` - Проверка прав администратора
- [ ] `_get_admin_ids()` - Получение списка админов
- [+] `handle_start_admin(message)` - `/start`, `/admin`

### Управление партнёрами
- [ ] `show_pending_partners(callback_query)` - Список заявок партнёров
- [ ] `handle_partner_approval(callback_query)` - Одобрение партнёра
- [ ] `_notify_admins_about_partner(partner_row)` - Уведомление админам
- [ ] `watch_new_partner_applications(poll_interval_sec)` - Мониторинг новых заявок

### Управление услугами
- [ ] `show_pending_services(callback_query)` - Список услуг на модерации
- [ ] `handle_service_approval(callback_query)` - Одобрение/отклонение услуги
- [ ] `_notify_admins_about_service(service_row)` - Уведомление о новой услуге
- [ ] `watch_new_service_submissions(poll_interval_sec)` - Мониторинг новых услуг
- [ ] `open_manage_services(callback_query, state)` - Управление услугами партнёра
- [ ] `receive_partner_id(message, state)` - Ввод ID партнёра
- [ ] `choose_category(callback_query, state)` - Выбор категории
- [ ] `set_partner_category(callback_query, state)` - Установка категории
- [ ] `choose_city(callback_query, state)` - Выбор города
- [ ] `choose_district(callback_query, state)` - Выбор района
- [ ] `set_partner_location(callback_query, state)` - Установка локации
- [ ] `services_menu(callback_query, state)` - Меню услуг
- [ ] `svc_add_start(callback_query, state)` - Начало добавления услуги
- [ ] `svc_add_title(message, state)` - Название услуги
- [ ] `svc_add_description(message, state)` - Описание услуги
- [ ] `svc_add_price(message, state)` - Цена услуги
- [ ] `svc_add_finish(callback_query, state)` - Завершение добавления
- [ ] `svc_delete_pick(callback_query, state)` - Выбор услуги для удаления
- [ ] `svc_delete_confirm(callback_query, state)` - Подтверждение удаления
- [ ] `svc_edit_pick(callback_query, state)` - Выбор услуги для редактирования
- [ ] `svc_edit_fields(callback_query, state)` - Выбор поля для редактирования
- [ ] `svc_choose_field(callback_query, state)` - Выбор конкретного поля
- [ ] `svc_set_service_category(callback_query, state)` - Установка категории услуги
- [ ] `svc_apply_field_edit(message, state)` - Применение изменений

### Управление новостями
- [ ] `show_news_management(callback_query)` - Меню управления новостями
- [ ] `start_news_creation(callback_query, state)` - Создание новости
- [ ] `process_news_title(message, state)` - Заголовок новости
- [ ] `process_news_content(message, state)` - Содержание новости
- [ ] `process_news_preview(message, state)` - Превью новости
- [ ] `process_news_image(message, state)` - Изображение новости
- [ ] `show_news_list(callback_query)` - Список новостей
- [ ] `start_news_editing(callback_query, state)` - Редактирование новости
- [ ] `select_news_for_editing(message, state)` - Выбор новости
- [ ] `process_field_selection(callback_query, state)` - Выбор поля для редактирования
- [ ] `save_edited_field(message, state)` - Сохранение изменений
- [ ] `cancel_editing(callback_query, state)` - Отмена редактирования
- [ ] `start_news_deletion(callback_query)` - Удаление новости
- [ ] `confirm_news_deletion(callback_query)` - Подтверждение удаления
- [ ] `delete_news_confirmed(callback_query)` - Выполнение удаления

### Дашборды и одностраничники
- [ ] `show_admin_dashboard(callback_query)` - Админский дашборд
- [ ] `show_background_menu(callback_query)` - Меню фонов
- [ ] `set_background(callback_query)` - Установка фона
- [ ] `show_onepagers_menu(callback_query)` - Меню одностраничников
- [ ] `show_onepager(callback_query)` - Показ одностраничника

### UGC контент
- [ ] `show_pending_ugc(callback_query)` - Список UGC на модерации
- [ ] `approve_ugc_content(callback_query)` - Одобрение UGC
- [ ] `reject_ugc_content(callback_query)` - Отклонение UGC
- [ ] `_notify_admins_about_ugc(ugc_row)` - Уведомление о новом UGC
- [ ] `watch_new_ugc_submissions(poll_interval_sec)` - Мониторинг новых UGC

### Промоутеры и лидерборд
- [ ] `show_promoters(callback_query)` - Список промоутеров
- [ ] `show_promoter_info(callback_query)` - Информация о промоутере
- [ ] `show_leaderboard_menu(callback_query)` - Меню лидерборда
- [ ] `show_full_leaderboard(callback_query)` - Полный лидерборд
- [ ] `create_leaderboard_period(callback_query)` - Создание периода
- [ ] `distribute_prizes(callback_query)` - Распределение призов

### Утилиты
- [ ] `back_to_main_menu(callback_query)` - Возврат в главное меню
- [ ] `send_partner_notification(partner_chat_id, text)` - Уведомление партнёру

---

## 🗄️ Менеджер БД (supabase_manager.py)

### Инициализация
- [ ] `__init__()` - Инициализация подключения
- [ ] `WELCOME_BONUS_AMOUNT` - Получение приветственного бонуса

### Управление клиентами
- [ ] `client_exists(chat_id)` - Проверка существования клиента
- [ ] `get_client_by_phone(phone)` - Поиск клиента по телефону
- [ ] `handle_manual_registration(phone, partner_id, welcome_bonus)` - Ручная регистрация
- [ ] `register_client_via_link(chat_id, partner_chat_id, phone, name, welcome_bonus)` - Регистрация по ссылке
- [ ] `register_client_via_client_referral(chat_id, referrer_code, phone, name)` - Регистрация по коду клиента
- [ ] `update_client_chat_id(old_id, new_id)` - Обновление Chat ID
- [ ] `get_client_balance(chat_id)` - Получение баланса
- [ ] `get_client_analytics(client_chat_id)` - Аналитика клиента
- [ ] `get_client_details_for_partner(client_chat_id)` - Детали для партнёра
- [ ] `export_user_data(chat_id)` - Экспорт данных пользователя
- [ ] `delete_user_data(chat_id)` - Удаление данных пользователя (GDPR)

### Транзакции
- [ ] `record_transaction(client_chat_id, partner_chat_id, points, transaction_type, description, raw_amount)` - Запись транзакции
- [ ] `execute_transaction(client_chat_id, partner_chat_id, txn_type, raw_amount, allow_queue)` - Выполнение транзакции
- [ ] `_calculate_accrual_points(partner_chat_id, raw_amount)` - Расчёт баллов начисления
- [ ] `_resolve_multiplier_with_expiry(rule, multiplier)` - Расчёт множителя с истечением
- [ ] `_apply_rounding(value, mode)` - Применение округления
- [ ] `_extract_float(candidate, default)` - Извлечение float
- [ ] `_get_daily_transactions_summary(client_chat_id, txn_type)` - Сводка транзакций за день
- [ ] `_check_transaction_limits(client_chat_id, partner_chat_id, txn_type, points, raw_amount)` - Проверка лимитов

### Правила кэшбэка
- [ ] `_get_cashback_rules()` - Получение правил кэшбэка
- [ ] `_get_operation_templates_config()` - Конфигурация шаблонов операций
- [ ] `get_operation_templates(partner_chat_id, txn_type)` - Получение шаблонов
- [ ] `_get_transaction_rules_config()` - Конфигурация правил транзакций
- [ ] `_rule_matches_partner(rule, partner_chat_id)` - Проверка соответствия партнёру
- [ ] `_rule_matches_time(rule)` - Проверка соответствия времени
- [ ] `_apply_bonus_rules(partner_chat_id, txn_type, raw_amount, base_points)` - Применение бонусных правил
- [ ] `_get_transaction_limits()` - Получение лимитов транзакций

### Кэширование
- [ ] `_get_cache_entry(cache_key)` - Получение из кэша
- [ ] `_set_cache_entry(cache_key, payload)` - Сохранение в кэш
- [ ] `_log_setting_change(setting_key, old_value, new_value, updated_by)` - Логирование изменений

### Статистика партнёров
- [ ] `get_partner_stats(partner_chat_id)` - Базовая статистика
- [ ] `get_advanced_partner_stats(partner_chat_id, period_days)` - Расширенная статистика
- [ ] `get_partner_stats_by_period(partner_chat_id, start_date, end_date)` - Статистика за период
- [ ] `export_partner_data_to_csv(partner_chat_id, period_days)` - Экспорт в CSV
- [ ] `get_partner_cohort_analysis(partner_chat_id)` - Когортный анализ

### Управление партнёрами
- [ ] `partner_exists(chat_id)` - Проверка существования
- [ ] `get_partner_status(chat_id)` - Получение статуса
- [ ] `approve_partner(chat_id)` - Одобрение партнёра
- [ ] `reject_partner(chat_id)` - Отклонение партнёра
- [ ] `update_partner_status(partner_id, new_status)` - Обновление статуса
- [ ] `update_partner_data(partner_id, name, company_name, phone)` - Обновление данных
- [ ] `ensure_partner_record(partner_chat_id)` - Создание записи партнёра
- [ ] `set_partner_business_type(partner_chat_id, business_type)` - Установка типа бизнеса
- [ ] `set_partner_location(partner_chat_id, city, district)` - Установка локации
- [ ] `get_all_partners()` - Получение всех партнёров

### Управление услугами
- [ ] `get_partner_services(partner_chat_id, category)` - Получение услуг партнёра
- [ ] `add_service(service_data)` - Добавление услуги
- [ ] `update_service(service_id, partner_chat_id, title, description, price_points)` - Обновление услуги
- [ ] `delete_service(service_id, partner_chat_id)` - Удаление услуги
- [ ] `get_service_by_id(service_id, partner_chat_id)` - Получение услуги по ID
- [ ] `update_service_category(service_id, partner_chat_id, category)` - Обновление категории
- [ ] `get_service_categories_list()` - Список категорий
- [ ] `get_pending_services_for_admin()` - Услуги на модерации
- [ ] `update_service_approval_status(service_id, new_status)` - Обновление статуса одобрения

### Управление акциями
- [ ] `add_promotion(promo_data)` - Добавление акции

### Управление новостями
- [ ] `create_news(news_data)` - Создание новости
- [ ] `get_all_news(published_only)` - Получение всех новостей
- [ ] `get_news_by_id(news_id)` - Получение новости по ID
- [ ] `update_news(news_id, updates)` - Обновление новости
- [ ] `delete_news(news_id)` - Удаление новости
- [ ] `increment_news_views(news_id)` - Увеличение просмотров

### Реферальная система
- [ ] `generate_referral_code(chat_id)` - Генерация реферального кода
- [ ] `get_or_create_referral_code(chat_id)` - Получение или создание кода
- [ ] `_create_referral_tree_links(new_user_chat_id, direct_referrer_chat_id)` - Создание связей в дереве
- [ ] `_build_referral_tree(referred_chat_id, level, max_level)` - Построение дерева
- [ ] `process_referral_registration_bonuses(new_user_chat_id, referrer_chat_id)` - Бонусы за регистрацию
- [ ] `process_referral_transaction_bonuses(user_chat_id, earned_points, transaction_id)` - Бонусы за транзакции
- [ ] `get_referral_stats(chat_id)` - Статистика рефералов
- [ ] `check_and_award_achievements(chat_id)` - Проверка и награждение достижений

### Промоутеры и UGC
- [ ] `create_promoter_from_nps_10(client_chat_id)` - Создание промоутера при NPS=10
- [ ] `get_promoter_info(client_chat_id)` - Информация о промоутере
- [ ] `add_ugc_content(promoter_chat_id, content_url, platform, promo_code)` - Добавление UGC
- [ ] `approve_ugc_content(ugc_id, moderator_notes, quality_score, reward_points)` - Одобрение UGC
- [ ] `get_promo_materials(platform)` - Получение промо-материалов
- [ ] `get_ugc_content_for_promoter(promoter_chat_id, status)` - UGC промоутера
- [ ] `get_all_pending_ugc_content()` - Все UGC на модерации

### Лидерборд
- [ ] `create_leaderboard_period(period_type, target_date)` - Создание периода
- [ ] `get_active_leaderboard_period()` - Получение активного периода
- [ ] `add_leaderboard_metric(period_id, client_chat_id, metric_type, metric_value, description, related_id, related_table)` - Добавление метрики
- [ ] `_update_leaderboard_ranking(period_id, client_chat_id)` - Обновление рейтинга
- [ ] `get_leaderboard_top(period_id, limit)` - Топ лидерборда
- [ ] `get_leaderboard_rank_for_user(period_id, client_chat_id)` - Ранг пользователя
- [ ] `distribute_prizes(period_id)` - Распределение призов

### NPS
- [ ] `record_nps_rating(client_chat_id, partner_chat_id, rating, master_name)` - Запись оценки NPS

### Настройки приложения
- [ ] `get_app_setting(setting_key, default_value)` - Получение настройки
- [ ] `set_app_setting(setting_key, setting_value, updated_by)` - Установка настройки
- [ ] `get_background_image()` - Получение фонового изображения

### Утилиты
- [ ] `get_all_clients()` - Получение всех клиентов
- [ ] `get_distinct_cities()` - Список городов
- [ ] `get_distinct_districts_for_city(city)` - Список районов города

---

## 🔧 Вспомогательные модули

### dashboard_urls.py
- [ ] `get_partner_dashboard_url(partner_chat_id)` - URL дашборда партнёра
- [ ] `get_admin_dashboard_url()` - URL админского дашборда
- [ ] `get_onepager_url(onepager_type)` - URL одностраничника

### ai_helper.py
- [ ] `get_ai_support_answer(question)` - Получение ответа от AI

### rate_limiter.py
- [ ] `check_rate_limit(user_id, action, **kwargs)` - Проверка rate limit

### image_handler.py
- [ ] `process_photo_for_promotion()` - Обработка фото для акции

### secure_api.py
- [ ] `health_check(request)` - Проверка здоровья API
- [ ] `trigger_error(request)` - Тестовая ошибка
- [ ] `get_client_balance(request, client_chat_id)` - Получение баланса через API
- [ ] `create_transaction(request, payload)` - Создание транзакции через API
- [ ] `sentry_webhook(request, sentry_hook_resource)` - Webhook от Sentry

### transaction_queue.py
- [ ] Все методы очереди транзакций

---

## 📊 Статистика функций

### По модулям:
- **bot.py (Партнёрский бот):** ~50 функций
- **client_handler.py (Клиентский бот):** ~20 функций
- **admin_bot.py (Админский бот):** ~50 функций
- **supabase_manager.py (Менеджер БД):** ~95 функций
- **Вспомогательные модули:** ~15 функций

### Всего функций для тестирования: ~230

---

## 🎯 Приоритеты тестирования

### Критичные (P0):
1. Регистрация клиентов и партнёров
2. Начисление и списание баллов
3. Транзакции
4. NPS оценки
5. Реферальная система

### Важные (P1):
1. Управление акциями
2. Управление услугами
3. Статистика партнёров
4. Дашборды
5. UGC и промоутеры

### Желательные (P2):
1. Лидерборд
2. AI помощник
3. Экспорт данных
4. GDPR функции
5. Админские функции

---

## 📝 Примечания

- Функции с префиксом `_` являются приватными и тестируются косвенно
- Некоторые функции требуют настройки переменных окружения
- Часть функций требует моков для внешних сервисов (Telegram API, Supabase)
- Rate limiting функции требуют тестирования с различными нагрузками

---

**Дата создания:** 2025-11-19  
**Версия:** 1.0

