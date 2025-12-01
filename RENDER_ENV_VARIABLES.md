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
- **Value:** `https://YOUR_PROJECT_ID.supabase.co` (найдите в Supabase Dashboard → Settings → API)
- Нажмите **"Save"**

### 2. SUPABASE_KEY
- **Key:** `SUPABASE_KEY`
- **Value:** `YOUR_SUPABASE_ANON_KEY_HERE` (найдите в Supabase Dashboard → Settings → API → anon/public key)
- Нажмите **"Save"**

### 3. SENTRY_DSN
- **Key:** `SENTRY_DSN`
- **Value:** `YOUR_SENTRY_DSN_HERE` (найдите в Sentry Dashboard → Settings → Projects → Client Keys (DSN))
- Нажмите **"Save"**

### 4. SENTRY_ENVIRONMENT
- **Key:** `SENTRY_ENVIRONMENT`
- **Value:** `production`
- Нажмите **"Save"**

### 5. SENTRY_ALERT_TELEGRAM_TOKEN
- **Key:** `SENTRY_ALERT_TELEGRAM_TOKEN`
- **Value:** `YOUR_BOT_TOKEN_HERE` (получите у @BotFather в Telegram)
- Нажмите **"Save"**

### 6. SENTRY_ALERT_CHAT_ID
- **Key:** `SENTRY_ALERT_CHAT_ID`
- **Value:** `YOUR_CHAT_ID_HERE` (получите у @userinfobot в Telegram)
- Нажмите **"Save"**

### 7. SENTRY_WEBHOOK_SECRET
- **Key:** `SENTRY_WEBHOOK_SECRET`
- **Value:** `YOUR_SENTRY_WEBHOOK_SECRET_HERE` (настройте в Sentry Dashboard → Settings → Integrations → Webhooks)
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

