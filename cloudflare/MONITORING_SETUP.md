# 🔔 Мониторинг Cloudflare Workers — Полное руководство

## ✅ Что настроено

### 1. **Sentry интеграция**
- ✅ Модуль `utils/sentry.js` для отправки ошибок
- ✅ Интеграция во все webhook handlers (client, partner, admin)
- ✅ Автоматический трекинг производительности
- ✅ Контекстная информация (request, update, stack trace)

### 2. **Мониторинг производительности**
- ✅ Трекинг времени выполнения запросов
- ✅ Автоматическая отправка медленных запросов (>1s) в Sentry
- ✅ Метрики для успешных и ошибочных запросов

---

## 🚀 Настройка

### Шаг 1: Добавить Sentry DSN в Workers

Для каждого Worker нужно добавить секреты:

```bash
# Client Webhook
cd cloudflare/workers/client-webhook
wrangler secret put SENTRY_DSN
# Введите: https://bcb0ae7907d2c03b4be2507334a93db9@o4510368013877248.ingest.us.sentry.io/4510368037470208

wrangler secret put SENTRY_ENVIRONMENT
# Введите: production

# Partner Webhook
cd ../partner-webhook
wrangler secret put SENTRY_DSN
wrangler secret put SENTRY_ENVIRONMENT

# Admin Webhook
cd ../admin-webhook
wrangler secret put SENTRY_DSN
wrangler secret put SENTRY_ENVIRONMENT
```

### Шаг 2: Развернуть обновлённые Workers

```bash
# Deploy всех Workers
cd cloudflare/workers/client-webhook
wrangler deploy

cd ../partner-webhook
wrangler deploy

cd ../admin-webhook
wrangler deploy
```

---

## 📊 Что отслеживается

### Автоматически:

1. **Все ошибки**:
   - Ошибки парсинга запросов
   - Ошибки обработки update
   - Ошибки Supabase
   - Ошибки валидации webhook

2. **Производительность**:
   - Время выполнения запросов
   - Медленные запросы (>1s)
   - Ошибочные запросы

3. **Контекст**:
   - URL запроса
   - Метод (POST, OPTIONS)
   - Telegram update_id
   - Chat ID (если доступен)
   - Stack trace ошибок

### Фильтрация:

- Отправляются только **ошибки** (не info/warning)
- Медленные запросы отправляются с sample rate 10%
- Быстрые запросы (<1s) не отправляются

---

## 🔍 Cloudflare Dashboard — Аналитика

### 1. Real-time Logs

**Где:** Workers & Pages → [Worker Name] → Logs

**Что видно:**
- Все console.log/error в реальном времени
- Запросы и ответы
- Ошибки обработки

**Как использовать:**
1. Откройте Logs
2. Фильтруйте по `[ERROR]` для поиска ошибок
3. Фильтруйте по `[Sentry]` для отправок в Sentry

### 2. Analytics

**Где:** Workers & Pages → [Worker Name] → Analytics

**Что видно:**
- Количество запросов (requests)
- Успешные запросы (200 OK)
- Ошибки (5xx, 4xx)
- Время ответа (p50, p95, p99)
- Bandwidth

### 3. Metrics

**Кастомные метрики:**
- `webhook.client` — успешные запросы клиентского бота
- `webhook.client.error` — ошибочные запросы клиентского бота
- `webhook.partner` — успешные запросы партнёрского бота
- `webhook.partner.error` — ошибочные запросы партнёрского бота
- `webhook.admin` — успешные запросы админ-бота
- `webhook.admin.error` — ошибочные запросы админ-бота

---

## 🛡️ Безопасность — WAF правила

### Защита Webhooks от поддельных запросов

1. **Откройте Cloudflare Dashboard** → Security → WAF
2. **Create Rule** → **Custom Rule**
3. **Название:** `Block non-Telegram webhook requests`
4. **Логика:**

```
(http.request.uri.path contains "/webhook" or http.request.uri.path contains "/client-webhook" or http.request.uri.path contains "/partner-webhook" or http.request.uri.path contains "/admin-webhook") 
and 
not (ip.src.asnum in {62041 59930})
```

5. **Action:** Block
6. **Save**

