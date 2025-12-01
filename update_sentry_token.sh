#!/bin/bash

# Скрипт для обновления SENTRY_ALERT_TELEGRAM_TOKEN
# Использование: ./update_sentry_token.sh

NEW_TOKEN="8309705244:AAHCTtgphMpjqYDxk0iYJWF7P-K-P1dnmfo"

echo "🔐 Обновление SENTRY_ALERT_TELEGRAM_TOKEN"
echo ""

# Проверяем, какая платформа используется
if command -v railway &> /dev/null; then
    echo "📦 Обновляю на Railway..."
    railway variables set SENTRY_ALERT_TELEGRAM_TOKEN="$NEW_TOKEN"
    echo "✅ Токен обновлён на Railway"
    echo "🔄 Перезапустите сервис в Railway Dashboard"
elif command -v flyctl &> /dev/null; then
    echo "📦 Обновляю на Fly.io..."
    flyctl secrets set SENTRY_ALERT_TELEGRAM_TOKEN="$NEW_TOKEN" --app loyalitybot
    echo "✅ Токен обновлён на Fly.io"
    echo "🔄 Перезапустите приложение: flyctl apps restart loyalitybot"
else
    echo "⚠️  CLI для платформ не найден"
    echo ""
    echo "📋 Обновите токен вручную:"
    echo ""
    echo "🔹 Render.com:"
    echo "   1. Откройте Dashboard → ваш сервис → Environment"
    echo "   2. Найдите SENTRY_ALERT_TELEGRAM_TOKEN"
    echo "   3. Измените значение на: $NEW_TOKEN"
    echo "   4. Сохраните (Render перезапустит автоматически)"
    echo ""
    echo "🔹 Railway:"
    echo "   1. Откройте Dashboard → ваш проект → Variables"
    echo "   2. Найдите SENTRY_ALERT_TELEGRAM_TOKEN"
    echo "   3. Измените значение на: $NEW_TOKEN"
    echo "   4. Сохраните (Railway перезапустит автоматически)"
    echo ""
    echo "🔹 Fly.io:"
    echo "   flyctl secrets set SENTRY_ALERT_TELEGRAM_TOKEN=\"$NEW_TOKEN\" --app loyalitybot"
    echo ""
fi

echo ""
echo "✅ Новый токен: $NEW_TOKEN"






