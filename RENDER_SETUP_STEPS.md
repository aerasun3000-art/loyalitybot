# 📋 Пошаговая настройка Render

## ⚠️ ВАЖНО: Измените Language!

Сейчас у вас выбрано **"Docker"**, но нужно **"Python"**!

---

## 🔧 Шаги настройки

### 1. Измените Language

- Нажмите на выпадающий список **"Language"** (сейчас "Docker")
- Выберите **"Python"**

После этого появятся дополнительные поля.

---

### 2. Заполните команды

После выбора Python появятся поля:

**Build Command:**
```
pip install -r requirements.txt
```

**Start Command:**
```
uvicorn secure_api:app --host 0.0.0.0 --port $PORT
```

---

### 3. Добавьте переменные окружения

Нажмите кнопку **"Advanced"** или найдите раздел **"Environment Variables"**

Добавьте переменные (по одной):

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

### 4. Нажмите "Deploy Web Service"

После заполнения всех полей нажмите кнопку **"Deploy Web Service"** внизу формы.

---

## ✅ После деплоя

Render покажет URL вида:
```
https://loyalitybot.onrender.com
```

Используйте его для webhook в Sentry:
```
https://loyalitybot.onrender.com/api/sentry-webhook
```

---

*Главное - измените Language с Docker на Python!*


