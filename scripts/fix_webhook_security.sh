#!/bin/bash
# Скрипт для исправления проблемы безопасности webhook
# Удаляет все webhooks и устанавливает правильный на Cloudflare Worker

set -e

echo "🔒 Исправление проблемы безопасности webhook"
echo "=============================================="
echo ""

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Проверка наличия .env файла
if [ ! -f .env ]; then
    echo -e "${RED}❌ Файл .env не найден!${NC}"
    exit 1
fi

# Получение токена из .env
TOKEN=$(grep "^TOKEN_CLIENT=" .env 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" | tr -d ' ')

if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ TOKEN_CLIENT не найден в .env${NC}"
    echo ""
    echo "Добавьте в .env:"
    echo "TOKEN_CLIENT=ваш_токен_бота"
    exit 1
fi

echo -e "${GREEN}✅ Токен найден${NC}"
echo ""

# URL Cloudflare Worker
CLOUDFLARE_WEBHOOK_URL="https://loyalitybot-client-webhook.aerasun3000.workers.dev"

echo "📋 Текущий webhook:"
echo "==================="
WEBHOOK_INFO=$(curl -s "https://api.telegram.org/bot${TOKEN}/getWebhookInfo")
echo "$WEBHOOK_INFO" | python3 -m json.tool 2>/dev/null || echo "$WEBHOOK_INFO"
echo ""

# Проверка ответа
if echo "$WEBHOOK_INFO" | grep -q '"ok":false'; then
    echo -e "${YELLOW}⚠️  Ошибка при проверке webhook${NC}"
    echo "Возможные причины:"
    echo "  1. Токен неверный"
    echo "  2. Бот был удален"
    echo ""
    echo "Проверьте токен через @BotFather:"
    echo "  1. Откройте @BotFather"
    echo "  2. Отправьте /mybots"
    echo "  3. Выберите ваш бот"
    echo "  4. Выберите 'API Token'"
    echo ""
    read -p "Продолжить удаление webhook? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Шаг 1: Удалить все webhooks
echo ""
echo "🗑️  ШАГ 1: Удаление всех webhooks"
echo "=================================="
DELETE_RESULT=$(curl -s -X POST "https://api.telegram.org/bot${TOKEN}/deleteWebhook?drop_pending_updates=true")
echo "$DELETE_RESULT" | python3 -m json.tool 2>/dev/null || echo "$DELETE_RESULT"

if echo "$DELETE_RESULT" | grep -q '"ok":true'; then
    echo -e "${GREEN}✅ Webhook удален${NC}"
else
    echo -e "${YELLOW}⚠️  Возможно webhook уже был удален или произошла ошибка${NC}"
fi

# Небольшая задержка
sleep 2

# Шаг 2: Установить правильный webhook
echo ""
echo "🔗 ШАГ 2: Установка webhook на Cloudflare Worker"
echo "================================================"
echo "URL: $CLOUDFLARE_WEBHOOK_URL"
echo ""

SET_RESULT=$(curl -s -X POST "https://api.telegram.org/bot${TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"${CLOUDFLARE_WEBHOOK_URL}\", \"drop_pending_updates\": true}")

echo "$SET_RESULT" | python3 -m json.tool 2>/dev/null || echo "$SET_RESULT"

if echo "$SET_RESULT" | grep -q '"ok":true'; then
    echo -e "${GREEN}✅ Webhook установлен на Cloudflare Worker${NC}"
else
    echo -e "${RED}❌ Ошибка при установке webhook${NC}"
    exit 1
fi

# Шаг 3: Проверка
echo ""
echo "✅ ШАГ 3: Проверка установленного webhook"
echo "=========================================="
sleep 2
FINAL_CHECK=$(curl -s "https://api.telegram.org/bot${TOKEN}/getWebhookInfo")
echo "$FINAL_CHECK" | python3 -m json.tool 2>/dev/null || echo "$FINAL_CHECK"

if echo "$FINAL_CHECK" | grep -q "$CLOUDFLARE_WEBHOOK_URL"; then
    echo ""
    echo -e "${GREEN}✅ УСПЕХ! Webhook установлен правильно${NC}"
    echo ""
    echo "📋 Следующие шаги:"
    echo "  1. Протестируйте бота с новым пользователем"
    echo "  2. Проверьте логи Cloudflare Workers:"
    echo "     cd cloudflare/workers/client-webhook"
    echo "     wrangler tail"
    echo ""
    echo "🔒 Рекомендуется добавить Secret Token для защиты:"
    echo "   См. CLOUDFLARE_SECURITY_FIX.md"
else
    echo ""
    echo -e "${YELLOW}⚠️  Webhook может быть установлен, но проверка не прошла${NC}"
    echo "Проверьте вручную через @BotFather"
fi
