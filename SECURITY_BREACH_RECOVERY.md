# 🚨 ВОССТАНОВЛЕНИЕ ПОСЛЕ ВЗЛОМА БОТА

**Дата:** 2026-01-18  
**Статус:** КРИТИЧЕСКИЙ  
**Злоумышленник:** @MISHADOX  
**Метка взлома:** "OWNED BY @MISHADOX", "HACKED BY MISHADOX"

---

## ⚠️ КРИТИЧЕСКИЕ ДЕЙСТВИЯ (СДЕЛАТЬ СЕЙЧАС!)

### ШАГ 1: Отозвать токен (СРОЧНО!)

1. Откройте [@BotFather](https://t.me/BotFather)
2. Отправьте `/mybots`
3. Выберите ваш клиентский бот (mindbeatybot)
4. Выберите **"API Token"**
5. Выберите **"Revoke current token"** (Отозвать текущий токен)
6. Подтвердите действие

**Это немедленно отключит взломанный токен!**

---

### ШАГ 2: Создать новый токен

1. В @BotFather выберите бота
2. Выберите **"API Token"**
3. Выберите **"Generate new token"** (Создать новый токен)
4. Скопируйте новый токен

**⚠️ ВАЖНО:** Сохраните новый токен в безопасном месте!

---

### ШАГ 3: Обновить токен в коде

#### 3.1. Обновить в .env

```bash
cd /Users/ghbi/Downloads/loyalitybot
nano .env
# Или
code .env
```

Найдите строку:
```
TOKEN_CLIENT=старый_токен
```

Замените на:
```
TOKEN_CLIENT=новый_токен
```

#### 3.2. Обновить в Cloudflare секретах

```bash
cd cloudflare/workers/client-webhook
echo "новый_токен" | wrangler secret put TOKEN_CLIENT --env=""
```

#### 3.3. Передеплоить Worker

```bash
cd cloudflare/workers/client-webhook
wrangler deploy --env=""
```

---

### ШАГ 4: Переустановить webhook с защитой

#### 4.1. Сгенерировать новый Secret Token

```bash
# Способ 1 (если установлен openssl):
openssl rand -hex 32

# Способ 2 (через Python):
python3 -c "import secrets; print(secrets.token_hex(32))"
```

#### 4.2. Добавить Secret Token в Cloudflare

```bash
cd cloudflare/workers/client-webhook
echo "сгенерированный_секретный_токен" | wrangler secret put WEBHOOK_SECRET_TOKEN --env=""
```

#### 4.3. Установить webhook с Secret Token

```bash
cd /Users/ghbi/Downloads/loyalitybot
TOKEN="новый_токен"  # Замените на новый токен
SECRET_TOKEN="сгенерированный_секретный_токен"  # Замените на секретный токен

# Удалить старый webhook
curl -X POST "https://api.telegram.org/bot${TOKEN}/deleteWebhook?drop_pending_updates=true"

# Установить новый webhook с защитой
curl -X POST "https://api.telegram.org/bot${TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"https://loyalitybot-client-webhook.aerasun3000.workers.dev\",
    \"secret_token\": \"${SECRET_TOKEN}\",
    \"drop_pending_updates\": true
  }"

# Проверить
curl -s "https://api.telegram.org/bot${TOKEN}/getWebhookInfo" | python3 -m json.tool
```

---

## 🔒 УСИЛЕНИЕ БЕЗОПАСНОСТИ

### 1. Валидация админских команд по user_id

Добавить проверку, что только владелец бота может выполнять админские команды:

```javascript
// В cloudflare/workers/client-webhook/client.js

const BOT_OWNER_USER_ID = '123456789'; // Замените на ваш Telegram user_id

export async function routeUpdate(env, update) {
  // Проверить, что команды выполняет владелец
  if (update.message) {
    const userId = String(update.message.from.id);
    const text = update.message.text || '';
    
    // Админские команды только для владельца
    if (text.startsWith('/admin') || text.startsWith('/delete') || text.startsWith('/config')) {
      if (userId !== BOT_OWNER_USER_ID) {
        await sendTelegramMessage(
          env.TOKEN_CLIENT,
          update.message.chat.id,
          '❌ Доступ запрещен'
        );
        return { success: false, error: 'Unauthorized' };
      }
    }
  }
  
  // ... остальной код
}
```

### 2. Валидация callback_data

Всегда проверяйте callback_data на сервере:

```javascript
export async function routeUpdate(env, update) {
  if (update.callback_query) {
    const callbackData = update.callback_query.data;
    const userId = String(update.callback_query.from.id);
    
    // Проверка на подделку callback_data
    const allowedCallbacks = ['balance', 'nps_rate_0', 'nps_rate_1', ...];
    
    if (!allowedCallbacks.some(allowed => callbackData.startsWith(allowed))) {
      console.error('[Security] Invalid callback_data:', callbackData, 'from user:', userId);
      return { success: false, error: 'Invalid callback' };
    }
    
    // Проверка user_id для чувствительных операций
    if (callbackData.startsWith('delete_') || callbackData.startsWith('admin_')) {
      if (userId !== BOT_OWNER_USER_ID) {
        console.error('[Security] Unauthorized callback from user:', userId);
        return { success: false, error: 'Unauthorized' };
      }
    }
  }
  
  // ... остальной код
}
```

### 3. Rate Limiting

Добавить ограничение запросов для защиты от DDoS:

```javascript
// В cloudflare/workers/client-webhook/index.js

// Простой rate limiter (можно улучшить с Redis)
const rateLimitMap = new Map();

function checkRateLimit(chatId) {
  const now = Date.now();
  const key = `rate_limit_${chatId}`;
  
  if (rateLimitMap.has(key)) {
    const { count, resetAt } = rateLimitMap.get(key);
    
    if (now > resetAt) {
      rateLimitMap.set(key, { count: 1, resetAt: now + 60000 }); // 1 минута
      return true;
    }
    
    if (count >= 20) { // Макс 20 запросов в минуту
      return false;
    }
    
    rateLimitMap.set(key, { count: count + 1, resetAt });
    return true;
  }
  
  rateLimitMap.set(key, { count: 1, resetAt: now + 60000 });
  return true;
}

export default {
  async fetch(request, env, ctx) {
    // ... валидация webhook
    
    try {
      const update = await parseTelegramUpdate(request);
      const chatId = getChatIdFromUpdate(update);
      
      // Rate limiting
      if (!checkRateLimit(chatId)) {
        console.error('[RateLimit] Too many requests from:', chatId);
        return errorResponse('Too many requests', 429);
      }
      
      // ... остальной код
    }
  }
}
```

### 4. Проверка IP адресов Telegram

Cloudflare Workers может проверять IP адреса запросов:

```javascript
// Список официальных IP Telegram (обновляйте регулярно)
const TELEGRAM_IPS = [
  '149.154.160.0/20',
  '91.108.4.0/22',
  // Добавьте актуальные IP из https://core.telegram.org/bots/webhooks
];

function isTelegramIP(ip) {
  // Простая проверка (можно улучшить с библиотекой для CIDR)
  return TELEGRAM_IPS.some(range => {
    // Упрощенная проверка - лучше использовать библиотеку
    return ip.startsWith(range.split('/')[0].substring(0, 8));
  });
}

export default {
  async fetch(request, env, ctx) {
    // Проверка IP (опционально, если Secret Token работает)
    const clientIP = request.headers.get('CF-Connecting-IP');
    // ... проверка IP
  }
}
```

### 5. Мониторинг и логирование

Добавить логирование всех подозрительных действий:

```javascript
function logSecurityEvent(event, data) {
  console.error('[Security]', event, JSON.stringify(data));
  
  // Отправка в Sentry или другой мониторинг
  if (env.SENTRY_DSN) {
    // Отправить в Sentry
  }
}

// Использование:
if (suspiciousActivity) {
  logSecurityEvent('SUSPICIOUS_CALLBACK', {
    userId: update.callback_query.from.id,
    callback: callbackData,
    timestamp: new Date().toISOString()
  });
}
```

---

## 📋 Чеклист восстановления

- [ ] ✅ Отозвать старый токен в @BotFather
- [ ] ✅ Создать новый токен
- [ ] ✅ Обновить токен в .env
- [ ] ✅ Обновить токен в Cloudflare секретах
- [ ] ✅ Передеплоить Worker
- [ ] ✅ Сгенерировать новый Secret Token
- [ ] ✅ Добавить Secret Token в Cloudflare
- [ ] ✅ Установить webhook с Secret Token
- [ ] ✅ Проверить работу бота
- [ ] ✅ Добавить валидацию админских команд
- [ ] ✅ Добавить валидацию callback_data
- [ ] ✅ Добавить rate limiting
- [ ] ✅ Настроить мониторинг

---

## ⚠️ Дополнительные меры

1. **Включите 2FA на аккаунте Telegram**
   - Settings → Privacy and Security → Two-Step Verification

2. **Проверьте активные сеансы**
   - Settings → Privacy and Security → Active Sessions
   - Закройте все подозрительные сеансы

3. **Измените пароль Telegram** (если есть)

4. **Проверьте другие боты**
   - Проверьте все ваши боты на наличие взлома
   - Отзовите токены, если подозреваете компрометацию

5. **Мониторьте логи**
   - Регулярно проверяйте логи Cloudflare Worker
   - Ищите подозрительную активность

---

## 🔍 Проверка после восстановления

1. Протестируйте бота с новым пользователем
2. Проверьте, что сообщение "OWNED BY @MISHADOX" больше не появляется
3. Проверьте логи на наличие подозрительной активности
4. Убедитесь, что все защитные меры работают

---

**Дата:** 2026-01-18  
**Приоритет:** 🔴 КРИТИЧЕСКИЙ  
**Статус:** ТРЕБУЕТСЯ НЕМЕДЛЕННОЕ ДЕЙСТВИЕ
