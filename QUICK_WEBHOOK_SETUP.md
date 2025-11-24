# 🚀 Быстрая настройка Sentry Webhook

## Вариант 1: Автоматическая настройка через API (рекомендуется)

### Шаг 1: Получите Sentry API Token

1. Откройте: https://sentry.io/settings/account/api/auth-tokens/
2. Нажмите **"Create New Token"**
3. Название: `Webhook Setup`
4. Права (scopes):
   - ✅ `org:read`
   - ✅ `project:read` 
   - ✅ `project:write`
5. Нажмите **"Create Token"**
6. **Скопируйте токен** (показывается только один раз!)

### Шаг 2: Добавьте переменные в .env

```bash
# Откройте .env и добавьте:
SENTRY_ORG=your-org-slug          # Slug вашей организации (из URL Sentry)
SENTRY_PROJECT=python              # Slug проекта (обычно "python")
SENTRY_API_TOKEN=your_token_here   # Токен из шага 1
WEBHOOK_URL=https://your-domain.com/api/sentry-webhook
```

**Как найти ORG и PROJECT:**
- Откройте ваш проект в Sentry
- URL будет: `https://sentry.io/organizations/ORG-SLUG/projects/PROJECT-SLUG/`
- Например: `https://sentry.io/organizations/my-org/projects/python/`
  - ORG-SLUG = `my-org`
  - PROJECT-SLUG = `python`

### Шаг 3: Запустите скрипт

```bash
python setup_sentry_webhook.py
```

---

## Вариант 2: Ручная настройка через UI (5 минут)

### Шаг 1: Откройте Sentry Dashboard

1. https://sentry.io/ → Ваш проект

### Шаг 2: Настройте Webhook

1. **Settings** (⚙️) → **Integrations**
2. Найдите **Webhooks** → **Configure** или **Add to Project**
3. Заполните:
   - **Callback URL**: `https://your-domain.com/api/sentry-webhook`
     - Для тестирования: используйте ngrok (`ngrok http 8003`)
   - **Secret** (опционально): значение из `.env` → `SENTRY_WEBHOOK_SECRET`
4. **Save Changes**

### Шаг 3: Создайте Alert Rule

1. **Alerts** → **Create Alert**
2. **When**: 
   - ✅ `An issue is first seen`
   - ✅ `An issue changes state from resolved to unresolved`
3. **Then perform these actions**:
   - Выберите **"Send a notification via Webhooks"**
   - Выберите ваш webhook
4. **Save Alert Rule**

### Шаг 4: Тестирование

```bash
# Вызовите тестовую ошибку
curl http://127.0.0.1:8003/sentry-debug

# Проверьте:
# 1. Sentry Dashboard - должна появиться ошибка
# 2. Telegram - должно прийти уведомление
```

---

## 🔧 Для тестирования (ngrok)

Если у вас нет публичного URL:

```bash
# Установите ngrok
brew install ngrok

# Запустите туннель
ngrok http 8003

# Скопируйте HTTPS URL (например: https://abc123.ngrok.io)
# Используйте его в WEBHOOK_URL:
# WEBHOOK_URL=https://abc123.ngrok.io/api/sentry-webhook
```

**Важно:** ngrok URL меняется при каждом перезапуске. Для продакшена используйте постоянный домен.

---

## ✅ Проверка работы

### 1. Проверка webhook endpoint

```bash
curl -X POST http://127.0.0.1:8003/api/sentry-webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# Должен вернуть: {"status":"ok","message":"Alert sent to Telegram"}
```

### 2. Проверка Telegram

- Откройте Telegram
- Найдите бота (токен из `SENTRY_ALERT_TELEGRAM_TOKEN`)
- Проверьте что приходят уведомления

### 3. Тестовая ошибка

```bash
curl http://127.0.0.1:8003/sentry-debug
```

---

## 🐛 Troubleshooting

### Webhook не получает запросы

1. Проверьте что URL правильный и доступен из интернета
2. Проверьте логи: `tail -f logs/secure_api.log`
3. Убедитесь что сервер запущен: `curl http://127.0.0.1:8003/health`

### Уведомления не приходят в Telegram

1. Проверьте переменные: `grep SENTRY_ALERT .env`
2. Проверьте что бот запущен
3. Проверьте chat_id правильный

### Ошибка 401 (Invalid signature)

- Убедитесь что `SENTRY_WEBHOOK_SECRET` одинаковый в Sentry и `.env`
- Или отключите проверку (оставьте Secret пустым)

---

## 📞 Нужна помощь?

См. подробную инструкцию: `SETUP_SENTRY_WEBHOOKS.md`


