#!/bin/bash
# Скрипт для получения переменных окружения для Railway

echo "📋 Переменные окружения для Railway:"
echo "======================================"
echo ""
echo "Скопируйте эти переменные в Railway Dashboard → Variables:"
echo ""

cd /Users/ghbi/Downloads/loyalitybot

# Обязательные переменные
echo "# === ОБЯЗАТЕЛЬНЫЕ ==="
grep -E "^SUPABASE_URL=" .env 2>/dev/null || echo "SUPABASE_URL=ваш_supabase_url"
grep -E "^SUPABASE_KEY=" .env 2>/dev/null || echo "SUPABASE_KEY=ваш_supabase_key"
grep -E "^SENTRY_DSN=" .env 2>/dev/null || echo "SENTRY_DSN=ваш_sentry_dsn"
echo "SENTRY_ENVIRONMENT=production"
echo ""

# Telegram алерты
echo "# === TELEGRAM АЛЕРТЫ ==="
grep -E "^SENTRY_ALERT_TELEGRAM_TOKEN=" .env 2>/dev/null || echo "SENTRY_ALERT_TELEGRAM_TOKEN=ваш_token"
grep -E "^SENTRY_ALERT_CHAT_ID=" .env 2>/dev/null || echo "SENTRY_ALERT_CHAT_ID=ваш_chat_id"
grep -E "^SENTRY_WEBHOOK_SECRET=" .env 2>/dev/null || echo "SENTRY_WEBHOOK_SECRET=ваш_secret"
echo ""

# Опциональные
echo "# === ОПЦИОНАЛЬНЫЕ ==="
echo "APP_VERSION=1.0.0"
echo "LOG_LEVEL=INFO"
echo ""

echo "======================================"
echo "✅ Скопируйте эти переменные в Railway"
echo ""


