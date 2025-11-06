#!/bin/bash
# Скрипт для деплоя функционала смены фонов

set -e  # Остановка при ошибке

echo "🚀 Начинаем деплой функционала смены фонов..."

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Обновление кода из Git (если используется)
if [ -d ".git" ]; then
    echo -e "${YELLOW}📥 Обновление кода из Git...${NC}"
    git pull origin main || git pull origin master
else
    echo -e "${YELLOW}⚠️  Git репозиторий не найден, пропускаем обновление${NC}"
fi

# 2. Деплой фронтенда на Vercel
echo -e "${YELLOW}🚀 Деплой фронтенда на Vercel...${NC}"
if command -v vercel &> /dev/null; then
    vercel --prod --yes
    echo -e "${GREEN}✅ Фронтенд задеплоен на Vercel${NC}"
else
    echo -e "${YELLOW}⚠️  Vercel CLI не найден, фронтенд должен задеплоиться автоматически через Git${NC}"
fi

# 3. Перезапуск ботов (systemd)
echo -e "${YELLOW}🔄 Перезапуск ботов...${NC}"

# Проверяем, какие сервисы существуют
if systemctl list-units --type=service | grep -q "loyalitybot-admin.service"; then
    sudo systemctl restart loyalitybot-admin.service
    echo -e "${GREEN}✅ Админ-бот перезапущен${NC}"
else
    echo -e "${YELLOW}⚠️  loyalitybot-admin.service не найден${NC}"
fi

if systemctl list-units --type=service | grep -q "loyalitybot-client.service"; then
    sudo systemctl restart loyalitybot-client.service
    echo -e "${GREEN}✅ Клиентский бот перезапущен${NC}"
else
    echo -e "${YELLOW}⚠️  loyalitybot-client.service не найден${NC}"
fi

if systemctl list-units --type=service | grep -q "loyalitybot-partner.service"; then
    sudo systemctl restart loyalitybot-partner.service
    echo -e "${GREEN}✅ Партнерский бот перезапущен${NC}"
else
    echo -e "${YELLOW}⚠️  loyalitybot-partner.service не найден${NC}"
fi

# 4. Проверка статуса
echo -e "${YELLOW}📊 Проверка статуса сервисов...${NC}"
for service in loyalitybot-admin loyalitybot-client loyalitybot-partner; do
    if systemctl is-active --quiet ${service}.service; then
        echo -e "${GREEN}✅ ${service}.service активен${NC}"
    else
        echo -e "${YELLOW}⚠️  ${service}.service не активен${NC}"
        sudo systemctl status ${service}.service --no-pager -l || true
    fi
done

# 5. Если используется Docker
if [ -f "docker-compose.yml" ] || [ -f "compose.yml" ]; then
    echo -e "${YELLOW}🐳 Обнаружен Docker Compose, перезапускаем контейнеры...${NC}"
    docker compose up -d --build || docker-compose up -d --build
    echo -e "${GREEN}✅ Docker контейнеры перезапущены${NC}"
fi

echo -e "${GREEN}🎉 Деплой завершен!${NC}"
echo ""
echo "📝 Следующие шаги:"
echo "1. Откройте админ-бот в Telegram"
echo "2. Нажмите /start или /admin"
echo "3. Выберите '🎨 Смена Фона'"
echo "4. Выберите нужный фон"
echo "5. Обновите страницу фронтенда для применения изменений"

