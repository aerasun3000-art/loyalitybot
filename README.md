# 🎁 LoyalityBot - Система лояльности для бизнеса

Многокомпонентная Telegram-система управления программой лояльности, позволяющая партнёрам (бизнесам) начислять бонусы клиентам, управлять акциями и получать обратную связь через NPS.

---

## 📋 Содержание

- [Возможности](#-возможности)
- [Архитектура](#-архитектура)
- [Требования](#-требования)
- [Установка](#-установка)
- [Конфигурация](#-конфигурация)
- [Запуск](#-запуск)
- [Структура проекта](#-структура-проекта)
- [База данных](#-база-данных)
- [Разработка](#-разработка)
- [FAQ](#-faq)

---

## ✨ Возможности

### Для партнёров (бизнесов):
- ✅ Начисление баллов клиентам (5% кэшбэк от суммы чека)
- ✅ Списание баллов при оплате бонусами
- ✅ Создание акций и специальных предложений
- ✅ Добавление услуг для обмена на баллы
- ✅ Реферальные ссылки для привлечения клиентов
- ✅ Детальная статистика: обороты, NPS, количество клиентов
- ✅ Приветственные бонусы для новых клиентов

### Для клиентов:
- ✅ Регистрация по реферальной ссылке партнёра
- ✅ Получение приветственного бонуса (100 баллов)
- ✅ Оценка качества обслуживания (NPS 0-10)
- ✅ Просмотр баланса и истории транзакций
- ✅ Доступ к акциям и услугам партнёров

### Для администраторов:
- ✅ Модерация заявок партнёров
- ✅ Одобрение/отклонение услуг
- ✅ Визуализация данных (Streamlit дашборд)
- ✅ Автоматические уведомления о новых заявках
- ✅ Общая аналитика системы

---

## 🏗️ Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                      КЛИЕНТЫ                                │
│         (Telegram Bot + Web App Frontend)                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   CLIENT_HANDLER.PY                         │
│    • Регистрация по реферальным ссылкам                     │
│    • NPS-рейтинги                                           │
│    • Интеграция с Web App                                   │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   BOT.PY     │  │ ADMIN_BOT.PY │  │ADMIN_DASH.PY │
│  (Партнёры)  │  │(Модерация)   │  │ (Streamlit)  │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       └─────────────────┼─────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ SUPABASE_MANAGER.PY  │
              │  (Database Layer)    │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │   SUPABASE (PG DB)   │
              │  • users             │
              │  • partners          │
              │  • transactions      │
              │  • nps_ratings       │
              │  • promotions        │
              │  • services          │
              └──────────────────────┘
```

---

## 📦 Требования

- **Python**: 3.10 или выше
- **База данных**: Supabase аккаунт (PostgreSQL)
- **Telegram**: 3 бота (партнёрский, клиентский, админский)
- **Системные пакеты**: `python3-pip`, `git`

---

## 🚀 Установка

### 1. Клонирование репозитория

```bash
git clone <your-repo-url>
cd loyalitybot
```

### 2. Создание виртуального окружения

```bash
python3 -m venv venv
source venv/bin/activate  # Linux/macOS
# или
venv\Scripts\activate     # Windows
```

### 3. Установка зависимостей

```bash
pip install -r requirements.txt
```

### 4. Настройка Telegram ботов

Создайте 3 бота через [@BotFather](https://t.me/BotFather):

1. **Партнёрский бот** - для партнёров
   - Команда: `/newbot`
   - Сохраните токен → `TOKEN_PARTNER`

2. **Клиентский бот** - для клиентов
   - Команда: `/newbot`
   - Сохраните токен → `TOKEN_CLIENT`

3. **Админ бот** - для администраторов
   - Команда: `/newbot`
   - Сохраните токен → `ADMIN_BOT_TOKEN`

Получите ваш Telegram Chat ID:
- Напишите [@userinfobot](https://t.me/userinfobot)
- Сохраните ID → `ADMIN_CHAT_ID`

### 5. Настройка Supabase

1. Создайте проект на [supabase.com](https://supabase.com)
2. Перейдите в **Settings → API**
3. Скопируйте:
   - `URL` → `SUPABASE_URL`
   - `anon/public key` → `SUPABASE_KEY`

4. Создайте таблицы (см. [База данных](#-база-данных))

---

## ⚙️ Конфигурация

### Создание файла .env

```bash
cp .env.example .env
nano .env  # или любой редактор
```

Заполните все переменные окружения (см. `.env.example`):

```env
TOKEN_PARTNER=your_partner_bot_token
TOKEN_CLIENT=your_client_bot_token
ADMIN_BOT_TOKEN=your_admin_bot_token
ADMIN_CHAT_ID=your_telegram_chat_id

SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=your_supabase_anon_key

WELCOME_BONUS_AMOUNT=100
```

---

## 🎬 Запуск

### Вариант 1: Ручной запуск (для разработки)

Запустите каждый компонент в отдельном терминале:

```bash
# Терминал 1: Партнёрский бот
python bot.py

# Терминал 2: Клиентский бот
python client_handler.py

# Терминал 3: Админ бот
python admin_bot.py

# Терминал 4 (опционально): Streamlit дашборд
streamlit run admin_dashboard.py
```

### Вариант 2: Использование Screen/Tmux

```bash
# Создание сессий
screen -S partner_bot
python bot.py
# Нажмите Ctrl+A, затем D для отсоединения

screen -S client_bot
python client_handler.py
# Ctrl+A, D

screen -S admin_bot
python admin_bot.py
# Ctrl+A, D
```

Вернуться к сессии: `screen -r partner_bot`

### Вариант 3: Systemd (для продакшена)

Создайте сервисные файлы (примеры в `/docs/systemd/`)

```bash
sudo systemctl start loyalitybot-partner
sudo systemctl start loyalitybot-client
sudo systemctl start loyalitybot-admin
```

---

## 📁 Структура проекта

```
loyalitybot/
├── bot.py                    # Партнёрский бот (telebot)
├── client_handler.py         # Клиентский бот (telebot)
├── admin_bot.py              # Админ бот (aiogram)
├── admin_dashboard.py        # Streamlit дашборд
├── supabase_manager.py       # Менеджер БД
├── requirements.txt          # Python зависимости
├── .env.example              # Шаблон переменных окружения
├── .gitignore               # Git ignore файл
├── README.md                 # Этот файл
└── service_account.json      # Credentials (НЕ коммитить!)
```

---

## 💾 База данных

### Таблицы Supabase

#### 1. `users` (клиенты)
```sql
CREATE TABLE users (
    chat_id TEXT PRIMARY KEY,
    phone TEXT UNIQUE,
    name TEXT,
    balance INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    city TEXT,
    district TEXT,
    reg_date TIMESTAMP,
    last_visit TIMESTAMP,
    registered_via TEXT,
    referral_source TEXT,
    total_bonus_spent INTEGER DEFAULT 0,
    total_money_spent NUMERIC DEFAULT 0
);
```

#### 2. `partner_applications` (заявки партнёров)
```sql
CREATE TABLE partner_applications (
    chat_id TEXT PRIMARY KEY,
    name TEXT,
    phone TEXT,
    company_name TEXT,
    city TEXT,
    district TEXT,
    status TEXT DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### 3. `partners` (одобренные партнёры)
```sql
CREATE TABLE partners (
    chat_id TEXT PRIMARY KEY,
    name TEXT,
    company_name TEXT
);
```

#### 4. `transactions` (история транзакций)
```sql
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    client_chat_id TEXT REFERENCES users(chat_id),
    partner_chat_id TEXT REFERENCES partners(chat_id),
    date_time TIMESTAMP DEFAULT NOW(),
    total_amount NUMERIC,
    earned_points INTEGER,
    spent_points INTEGER,
    operation_type TEXT,
    description TEXT
);
```

#### 5. `nps_ratings` (оценки NPS)
```sql
CREATE TABLE nps_ratings (
    id SERIAL PRIMARY KEY,
    client_chat_id TEXT REFERENCES users(chat_id),
    partner_chat_id TEXT REFERENCES partners(chat_id),
    rating INTEGER CHECK (rating >= 0 AND rating <= 10),
    master_name TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### 6. `promotions` (акции)
```sql
CREATE TABLE promotions (
    id SERIAL PRIMARY KEY,
    partner_chat_id TEXT REFERENCES partners(chat_id),
    title TEXT,
    description TEXT,
    discount_value TEXT,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### 7. `services` (услуги)
```sql
CREATE TABLE services (
    id SERIAL PRIMARY KEY,
    partner_chat_id TEXT REFERENCES partners(chat_id),
    title TEXT,
    description TEXT,
    price_points INTEGER,
    status TEXT DEFAULT 'Pending'
);
```

---

## 🛠️ Разработка

### Структура веток Git

```
main         - production код
develop      - разработка
feature/*    - новые функции
bugfix/*     - исправления багов
hotfix/*     - срочные фиксы для продакшена
```

### Запуск тестов

```bash
# Установка pytest
pip install pytest pytest-asyncio

# Запуск тестов
pytest tests/

# С покрытием кода
pytest --cov=. tests/
```

### Код-стайл

Проект следует PEP 8. Рекомендуется использовать:

```bash
pip install black flake8
black .
flake8 .
```

---

## ❓ FAQ

### Q: Как добавить нового администратора?

A: Добавьте его Chat ID в `.env`:
```env
ADMIN_CHAT_ID=123456789,987654321,111222333
```

### Q: Как изменить размер приветственного бонуса?

A: Измените в `.env`:
```env
WELCOME_BONUS_AMOUNT=200
```

### Q: Как сбросить базу данных?

A: В Supabase Table Editor удалите все записи или используйте SQL:
```sql
TRUNCATE users, transactions, nps_ratings CASCADE;
```

### Q: Бот не отвечает, что делать?

A: Проверьте:
1. Логи: `tail -f logs/bot.log`
2. Токены в `.env` корректны
3. Боты запущены: `ps aux | grep python`
4. Интернет соединение и доступ к Telegram API

### Q: Как узнать Chat ID клиента?

A: Клиент должен написать боту `/start`, его ID появится в логах или попросите написать [@userinfobot](https://t.me/userinfobot)

---

## 📞 Поддержка

- **Баги и предложения**: [GitHub Issues](#)
- **Документация**: [Wiki](#)
- **Telegram**: [Support Channel](#)

---

## 📄 Лицензия

Этот проект является приватным. Все права защищены.

---

## 🙏 Благодарности

- [python-telegram-bot](https://github.com/python-telegram-bot/python-telegram-bot)
- [aiogram](https://github.com/aiogram/aiogram)
- [Supabase](https://supabase.com)
- [Streamlit](https://streamlit.io)

---

**Версия**: 0.7.0  
**Последнее обновление**: Октябрь 2025

