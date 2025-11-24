#!/bin/bash

# Скрипт для настройки переменных окружения в Fly.io
# Использование: ./setup_fly_secrets.sh

echo "🔐 Настройка переменных окружения для Fly.io"
echo ""
echo "⚠️  ВАЖНО: Замените значения на реальные из вашего .env файла!"
echo ""

# Основные переменные для Supabase
read -p "SUPABASE_URL: " SUPABASE_URL
read -p "SUPABASE_KEY: " SUPABASE_KEY

# Sentry
read -p "SENTRY_DSN: " SENTRY_DSN
read -p "SENTRY_ENVIRONMENT [production]: " SENTRY_ENVIRONMENT
SENTRY_ENVIRONMENT=${SENTRY_ENVIRONMENT:-production}

# Telegram для алертов
read -p "SENTRY_ALERT_TELEGRAM_TOKEN: " SENTRY_ALERT_TELEGRAM_TOKEN
read -p "SENTRY_ALERT_CHAT_ID: " SENTRY_ALERT_CHAT_ID
read -p "SENTRY_WEBHOOK_SECRET: " SENTRY_WEBHOOK_SECRET

# Опциональные
read -p "APP_VERSION [1.0.0]: " APP_VERSION
APP_VERSION=${APP_VERSION:-1.0.0}
read -p "LOG_LEVEL [INFO]: " LOG_LEVEL
LOG_LEVEL=${LOG_LEVEL:-INFO}

echo ""
echo "📤 Устанавливаю secrets в Fly.io..."

flyctl secrets set \
  SUPABASE_URL="$SUPABASE_URL" \
  SUPABASE_KEY="$SUPABASE_KEY" \
  SENTRY_DSN="$SENTRY_DSN" \
  SENTRY_ENVIRONMENT="$SENTRY_ENVIRONMENT" \
  SENTRY_ALERT_TELEGRAM_TOKEN="$SENTRY_ALERT_TELEGRAM_TOKEN" \
  SENTRY_ALERT_CHAT_ID="$SENTRY_ALERT_CHAT_ID" \
  SENTRY_WEBHOOK_SECRET="$SENTRY_WEBHOOK_SECRET" \
  APP_VERSION="$APP_VERSION" \
  LOG_LEVEL="$LOG_LEVEL" \
  --app loyalitybot

echo ""
echo "✅ Secrets установлены!"
echo ""
echo "🔄 Перезапускаю приложение..."
flyctl apps restart loyalitybot

echo ""
echo "✅ Готово! Проверьте: https://loyalitybot.fly.dev/health"

