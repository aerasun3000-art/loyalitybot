#!/bin/bash
# Скрипт для установки webhook после обновления токена
# Использование: ./scripts/install_webhook.sh

set -e

echo ""
echo "🔗 Установка webhook с защитой"
echo "=============================="
echo ""

# Проверка наличия .env
if [ ! -f .env ]; then
    echo "❌ Файл .env не найден!"
    exit 1
fi

# Получить токен из .env
TOKEN=$(grep "^TOKEN_CLIENT=" .env 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" | tr -d ' ')

if [ -z "$TOKEN" ]; then
    echo "❌ TOKEN_CLIENT не найден в .env"
    echo ""
    echo "Убедитесь, что:"
    echo "  1. Токен отозван в @BotFather"
    echo "  2. Создан новый токен"
    echo "  3. Токен обновлен в .env"
    exit 1
fi

echo "✅ Токен найден: ${TOKEN:0:15}..."
echo ""

# Получить Secret Token
SECRET_TOKEN=$(cat /tmp/webhook_secret_token.txt 2>/dev/null)

if [ -z "$SECRET_TOKEN" ]; then
    echo "⚠️  Secret Token не найден, генерирую новый..."
    if command -v openssl &> /dev/null; then
        SECRET_TOKEN=$(openssl rand -hex 32)
    else
        SECRET_TOKEN=$(python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null)
    fi
    
    # Добавить в Cloudflare
    cd cloudflare/workers/client-webhook
    echo "$SECRET_TOKEN" | wrangler secret put WEBHOOK_SECRET_TOKEN --env="" 2>&1
    echo "$SECRET_TOKEN" > /tmp/webhook_secret_token.txt
    cd ../..
    
    echo "✅ Сгенерирован и добавлен новый Secret Token"
fi

echo "✅ Secret Token: ${SECRET_TOKEN:0:20}..."
echo ""

# Удалить старый webhook
echo "🗑️  Удаляю старый webhook..."
DELETE_RESULT=$(curl -s -X POST "https://api.telegram.org/bot${TOKEN}/deleteWebhook?drop_pending_updates=true")
echo "$DELETE_RESULT" | python3 -m json.tool 2>/dev/null || echo "$DELETE_RESULT"

if echo "$DELETE_RESULT" | grep -q '"ok":false'; then
    ERROR_CODE=$(echo "$DELETE_RESULT" | grep -o '"error_code":[0-9]*' | cut -d':' -f2)
    if [ "$ERROR_CODE" = "401" ]; then
        echo ""
        echo "❌ ОШИБКА: Токен неверный или отозван!"
        echo ""
        echo "Проверьте:"
        echo "  1. Отозвали ли вы старый токен в @BotFather"
        echo "  2. Создали ли вы новый токен"
        echo "  3. Обновили ли вы токен в .env"
        exit 1
    fi
fi

sleep 2

# Установить новый webhook
echo ""
echo "🔗 Устанавливаю новый webhook с Secret Token..."
SET_RESULT=$(curl -s -X POST "https://api.telegram.org/bot${TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"https://loyalitybot-client-webhook.aerasun3000.workers.dev\",
    \"secret_token\": \"${SECRET_TOKEN}\",
    \"drop_pending_updates\": true
  }")

echo "$SET_RESULT" | python3 -m json.tool 2>/dev/null || echo "$SET_RESULT"

if echo "$SET_RESULT" | grep -q '"ok":true'; then
    echo ""
    echo "✅ Webhook установлен успешно!"
else
    ERROR_CODE=$(echo "$SET_RESULT" | grep -o '"error_code":[0-9]*' | cut -d':' -f2)
    if [ "$ERROR_CODE" = "401" ]; then
        echo ""
        echo "❌ ОШИБКА: Токен неверный или отозван!"
        echo ""
        echo "Проверьте:"
        echo "  1. Отозвали ли вы старый токен в @BotFather"
        echo "  2. Создали ли вы новый токен"
        echo "  3. Обновили ли вы токен в .env"
        exit 1
    else
        echo ""
        echo "❌ Ошибка при установке webhook"
        exit 1
    fi
fi

# Проверка
echo ""
echo "✅ Проверяю webhook..."
sleep 2
CHECK_RESULT=$(curl -s "https://api.telegram.org/bot${TOKEN}/getWebhookInfo")
echo "$CHECK_RESULT" | python3 -m json.tool 2>/dev/null || echo "$CHECK_RESULT"

if echo "$CHECK_RESULT" | grep -q "loyalitybot-client-webhook.aerasun3000.workers.dev"; then
    echo ""
    echo "✅ УСПЕХ! Webhook установлен правильно"
    echo ""
    echo "📋 Проверьте:"
    echo "  1. Протестируйте бота с новым пользователем"
    echo "  2. Убедитесь, что сообщение 'OWNED BY @MISHADOX' больше не появляется"
    echo "  3. Проверьте логи: cd cloudflare/workers/client-webhook && wrangler tail"
else
    echo ""
    echo "⚠️  Webhook может быть установлен, но проверка не прошла"
fi
