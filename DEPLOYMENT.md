# 🚀 Руководство по развёртыванию LoyalityBot

Это пошаговое руководство поможет вам развернуть LoyalityBot в production.

---

## 📋 Предварительные требования

### Сервер
- Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- Python 3.10+
- 1 GB RAM минимум (рекомендуется 2 GB)
- 10 GB свободного места на диске
- Доступ по SSH с правами sudo

### Внешние сервисы
- ✅ Аккаунт Supabase (база данных)
- ✅ 3 Telegram бота (созданные через @BotFather)
- ✅ Telegram Chat ID администратора

---

## 🛠️ Установка на сервере

### Шаг 1: Подключение к серверу

```bash
ssh user@your-server-ip
```

### Шаг 2: Обновление системы

```bash
sudo apt update && sudo apt upgrade -y
```

### Шаг 3: Установка необходимых пакетов

```bash
sudo apt install -y python3 python3-pip python3-venv git
```

### Шаг 4: Клонирование проекта

```bash
cd /home/your-username
git clone <your-repository-url> loyalitybot
cd loyalitybot
```

### Шаг 5: Создание виртуального окружения

```bash
python3 -m venv venv
source venv/bin/activate
```

### Шаг 6: Установка зависимостей

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### Шаг 7: Настройка переменных окружения

```bash
# Создайте .env файл
cp env.example.txt .env
nano .env
```

Заполните все переменные реальными значениями:

```env
TOKEN_PARTNER=your_partner_bot_token
TOKEN_CLIENT=your_client_bot_token
ADMIN_BOT_TOKEN=your_admin_bot_token
ADMIN_CHAT_ID=your_telegram_chat_id

SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=your_supabase_key

WELCOME_BONUS_AMOUNT=100
```

Сохраните (Ctrl+O, Enter, Ctrl+X).

---

## 🗄️ Настройка базы данных Supabase

### 1. Создание таблиц

Выполните SQL запросы в Supabase SQL Editor (подробные схемы см. в README.md):

```sql
-- Таблица пользователей
CREATE TABLE users (...);

-- Таблица заявок партнёров
CREATE TABLE partner_applications (...);

-- Таблица партнёров
CREATE TABLE partners (...);

-- И остальные таблицы...
```

### 2. Настройка Row Level Security (RLS)

Supabase автоматически включает RLS. Для работы системы через service key:
- Используйте `anon` ключ (указан в .env как SUPABASE_KEY)
- Настройте политики доступа или используйте `service_role` ключ для backend

---

## ▶️ Запуск ботов

### Вариант 1: Ручной запуск (для тестирования)

```bash
# Терминал 1
source venv/bin/activate
python bot.py

# Терминал 2 (новый SSH сессия)
source venv/bin/activate
python client_handler.py

# Терминал 3 (новый SSH сессия)
source venv/bin/activate
python admin_bot.py
```

**Проверка:** Напишите `/start` в каждом боте.

---

### Вариант 2: Systemd (рекомендуется для production)

#### 1. Настройка сервисных файлов

```bash
cd systemd-services
nano loyalitybot-partner.service
```

Замените:
- `YOUR_USERNAME` → ваш пользователь (например, `ubuntu`)
- `/path/to/loyalitybot` → полный путь к проекту (например, `/home/ubuntu/loyalitybot`)

Повторите для всех 3 файлов.

#### 2. Копирование в systemd

```bash
sudo cp systemd-services/*.service /etc/systemd/system/
sudo systemctl daemon-reload
```

#### 3. Создание директории для логов

```bash
sudo mkdir -p /var/log/loyalitybot
sudo chown $USER:$USER /var/log/loyalitybot
```

#### 4. Запуск сервисов

```bash
# Включить автозапуск
sudo systemctl enable loyalitybot-partner
sudo systemctl enable loyalitybot-client
sudo systemctl enable loyalitybot-admin

# Запустить сервисы
sudo systemctl start loyalitybot-partner
sudo systemctl start loyalitybot-client
sudo systemctl start loyalitybot-admin
```

#### 5. Проверка статуса

```bash
sudo systemctl status loyalitybot-partner
sudo systemctl status loyalitybot-client
sudo systemctl status loyalitybot-admin
```

Все 3 сервиса должны быть в статусе `active (running)` (зелёный).

#### 6. Просмотр логов

