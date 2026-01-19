#!/bin/bash
# Скрипт восстановления бота после взлома
# Использование: ./scripts/recover_bot_security.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "🚨 ВОССТАНОВЛЕНИЕ БОТА ПОСЛЕ ВЗЛОМА"
echo "===================================="
echo ""

# Проверка наличия .env
if [ ! -f .env ]; then
    echo -e "${RED}❌ Файл .env не найден!${NC}"
    exit 1
fi

# Шаг 1: Запросить новый токен
echo -e "${YELLOW}ШАГ 1: Обновление токена${NC}"
echo "=============================="
echo ""
echo "⚠️  ВАЖНО: Сначала отзовите старый токен в @BotFather:"
echo "   1. Откройте @BotFather"
echo "   2. Отправьте /mybots"
echo "   3. Выберите бота → API Token → Revoke Token"
echo ""
echo "Затем создайте новый токен:"
echo "   API Token → Generate New Token"
echo ""
read -p "Введите новый токен: " NEW_TOKEN

if [ -z "$NEW_TOKEN" ]; then
    echo -e "${RED}❌ Токен не может быть пустым!${NC}"
    exit 1
fi

# Шаг 2: Обновить .env
echo ""
echo -e "${YELLOW}ШАГ 2: Обновление .env${NC}"
echo "=========================="
echo ""

# Резервная копия
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ Создана резервная копия .env"

# Обновить токен в .env
if grep -q "^TOKEN_CLIENT=" .env; then
    sed -i '' "s|^TOKEN_CLIENT=.*|TOKEN_CLIENT=${NEW_TOKEN}|" .env
    echo "✅ TOKEN_CLIENT обновлен в .env"
else
    echo "TOKEN_CLIENT=${NEW_TOKEN}" >> .env
    echo "✅ TOKEN_CLIENT добавлен в .env"
fi

# Шаг 3: Обновить Cloudflare секреты
echo ""
echo -e "${YELLOW}ШАГ 3: Обновление Cloudflare секретов${NC}"
echo "======================================"
echo ""

cd cloudflare/workers/client-webhook

echo "Обновляю TOKEN_CLIENT в Cloudflare..."
echo "${NEW_TOKEN}" | wrangler secret put TOKEN_CLIENT --env=""

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ TOKEN_CLIENT обновлен в Cloudflare${NC}"
else
    echo -e "${RED}❌ Ошибка при обновлении TOKEN_CLIENT${NC}"
    exit 1
fi

# Шаг 4: Генерировать новый Secret Token
echo ""
echo -e "${YELLOW}ШАГ 4: Генерация Secret Token${NC}"
echo "================================"
echo ""

# Генерировать Secret Token
if command -v openssl &> /dev/null; then
    SECRET_TOKEN=$(openssl rand -hex 32)
else
    SECRET_TOKEN=$(python3 -c "import secrets; print(secrets.token_hex(32))")
fi

echo "✅ Сгенерирован Secret Token: ${SECRET_TOKEN:0:20}..."
echo ""

# Добавить в Cloudflare
echo "Добавляю WEBHOOK_SECRET_TOKEN в Cloudflare..."
echo "${SECRET_TOKEN}" | wrangler secret put WEBHOOK_SECRET_TOKEN --env=""

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ WEBHOOK_SECRET_TOKEN добавлен в Cloudflare${NC}"
else
    echo -e "${RED}❌ Ошибка при добавлении WEBHOOK_SECRET_TOKEN${NC}"
    exit 1
fi

# Шаг 5: Передеплоить Worker
echo ""
echo -e "${YELLOW}ШАГ 5: Передеплой Worker${NC}"
echo "============================="
echo ""

wrangler deploy --env=""

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Worker передеплоен${NC}"
else
    echo -e "${RED}❌ Ошибка при передеплое Worker${NC}"
    exit 1
fi

# Шаг 6: Установить webhook с Secret Token
echo ""
echo -e "${YELLOW}ШАГ 6: Установка webhook с защитой${NC}"
echo "======================================"
echo ""

cd ../..

# Удалить старый webhook
echo "Удаляю старый webhook..."
DELETE_RESULT=$(curl -s -X POST "https://api.telegram.org/bot${NEW_TOKEN}/deleteWebhook?drop_pending_updates=true")
echo "$DELETE_RESULT" | python3 -m json.tool 2>/dev/null || echo "$DELETE_RESULT"

sleep 2

# Установить новый webhook
echo ""
echo "Устанавливаю новый webhook с Secret Token..."
SET_RESULT=$(curl -s -X POST "https://api.telegram.org/bot${NEW_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"https://loyalitybot-client-webhook.aerasun3000.workers.dev\",
    \"secret_token\": \"${SECRET_TOKEN}\",
    \"drop_pending_updates\": true
  }")

echo "$SET_RESULT" | python3 -m json.tool 2>/dev/null || echo "$SET_RESULT"

if echo "$SET_RESULT" | grep -q '"ok":true'; then
    echo -e "${GREEN}✅ Webhook установлен с Secret Token${NC}"
else
    echo -e "${RED}❌ Ошибка при установке webhook${NC}"
    exit 1
fi

# Проверка
echo ""
echo "Проверяю webhook..."
sleep 2
CHECK_RESULT=$(curl -s "https://api.telegram.org/bot${NEW_TOKEN}/getWebhookInfo")
echo "$CHECK_RESULT" | python3 -m json.tool 2>/dev/null || echo "$CHECK_RESULT"

# Итоги
echo ""
echo "===================================="
echo -e "${GREEN}✅ ВОССТАНОВЛЕНИЕ ЗАВЕРШЕНО!${NC}"
echo "===================================="
echo ""
echo "✅ Токен отозван и обновлен"
echo "✅ Cloudflare секреты обновлены"
echo "✅ Worker передеплоен"
echo "✅ Webhook установлен с Secret Token"
echo ""
echo "📋 Следующие шаги:"
echo "   1. Протестируйте бота с новым пользователем"
echo "   2. Проверьте, что сообщение 'OWNED BY @MISHADOX' больше не появляется"
echo "   3. Проверьте логи: cd cloudflare/workers/client-webhook && wrangler tail"
echo ""
echo "🔒 Рекомендуется:"
echo "   • Включить 2FA на аккаунте Telegram"
echo "   • Проверить активные сеансы"
echo "   • Регулярно мониторить логи"
echo ""
echo "📄 Подробная инструкция: SECURITY_BREACH_RECOVERY.md"
echo ""
