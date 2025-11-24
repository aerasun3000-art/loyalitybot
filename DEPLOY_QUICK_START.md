# ⚡ Быстрый деплой на Railway (5 минут)

## 🚀 Пошаговая инструкция

### 1. Подготовка (уже готово ✅)

- ✅ `Procfile` создан
- ✅ `requirements.txt` готов
- ✅ `secure_api.py` готов

---

### 2. Создайте проект на Railway

1. Откройте: https://railway.app
2. Нажмите **"Start a New Project"**
3. Войдите через **GitHub**
4. Выберите **"Deploy from GitHub repo"**
5. Выберите репозиторий `loyalitybot`

---

### 3. Добавьте переменные окружения

В Railway Dashboard → ваш проект → **Variables**:

**Скопируйте из вашего `.env`:**

```bash
# Получите значения
cd /Users/ghbi/Downloads/loyalitybot
grep -E "SUPABASE_URL|SUPABASE_KEY|SENTRY_DSN|SENTRY_ALERT" .env
```

**Добавьте в Railway:**
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `SENTRY_DSN`
- `SENTRY_ENVIRONMENT=production`
- `SENTRY_ALERT_TELEGRAM_TOKEN`
- `SENTRY_ALERT_CHAT_ID`
- `SENTRY_WEBHOOK_SECRET`

---

### 4. Дождитесь деплоя

Railway автоматически:
- Определит Python проект
- Установит зависимости
- Запустит сервер

**Время:** ~2-3 минуты

---

### 5. Получите URL

После деплоя Railway покажет URL:
```
https://your-app-name.up.railway.app
```

**Ваш webhook URL:**
```
https://your-app-name.up.railway.app/api/sentry-webhook
```

---

### 6. Настройте Sentry

1. Вернитесь в Sentry → Alert Rule
2. В блоке **THEN** → **Add action** → **Webhook**
3. Укажите URL из шага 5
4. Сохраните

---

## ✅ Готово!

Теперь все ошибки будут автоматически отправляться в Telegram!

---

## 🔍 Проверка

```bash
# Health check
curl https://your-app-name.up.railway.app/health

# Swagger UI
open https://your-app-name.up.railway.app/docs

# Тест Sentry
curl https://your-app-name.up.railway.app/sentry-debug
```

---

*Подробная инструкция: `DEPLOY_TO_RAILWAY.md`*


