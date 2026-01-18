# 🔄 Backup Webhook URLs для клиентского бота

**Дата создания backup:** 2026-01-18  
**Статус:** Backup создан перед миграцией на Cloudflare

---

## 📋 Текущий webhook (Cloudflare)

**Дата настройки:** 2026-01-18  
**Провайдер:** Cloudflare Workers  
**URL:** `https://loyalitybot-client-webhook.aerasun3000.workers.dev`

**Статус:** ✅ Активен

**Проверка:**
```bash
curl -s "https://api.telegram.org/bot<TOKEN_CLIENT>/getWebhookInfo"
```

**Результат последней проверки (2026-01-18):**
```json
{
    "ok": true,
    "result": {
        "url": "https://loyalitybot-client-webhook.aerasun3000.workers.dev",
        "has_custom_certificate": false,
        "pending_update_count": 0,
        "max_connections": 40,
        "ip_address": "172.67.152.143"
    }
}
```

---

## 📋 Предыдущий метод (Long Polling на Fly.io)

**Дата настройки:** До 2026-01-18  
**Провайдер:** Fly.io  
**Метод:** Long Polling (не webhook)  
**Приложение:** `loyalitybot-client`  
**Статус:** ⏸️ Остановлен (но не удален)

### Информация о деплое:
- **Регион:** `ewr` (New Jersey)
- **Конфигурация:** `fly.client.toml`
- **Команда запуска:** `python client_handler.py`
- **Память:** 512MB
- **CPU:** 1 shared

### Конфигурация Fly.io:
```
app = "loyalitybot-client"
primary_region = "ewr"
memory_mb = 512
cpus = 1
```

### Если нужно вернуться к Long Polling:

**Шаг 1:** Остановить webhook
```bash
curl -X POST "https://api.telegram.org/bot8309705244:AAFKedHl1YKsNn_TdRDgDq1xUn1BOvnYfDE/deleteWebhook?drop_pending_updates=true"
```

**Шаг 2:** Проверить, что webhook удален
```bash
curl -s "https://api.telegram.org/bot8309705244:AAFKedHl1YKsNn_TdRDgDq1xUn1BOvnYfDE/getWebhookInfo" | python3 -m json.tool
```

**Шаг 3:** Запустить бот на Fly.io
```bash
cd /Users/ghbi/Downloads/loyalitybot
flyctl deploy --config fly.client.toml --app loyalitybot-client
```

**Шаг 4:** Проверить статус бота
```bash
flyctl status --app loyalitybot-client
flyctl logs --app loyalitybot-client
```

---

## 🔄 Инструкция по восстановлению

### Вариант 1: Вернуться к Cloudflare Webhook

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN_CLIENT>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://loyalitybot-client-webhook.aerasun3000.workers.dev"}'
```

### Вариант 2: Вернуться к Long Polling на Fly.io

```bash
# Удалить webhook
curl -X POST "https://api.telegram.org/bot<TOKEN_CLIENT>/deleteWebhook?drop_pending_updates=true"

# Перезапустить бот на Fly.io
cd /Users/ghbi/Downloads/loyalitybot
flyctl deploy --config fly.client.toml --app loyalitybot-client
```

---

## 📝 История изменений

### 2026-01-18: Миграция на Cloudflare Webhooks
- ✅ Установлен webhook: `https://loyalitybot-client-webhook.aerasun3000.workers.dev`
- ✅ Настроены все секреты в Cloudflare
- ⏸️ Long Polling на Fly.io остановлен (но не удален, можно восстановить)
- 📋 Backup создан: `WEBHOOK_BACKUP.md`

### До 2026-01-18: Long Polling на Fly.io
- Работал через Long Polling (`bot.polling()`)
- Регион: New Jersey (ewr)
- Файл: `client_handler.py` (строка 2270: `client_bot.polling()`)

---

## ⚠️ Важные заметки

1. **Не удаляйте** конфигурацию Fly.io — она может понадобиться для отката
2. **Сохраните токен бота** в безопасном месте
3. **Мониторьте логи** при переходе между методами

---

## 🔐 Секреты Cloudflare Worker

Если нужно восстановить worker, настроены следующие секреты:
- `TOKEN_CLIENT` - Токен клиентского бота
- `SUPABASE_URL` - URL Supabase проекта  
- `SUPABASE_KEY` - Supabase API key
- `FRONTEND_URL` - URL фронтенда
- `WELCOME_BONUS_AMOUNT` - 80 баллов

**Настройка секретов:**
```bash
cd cloudflare/workers/client-webhook
wrangler secret put TOKEN_CLIENT
# и так далее...
```

---

**Дата создания:** 2026-01-18  
**Версия:** 1.0
