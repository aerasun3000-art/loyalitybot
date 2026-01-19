#!/bin/bash
#
# Скрипт настройки мониторинга для Cloudflare Workers
# Автоматически добавляет Sentry секреты во все Workers
#

set -e

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Настройка мониторинга Cloudflare Workers${NC}\n"

# Проверка наличия wrangler
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ wrangler не найден. Установите: npm install -g wrangler${NC}"
    exit 1
fi

# Получение Sentry DSN
read -p "Введите Sentry DSN (или нажмите Enter для использования по умолчанию): " SENTRY_DSN
if [ -z "$SENTRY_DSN" ]; then
    SENTRY_DSN="https://bcb0ae7907d2c03b4be2507334a93db9@o4510368013877248.ingest.us.sentry.io/4510368037470208"
    echo -e "${YELLOW}Используется DSN по умолчанию${NC}"
fi

# Получение окружения
read -p "Введите окружение (production/staging/development) [production]: " SENTRY_ENV
if [ -z "$SENTRY_ENV" ]; then
    SENTRY_ENV="production"
fi

# Массив Workers
WORKERS=("client-webhook" "partner-webhook" "admin-webhook")

# Базовый путь
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo -e "\n${GREEN}📝 Настройка секретов для Workers...${NC}\n"

for WORKER in "${WORKERS[@]}"; do
    WORKER_DIR="$BASE_DIR/workers/$WORKER"
    
    if [ ! -d "$WORKER_DIR" ]; then
        echo -e "${YELLOW}⚠️  Worker $WORKER не найден, пропускаем...${NC}"
        continue
    fi
    
    echo -e "${GREEN}Настраиваю $WORKER...${NC}"
    cd "$WORKER_DIR"
    
    # Добавить SENTRY_DSN
    echo "$SENTRY_DSN" | wrangler secret put SENTRY_DSN --name "loyalitybot-$WORKER" 2>/dev/null || {
        echo -e "${YELLOW}⚠️  Не удалось добавить SENTRY_DSN для $WORKER${NC}"
    }
    
    # Добавить SENTRY_ENVIRONMENT
    echo "$SENTRY_ENV" | wrangler secret put SENTRY_ENVIRONMENT --name "loyalitybot-$WORKER" 2>/dev/null || {
        echo -e "${YELLOW}⚠️  Не удалось добавить SENTRY_ENVIRONMENT для $WORKER${NC}"
    }
    
    echo -e "${GREEN}✅ $WORKER настроен${NC}\n"
done

echo -e "${GREEN}🎉 Настройка завершена!${NC}\n"
echo -e "Следующие шаги:"
echo -e "1. Разверните Workers: ${YELLOW}cd cloudflare/workers/[worker-name] && wrangler deploy${NC}"
echo -e "2. Проверьте логи: ${YELLOW}wrangler tail${NC}"
echo -e "3. Откройте Sentry Dashboard для проверки событий"
