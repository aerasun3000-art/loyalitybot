#!/bin/bash
#
# Скрипт тестирования мониторинга
# Отправляет тестовые запросы для проверки Sentry интеграции
#

set -e

# Цвета
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🧪 Тестирование мониторинга Cloudflare Workers${NC}\n"

# Получить URL Workers
read -p "Введите URL клиентского webhook (или нажмите Enter для использования по умолчанию): " CLIENT_URL
if [ -z "$CLIENT_URL" ]; then
    CLIENT_URL="https://loyalitybot-client-webhook.aerasun3000.workers.dev"
fi

read -p "Введите URL партнёрского webhook (или нажмите Enter для пропуска): " PARTNER_URL
if [ -z "$PARTNER_URL" ]; then
    PARTNER_URL=""
fi

echo -e "\n${YELLOW}Тест 1: Отправка некорректного JSON (должна быть ошибка)${NC}"
curl -X POST "$CLIENT_URL" \
  -H "Content-Type: application/json" \
  -d '{"invalid": "json format"' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s -o /dev/null

echo -e "${GREEN}✅ Запрос отправлен. Проверьте Sentry через 10-30 секунд${NC}\n"

echo -e "${YELLOW}Тест 2: Отправка валидного update${NC}"
curl -X POST "$CLIENT_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "update_id": 12345,
    "message": {
      "message_id": 1,
      "chat": {"id": 123456, "type": "private"},
      "from": {"id": 123456, "is_bot": false, "first_name": "Test"},
      "text": "/start"
    }
  }' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | head -5

echo -e "${GREEN}✅ Запрос отправлен. Проверьте Cloudflare Logs${NC}\n"

if [ -n "$PARTNER_URL" ]; then
    echo -e "${YELLOW}Тест 3: Отправка в партнёрский webhook${NC}"
    curl -X POST "$PARTNER_URL" \
      -H "Content-Type: application/json" \
      -d '{
        "update_id": 12346,
        "message": {
          "message_id": 2,
          "chat": {"id": 789012, "type": "private"},
          "from": {"id": 789012, "is_bot": false, "first_name": "Test Partner"},
          "text": "/balance"
        }
      }' \
      -w "\nHTTP Status: %{http_code}\n" \
      -s | head -5
    
    echo -e "${GREEN}✅ Запрос отправлен${NC}\n"
fi

echo -e "${GREEN}🎉 Тестирование завершено!${NC}\n"
echo -e "Проверьте:"
echo -e "1. ${YELLOW}Cloudflare Logs${NC} — должны быть записи о запросах"
echo -e "2. ${YELLOW}Sentry Dashboard${NC} — должно появиться событие с ошибкой (Тест 1)"
echo -e "3. ${YELLOW}Cloudflare Analytics${NC} — должны быть новые запросы"
