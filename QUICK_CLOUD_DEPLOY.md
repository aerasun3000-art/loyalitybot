# ⚡ Быстрый деплой на облако (Fly.io)

## 🚀 За 5 минут

### Шаг 1: Установите Fly.io CLI

```bash
# macOS
brew install flyctl

# Linux / Windows
curl -L https://fly.io/install.sh | sh
```

### Шаг 2: Войдите в Fly.io

```bash
flyctl auth login
```

Откроется браузер для авторизации.

### Шаг 3: Настройте переменные окружения

Создайте файл `.fly.secrets` (не коммитьте в Git!):

```bash
# Скопируйте все переменные из .env
cat > .fly.secrets << EOF
SUPABASE_URL=ваш_supabase_url
SUPABASE_KEY=ваш_supabase_key
TOKEN_PARTNER=ваш_partner_token
TOKEN_CLIENT=ваш_client_token
ADMIN_BOT_TOKEN=ваш_admin_token
ADMIN_CHAT_ID=ваш_chat_id
SENTRY_DSN=ваш_sentry_dsn
SENTRY_ENVIRONMENT=production
APP_VERSION=1.0.0
LOG_LEVEL=INFO
EOF
```

### Шаг 4: Задеплойте админ-бота

```bash
# Инициализация (первый раз)
flyctl launch --config fly.admin.toml --app loyalitybot-admin

# Установка секретов
flyctl secrets set --app loyalitybot-admin $(cat .fly.secrets | xargs)

# Деплой
flyctl deploy --app loyalitybot-admin
```

### Шаг 5: Задеплойте партнерского бота

```bash
flyctl launch --config fly.partner.toml --app loyalitybot-partner
flyctl secrets set --app loyalitybot-partner $(cat .fly.secrets | xargs)
flyctl deploy --app loyalitybot-partner
```

### Шаг 6: Задеплойте клиентского бота

```bash
flyctl launch --config fly.client.toml --app loyalitybot-client
flyctl secrets set --app loyalitybot-client $(cat .fly.secrets | xargs)
flyctl deploy --app loyalitybot-client
```

---

## 🔄 Обновление ботов

### Обновить все боты

```bash
./deploy.sh fly
```

### Обновить конкретный бот

```bash
flyctl deploy --app loyalitybot-admin
flyctl deploy --app loyalitybot-partner
flyctl deploy --app loyalitybot-client
```

---

## 📊 Проверка статуса

```bash
# Статус всех ботов
flyctl status --app loyalitybot-admin
flyctl status --app loyalitybot-partner
flyctl status --app loyalitybot-client

# Логи
flyctl logs --app loyalitybot-admin
flyctl logs --app loyalitybot-partner
flyctl logs --app loyalitybot-client
```

---

## 🛑 Остановка ботов

```bash
flyctl apps suspend loyalitybot-admin
flyctl apps suspend loyalitybot-partner
flyctl apps suspend loyalitybot-client
```

---

## ▶️ Запуск ботов

```bash
flyctl apps resume loyalitybot-admin
flyctl apps resume loyalitybot-partner
flyctl apps resume loyalitybot-client
```

---

## 💰 Стоимость

**Бесплатный план Fly.io:**
- ✅ 3 VM бесплатно (как раз для 3 ботов!)
- ✅ 160 GB исходящего трафика/месяц
- ✅ 3 shared-cpu-1x (256 MB RAM каждый)

**Если нужно больше:**
- Shared-cpu-1x: $1.94/месяц
- Shared-cpu-2x: $3.88/месяц

---

## 🎯 Автоматический деплой через GitHub Actions

1. Добавьте секрет в GitHub:
   - Settings → Secrets → New secret
   - Name: `FLY_API_TOKEN`
   - Value: получите через `flyctl auth token`

2. При каждом push в `main` боты автоматически задеплоятся!

---

## ⚠️ Важно

1. **Только один экземпляр каждого бота** должен работать одновременно
2. **Не запускайте локальные боты** после деплоя на Fly.io
3. **Проверяйте логи** после деплоя: `flyctl logs --app loyalitybot-admin`

---

**Готово!** Ваши боты теперь работают в облаке! 🎉

