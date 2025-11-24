#!/bin/bash
# Скрипт для перезапуска ботов на сервере через systemd

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}🔄 Перезапуск ботов...${NC}"

# Перезапуск админ-бота
if systemctl list-units --type=service | grep -q "loyalitybot-admin.service"; then
    echo -e "${YELLOW}🔄 Перезапуск админ-бота...${NC}"
    sudo systemctl restart loyalitybot-admin.service
    sleep 2
    if systemctl is-active --quiet loyalitybot-admin.service; then
        echo -e "${GREEN}✅ Админ-бот перезапущен и работает${NC}"
    else
        echo -e "${RED}❌ Ошибка при перезапуске админ-бота${NC}"
        sudo systemctl status loyalitybot-admin.service --no-pager -l
    fi
else
    echo -e "${YELLOW}⚠️  loyalitybot-admin.service не найден${NC}"
fi

# Перезапуск клиентского бота
if systemctl list-units --type=service | grep -q "loyalitybot-client.service"; then
    echo -e "${YELLOW}🔄 Перезапуск клиентского бота...${NC}"
    sudo systemctl restart loyalitybot-client.service
    sleep 2
    if systemctl is-active --quiet loyalitybot-client.service; then
        echo -e "${GREEN}✅ Клиентский бот перезапущен и работает${NC}"
    else
        echo -e "${RED}❌ Ошибка при перезапуске клиентского бота${NC}"
        sudo systemctl status loyalitybot-client.service --no-pager -l
    fi
else
    echo -e "${YELLOW}⚠️  loyalitybot-client.service не найден${NC}"
fi

# Перезапуск партнерского бота
if systemctl list-units --type=service | grep -q "loyalitybot-partner.service"; then
    echo -e "${YELLOW}🔄 Перезапуск партнерского бота...${NC}"
    sudo systemctl restart loyalitybot-partner.service
    sleep 2
    if systemctl is-active --quiet loyalitybot-partner.service; then
        echo -e "${GREEN}✅ Партнерский бот перезапущен и работает${NC}"
    else
        echo -e "${RED}❌ Ошибка при перезапуске партнерского бота${NC}"
        sudo systemctl status loyalitybot-partner.service --no-pager -l
    fi
else
    echo -e "${YELLOW}⚠️  loyalitybot-partner.service не найден${NC}"
fi

echo ""
echo -e "${GREEN}📊 Статус всех сервисов:${NC}"
systemctl status loyalitybot-admin.service --no-pager -l | head -5 || true
echo ""
systemctl status loyalitybot-client.service --no-pager -l | head -5 || true
echo ""
systemctl status loyalitybot-partner.service --no-pager -l | head -5 || true

echo ""
echo -e "${GREEN}🎉 Перезапуск завершен!${NC}"









