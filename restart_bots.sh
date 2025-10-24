#!/bin/bash
# Скрипт для безопасного перезапуска ботов

echo "🛑 Останавливаем все боты..."

# Останавливаем процессы
pkill -f admin_bot.py
pkill -f bot.py
pkill -f client_handler.py

echo "⏳ Ждём 2 секунды..."
sleep 2

# Проверяем, что всё остановлено
RUNNING=$(pgrep -fl "admin_bot.py|bot.py|client_handler.py" | grep -v grep)

if [ ! -z "$RUNNING" ]; then
    echo "⚠️  Найдены запущенные процессы:"
    echo "$RUNNING"
    echo ""
    echo "Принудительная остановка..."
    pkill -9 -f admin_bot.py
    pkill -9 -f bot.py
    pkill -9 -f client_handler.py
    sleep 1
fi

echo "✅ Все боты остановлены"
echo ""
echo "📝 Теперь запустите каждый бот в отдельном терминале:"
echo ""
echo "Терминал 1: python bot.py"
echo "Терминал 2: python client_handler.py"
echo "Терминал 3: python admin_bot.py"
echo ""
echo "Или используйте screen/tmux для фоновой работы."

