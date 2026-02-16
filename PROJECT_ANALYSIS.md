# Анализ проекта LoyalityBot

Полный анализ многокомпонентной системы лояльности LoyalityBot: архитектура, стек, потоки данных, роли компонентов и связь фронтенда, бэкенда и БД.

---

## 1. Назначение проекта

**LoyalityBot** — система управления программой лояльности для бизнеса (в т.ч. beauty-индустрия), интегрированная с Telegram. Три роли:

- **Партнёры (бизнесы):** начисление/списание баллов клиентам, акции, услуги, реферальные ссылки, статистика, QR-коды.
- **Клиенты:** регистрация по реферальной ссылке, приветственный бонус, баланс, история, NPS-оценки, Web App (услуги, акции, новости).
- **Администраторы:** модерация заявок и услуг, новости, MLM-статистика, дашборды.

---

## 2. Технологический стек

| Слой | Технологии |
|------|-------------|
| **Фронтенд** | React 18, Vite 5, React Router 6, Tailwind CSS, Zustand, @telegram-apps/telegram-ui, @twa-dev/sdk, Supabase JS, Sentry |
| **Бэкенд (облако)** | Cloudflare Workers (JavaScript): REST API, webhooks для трёх ботов |
| **Бэкенд (локальный, опционально)** | Python 3.10+: telebot (партнёр/клиент), aiogram (админ), FastAPI (документированный API), Streamlit (дашборд) |
| **БД** | Supabase (PostgreSQL), RLS, миграции в [migrations/](migrations/) |
| **Деплой** | **Только Cloudflare:** фронт — Cloudflare Pages, воркеры — Cloudflare Workers (см. [.cursor/rules/deploy-cloudflare.mdc](.cursor/rules/deploy-cloudflare.mdc)) |
| **Мониторинг** | Sentry (боты и воркеры), опционально webhook в Telegram |

---

## 3. Архитектура (высокоуровневая)

```
┌─────────────────────────────────────────────────────────────┐
│ КЛИЕНТЫ: Telegram Client Bot + Web App Frontend              │
└────────────────────────┬────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Partner Bot  │  │ Admin Bot    │  │ API Worker   │
│ (webhook)    │  │ (webhook)    │  │ (REST)       │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       └─────────────────┼─────────────────┘
                         ▼
              ┌──────────────────────┐
              │ Supabase (PostgreSQL)│
              └──────────────────────┘
```

- **Фронт** общается с **Supabase** напрямую (чтение/запись через [frontend/src/services/supabase.js](frontend/src/services/supabase.js)) и с **API Worker** для: транзакций, реферального кода, redeem промо, перевода, отправки QR партнёру, Sentry webhook, district-availability.
- **Три Telegram-бота** в продакшене получают апдейты через **webhooks** (partner-webhook, client-webhook, admin-webhook). Локально можно запускать Python-версии (`bot.py`, `client_handler.py`, `admin_bot.py`).

---

## 4. Компоненты Cloudflare Workers

| Worker | Назначение |
|--------|------------|
| **api** | REST: баланс, транзакции (accrual/spend), redeem-promotion, перевод (OpenAI), отправка QR партнёру, referral-code, Sentry webhook, district-availability. Обращается к Supabase и при необходимости к Telegram API. |
| **partner-webhook** | Принимает Telegram updates от партнёрского бота, парсит, передаёт в [cloudflare/workers/partner-webhook/partner.js](cloudflare/workers/partner-webhook/partner.js), пишет в Supabase. |
| **client-webhook** | Аналогично для клиентского бота → [cloudflare/workers/client-webhook/client.js](cloudflare/workers/client-webhook/client.js). |
| **admin-webhook** | Аналогично для админ-бота → [cloudflare/workers/admin-webhook/admin.js](cloudflare/workers/admin-webhook/admin.js). |
| **exchange-rates-cron** | По расписанию (cron) запрашивает курсы USD→VND, RUB, KZT из API и записывает в таблицу `currency_exchange_rates` в Supabase. |

Общие утилиты: [cloudflare/utils/](cloudflare/utils/) (common, supabase, telegram, sentry); в каждом воркере — свой `common.js`, `supabase.js`, `telegram.js`, при необходимости `sentry.js`.

---

## 5. Фронтенд (Web App)

- **Точка входа:** [frontend/src/main.jsx](frontend/src/main.jsx) → [frontend/src/App.jsx](frontend/src/App.jsx) с React Router и Telegram UI.
- **Маршруты:** главная (`/`), `/history`, `/promotions`, `/community`, `/profile`, `/services`, `/all-categories`, детали акций/новостей, партнёрские онбординги (`/partner/apply`, `/availability-map`), аналитика (клиент/партнёр/админ), онопейджеры, тестовая страница. Публичные маршруты (без обязательного Telegram) перечислены в `PUBLIC_ROUTES` в App.jsx.
- **Данные:** клиент Supabase создаётся из `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`. Вызовы к REST API идут на `VITE_API_URL` (в dev — localhost:8001).
- **Функции:** баланс, история, акции, услуги (категории, фильтры по городу/району), NPS, новости, профиль (валюта, онбординг), рефералы, мультиязычность (i18n), темы, локации.

---

## 6. База данных (Supabase)

Основные сущности (по README и коду):

