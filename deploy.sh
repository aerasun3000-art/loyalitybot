#!/bin/bash
# 🚀 Универсальный скрипт для деплоя и перезапуска ботов
# Поддерживает: локальный деплой, systemd, Docker, облачные сервисы

set -e

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Определение типа деплоя
DEPLOY_TYPE="${1:-local}"

echo -e "${BLUE}🚀 Деплой LoyalityBot${NC}"
echo -e "${YELLOW}Тип деплоя: ${DEPLOY_TYPE}${NC}"
echo ""

# Функция для проверки зависимостей
check_dependencies() {
    local missing=()
    
    if ! command -v python3 &> /dev/null; then
        missing+=("python3")
    fi
    
    if [ "$DEPLOY_TYPE" = "docker" ] && ! command -v docker &> /dev/null; then
        missing+=("docker")
    fi
    
    if [ "$DEPLOY_TYPE" = "fly" ] && ! command -v flyctl &> /dev/null; then
        missing+=("flyctl")
    fi
    
    if [ ${#missing[@]} -gt 0 ]; then
        echo -e "${RED}❌ Отсутствуют зависимости: ${missing[*]}${NC}"
        exit 1
    fi
}

# Локальный деплой (nohup)
deploy_local() {
    echo -e "${YELLOW}📦 Локальный деплой...${NC}"
    
    # Останавливаем старые процессы
    echo -e "${YELLOW}🛑 Останавливаем старые процессы...${NC}"
    pkill -f admin_bot.py 2>/dev/null || true
    pkill -f bot.py 2>/dev/null || true
    pkill -f client_handler.py 2>/dev/null || true
    sleep 2
    
    # Проверяем виртуальное окружение
    if [ ! -d "venv" ]; then
        echo -e "${YELLOW}📦 Создаём виртуальное окружение...${NC}"
        python3 -m venv venv
    fi
    
    # Активируем и устанавливаем зависимости
    echo -e "${YELLOW}📥 Устанавливаем зависимости...${NC}"
    source venv/bin/activate
    pip install --upgrade pip -q
    pip install -r requirements.txt -q
    
    # Запускаем боты
    echo -e "${YELLOW}🤖 Запускаем боты...${NC}"
    nohup ./venv/bin/python3 admin_bot.py > admin_bot_output.log 2>&1 &
    nohup ./venv/bin/python3 bot.py > bot_output.log 2>&1 &
    nohup ./venv/bin/python3 client_handler.py > client_handler_output.log 2>&1 &
    
    sleep 3
    
    # Проверяем статус
    if pgrep -f admin_bot.py > /dev/null && \
       pgrep -f bot.py > /dev/null && \
       pgrep -f client_handler.py > /dev/null; then
        echo -e "${GREEN}✅ Все боты успешно запущены!${NC}"
        echo ""
        echo -e "${BLUE}📊 Статус:${NC}"
        ps aux | grep -E "(admin_bot|bot\.py|client_handler)" | grep python | grep -v grep | awk '{print "   PID:", $2, "|", $11, $12}'
    else
        echo -e "${RED}❌ Ошибка при запуске ботов. Проверьте логи:${NC}"
        echo "   tail -f admin_bot_output.log"
        echo "   tail -f bot_output.log"
        echo "   tail -f client_handler_output.log"
        exit 1
    fi
}

# Systemd деплой
deploy_systemd() {
    echo -e "${YELLOW}📦 Деплой через systemd...${NC}"
    
    if ! command -v systemctl &> /dev/null; then
        echo -e "${RED}❌ systemctl не найден. Используйте 'local' или 'docker'${NC}"
        exit 1
    fi
    
    # Проверяем наличие сервисных файлов
    if [ ! -f "systemd-services/loyalitybot-admin.service" ]; then
        echo -e "${RED}❌ Сервисные файлы не найдены в systemd-services/${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}🔄 Перезапускаем сервисы...${NC}"
    
    sudo systemctl restart loyalitybot-admin.service 2>/dev/null || echo -e "${YELLOW}⚠️  loyalitybot-admin.service не найден${NC}"
    sudo systemctl restart loyalitybot-client.service 2>/dev/null || echo -e "${YELLOW}⚠️  loyalitybot-client.service не найден${NC}"
    sudo systemctl restart loyalitybot-partner.service 2>/dev/null || echo -e "${YELLOW}⚠️  loyalitybot-partner.service не найден${NC}"
    
    sleep 2
    
    echo -e "${GREEN}✅ Сервисы перезапущены${NC}"
    echo ""
    echo -e "${BLUE}📊 Статус:${NC}"
    sudo systemctl status loyalitybot-admin.service --no-pager -l | head -5 || true
    sudo systemctl status loyalitybot-client.service --no-pager -l | head -5 || true
    sudo systemctl status loyalitybot-partner.service --no-pager -l | head -5 || true
}

# Docker деплой
deploy_docker() {
    echo -e "${YELLOW}📦 Деплой через Docker...${NC}"
    
    if [ ! -f "docker-compose.yml" ]; then
        echo -e "${RED}❌ docker-compose.yml не найден${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}🔄 Перезапускаем контейнеры...${NC}"
    docker-compose down
    docker-compose build --no-cache
    docker-compose up -d
    
    sleep 3
    
    echo -e "${GREEN}✅ Контейнеры запущены${NC}"
    echo ""
    echo -e "${BLUE}📊 Статус:${NC}"
    docker-compose ps
}

# Fly.io деплой
deploy_fly() {
    echo -e "${YELLOW}📦 Деплой на Fly.io...${NC}"
    
    if [ ! -f "fly.toml" ]; then
        echo -e "${RED}❌ fly.toml не найден. Запустите: flyctl launch${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}🚀 Запускаем деплой...${NC}"
    flyctl deploy
    
    echo -e "${GREEN}✅ Деплой завершён${NC}"
    flyctl status
}

# Render деплой (через Git)
deploy_render() {
    echo -e "${YELLOW}📦 Деплой на Render (через Git push)...${NC}"
    
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        echo -e "${RED}❌ Это не Git репозиторий${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}📤 Отправляем изменения в Git...${NC}"
    git add .
    git commit -m "Deploy: $(date +%Y-%m-%d\ %H:%M:%S)" || echo "Нет изменений для коммита"
    git push origin main || git push origin master
    
    echo -e "${GREEN}✅ Изменения отправлены. Render автоматически задеплоит${NC}"
    echo -e "${BLUE}💡 Проверьте статус на: https://dashboard.render.com${NC}"
}

# Главная функция
main() {
    check_dependencies
    
    case "$DEPLOY_TYPE" in
        local)
            deploy_local
            ;;
        systemd)
            deploy_systemd
            ;;
        docker)
            deploy_docker
            ;;
        fly)
            deploy_fly
            ;;
        render)
            deploy_render
            ;;
        *)
            echo -e "${RED}❌ Неизвестный тип деплоя: ${DEPLOY_TYPE}${NC}"
            echo ""
            echo "Доступные типы:"
            echo "  local    - Локальный деплой (nohup)"
            echo "  systemd  - Деплой через systemd сервисы"
            echo "  docker   - Деплой через Docker Compose"
            echo "  fly      - Деплой на Fly.io"
            echo "  render   - Деплой на Render (через Git)"
            exit 1
            ;;
    esac
    
    echo ""
    echo -e "${GREEN}🎉 Деплой завершён успешно!${NC}"
}

# Запуск
main

