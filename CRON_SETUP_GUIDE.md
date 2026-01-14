# ⏰ РУКОВОДСТВО ПО НАСТРОЙКЕ CRON ДЛЯ ЕЖЕМЕСЯЧНОГО РАСЧЕТА REVENUE SHARE

**Дата:** Ноябрь 2025  
**Скрипт:** `calculate_monthly_revenue_share.py`

---

## 📋 ОБЗОР

Скрипт `calculate_monthly_revenue_share.py` автоматически рассчитывает Revenue Share за указанный период и может одобрять выплаты.

**Рекомендуется запускать:** 1-го числа каждого месяца для расчета за прошлый месяц.

---

## 🚀 БЫСТРЫЙ СТАРТ

### 1. Ручной запуск (тестирование)

```bash
cd /Users/ghbi/Downloads/loyalitybot

# Расчет за прошлый месяц
python3 calculate_monthly_revenue_share.py

# Расчет за прошлый месяц + автоматическое одобрение
python3 calculate_monthly_revenue_share.py --approve

# Расчет за текущий месяц
python3 calculate_monthly_revenue_share.py --period current_month

# Расчет за кастомный период
python3 calculate_monthly_revenue_share.py --period custom --start 2025-11-01 --end 2025-11-30
```

---

## ⚙️ НАСТРОЙКА CRON

### Вариант 1: macOS / Linux (crontab)

1. Откройте crontab:
```bash
crontab -e
```

2. Добавьте строку (расчет 1-го числа каждого месяца в 00:00):
```cron
0 0 1 * * cd /Users/ghbi/Downloads/loyalitybot && /usr/bin/python3 calculate_monthly_revenue_share.py --approve >> revenue_share.log 2>&1
```

3. Сохраните и выйдите (в vim: `:wq`, в nano: `Ctrl+X`, затем `Y`)

4. Проверьте, что задача добавлена:
```bash
crontab -l
```

---

### Вариант 2: macOS (launchd) - Рекомендуется для macOS

1. Создайте plist файл:
```bash
nano ~/Library/LaunchAgents/com.loyaltybot.revenue_share.plist
```

2. Добавьте содержимое:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.loyaltybot.revenue_share</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>/Users/ghbi/Downloads/loyalitybot/calculate_monthly_revenue_share.py</string>
        <string>--approve</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/ghbi/Downloads/loyalitybot</string>
    <key>StandardOutPath</key>
    <string>/Users/ghbi/Downloads/loyalitybot/revenue_share.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/ghbi/Downloads/loyalitybot/revenue_share_error.log</string>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Day</key>
        <integer>1</integer>
        <key>Hour</key>
        <integer>0</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
</dict>
</plist>
```

3. Загрузите задачу:
```bash
launchctl load ~/Library/LaunchAgents/com.loyaltybot.revenue_share.plist
```

4. Проверьте статус:
```bash
launchctl list | grep loyaltybot
```

---

### Вариант 3: Supabase Edge Function (для облачного запуска)

Если вы используете Supabase, можно создать Edge Function:

1. Создайте функцию в Supabase Dashboard
2. Используйте код из `calculate_monthly_revenue_share.py`
3. Настройте Supabase Cron для запуска 1-го числа каждого месяца

---

## 📊 ПАРАМЕТРЫ КОМАНДНОЙ СТРОКИ

### `--period`

Выбор периода для расчета:
- `last_month` (по умолчанию) - прошлый месяц
- `current_month` - текущий месяц
- `custom` - кастомный период (требует `--start` и `--end`)

### `--start` и `--end`

Даты начала и конца периода (формат: YYYY-MM-DD)
Используется только с `--period custom`

### `--approve`

Автоматически одобряет все pending выплаты за указанный период

---

## 📝 ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ

### Пример 1: Расчет за прошлый месяц

```bash
python3 calculate_monthly_revenue_share.py
```

**Результат:**
```
НАЧАЛО РАСЧЕТА REVENUE SHARE
Период: 2025-10-01 - 2025-10-31
Обработано выплат: 15
Общая сумма: $1,234.56
✅ Расчет завершен успешно!
```

### Пример 2: Расчет + одобрение

```bash
python3 calculate_monthly_revenue_share.py --approve
```

**Результат:**
```
НАЧАЛО РАСЧЕТА REVENUE SHARE
Период: 2025-10-01 - 2025-10-31
Обработано выплат: 15
Общая сумма: $1,234.56
Одобрено выплат: 15
✅ Расчет завершен успешно!
```

### Пример 3: Расчет за конкретный период

```bash
python3 calculate_monthly_revenue_share.py \
  --period custom \
  --start 2025-11-01 \
  --end 2025-11-15 \
  --approve
```

---

## 🔍 МОНИТОРИНГ

### Просмотр логов

```bash
# Последние 50 строк
tail -n 50 revenue_share.log

# Следить за логами в реальном времени
tail -f revenue_share.log

# Поиск ошибок
grep -i error revenue_share.log
```

### Проверка выполнения

```bash
# Проверить последний запуск (crontab)
grep "calculate_monthly_revenue_share" /var/log/syslog

# Проверить статус (launchd)
launchctl list | grep loyaltybot
```

---

## ⚠️ ВАЖНЫЕ ЗАМЕЧАНИЯ

1. **Время запуска:** Рекомендуется запускать в нерабочее время (например, 00:00)
2. **Резервное копирование:** Перед первым запуском сделайте бэкап базы данных
3. **Тестирование:** Всегда тестируйте на тестовых данных перед продакшеном
4. **Логирование:** Убедитесь, что логи пишутся в доступное место
5. **Переменные окружения:** Убедитесь, что `.env` файл доступен для скрипта

---

## 🆘 РЕШЕНИЕ ПРОБЛЕМ

### Скрипт не запускается

1. Проверьте права доступа:
```bash
chmod +x calculate_monthly_revenue_share.py
```

2. Проверьте путь к Python:
```bash
which python3
```

3. Проверьте переменные окружения:
```bash
python3 check_env.py
```

### Cron не выполняется

1. Проверьте синтаксис crontab:
```bash
crontab -l
```

2. Проверьте логи cron:
```bash
# macOS
grep CRON /var/log/system.log

# Linux
grep CRON /var/log/syslog
```

3. Убедитесь, что путь абсолютный:
```cron
0 0 1 * * cd /Users/ghbi/Downloads/loyalitybot && /usr/bin/python3 calculate_monthly_revenue_share.py
```

### Ошибки при расчете

1. Проверьте подключение к базе данных
2. Проверьте RLS политики (выполните `fix_mlm_rls_policies.sql`)
3. Проверьте логи: `tail -f revenue_share.log`

---

## 📚 СВЯЗАННЫЕ ДОКУМЕНТЫ

- `calculate_monthly_revenue_share.py` - Сам скрипт
- `NEXT_STEPS_MLM.md` - Следующие шаги
- `MLM_PARTNER_REVENUE_SHARE_GUIDE.md` - Общее руководство
- `fix_mlm_rls_policies.sql` - SQL миграция для RLS

---

**Дата создания:** Ноябрь 2025  
**Версия:** 1.0















