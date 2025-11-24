# 🔐 Настройка переменных окружения в Fly.io

## ✅ Приложение уже работает!

Health check: https://loyalitybot.fly.dev/health

---

## 📋 Необходимые переменные

Для работы API нужны следующие переменные окружения:

### Обязательные:
- `SUPABASE_URL` - URL вашего Supabase проекта
- `SUPABASE_KEY` - Service key из Supabase
- `SENTRY_DSN` - DSN из Sentry
- `SENTRY_ALERT_TELEGRAM_TOKEN` - Токен Telegram бота для алертов
- `SENTRY_ALERT_CHAT_ID` - Chat ID куда отправлять алерты
- `SENTRY_WEBHOOK_SECRET` - Секретный ключ для webhook

### Опциональные:
- `SENTRY_ENVIRONMENT` - production (по умолчанию)
- `APP_VERSION` - 1.0.0 (по умолчанию)
- `LOG_LEVEL` - INFO (по умолчанию)

---

## 🚀 Быстрая настройка

### Вариант 1: Через команды (рекомендуется)

```bash
flyctl secrets set \
  SUPABASE_URL="ваш_supabase_url" \
  SUPABASE_KEY="ваш_supabase_key" \
  SENTRY_DSN="ваш_sentry_dsn" \
  SENTRY_ENVIRONMENT="production" \
  SENTRY_ALERT_TELEGRAM_TOKEN="ваш_telegram_token" \
  SENTRY_ALERT_CHAT_ID="ваш_chat_id" \
  SENTRY_WEBHOOK_SECRET="ваш_webhook_secret" \
  APP_VERSION="1.0.0" \
  LOG_LEVEL="INFO" \
  --app loyalitybot
```

### Вариант 2: По одной переменной

```bash
flyctl secrets set SUPABASE_URL="ваш_url" --app loyalitybot
flyctl secrets set SUPABASE_KEY="ваш_key" --app loyalitybot
flyctl secrets set SENTRY_DSN="ваш_dsn" --app loyalitybot
# ... и так далее
```

### Вариант 3: Через интерактивный скрипт

```bash
./setup_fly_secrets.sh
```

---

## ✅ После настройки

1. **Перезапустите приложение:**
   ```bash
   flyctl apps restart loyalitybot
   ```

2. **Проверьте работу:**
   ```bash
   curl https://loyalitybot.fly.dev/health
   ```

3. **Проверьте Swagger UI:**
   https://loyalitybot.fly.dev/docs

---

## 🔍 Просмотр установленных secrets

```bash
flyctl secrets list --app loyalitybot
```

---

## 📝 Настройка Sentry Webhook

После настройки secrets, добавьте webhook в Sentry:

1. Откройте Sentry → ваш проект → Settings → Integrations → Webhooks
2. Добавьте URL: `https://loyalitybot.fly.dev/api/sentry-webhook`
3. Включите события: `issue.created`, `issue.resolved`

---

## 🎯 Готово!

После настройки всех переменных ваше приложение будет полностью функциональным!

