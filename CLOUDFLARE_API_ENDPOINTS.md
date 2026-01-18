# REST API Endpoints - Cloudflare Workers

**URL:** `https://loyalitybot-api.aerasun3000.workers.dev`

---

## ✅ Реализованные эндпоинты

### 1. Health Check
- **GET** `/health`
- **Описание:** Проверка работоспособности API
- **Ответ:** `{"status": "ok"}`

### 2. Получить баланс клиента
- **GET** `/clients/:client_chat_id/balance`
- **Описание:** Возвращает текущий баланс бонусных баллов клиента
- **Ответ:** 
  ```json
  {
    "client_chat_id": "123456789",
    "balance": 150
  }
  ```

### 3. Создать транзакцию
- **POST** `/transactions`
- **Описание:** Начисление или списание бонусных баллов
- **Тело запроса:**
  ```json
  {
    "client_chat_id": "123456789",
    "partner_chat_id": "987654321",
    "txn_type": "accrual",  // или "spend"
    "amount": 1000
  }
  ```
- **Ответ:**
  ```json
  {
    "success": true,
    "new_balance": 150,
    "points": 50
  }
  ```

### 4. Обмен баллов на акцию
- **POST** `/api/redeem-promotion`
- **Описание:** Подготавливает обмен баллов для акции (частичная оплата)
- **Тело запроса:**
  ```json
  {
    "client_chat_id": "123456789",
    "promotion_id": 123,
    "points_to_spend": 50
  }
  ```
- **Ответ:**
  ```json
  {
    "success": true,
    "current_balance": 150,
    "points_to_spend": 50,
    "points_value_usd": 50.0,
    "service_price": 100.0,
    "cash_payment": 50.0,
    "qr_data": "PROMOTION:123:123456789:50:50.00"
  }
  ```

### 5. AI перевод текста
- **POST** `/api/translate`
- **Описание:** Переводит текст с одного языка на другой используя OpenAI
- **Тело запроса:**
  ```json
  {
    "text": "Привет, мир!",
    "target_lang": "en",
    "source_lang": "ru"
  }
  ```
- **Ответ:**
  ```json
  {
    "success": true,
    "translated_text": "Hello, world!",
    "original_text": "Привет, мир!",
    "source_lang": "ru",
    "target_lang": "en"
  }
  ```
- **Требует:** `OPENAI_API_KEY` в секретах

### 6. Отправить QR-код партнеру
- **POST** `/send-qr-to-partner`
- **Описание:** Отправляет QR-код клиента партнеру через Telegram
- **Content-Type:** `multipart/form-data`
- **Параметры:**
  - `qr_image` (File) - Изображение QR-кода
  - `client_chat_id` (String) - Chat ID клиента
  - `partner_chat_id` (String, optional) - Chat ID партнера
  - `partner_username` (String, optional) - Username партнера
  - `service_title` (String, optional) - Название услуги
- **Ответ:**
  ```json
  {
    "success": true
  }
  ```
- **Требует:** `TOKEN_PARTNER` в секретах

### 7. Sentry Webhook
- **POST** `/api/sentry-webhook`
- **Описание:** Получение уведомлений от Sentry и отправка в Telegram
- **Тело запроса:** JSON от Sentry
- **Ответ:**
  ```json
  {
    "status": "ok",
    "message": "Alert sent to Telegram"
  }
  ```
- **Требует:** `ADMIN_BOT_TOKEN`, `ADMIN_CHAT_ID` в секретах

### 8. Карта доступности районов
- **GET** `/api/district-availability?city=New York`
- **Описание:** Возвращает карту доступности всех позиций (район × сфера услуг)
- **Параметры:**
  - `city` (query, optional) - Город (по умолчанию "New York")
- **Ответ:**
  ```json
  {
    "Manhattan Downtown": {
      "nail_care": "taken",
      "hair_salon": "available",
      "massage": "pending"
    },
    "Brooklyn Downtown": {
      ...
    }
  }
  ```

---

## 🔐 Требуемые секреты

Все секреты настраиваются через `wrangler secret put`:

```bash
cd cloudflare/workers/api

# Обязательные
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_KEY
wrangler secret put TOKEN_PARTNER

# Для переводов
wrangler secret put OPENAI_API_KEY

# Для Sentry webhook
wrangler secret put ADMIN_BOT_TOKEN
wrangler secret put ADMIN_CHAT_ID

# Опциональные
wrangler secret put SENTRY_WEBHOOK_SECRET
```

---

## 📝 Примечания

- Все эндпоинты поддерживают CORS
- Эндпоинты возвращают JSON
- Ошибки возвращаются с соответствующими HTTP статусами (400, 500)
- Rate limiting не реализован (можно добавить через Cloudflare Rate Limiting)

---

## 🧪 Тестирование

```bash
# Health check
curl https://loyalitybot-api.aerasun3000.workers.dev/health

# Получить баланс
curl https://loyalitybot-api.aerasun3000.workers.dev/clients/123456789/balance

# Перевод
curl -X POST https://loyalitybot-api.aerasun3000.workers.dev/api/translate \
  -H "Content-Type: application/json" \
  -d '{"text": "Привет", "target_lang": "en", "source_lang": "ru"}'

# Карта доступности
curl "https://loyalitybot-api.aerasun3000.workers.dev/api/district-availability?city=New%20York"
```
