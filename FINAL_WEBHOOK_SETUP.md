# ✅ Финальная настройка Sentry Webhook

## 🎯 Текущий статус

- ✅ **API Token**: добавлен в `.env`
- ✅ **Organization**: `ghbi`
- ✅ **Project**: `python`
- ✅ **Webhook endpoint**: готов (`/api/sentry-webhook`)
- ⚠️ **Нужен**: публичный URL для webhook

---

## 🚀 Быстрая настройка через Sentry UI (5 минут)

### Шаг 1: Откройте Sentry Dashboard

1. Перейдите на: https://sentry.io/organizations/ghbi/projects/python/
2. Войдите в аккаунт

### Шаг 2: Настройте Webhook

1. В левом меню: **⚙️ Settings** → **Integrations**
2. Найдите **Webhooks** → **Configure** или **Add to Project**
3. Заполните форму:

   **Callback URL:**
   ```
   https://your-domain.com/api/sentry-webhook
   ```
   
   **Для тестирования используйте:**
   - Установите cloudflared: `brew install cloudflared`
   - Запустите: `cloudflared tunnel --url http://127.0.0.1:8003`
   - Скопируйте HTTPS URL
   - Используйте: `https://abc123.trycloudflare.com/api/sentry-webhook`
   
   **Secret (опционально):**
   - Скопируйте из `.env`: `grep SENTRY_WEBHOOK_SECRET .env`
   - Или оставьте пустым

4. Нажмите **Save Changes**

### Шаг 3: Создайте Alert Rule

1. **Alerts** → **Create Alert**
2. Выберите тип: **Issues**

   **When:**
   - ✅ `An issue is first seen`
   - ✅ `An issue changes state from resolved to unresolved`

   **Then:**
   - Выберите **"Send a notification via Webhooks"**
   - Выберите ваш webhook

3. Нажмите **Save Alert Rule**

### Шаг 4: Тестирование

```bash
# Вызовите тестовую ошибку
curl http://127.0.0.1:8003/sentry-debug

# Проверьте:
# 1. Sentry Dashboard → Issues - должна появиться ошибка
# 2. Telegram - должно прийти уведомление
```

---

## 🔧 Альтернатива: Cloudflare Tunnel

Если хотите автоматический публичный URL:

```bash
# Установите cloudflared
brew install cloudflared

# Запустите туннель
cloudflared tunnel --url http://127.0.0.1:8003

# Скопируйте HTTPS URL (например: https://abc123.trycloudflare.com)
# Используйте: https://abc123.trycloudflare.com/api/sentry-webhook
```

Затем запустите:
```bash
python setup_webhook_direct.py
# Введите URL когда попросит
```

---

## 📋 Проверка работы

### 1. Проверка webhook endpoint

```bash
curl -X POST http://127.0.0.1:8003/api/sentry-webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# Должен вернуть: {"status":"ok","message":"Alert sent to Telegram"}
```

### 2. Проверка Telegram

- Откройте Telegram
- Найдите бота (токен из `.env`)
- Проверьте что приходят уведомления

---

## ✅ Готово!

После настройки все критические ошибки будут автоматически отправляться в Telegram!

---

*Все данные уже настроены в `.env`, осталось только добавить webhook URL в Sentry Dashboard*


