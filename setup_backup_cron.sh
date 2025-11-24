#!/bin/bash
# Скрипт для настройки автоматических бэкапов через cron

# Путь к проекту
PROJECT_DIR="/Users/ghbi/Downloads/loyalitybot"
PYTHON_BIN="$PROJECT_DIR/venv/bin/python3"
BACKUP_SCRIPT="$PROJECT_DIR/backup_database.py"

# Создание cron задачи
# Запуск каждый день в 3:00 AM
CRON_SCHEDULE="0 3 * * *"

# Команда для cron
CRON_CMD="cd $PROJECT_DIR && $PYTHON_BIN $BACKUP_SCRIPT --type full --cleanup >> $PROJECT_DIR/logs/backup_cron.log 2>&1"

echo "🔧 Настройка автоматических бэкапов"
echo "======================================"
echo ""
echo "Расписание: Каждый день в 3:00 AM"
echo "Команда: $CRON_CMD"
echo ""

# Проверка существует ли уже задача
if crontab -l 2>/dev/null | grep -q "$BACKUP_SCRIPT"; then
    echo "⚠️  Задача бэкапа уже существует в crontab"
    echo ""
    echo "Текущие cron задачи:"
    crontab -l | grep backup_database
    echo ""
    read -p "Хотите обновить? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Отменено"
        exit 0
    fi
    # Удаление старой задачи
    crontab -l | grep -v "$BACKUP_SCRIPT" | crontab -
fi

# Добавление новой задачи
(crontab -l 2>/dev/null; echo "$CRON_SCHEDULE $CRON_CMD") | crontab -

echo ""
echo "✅ Автоматический бэкап настроен!"
echo ""
echo "Проверка установки:"
crontab -l | grep backup_database
echo ""
echo "📋 Управление:"
echo "  Просмотр логов: tail -f $PROJECT_DIR/logs/backup_cron.log"
echo "  Список бэкапов: python3 restore_database.py --list"
echo "  Ручной запуск: python3 backup_database.py"
echo ""
echo "⚙️  Для изменения расписания отредактируйте этот скрипт и запустите снова"
echo ""


