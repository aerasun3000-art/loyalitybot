#!/bin/bash
# Переключение админ-бота с polling (Python) на webhook (Cloudflare Workers)
# После выполнения ОСТАНОВИТЕ Python процесс admin_bot.py

set -e

ADMIN_WEBHOOK_URL="https://loyalitybot-admin-webhook.aerasun3000.workers.dev"

echo ""
echo "🔗 Переключение админ-бота на Cloudflare Workers"
echo "================================================="
echo ""

if [ ! -f .env ]; then
    echo "❌ Файл .env не найден!"
    exit 1
fi

TOKEN=$(grep "^ADMIN_BOT_TOKEN=" .env 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" | tr -d ' ')

if [ -z "$TOKEN" ]; then
    echo "❌ ADMIN_BOT_TOKEN не найден в .env"
    exit 1
fi

echo "✅ Токен найден"
echo "   URL Worker: $ADMIN_WEBHOOK_URL"
echo ""

# Текущий webhook
echo "📋 Текущий webhook:"
curl -s "https://api.telegram.org/bot${TOKEN}/getWebhookInfo" | python3 -m json.tool
echo ""

# Установить webhook
echo "🔗 Устанавливаю webhook..."
SET_RESULT=$(curl -s -X POST "https://api.telegram.org/bot${TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"${ADMIN_WEBHOOK_URL}\", \"drop_pending_updates\": true}")

echo "$SET_RESULT" | python3 -m json.tool

if echo "$SET_RESULT" | grep -q '"ok":true'; then
    echo ""
    echo "✅ Webhook установлен! Админ-бот теперь обрабатывается Cloudflare Workers."
    echo ""
    echo "⚠️  ВАЖНО: Остановите Python процесс admin_bot.py, иначе будет 409 Conflict:"
    echo "   pkill -f admin_bot.py"
    echo "   # или если через systemd:"
    echo "   sudo systemctl stop loyalitybot-admin.service"
    echo ""
else
    echo ""
    echo "❌ Ошибка при установке webhook"
    exit 1
fi
