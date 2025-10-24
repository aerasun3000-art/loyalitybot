# ⚡ Быстрый старт LoyalityBot

Это руководство поможет вам запустить LoyalityBot локально за 10 минут.

---

## 📋 Что вам понадобится

1. **Python 3.10+** - [Скачать](https://www.python.org/downloads/)
2. **Git** - [Скачать](https://git-scm.com/)
3. **Аккаунт Supabase** - [Создать бесплатно](https://supabase.com)
4. **3 Telegram бота** - создать через [@BotFather](https://t.me/BotFather)

---

## 🚀 5 шагов к запуску

### Шаг 1: Клонируйте проект

```bash
git clone <your-repo-url>
cd loyalitybot
```

### Шаг 2: Установите зависимости

```bash
# Создайте виртуальное окружение
python3 -m venv venv

# Активируйте его
source venv/bin/activate  # macOS/Linux
# ИЛИ
venv\Scripts\activate     # Windows

# Установите пакеты
pip install -r requirements.txt
```

### Шаг 3: Создайте Telegram ботов

1. Откройте [@BotFather](https://t.me/BotFather)
2. Создайте 3 бота командой `/newbot`:
   - **Партнёрский бот** (например: MyBusinessBot)
   - **Клиентский бот** (например: MyClientsBot)
   - **Админ бот** (например: MyAdminBot)
3. Сохраните все 3 токена

### Шаг 4: Настройте Supabase

1. Создайте проект на [supabase.com](https://supabase.com)
2. Перейдите в **SQL Editor** и выполните:

```sql
-- Таблица пользователей
CREATE TABLE users (
    chat_id TEXT PRIMARY KEY,
    phone TEXT UNIQUE,
    name TEXT,
    balance INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    reg_date TIMESTAMP DEFAULT NOW(),
    registered_via TEXT,
    referral_source TEXT
);

-- Таблица партнёров (одобренные)
CREATE TABLE partners (
    chat_id TEXT PRIMARY KEY,
    name TEXT,
    company_name TEXT
);

-- Таблица заявок партнёров
CREATE TABLE partner_applications (
    chat_id TEXT PRIMARY KEY,
    name TEXT,
    phone TEXT,
    company_name TEXT,
    status TEXT DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Таблица транзакций
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

-- Таблица NPS оценок
CREATE TABLE nps_ratings (
    id SERIAL PRIMARY KEY,
    client_chat_id TEXT REFERENCES users(chat_id),
    partner_chat_id TEXT REFERENCES partners(chat_id),
    rating INTEGER CHECK (rating >= 0 AND rating <= 10),
    master_name TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Таблица акций
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

-- Таблица услуг
CREATE TABLE services (
    id SERIAL PRIMARY KEY,
    partner_chat_id TEXT REFERENCES partners(chat_id),
    title TEXT,
    description TEXT,
    price_points INTEGER,
    status TEXT DEFAULT 'Pending'
);
```

3. Перейдите в **Settings → API**
4. Скопируйте **URL** и **anon public** ключ

### Шаг 5: Создайте .env файл

```bash
# Скопируйте шаблон
cp env.example.txt .env

# Отредактируйте .env
nano .env  # или используйте любой редактор
```

Заполните переменные:

```env
# Токены ботов (из шага 3)
TOKEN_PARTNER=123456:ABC-DEF...
TOKEN_CLIENT=789012:GHI-JKL...
ADMIN_BOT_TOKEN=345678:MNO-PQR...

# Ваш Telegram Chat ID (узнайте у @userinfobot)
ADMIN_CHAT_ID=123456789

# Supabase (из шага 4)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=eyJhbGc...

# Бонус для новых клиентов
WELCOME_BONUS_AMOUNT=100
```

Сохраните файл (Ctrl+O, Enter, Ctrl+X).

---

## ▶️ Запуск

### Запустите все 3 бота в разных терминалах:

**Терминал 1 - Партнёрский бот:**
```bash
source venv/bin/activate
python bot.py
```

**Терминал 2 - Клиентский бот:**
```bash
source venv/bin/activate
python client_handler.py
```

**Терминал 3 - Админ бот:**
```bash
source venv/bin/activate
python admin_bot.py
```

Вы должны увидеть:
```
=== Партнёрский бот запущен ===
```

---

## ✅ Проверка работоспособности

### 1. Тест админ бота

1. Откройте вашего админ бота в Telegram
2. Отправьте `/start`
3. Вы должны увидеть меню с кнопками:
   - 🤝 Заявки Партнеров
   - ✨ Модерация Услуг
   - 📊 Общая статистика

### 2. Создайте тестового партнёра

**В Supabase SQL Editor:**

```sql
INSERT INTO partner_applications (chat_id, name, phone, company_name, status)
VALUES ('YOUR_TELEGRAM_CHAT_ID', 'Тест Партнёр', '79991234567', 'ООО Тест', 'Pending');
```

Замените `YOUR_TELEGRAM_CHAT_ID` на ваш реальный Telegram Chat ID.

### 3. Одобрите партнёра

1. В админ боте нажмите "🤝 Заявки Партнеров"
2. Нажмите "🟢 Одобрить"

### 4. Тест партнёрского бота

1. Откройте партнёрского бота
2. Отправьте `/start`
3. Вы должны увидеть рабочее меню

### 5. Создайте тестового клиента

1. Нажмите "👥 Пригласить клиента"
2. Скопируйте реферальную ссылку
3. Откройте её в браузере или другом Telegram аккаунте
4. Клиент должен зарегистрироваться и получить 100 баллов

---

## 🎉 Готово!

Теперь вы можете:

- ✅ Начислять/списывать баллы клиентам
- ✅ Создавать акции и услуги
- ✅ Приглашать новых клиентов
- ✅ Собирать NPS оценки
- ✅ Модерировать заявки через админ бота

---

## 📚 Что дальше?

- **Подробная документация**: читайте [README.md](README.md)
- **Развёртывание на сервере**: см. [DEPLOYMENT.md](DEPLOYMENT.md)
- **Тестирование**: запустите `./run_tests.sh`
- **Streamlit Dashboard**: `streamlit run admin_dashboard.py`

---

## ❓ Проблемы?

### Бот не отвечает

- Проверьте, что бот запущен (смотрите терминал)
- Проверьте TOKEN в .env файле
- Проверьте интернет-соединение

### Ошибка подключения к Supabase

- Проверьте SUPABASE_URL и SUPABASE_KEY
- Убедитесь, что таблицы созданы

### Партнёр не может начислить баллы

- Убедитесь, что партнёр одобрен (статус Approved)
- Проверьте, что клиент существует в БД
- Посмотрите логи в терминале

---

**Нужна помощь? Свяжитесь с поддержкой.**

