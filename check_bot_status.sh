#!/bin/bash
# Скрипт для проверки статуса ботов и предотвращения конфликтов

echo "🔍 Проверка статуса ботов..."
echo ""

# Проверяем локальные процессы
LOCAL_BOTS=$(ps aux | grep -E "bot.py|client_handler.py|admin_bot.py" | grep -v grep | grep python)

if [ ! -z "$LOCAL_BOTS" ]; then
    echo "⚠️  ВНИМАНИЕ: Найдены локальные процессы ботов:"
    echo "$LOCAL_BOTS" | awk '{print "   PID:", $2, "|", $11, $12, $13}'
    echo ""
    echo "❌ Эти процессы конфликтуют с ботами на Fly.io!"
    echo ""
    echo "Остановите локальные боты командой:"
    echo "   pkill -f 'bot.py|client_handler.py|admin_bot.py'"
    echo ""
    exit 1
fi

echo "✅ Локальные боты не запущены"
echo ""

# Проверяем статус на Fly.io
echo "🌐 Проверка ботов на Fly.io..."
echo ""

if command -v flyctl &> /dev/null; then
    echo "Партнёрский бот:"
    flyctl status --app loyalitybot-partner 2>/dev/null | grep -E "STATE|started|stopped" || echo "   ⚠️  Не удалось проверить статус"
    echo ""
    
    echo "Клиентский бот:"
    flyctl status --app loyalitybot-client 2>/dev/null | grep -E "STATE|started|stopped" || echo "   ⚠️  Не удалось проверить статус"
    echo ""
    
    echo "Админ-бот:"
    flyctl status --app loyalitybot-admin 2>/dev/null | grep -E "STATE|started|stopped" || echo "   ⚠️  Не удалось проверить статус"
else
    echo "⚠️  flyctl не установлен. Установите: brew install flyctl"
fi

echo ""
echo "✅ Проверка завершена"