**Что делает:**
- Разрешает запросы только от IP Telegram (ASN 62041, 59930)
- Блокирует все остальные запросы к webhook endpoints

---

## 📬 Настройка алертов

### Cloudflare Alerts

1. **Notifications** → Create
2. **Name:** `Worker Error Rate`
3. **Trigger:** 
   - Worker error rate > 5% за 5 минут
4. **Notification:** Email/Telegram/Slack

### Sentry Alerts

1. **Sentry Dashboard** → Settings → Alerts
2. **Create Alert Rule**
3. **Conditions:**
   - New Issue Created
   - Issue Count > 10 за час
   - Error Rate Spike
4. **Actions:**
   - Send Email
   - Send to Telegram (через интеграцию)
   - Send to Slack

---

## 🧪 Тестирование мониторинга

### Тест 1: Отправить ошибку вручную

```bash
# Создать тестовый запрос, который вызовет ошибку
curl -X POST https://loyalitybot-client-webhook.xxx.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"invalid": "json"}'
```

**Проверьте:**
1. Cloudflare Logs — должна появиться ошибка
2. Sentry — должно появиться событие через 10-30 секунд

### Тест 2: Проверить производительность

```bash
# Отправить нормальный запрос
curl -X POST https://loyalitybot-client-webhook.xxx.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"update_id": 123, "message": {"chat": {"id": 1}, "text": "/start"}}'
```

**Проверьте:**
1. Cloudflare Analytics — должен быть 200 OK
2. Sentry — если запрос медленный (>1s), появится метрика

### Тест 3: Проверить WAF правило

```bash
# Попробовать отправить с другого IP (должно быть заблокировано)
curl -X POST https://loyalitybot-client-webhook.xxx.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"test": "blocked"}'
```

**Проверьте:**
1. Cloudflare → Security → Events
2. Должна быть запись о блокировке

---

## 📈 Дашборды

### Cloudflare Dashboard

**Основные метрики:**
- Requests/day
- Error rate
- Response time
- Top errors

**Где:** Workers & Pages → [Worker] → Analytics

### Sentry Dashboard

**Основные метрики:**
- Issues (ошибки)
- Events (количество событий)
- Performance (производительность)
- Users affected

**Где:** https://sentry.io/ → Projects → loyaltybot-bots

---

## 🔧 Troubleshooting

### Ошибки не появляются в Sentry

**Проверьте:**
1. SENTRY_DSN установлен:
   ```bash
   wrangler secret list
   ```

2. SENTRY_DSN правильный формат:
   ```
   https://xxx@o123456.ingest.sentry.io/789
   ```

3. Worker логи показывают ошибки:
   ```bash
   wrangler tail
   ```

### Слишком много событий в Sentry

**Решение:** Увеличьте фильтрацию в `utils/sentry.js`:

```javascript
// В sendToSentry добавить проверку
if (error.message.includes('ExpectedError')) {
  return; // Не отправлять
}
```

### Медленные запросы не отслеживаются

**Проверьте:**
1. Sample rate (по умолчанию 10%)
2. Порог отправки (по умолчанию >1s)

**Изменить в `utils/sentry.js`:**
```javascript
if (duration < 500 && Math.random() > 0.01) { // 500ms, 1% sample
  return;
}
```

---

## 📚 Дополнительные ресурсы

- [Cloudflare Workers Logs](https://developers.cloudflare.com/workers/observability/logs/)
- [Cloudflare Analytics](https://developers.cloudflare.com/workers/observability/analytics/)
- [Sentry JavaScript SDK](https://docs.sentry.io/platforms/javascript/)
- [Cloudflare WAF](https://developers.cloudflare.com/waf/)

---

## ✅ Checklist настройки

- [ ] SENTRY_DSN добавлен во все Workers
- [ ] SENTRY_ENVIRONMENT добавлен во все Workers
- [ ] Workers развёрнуты с новой версией
- [ ] WAF правила настроены
- [ ] Cloudflare алерты настроены
- [ ] Sentry алерты настроены
- [ ] Тестирование выполнено
- [ ] Дашборды проверены

---

**Поздравляем! 🎉 Мониторинг полностью настроен!**
