#!/bin/bash

# Скрипт для деплоя API на Fly.io
# Использование: ./deploy_api_fly.sh

set -e

echo "🚀 Деплой бэкенд API на Fly.io"
echo ""

# Проверка flyctl
if ! command -v flyctl &> /dev/null; then
    echo "❌ flyctl не установлен!"
    echo "Установите: brew install flyctl"
    exit 1
fi

# Проверка авторизации
if ! flyctl auth whoami &> /dev/null; then
    echo "⚠️  Не авторизован в Fly.io"
    echo "Выполните: flyctl auth login"
    exit 1
fi

echo "✅ flyctl установлен и авторизован"
echo ""

# Проверка существования приложения
APP_NAME="loyalitybot-api"

if flyctl apps list | grep -q "$APP_NAME"; then
    echo "✅ Приложение $APP_NAME уже существует"
    echo ""
    read -p "Продолжить деплой? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "📦 Создаю новое приложение $APP_NAME..."
    flyctl launch --name "$APP_NAME" --region ams --no-deploy --copy-config fly.api.toml
    echo "✅ Приложение создано"
    echo ""
fi

# Чтение переменных из .env
if [ ! -f .env ]; then
    echo "❌ Файл .env не найден!"
    exit 1
fi

echo "📝 Устанавливаю переменные окружения..."

# Читаем переменные из .env
source .env

# Устанавливаем secrets
flyctl secrets set \
    SUPABASE_URL="$SUPABASE_URL" \
    SUPABASE_KEY="$SUPABASE_KEY" \
    OPENAI_API_KEY="$OPENAI_API_KEY" \
    OPENAI_MODEL="${OPENAI_MODEL:-gpt-3.5-turbo}" \
    OPENAI_MAX_TOKENS="${OPENAI_MAX_TOKENS:-500}" \
    --app "$APP_NAME"

echo "✅ Переменные окружения установлены"
echo ""

# Деплой
echo "🚀 Запускаю деплой..."
flyctl deploy --config fly.api.toml --app "$APP_NAME"

echo ""
echo "✅ Деплой завершён!"
echo ""
echo "📋 Следующие шаги:"
echo "1. Проверьте статус: flyctl status --app $APP_NAME"
echo "2. Проверьте логи: flyctl logs --app $APP_NAME"
echo "3. Проверьте health: curl https://$APP_NAME.fly.dev/health"
echo "4. Обновите VITE_API_URL в Netlify: https://$APP_NAME.fly.dev"

