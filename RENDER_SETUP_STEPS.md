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
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
```

```
SUPABASE_KEY=YOUR_SUPABASE_ANON_KEY_HERE
```

```
SENTRY_DSN=YOUR_SENTRY_DSN_HERE
```

```
SENTRY_ENVIRONMENT=production
```

```
SENTRY_ALERT_TELEGRAM_TOKEN=YOUR_BOT_TOKEN_HERE
```

```
SENTRY_ALERT_CHAT_ID=YOUR_CHAT_ID_HERE
```

```
SENTRY_WEBHOOK_SECRET=YOUR_SENTRY_WEBHOOK_SECRET_HERE
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


