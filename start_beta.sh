#!/bin/bash
# Скрипт для запуска всех ботов в бета-режиме

cd /Users/ghbi/Downloads/loyalitybot || exit 1

# Активируем виртуальное окружение
source venv/bin/activate

# Функция для проверки запущенного процесса
check_bot() {
    local bot_name=$1
    if pgrep -f "$bot_name" > /dev/null; then
        echo "✅ $bot_name уже запущен"
        return 0
    else
        return 1
    fi
}

# Функция для запуска бота
start_bot() {
    local bot_name=$1
    local script=$2
    local log_file=$3
    
    if check_bot "$bot_name"; then
        echo "⚠️  $bot_name уже запущен, пропускаем..."
        return 0
    fi
    
    echo "🚀 Запускаем $bot_name..."
    nohup python3 "$script" > "$log_file" 2>&1 &
    sleep 2
    
    if check_bot "$bot_name"; then
        echo "✅ $bot_name успешно запущен (PID: $(pgrep -f "$bot_name"))"
        return 0
    else
        echo "❌ Ошибка запуска $bot_name. Проверьте $log_file"
        return 1
    fi
}

# Проверка переменных окружения
echo "🔍 Проверяем переменные окружения..."

required_vars=(
    "TOKEN_CLIENT"
    "TOKEN_PARTNER"
    "ADMIN_BOT_TOKEN"
    "ADMIN_CHAT_ID"
    "SUPABASE_URL"
    "SUPABASE_KEY"
)

missing_vars=()
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -gt 0 ]; then
    echo "❌ Отсутствуют переменные окружения:"
    printf '   - %s\n' "${missing_vars[@]}"
    echo ""
    echo "Убедитесь, что файл .env содержит все необходимые переменные."
    exit 1
fi

echo "✅ Все переменные окружения на месте"
echo ""

# Останавливаем старые процессы (если есть)
echo "🛑 Останавливаем старые процессы..."
pkill -f "client_handler.py" 2>/dev/null
pkill -f "bot.py" 2>/dev/null
pkill -f "admin_bot.py" 2>/dev/null
sleep 2

# Создаём директорию для логов (если не существует)
mkdir -p logs

# Запускаем боты
echo ""
echo "🤖 Запускаем боты..."
echo ""

start_bot "client_handler.py" "client_handler.py" "client_handler_output.log"
start_bot "bot.py" "bot.py" "bot_output.log"
start_bot "admin_bot.py" "admin_bot.py" "admin_bot_output.log"

echo ""
echo "📊 Статус ботов:"
echo ""
ps aux | grep -E "(client_handler|bot\.py|admin_bot)" | grep python | grep -v grep | awk '{print "   PID:", $2, "|", $11, $12, $13}'

echo ""
echo "✅ Готово! Все боты запущены."
echo ""
echo "📋 Полезные команды:"
echo "   Просмотр логов:"
echo "   tail -f client_handler_output.log"
echo "   tail -f bot_output.log"
echo "   tail -f admin_bot_output.log"
echo ""
echo "   Остановка всех ботов:"
echo "   pkill -f 'client_handler.py|bot.py|admin_bot.py'"
echo ""

