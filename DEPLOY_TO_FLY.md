# 🚀 Деплой на Fly.io (Альтернатива Render)

## ✅ Почему Fly.io лучше Render

- ✅ **Не засыпает** (в отличие от Render)
- ✅ **Бесплатный план** с 3 VM
- ✅ **Быстрее** первый запрос
- ✅ **Проще** настройка (один файл конфигурации)

---

## 📋 Быстрый старт (5 минут)

### Шаг 1: Установите flyctl

```bash
# macOS
brew install flyctl

# Или через curl
curl -L https://fly.io/install.sh | sh
```

### Шаг 2: Войдите в Fly.io

```bash
flyctl auth login
```

Откроется браузер для авторизации.

---

### Шаг 3: Инициализируйте проект

```bash
cd /Users/ghbi/Downloads/loyalitybot
flyctl launch
```

Fly.io спросит:
- **App name**: `loyalitybot-api` (или любой другой)
- **Region**: выберите ближайший (например, `ams` для Амстердама)
- **Postgres**: No (у вас уже есть Supabase)
- **Redis**: No (не нужно)

---

### Шаг 4: Настройте переменные окружения

```bash
flyctl secrets set SUPABASE_URL=ваш_supabase_url
flyctl secrets set SUPABASE_KEY=ваш_supabase_key
flyctl secrets set SENTRY_DSN=ваш_sentry_dsn
flyctl secrets set SENTRY_ENVIRONMENT=production
flyctl secrets set SENTRY_ALERT_TELEGRAM_TOKEN=ваш_telegram_token
flyctl secrets set SENTRY_ALERT_CHAT_ID=ваш_chat_id
flyctl secrets set SENTRY_WEBHOOK_SECRET=ваш_webhook_secret
flyctl secrets set APP_VERSION=1.0.0
flyctl secrets set LOG_LEVEL=INFO
```

---

### Шаг 5: Задеплойте

```bash
flyctl deploy
```

---

### Шаг 6: Получите URL

```bash
flyctl status
```

URL будет: `https://loyalitybot-api.fly.dev`

---

## 🔧 Конфигурация (fly.toml)

Fly.io создаст файл `fly.toml` автоматически. Если нужно настроить вручную:

```toml
app = "loyalitybot-api"
primary_region = "ams"

[build]
  builder = "paketobuildpacks/builder:base"

[env]
  PORT = "8080"

[[services]]
  internal_port = 8080
  protocol = "tcp"

  [[services.ports]]
    port = 80
    handlers = ["http"]
    force_https = true

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

  [services.concurrency]
    type = "requests"
    hard_limit = 25
    soft_limit = 20

  [[services.http_checks]]
    interval = "10s"
    timeout = "2s"
    grace_period = "5s"
    method = "GET"
    path = "/health"
```

---

## ✅ Проверка работы

### 1. Health Check

```bash
curl https://loyalitybot-api.fly.dev/health
```

### 2. Swagger UI

Откройте: `https://loyalitybot-api.fly.dev/docs`

---

## 💰 Стоимость

**Бесплатный план:**
- 3 shared-cpu-1x VM
- 3GB persistent volumes
- 160GB outbound data transfer

**Для вашего API этого более чем достаточно!**

---

## 🎯 Преимущества перед Render

1. **Не засыпает** - сервис всегда доступен
2. **Быстрее** - нет задержки на "пробуждение"
3. **Проще** - один файл конфигурации
4. **Надёжнее** - меньше проблем с PATH и venv

---

## 📚 Дополнительно

- [Fly.io Docs](https://fly.io/docs/)
- [Fly.io Pricing](https://fly.io/docs/about/pricing/)

---

*Fly.io - отличная альтернатива Render!*

