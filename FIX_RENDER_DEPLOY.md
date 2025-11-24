# 🔧 Исправление деплоя на Render

## ❌ Текущие проблемы

1. **Ошибка:** `gunicorn: command not found`
   - Render пытается запустить gunicorn по умолчанию
   - Нужно использовать uvicorn для FastAPI

2. **Переменные окружения не добавлены**
   - Без них сервис не сможет работать

---

## ✅ Как исправить

### Шаг 1: Исправьте Start Command

1. В Render Dashboard → ваш сервис **"loyalitybot"**
2. Перейдите в **Settings**
3. Найдите раздел **"Start Command"**
4. Измените на:
   ```
   uvicorn secure_api:app --host 0.0.0.0 --port $PORT
   ```
5. Сохраните изменения

---

### Шаг 2: Добавьте переменные окружения

1. В том же разделе **Settings**
2. Найдите **"Environment Variables"**
3. Нажмите **"Add Environment Variable"**
4. Добавьте по одной переменной:

**Обязательные:**
```
SUPABASE_URL = https://gynpvfchojnyoirosysj.supabase.co
```

```
SUPABASE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5bnB2ZmNob2pueW9pcm9zeXNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2NTExMzksImV4cCI6MjA3NjIyNzEzOX0.Lw-DG19z7ZNoiu1k0jLO8A7SmylhHPfA596qg0a88qk
```

```
SENTRY_DSN = https://e56e38258c00163c53cd92c4d772680e@o4510368013877248.ingest.us.sentry.io/4510368109297664
```

```
SENTRY_ENVIRONMENT = production
```

**Для Telegram алертов:**
```
SENTRY_ALERT_TELEGRAM_TOKEN = 8167568746:AAFQJ4ovbbvvDPBzuDjsC33KRirLgQ6MNBM
```

```
SENTRY_ALERT_CHAT_ID = 406631153
```

```
SENTRY_WEBHOOK_SECRET = 991d8cc952f1d3334a5184409c75193a2a56651c9d4935da4918f6c7b0f3c47a
```

**Опциональные:**
```
APP_VERSION = 1.0.0
```

```
LOG_LEVEL = INFO
```

---

### Шаг 3: Перезадеплойте

1. После сохранения всех изменений
2. Нажмите **"Manual Deploy"** → **"Deploy latest commit"**
3. Или просто подождите - Render может перезадеплоить автоматически

---

## ✅ После исправления

После успешного деплоя:

1. **Проверьте Health Check:**
   ```bash
   curl https://loyalitybot.onrender.com/health
   ```
   Должен вернуть: `{"status":"ok"}`

2. **Проверьте Swagger UI:**
   ```
   https://loyalitybot.onrender.com/docs
   ```

3. **Используйте для Sentry Webhook:**
   ```
   https://loyalitybot.onrender.com/api/sentry-webhook
   ```

---

## 🐛 Если всё ещё не работает

### Проверьте логи

В Render Dashboard → **Logs** проверьте:
- Есть ли ошибки импорта
- Правильно ли указан Start Command
- Все ли переменные окружения установлены

### Проверьте Build Command

Убедитесь что **Build Command**:
```
pip install -r requirements.txt
```

---

*После исправления Start Command и добавления переменных всё должно заработать!*


