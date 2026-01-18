# Cloudflare Workers для LoyaltyBot

Структура проекта для миграции ботов на Cloudflare Webhooks.

## 📁 Структура

```
cloudflare/
├── workers/           # Cloudflare Workers endpoints
│   ├── client-webhook/   # Клиентский бот webhook
│   ├── partner-webhook/  # Партнерский бот webhook (TODO)
│   ├── admin-webhook/    # Админ-бот webhook (TODO)
│   └── api/              # REST API worker (TODO)
├── handlers/         # Обработчики для каждого бота
│   ├── client.js     # Клиентский бот handlers
│   ├── partner.js    # Партнерский бот handlers (TODO)
│   └── admin.js      # Админ-бот handlers (TODO)
└── utils/            # Общие утилиты
    ├── supabase.js   # Работа с Supabase
    ├── telegram.js   # Работа с Telegram API
    └── common.js     # Общие функции
```

## 🚀 Быстрый старт

### 1. Установить Wrangler CLI

```bash
npm install -g wrangler
# или
brew install cloudflare-wrangler
```

### 2. Авторизоваться

```bash
wrangler login
```

### 3. Деплой клиентского бота

```bash
cd workers/client-webhook
wrangler deploy
```

### 4. Настроить секреты

```bash
wrangler secret put TOKEN_CLIENT
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_KEY
wrangler secret put FRONTEND_URL
wrangler secret put WELCOME_BONUS_AMOUNT
```

### 5. Настроить webhook

Используйте скрипт из корня проекта:

```bash
cd ../..
python3 scripts/setup_webhooks.py
```

Или вручную через Telegram API.

## 📝 Необходимые секреты

Смотрите полный список в `CLOUDFLARE_MIGRATION_STEPS.md`

## 🔗 Полезные ссылки

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