- **users** — клиенты: `chat_id`, phone, name, balance, status, city, district, referral_source, referral_code, preferred_currency, onboarding_seen и др.
- **partners** — одобренные партнёры: chat_id, company_name, city, district, business_type, cashback_rate, work_mode, category_group и др.
- **partner_applications** — заявки на партнёрство (Pending/Approved/Rejected).
- **transactions** — операции: client_chat_id, partner_chat_id, total_amount, earned_points, spent_points, operation_type (accrual, redemption, enrollment_bonus), currency (миграция add_currency).
- **nps_ratings** — оценки клиентов по партнёрам (0–10).
- **promotions** — акции партнёров (связь с услугами через promotion_services).
- **services** — услуги партнёров (category, price_points, approval_status).
- **news** — новости (is_published, views_count).
- **currency_exchange_rates** — курсы валют для мультивалютности (обновляет exchange-rates-cron).
- **app_roles** — роли (moderator, admin); **referral_tree**, **referral_rewards** — реферальная/MLM логика; **reactivation_events**, настройки реактивации у партнёров.

Миграции в [migrations/](migrations/) (например, мультивалютность, RLS, реактивация, TON, специалисты и т.д.).

---

## 7. Python-боты (локальная/альтернативная среда)

- **bot.py** (партнёрский): telebot, SupabaseManager, регистрация партнёров, начисление/списание баллов, QR (qrcode, pyzbar), акции, услуги, Revenue Share, ссылки на дашборд. Зависимости: [requirements.txt](requirements.txt) (pytelegrambotapi, supabase, qrcode, pyzbar, sentry-sdk и др.).
- **client_handler.py** (клиентский): регистрация по реферальной ссылке, приветственный бонус, NPS, открытие Web App, баланс, история, rate limiting.
- **admin_bot.py** (админ): aiogram, модерация заявок и услуг, новости, MLM, дашборды, онопейджеры.
- **admin_dashboard.py** — Streamlit-дашборд для визуализации данных.
- **FastAPI** (по [API_DOCUMENTATION.md](API_DOCUMENTATION.md)): локальный REST API на порту 8001 с Swagger/ReDoc (health, clients/balance, transactions, webhooks). В продакшене эту роль выполняет Cloudflare Worker **api**.

---

## 8. Ключевые потоки данных

- **Начисление баллов:** партнёр (Telegram или Web App) → API Worker `POST /transactions` (txn_type: accrual) → расчёт кэшбэка (cashback_rate партнёра) → обновление `users.balance` и запись в `transactions`.
- **Списание баллов:** `POST /transactions` (txn_type: spend) → проверка баланса → уменьшение balance, запись транзакции.
- **Регистрация клиента:** переход по реферальной ссылке → client-webhook или client_handler → создание/обновление user, referral_source, при необходимости приветственный бонус (enrollment_bonus).
- **Реферальный код для Web App:** фронт вызывает API Worker `GET /api/referral-code/:chat_id` → Worker генерирует/возвращает код, при необходимости обновляет `users.referral_code`.
- **Курсы валют:** раз в день exchange-rates-cron запрашивает курсы → запись в `currency_exchange_rates` (используется для мультивалютности и документа [MULTI_CURRENCY_REWARD_SOLUTION.md](MULTI_CURRENCY_REWARD_SOLUTION.md)).

---

## 9. Мультивалютность и вознаграждения

В [MULTI_CURRENCY_REWARD_SOLUTION.md](MULTI_CURRENCY_REWARD_SOLUTION.md) описана задача: партнёры в разных валютах (VND, USD, RUB и т.д.), Revenue Share нужно считать в единой валюте. Решение: поле `currency` в транзакциях, таблица `currency_exchange_rates`, конвертация в USD при расчёте вознаграждений. Миграции `add_currency_to_transactions.sql`, `create_currency_exchange_rates.sql`, `add_preferred_currency_to_users.sql` и крон обмена уже есть; полная логика расчёта по ТЗ может быть в процессе внедрения.

---

## 10. Деплой и конфигурация

- **Фронт:** `cd frontend && npm run build && wrangler pages deploy dist --project-name=loyalitybot-frontend`.
- **Воркеры:** в каждой папке `cloudflare/workers/<name>/` — `wrangler deploy` (конфиг в wrangler.toml).
- Переменные окружения: токены ботов (`TOKEN_PARTNER`, `TOKEN_CLIENT`, `ADMIN_BOT_TOKEN`), `ADMIN_CHAT_ID`, `SUPABASE_URL`, `SUPABASE_KEY`, при необходимости `OPENAI_API_KEY`, `SENTRY_DSN`, `WEBHOOK_SECRET_TOKEN`, `CRON_SECRET_TOKEN` для крона курсов.
- Другие платформы (Render, Vercel, Netlify, Fly.io) по правилам проекта не используются.

---

## 11. Документация и статус функций

- [README.md](README.md) — общее описание, установка, таблицы БД, запуск ботов и дашборда.
- [API_DOCUMENTATION.md](API_DOCUMENTATION.md) — описание REST API (Swagger на :8001 для локального FastAPI).
- [PROJECT_FEATURES_STATUS.md](PROJECT_FEATURES_STATUS.md) — статус фич по этапам (гипотеза → прототип → тест → прод) для ботов и фронта.
- Множество тематических .md в корне: деплой Cloudflare, MLM, мультивалютность, A/B тесты, безопасность, чек-листы и т.д.

---

## 12. Итоговая схема связей

- **Пользователи Telegram** взаимодействуют с тремя ботами; в продакшене апдейты обрабатывают Cloudflare Webhook Workers, которые читают/пишут Supabase и при необходимости вызывают Telegram API.
- **Web App** работает в Telegram Mini App; данные — через Supabase Client и REST API Worker (транзакции, рефералы, промо, перевод, QR, карта районов).
- **Единый источник правды** — Supabase; курсы валют подгружаются кроном и используются для мультивалютной логики и будущих расчётов Revenue Share в одной валюте.

Если нужно углубиться в конкретный компонент (например, только фронт, только API Worker или только схему БД), можно сузить анализ по запросу.
