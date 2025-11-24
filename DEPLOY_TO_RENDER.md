# 🚀 Деплой на Render (Бесплатно!)

## ⚡ Быстрый старт (5 минут)

### Шаг 1: Создайте аккаунт на Render

1. Перейдите: https://render.com
2. Нажмите **"Get Started for Free"**
3. Войдите через **GitHub**

---

### Шаг 2: Создайте Web Service

1. В Dashboard нажмите **"New +"**
2. Выберите **"Web Service"**
3. Нажмите **"Connect account"** рядом с GitHub
4. Выберите репозиторий **`loyalitybot`**

---

### Шаг 3: Настройте сервис

**Основные настройки:**
- **Name**: `loyalitybot-api`
- **Region**: `Oregon (US West)` (или ближайший к вам)
- **Branch**: `main`
- **Root Directory**: (оставьте пустым)
- **Runtime**: `Python 3`
- **Build Command**: 
  ```
  pip install -r requirements.txt
  ```
- **Start Command**: 
  ```
  uvicorn secure_api:app --host 0.0.0.0 --port $PORT
  ```

---

### Шаг 4: Добавьте переменные окружения

В разделе **"Environment Variables"** добавьте:

```
SUPABASE_URL=https://gynpvfchojnyoirosysj.supabase.co
```

```
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5bnB2ZmNob2pueW9pcm9zeXNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2NTExMzksImV4cCI6MjA3NjIyNzEzOX0.Lw-DG19z7ZNoiu1k0jLO8A7SmylhHPfA596qg0a88qk
```

```
SENTRY_DSN=https://e56e38258c00163c53cd92c4d772680e@o4510368013877248.ingest.us.sentry.io/4510368109297664
```

```
SENTRY_ENVIRONMENT=production
```

```
SENTRY_ALERT_TELEGRAM_TOKEN=8167568746:AAFQJ4ovbbvvDPBzuDjsC33KRirLgQ6MNBM
```

```
SENTRY_ALERT_CHAT_ID=406631153
```

```
SENTRY_WEBHOOK_SECRET=991d8cc952f1d3334a5184409c75193a2a56651c9d4935da4918f6c7b0f3c47a
```

```
APP_VERSION=1.0.0
```

```
LOG_LEVEL=INFO
```

---

### Шаг 5: Задеплойте

1. Нажмите **"Create Web Service"**
2. Render начнёт деплой автоматически
3. Дождитесь завершения (~3-5 минут)

---

### Шаг 6: Получите URL

После деплоя Render покажет:

**URL будет:**
```
https://loyalitybot-api.onrender.com
```

**Ваш Webhook URL:**
```
https://loyalitybot-api.onrender.com/api/sentry-webhook
```

---

### Шаг 7: Настройте Sentry

1. Вернитесь в Sentry → Alert Rule
2. В блоке **THEN** → webhook action
3. Укажите URL:
   ```
   https://loyalitybot-api.onrender.com/api/sentry-webhook
   ```
4. Сохраните

---

## ✅ Готово!

Теперь:
- ✅ API работает на публичном URL
- ✅ Webhook настроен
- ✅ Ошибки отправляются в Telegram

---

## 🔍 Проверка

```bash
# Health check
curl https://loyalitybot-api.onrender.com/health

# Swagger UI
open https://loyalitybot-api.onrender.com/docs

# Тест Sentry
curl https://loyalitybot-api.onrender.com/sentry-debug
```

---

## ⚠️ Важно про Render

**"Сон" сервиса:**
- На бесплатном плане сервис "засыпает" после 15 минут бездействия
- Первый запрос после "сна" может занять 30-60 секунд
- Это нормально для webhook - Sentry будет "будить" сервис

**Если нужен постоянный "бодрствующий" сервис:**
- Upgrade to Starter ($7/месяц)
- Или используйте другой хостинг (Fly.io)

---

## 💰 Стоимость

- **Бесплатный план**: Достаточно для webhook
- **Starter**: $7/месяц (если нужен постоянный "бодрствующий" сервис)

---

*Render - отличный выбор для бесплатного деплоя!*


