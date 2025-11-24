# 🔧 Добавление переменных окружения в Render

## 📍 Где найти

1. **Render Dashboard** → ваш сервис **"loyalitybot"**
2. В верхнем меню нажмите **"Settings"**
3. Прокрутите вниз до раздела **"Environment Variables"**
4. Нажмите **"Add Environment Variable"**

---

## 📋 Переменные для добавления

Добавьте каждую переменную отдельно:

### 1. SUPABASE_URL
- **Key:** `SUPABASE_URL`
- **Value:** `https://gynpvfchojnyoirosysj.supabase.co`
- Нажмите **"Save"**

### 2. SUPABASE_KEY
- **Key:** `SUPABASE_KEY`
- **Value:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5bnB2ZmNob2pueW9pcm9zeXNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2NTExMzksImV4cCI6MjA3NjIyNzEzOX0.Lw-DG19z7ZNoiu1k0jLO8A7SmylhHPfA596qg0a88qk`
- Нажмите **"Save"**

### 3. SENTRY_DSN
- **Key:** `SENTRY_DSN`
- **Value:** `https://e56e38258c00163c53cd92c4d772680e@o4510368013877248.ingest.us.sentry.io/4510368109297664`
- Нажмите **"Save"**

### 4. SENTRY_ENVIRONMENT
- **Key:** `SENTRY_ENVIRONMENT`
- **Value:** `production`
- Нажмите **"Save"**

### 5. SENTRY_ALERT_TELEGRAM_TOKEN
- **Key:** `SENTRY_ALERT_TELEGRAM_TOKEN`
- **Value:** `8167568746:AAFQJ4ovbbvvDPBzuDjsC33KRirLgQ6MNBM`
- Нажмите **"Save"**

### 6. SENTRY_ALERT_CHAT_ID
- **Key:** `SENTRY_ALERT_CHAT_ID`
- **Value:** `406631153`
- Нажмите **"Save"**

### 7. SENTRY_WEBHOOK_SECRET
- **Key:** `SENTRY_WEBHOOK_SECRET`
- **Value:** `991d8cc952f1d3334a5184409c75193a2a56651c9d4935da4918f6c7b0f3c47a`
- Нажмите **"Save"**

### 8. APP_VERSION (опционально)
- **Key:** `APP_VERSION`
- **Value:** `1.0.0`
- Нажмите **"Save"**

### 9. LOG_LEVEL (опционально)
- **Key:** `LOG_LEVEL`
- **Value:** `INFO`
- Нажмите **"Save"**

---

## ✅ После добавления всех переменных

1. **Сохраните изменения**
2. Render автоматически перезадеплоит сервис
3. Или нажмите **"Manual Deploy"** → **"Deploy latest commit"**

---

## 🔍 Проверка

После деплоя проверьте:

```bash
# Health check
curl https://loyalitybot.onrender.com/health

# Должен вернуть: {"status":"ok"}
```

---

## 💡 Совет

Можно добавить все переменные сразу, а потом сохранить - Render перезадеплоит один раз после всех изменений.

---

*Добавьте все переменные и сервис заработает!*