```bash
# В реальном времени
sudo journalctl -u loyalitybot-partner -f

# Последние 50 строк
sudo journalctl -u loyalitybot-partner -n 50

# Логи из файла
tail -f /var/log/loyalitybot/partner.log
```

---

### Вариант 3: Docker (альтернатива)

#### 1. Установка Docker

```bash
sudo apt install -y docker.io docker-compose
sudo usermod -aG docker $USER
# Выйдите и войдите снова для применения группы
```

#### 2. Запуск через Docker Compose

```bash
# Убедитесь, что .env файл настроен
docker-compose up -d
```

#### 3. Проверка статуса

```bash
docker-compose ps
docker-compose logs -f
```

#### 4. Остановка

```bash
docker-compose down
```

---

## 📊 Запуск Streamlit Dashboard (опционально)

```bash
# Ручной запуск
streamlit run admin_dashboard.py --server.port=8501 --server.address=0.0.0.0

# Или через Docker (уже включено в docker-compose)
```

Откройте в браузере: `http://your-server-ip:8501`

---

## 🔒 Безопасность

### 1. Firewall

```bash
# Разрешить только SSH и Streamlit (если используется)
sudo ufw allow 22/tcp
sudo ufw allow 8501/tcp  # Только если нужен Streamlit
sudo ufw enable
sudo ufw status
```

### 2. Защита .env файла

```bash
chmod 600 .env
```

### 3. Автоматические обновления безопасности

```bash
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

---

## 🔄 Обновление проекта

```bash
cd /home/your-username/loyalitybot

# Остановить сервисы
sudo systemctl stop loyalitybot-{partner,client,admin}

# Обновить код
git pull origin main

# Обновить зависимости
source venv/bin/activate
pip install -r requirements.txt

# Запустить сервисы
sudo systemctl start loyalitybot-{partner,client,admin}

# Проверить статус
sudo systemctl status loyalitybot-partner
```

---

## 🐛 Устранение неполадок

### Проблема: Бот не отвечает

**Решение:**
1. Проверьте статус: `sudo systemctl status loyalitybot-partner`
2. Проверьте логи: `sudo journalctl -u loyalitybot-partner -n 50`
3. Проверьте .env переменные: `cat .env`
4. Проверьте доступ к Telegram API: `ping api.telegram.org`

### Проблема: Ошибка подключения к Supabase

**Решение:**
1. Проверьте SUPABASE_URL и SUPABASE_KEY в .env
2. Убедитесь, что IP сервера не заблокирован в Supabase
3. Проверьте интернет-соединение: `curl https://supabase.co`

### Проблема: Сервис падает после запуска

**Решение:**
1. Проверьте полные логи: `sudo journalctl -u loyalitybot-partner --no-pager`
2. Проверьте права доступа: `ls -la /path/to/loyalitybot`
3. Проверьте виртуальное окружение: `which python` (должен быть внутри venv)

---

## 📈 Мониторинг

### Проверка работоспособности

Создайте cron job для периодической проверки:

```bash
crontab -e
```

Добавьте:

```cron
# Проверка каждые 5 минут
*/5 * * * * systemctl is-active --quiet loyalitybot-partner || systemctl restart loyalitybot-partner
*/5 * * * * systemctl is-active --quiet loyalitybot-client || systemctl restart loyalitybot-client
*/5 * * * * systemctl is-active --quiet loyalitybot-admin || systemctl restart loyalitybot-admin
```

---

## ✅ Чеклист финального развёртывания

- [ ] Сервер настроен и обновлён
- [ ] Python 3.10+ установлен
- [ ] Проект склонирован
- [ ] Виртуальное окружение создано
- [ ] Зависимости установлены
- [ ] .env файл настроен с реальными токенами
- [ ] База данных Supabase настроена (таблицы созданы)
- [ ] Systemd сервисы настроены и запущены
- [ ] Все 3 бота отвечают на /start
- [ ] Firewall настроен
- [ ] Логирование работает
- [ ] Автоматический перезапуск настроен (cron/systemd)
- [ ] Backup стратегия определена

---

## 🆘 Поддержка

При возникновении проблем:
1. Проверьте логи: `/var/log/loyalitybot/` и `journalctl`
2. Изучите документацию: `README.md`
3. Свяжитесь с технической поддержкой

---

**Успешного развёртывания! 🚀**

