# ТЗ: Завершение LoyalityBot до продакшн-готовности

**Версия:** 1.0
**Дата:** 2026-02
**Приоритет:** P0 → P1 → P2

---

## ОБЗОР ЗАДАЧ

| # | Задача | Приоритет | Файлы | Оценка |
|---|--------|-----------|-------|--------|
| 1 | Карма: логика расчёта | P0 | migrations, api/index.js | 3–4 ч |
| 2 | Выплаты амбассадорам | P0 | client.js, migrations | 4–5 ч |
| 3 | Список рефералов в Community | P1 | supabase.js, Community.jsx, i18n.js | 2–3 ч |
| 4 | HMAC-верификация вебхуков | P1 | client/partner/admin webhooks | 2 ч |
| 5 | Rate limiting + валидация API | P1 | api/index.js | 2 ч |
| 6 | Атомарность транзакций | P2 | migrations, api/index.js | 3 ч |

---

---

# ЗАДАЧА 1: Карма — логика расчёта

## Контекст

**Что есть:**
- `users.karma_score NUMERIC(5,2) DEFAULT 50` — миграция `add_karma_to_users.sql`
- `users.karma_level TEXT` — уровни: `sprout` / `reliable` / `regular` / `golden`
- Компонент `frontend/src/components/KarmaIndicator.jsx` — отображает карму
- Компонент рендерится в `Home.jsx` / `Profile.jsx`

**Чего не хватает:**
- Нет никакой логики, которая обновляет `karma_score` при событиях.
- Скор всегда остаётся 50 (`reliable`) у всех пользователей.

## Формула расчёта кармы

```
karma_score = clamp(
  base_activity +
  nps_bonus +
  referral_bonus +
  frequency_bonus,
  0, 100
)

base_activity  = min(30, transactions_last_90d * 3)   -- до 30 очков за активность
nps_bonus      = avg_nps_given * 4                     -- до 40 очков (max NPS=10)
referral_bonus = min(20, direct_referrals * 4)         -- до 20 очков за рефералов
frequency_bonus = days_since_last_visit <= 14 ? 10 : 0 -- бонус за недавний визит

karma_level:
  score < 30  → 'sprout'
  score < 55  → 'reliable'
  score < 75  → 'regular'
  score >= 75 → 'golden'
```

## Когда обновлять

| Событие | Место вызова |
|---------|--------------|
| Успешная транзакция (accrual/spend) | `api/index.js` → `executeTransaction`, после строки 235 |
| Отправка NPS-оценки | `client-webhook/client.js` → `handleNPS`, после сохранения оценки |
| Регистрация нового реферала | `client-webhook/client.js` → при обработке `start` с реф-кодом |

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `migrations/add_karma_calculation_rpc.sql` | **Создать** — SQL-функция `recalculate_karma(p_chat_id TEXT)` |
| `cloudflare/workers/api/supabase.js` | **Добавить** `recalculateKarma(env, chatId)` |
| `cloudflare/workers/api/index.js` | Вызывать `recalculateKarma` после успешной транзакции |
| `cloudflare/workers/client-webhook/supabase.js` | **Добавить** `recalculateKarma(env, chatId)` |
| `cloudflare/workers/client-webhook/client.js` | Вызывать при NPS и регистрации реферала |

## SQL-функция (основа)

```sql
CREATE OR REPLACE FUNCTION recalculate_karma(p_chat_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_txn_count INT;
  v_avg_nps   NUMERIC;
  v_ref_count INT;
  v_last_visit TIMESTAMPTZ;
  v_score NUMERIC;
  v_level TEXT;
BEGIN
  -- Транзакции за 90 дней
  SELECT COUNT(*) INTO v_txn_count
  FROM transactions
  WHERE client_chat_id = p_chat_id
    AND date_time >= NOW() - INTERVAL '90 days';

  -- Средний NPS (оценки данные пользователем)
  SELECT AVG(rating) INTO v_avg_nps
  FROM nps_ratings
  WHERE client_chat_id = p_chat_id;

  -- Прямые рефералы (level=1)
  SELECT COUNT(*) INTO v_ref_count
  FROM referral_tree
  WHERE referrer_chat_id = p_chat_id AND level = 1;

  -- Дата последнего визита
  SELECT last_visit INTO v_last_visit
  FROM users WHERE chat_id = p_chat_id;

  -- Расчёт score
  v_score := LEAST(30, v_txn_count * 3)
           + COALESCE(v_avg_nps, 5) * 4
           + LEAST(20, v_ref_count * 4)
           + CASE WHEN v_last_visit >= NOW() - INTERVAL '14 days' THEN 10 ELSE 0 END;

  v_score := GREATEST(0, LEAST(100, v_score));

  -- Определение уровня
  v_level := CASE
    WHEN v_score < 30 THEN 'sprout'
    WHEN v_score < 55 THEN 'reliable'
    WHEN v_score < 75 THEN 'regular'
    ELSE 'golden'
  END;

  UPDATE users
  SET karma_score = v_score, karma_level = v_level
  WHERE chat_id = p_chat_id;
END;
$$;
```

---

---

# ЗАДАЧА 2: Выплаты амбассадорам

## Контекст

**Что есть:**
- `ambassadors` таблица: `balance_pending`, `total_earnings`, `last_payout_at`
- `ambassador_earnings` — детальный лог начислений
- Кабинет амбассадора в боте (`showAmbassadorCabinet` в `client.js`)
- Кнопка «💳 Запросить выплату» (`callback_data: 'ambassador_payout'`)
- Хендлер `if (data === 'ambassador_payout')` возвращает «В разработке»

**Чего не хватает:**
- Таблица `ambassador_payout_requests`
- Флоу запроса выплаты (выбор суммы, реквизитов)
- Уведомление администратора
- Обработка заявок в admin-боте

## Схема данных

```sql
-- migrations/add_ambassador_payout_requests.sql
CREATE TABLE IF NOT EXISTS ambassador_payout_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_chat_id TEXT NOT NULL REFERENCES ambassadors(chat_id),
  amount          NUMERIC NOT NULL CHECK (amount > 0),
  payment_method  TEXT NOT NULL CHECK (payment_method IN ('card', 'sbp', 'crypto')),
  payment_details TEXT NOT NULL,  -- номер карты/телефон/адрес
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  processed_at    TIMESTAMPTZ,
  admin_note      TEXT
);

CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON ambassador_payout_requests(status);
CREATE INDEX IF NOT EXISTS idx_payout_requests_ambassador ON ambassador_payout_requests(ambassador_chat_id);
```

## Флоу пользователя (бот)

```
[Кабинет амбассадора]
  └─ 💳 Запросить выплату
       └─ Проверить balance_pending >= 500 руб.
            ├─ НЕТ: "Минимальная сумма выплаты 500 ₽. Ваш баланс: {n} ₽"
            └─ ДА:  "Введите сумму для вывода (от 500 до {balance_pending} ₽):"
                     └─ [пользователь вводит сумму]
                          └─ "Выберите способ получения:"
                               [💳 Карта] [📱 СБП] [₿ Крипто]
                                    └─ "Введите реквизиты:"
                                         └─ Запись в ambassador_payout_requests
                                              └─ "✅ Заявка #{id} принята. Обработаем в течение 3 рабочих дней."
                                                   └─ Уведомление в admin-чат
```

## Состояния бота (bot_states)

Использовать существующую систему `bot_states` в Supabase:

```javascript
// state: 'ambassador_payout_amount'  — ждём ввод суммы
// state: 'ambassador_payout_method'  — ждём выбор способа (через callback)
// state: 'ambassador_payout_details' — ждём реквизиты
// data в bot_states: { amount, method }
```

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `migrations/add_ambassador_payout_requests.sql` | **Создать** — таблица `ambassador_payout_requests` |
| `cloudflare/workers/client-webhook/client.js` | Заменить стаб `ambassador_payout`, добавить хендлеры состояний |
| `cloudflare/workers/client-webhook/supabase.js` | Добавить `createPayoutRequest`, `getAmbassadorBalance` |
| `cloudflare/workers/admin-webhook/` | Добавить команду `/payouts` — список заявок + кнопки одобрить/отклонить |

## Суммы и ограничения

- Минимальная сумма заявки: **500 ₽**
- Максимум: `balance_pending` амбассадора
- После одобрения: `balance_pending -= amount`, `last_payout_at = NOW()`
- `status: 'paid'` → уведомление амбассадору

---

---

# ЗАДАЧА 3: Список рефералов в Community

## Контекст

Полное ТЗ: `docs/TZ_REFERRAL_LIST.md` (уже написано, реализация не выполнена).

**Что есть:**
- `referral_tree` с полями: `referred_chat_id`, `level`, `registered_at`, `total_earned_points`
- `getReferralStats()` в `frontend/src/services/supabase.js` — возвращает данные, но без `name`
- Страница `Community.jsx` — загружает стату, но блок списка не отрисован

**Чего не хватает:**
- Batch-запрос к `users` для получения имён рефералов
- UI-блок в `Community.jsx`
- 4 ключа в `i18n.js`

## Изменения

### `frontend/src/services/supabase.js` — функция `getReferralStats`

После получения `referrals` из `referral_tree` добавить:

```javascript
// Batch-запрос имён
const referredIds = [...new Set((referrals || []).map(r => r.referred_chat_id).filter(Boolean))];
let namesMap = {};
if (referredIds.length > 0) {
  const { data: usersData } = await supabase
    .from('users')
    .select('chat_id, name')
    .in('chat_id', referredIds);
  namesMap = (usersData || []).reduce((acc, u) => {
    acc[u.chat_id] = u.name || '—';
    return acc;
  }, {});
}
const referralsWithNames = (referrals || []).map(r => ({
  ...r,
  referred_name: namesMap[r.referred_chat_id] || '—'
}));
// Заменить referrals → referralsWithNames в возврате функции
```

### `frontend/src/pages/Community.jsx`

Добавить блок после «Последние награды»:

```jsx
{referralStats?.referrals_list?.length > 0 && (
  <div style={{ background: 'var(--tg-theme-secondary-bg-color)', borderRadius: 16, padding: 16, marginTop: 16 }}>
    <div style={{ fontWeight: 600, marginBottom: 12 }}>{t('referral_list_title')}</div>
    {referralStats.referrals_list.map((ref, i) => (
      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--tg-theme-hint-color)' }}>
        <div>
          <div style={{ fontWeight: 500 }}>{ref.referred_name}</div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>
            {ref.level > 1 && `${t('referral_level_short', { n: ref.level })} · `}
            {new Date(ref.registered_at).toLocaleDateString()}
          </div>
        </div>
        {ref.total_earned_points > 0 && (
          <div style={{ color: 'var(--tg-theme-link-color)', fontSize: 13 }}>
            {t('referral_earned_points', { n: ref.total_earned_points })}
          </div>
        )}
      </div>
    ))}
  </div>
)}
```

### `frontend/src/utils/i18n.js`

Добавить 4 ключа в объект переводов:

```javascript
referral_list_title:    { ru: 'Приглашённые друзья', en: 'Invited Friends' },
referral_list_empty:    { ru: 'Пока никого не пригласили', en: 'No one invited yet' },
referral_level_short:   { ru: 'Уровень {n}', en: 'Level {n}' },
referral_earned_points: { ru: '+{n} баллов', en: '+{n} pts' },
```

---

---

# ЗАДАЧА 4: HMAC-верификация Telegram вебхуков

## Контекст

Все три вебхука (`client-webhook`, `partner-webhook`, `admin-webhook`) принимают **любой** POST-запрос без проверки подлинности. Злоумышленник может отправить поддельное обновление от Telegram.

**Telegram требует:** проверка заголовка `X-Telegram-Bot-Api-Secret-Token` или верификация `data-check-string` через HMAC-SHA256.

## Реализация

Telegram при регистрации вебхука позволяет передать `secret_token`. При каждом запросе Telegram присылает заголовок `X-Telegram-Bot-Api-Secret-Token`.

### `cloudflare/workers/client-webhook/common.js` (или создать)

```javascript
/**
 * Verify Telegram webhook request authenticity
 * Uses X-Telegram-Bot-Api-Secret-Token header
 */
export async function verifyTelegramWebhook(request, secretToken) {
  const header = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
  if (!header || header !== secretToken) {
    return false;
  }
  return true;
}
```

### Регистрация вебхука с secret_token

При деплое вызвать (один раз):
```
POST https://api.telegram.org/bot{TOKEN}/setWebhook
{
  "url": "https://your-worker.workers.dev/webhook",
  "secret_token": "{WEBHOOK_SECRET}"  // добавить в wrangler.toml как env var
}
```

### Добавить проверку в начало fetch-хендлера каждого вебхука

```javascript
// В начале export default { async fetch(request, env) {...} }
if (request.method === 'POST') {
  const isValid = await verifyTelegramWebhook(request, env.WEBHOOK_SECRET);
  if (!isValid) {
    return new Response('Unauthorized', { status: 401 });
  }
}
```

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `cloudflare/workers/client-webhook/index.js` | Добавить проверку HMAC в начало POST-хендлера |
| `cloudflare/workers/partner-webhook/index.js` | То же |
| `cloudflare/workers/admin-webhook/index.js` | То же |
| `cloudflare/workers/*/wrangler.toml` | Добавить переменную `WEBHOOK_SECRET` |

---

---

# ЗАДАЧА 5: Rate limiting + валидация API

## Контекст

`api/index.js` принимает запросы на `/transaction` без ограничений:
- `rawAmount` не валидируется (может быть отрицательным, строкой, NaN)
- `txnType` проверяется, но только строковым сравнением
- Нет лимита запросов по IP или по `chatId`

## Валидация входных данных

### Функция валидации в `api/index.js`

```javascript
function validateTransactionInput(clientChatId, partnerChatId, txnType, rawAmount) {
  const errors = [];
  if (!clientChatId || isNaN(Number(clientChatId))) errors.push('invalid clientChatId');
  if (!partnerChatId || isNaN(Number(partnerChatId))) errors.push('invalid partnerChatId');
  if (!['accrual', 'spend'].includes(txnType)) errors.push('txnType must be accrual or spend');
  const amount = Number(rawAmount);
  if (!isFinite(amount) || amount <= 0) errors.push('rawAmount must be positive number');
  if (amount > 1_000_000) errors.push('rawAmount exceeds maximum (1,000,000)');
  return errors;
}
```

Вызывать в хендлере `/transaction` **до** `executeTransaction`.

## Rate limiting через Cloudflare KV

Cloudflare Workers не имеют встроенного rate limit. Использовать KV-хранилище:

```javascript
async function checkRateLimit(env, key, maxRequests = 10, windowSeconds = 60) {
  const kvKey = `ratelimit:${key}`;
  const current = await env.RATE_LIMIT_KV.get(kvKey);
  const count = current ? parseInt(current) : 0;
  if (count >= maxRequests) return false;
  await env.RATE_LIMIT_KV.put(kvKey, String(count + 1), { expirationTtl: windowSeconds });
  return true;
}

// В хендлере транзакции:
const allowed = await checkRateLimit(env, `txn:${partnerChatId}`, 60, 60); // 60 транзакций/мин на партнёра
if (!allowed) return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429 });
```

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `cloudflare/workers/api/index.js` | Добавить `validateTransactionInput` + вызовы, добавить `checkRateLimit` |
| `cloudflare/workers/api/wrangler.toml` | Привязать KV namespace `RATE_LIMIT_KV` |

---

---

# ЗАДАЧА 6: Атомарность транзакций (P2)

## Контекст

`executeTransaction` выполняет 3 последовательные операции:
1. `PATCH users` — обновить баланс
2. `POST transactions` — записать транзакцию
3. `PATCH partners` — списать с депозита + лог

Если шаги 2 или 3 упадут после успеха шага 1 — баланс обновлён, но транзакция не записана. Данные рассинхронизируются.

## Решение: Supabase RPC (хранимая процедура)

Перенести всю логику начисления в одну SQL-функцию с `BEGIN/COMMIT/ROLLBACK`.

### `migrations/add_execute_transaction_rpc.sql`

```sql
CREATE OR REPLACE FUNCTION execute_transaction(
  p_client_chat_id    TEXT,
  p_partner_chat_id   TEXT,
  p_txn_type          TEXT,  -- 'accrual' | 'spend'
  p_raw_amount        NUMERIC,
  p_points            INT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_balance NUMERIC;
  v_new_balance     NUMERIC;
  v_txn_id          INTEGER;
  v_deposit         NUMERIC;
BEGIN
  -- Блокировка строки пользователя
  SELECT balance INTO v_current_balance
  FROM users WHERE chat_id = p_client_chat_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF p_txn_type = 'spend' AND p_points > v_current_balance THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance',
                              'new_balance', v_current_balance);
  END IF;

  -- Новый баланс
  v_new_balance := CASE p_txn_type
    WHEN 'accrual' THEN v_current_balance + p_points
    WHEN 'spend'   THEN v_current_balance - p_points
  END;

  -- Обновить баланс
  UPDATE users SET balance = v_new_balance WHERE chat_id = p_client_chat_id;

  -- Записать транзакцию
  INSERT INTO transactions (client_chat_id, partner_chat_id, total_amount,
    earned_points, spent_points, operation_type, description, date_time)
  VALUES (p_client_chat_id, p_partner_chat_id,
    CASE WHEN p_txn_type = 'accrual' THEN p_raw_amount ELSE 0 END,
    CASE WHEN p_txn_type = 'accrual' THEN p_points ELSE 0 END,
    CASE WHEN p_txn_type = 'spend'   THEN p_points ELSE 0 END,
    CASE WHEN p_txn_type = 'accrual' THEN 'accrual' ELSE 'redemption' END,
    'Транзакция ' || p_txn_type || ' ' || p_points || ' баллов',
    NOW())
  RETURNING id INTO v_txn_id;

  -- Списание с депозита партнёра (только начисление)
  IF p_txn_type = 'accrual' THEN
    SELECT deposit_balance INTO v_deposit
    FROM partners WHERE chat_id = p_partner_chat_id FOR UPDATE;

    UPDATE partners
    SET deposit_balance = v_deposit - p_points,
        total_cashback_issued = total_cashback_issued + p_points
    WHERE chat_id = p_partner_chat_id;

    INSERT INTO partner_cashback_log
      (partner_chat_id, client_chat_id, transaction_id, check_amount, cashback_points, cashback_amount)
    VALUES (p_partner_chat_id, p_client_chat_id, v_txn_id, p_raw_amount, p_points, p_points);
  END IF;

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance,
                            'points', p_points, 'transaction_id', v_txn_id);
END;
$$;
```

Вызов из Workers:
```javascript
const result = await supabaseRpc(env, 'execute_transaction', {
  p_client_chat_id: clientChatId,
  p_partner_chat_id: partnerChatId,
  p_txn_type: txnType,
  p_raw_amount: rawAmount,
  p_points: transactionPoints,
});
```

---

---

# ПРОМПТЫ ДЛЯ CURSOR

Каждый промпт самодостаточен. Открыть нужный файл в Cursor, запустить промпт.

---

## ПРОМПТ 1: Карма — SQL-миграция

**Файл для открытия:** `migrations/add_karma_to_users.sql`

```
Создай новый файл migrations/add_karma_calculation_rpc.sql

В нём должна быть SQL-функция для PostgreSQL/Supabase:

CREATE OR REPLACE FUNCTION recalculate_karma(p_chat_id TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_txn_count   INT;
  v_avg_nps     NUMERIC;
  v_ref_count   INT;
  v_last_visit  TIMESTAMPTZ;
  v_score       NUMERIC;
  v_level       TEXT;
BEGIN
  SELECT COUNT(*) INTO v_txn_count
  FROM transactions
  WHERE client_chat_id = p_chat_id
    AND date_time >= NOW() - INTERVAL '90 days';

  SELECT AVG(rating) INTO v_avg_nps
  FROM nps_ratings
  WHERE client_chat_id = p_chat_id;

  SELECT COUNT(*) INTO v_ref_count
  FROM referral_tree
  WHERE referrer_chat_id = p_chat_id AND level = 1;

  SELECT last_visit INTO v_last_visit
  FROM users WHERE chat_id = p_chat_id;

  v_score := LEAST(30, v_txn_count * 3)
           + COALESCE(v_avg_nps, 5) * 4
           + LEAST(20, v_ref_count * 4)
           + CASE WHEN v_last_visit >= NOW() - INTERVAL '14 days' THEN 10 ELSE 0 END;

  v_score := GREATEST(0, LEAST(100, v_score));

  v_level := CASE
    WHEN v_score < 30 THEN 'sprout'
    WHEN v_score < 55 THEN 'reliable'
    WHEN v_score < 75 THEN 'regular'
    ELSE 'golden'
  END;

  UPDATE users
  SET karma_score = v_score, karma_level = v_level
  WHERE chat_id = p_chat_id;
END;
$$;

Добавь комментарий в начале файла с датой и назначением.
Не меняй существующие файлы.
```

---

## ПРОМПТ 2: Карма — вызов из Workers API

**Файл для открытия:** `cloudflare/workers/api/index.js`

```
В файле cloudflare/workers/api/index.js, в функции executeTransaction,
после строки с return { success: true, new_balance: newBalance, points: transactionPoints }
(примерно строка 237), добавь асинхронный вызов пересчёта кармы.

Добавь в cloudflare/workers/api/supabase.js новую функцию:

export async function recalculateKarma(env, chatId) {
  try {
    const config = getSupabaseConfig(env);
    const response = await fetch(`${config.url}/rest/v1/rpc/recalculate_karma`, {
      method: 'POST',
      headers: {
        'apikey': config.key,
        'Authorization': `Bearer ${config.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_chat_id: String(chatId) }),
    });
    if (!response.ok) {
      const err = await response.text();
      console.error('[recalculateKarma] failed:', err);
    }
  } catch (e) {
    console.error('[recalculateKarma] error:', e);
  }
}

Импортируй recalculateKarma в index.js.
В executeTransaction, после строки записи транзакции (после получения transactionId),
добавь:

// Пересчёт кармы (non-blocking)
recalculateKarma(env, clientChatId).catch(() => {});

Не меняй ничего кроме указанных мест.
Сохрани все существующие импорты.
```

---

## ПРОМПТ 3: Карма — вызов из клиентского вебхука (NPS)

**Файл для открытия:** `cloudflare/workers/client-webhook/client.js`

```
В файле cloudflare/workers/client-webhook/client.js найди место,
где сохраняется NPS-оценка от пользователя (поиск по 'nps_ratings' или 'handleNPS').

После успешной записи оценки в Supabase добавь вызов пересчёта кармы.

В cloudflare/workers/client-webhook/supabase.js добавь функцию:

export async function recalculateKarma(env, chatId) {
  try {
    const config = getSupabaseConfig(env);
    const response = await fetch(`${config.url}/rest/v1/rpc/recalculate_karma`, {
      method: 'POST',
      headers: {
        'apikey': config.key,
        'Authorization': `Bearer ${config.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_chat_id: String(chatId) }),
    });
    if (!response.ok) {
      const err = await response.text();
      console.error('[recalculateKarma]', err);
    }
  } catch (e) {
    console.error('[recalculateKarma]', e);
  }
}

Импортируй recalculateKarma в client.js и вызови после сохранения NPS:

recalculateKarma(env, chatId).catch(() => {});

Не изменяй ничего, кроме указанного места.
```

---

## ПРОМПТ 4: Выплаты амбассадорам — миграция

**Файл для открытия:** `migrations/add_ambassador_program.sql`

```
Создай новый файл migrations/add_ambassador_payout_requests.sql

Содержимое:

-- Migration: Ambassador Payout Requests
-- Purpose: таблица заявок на выплату для амбассадоров

CREATE TABLE IF NOT EXISTS ambassador_payout_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_chat_id  TEXT NOT NULL REFERENCES ambassadors(chat_id) ON DELETE CASCADE,
  amount              NUMERIC NOT NULL CHECK (amount >= 500),
  payment_method      TEXT NOT NULL CHECK (payment_method IN ('card', 'sbp', 'crypto')),
  payment_details     TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  processed_at        TIMESTAMPTZ,
  admin_note          TEXT
);

CREATE INDEX IF NOT EXISTS idx_payout_requests_status    ON ambassador_payout_requests(status);
CREATE INDEX IF NOT EXISTS idx_payout_requests_ambassador ON ambassador_payout_requests(ambassador_chat_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_created   ON ambassador_payout_requests(created_at DESC);

Добавь комментарий в начале файла.
Не изменяй другие файлы.
```

---

## ПРОМПТ 5: Выплаты амбассадорам — флоу в боте

**Файл для открытия:** `cloudflare/workers/client-webhook/client.js`

```
В файле cloudflare/workers/client-webhook/client.js найди хендлер:

  if (data === 'ambassador_payout') {
    await editMessageText(
      env.TOKEN_CLIENT, chatId, callbackQuery.message.message_id,
      '💳 Запрос выплаты — в разработке. Обратитесь в поддержку.'
    );
    return { success: true };
  }

Замени его на полноценный флоу выплаты:

1. Получи баланс амбассадора: `ambassadors?chat_id=eq.${chatId}&select=balance_pending`
2. Если balance_pending < 500 — отправь сообщение: "Минимальная сумма выплаты 500 ₽. Ваш текущий баланс: {n} ₽"
3. Иначе — запроси ввод суммы через editMessageText:
   "💳 Введите сумму для вывода (от 500 до {balance_pending} ₽):"
   и сохрани в bot_states: { state: 'ambassador_payout_amount' }

В handleText (обработка текстовых сообщений) добавь обработку состояний:

- 'ambassador_payout_amount':
  - Валидировать что введено число от 500 до balance_pending
  - Если ошибка — попросить ввести снова
  - Если OK — сохранить сумму в bot_states data, показать клавиатуру выбора способа:
    [[{ text: '💳 Карта', callback_data: 'payout_method_card' },
      { text: '📱 СБП', callback_data: 'payout_method_sbp' },
      { text: '₿ Крипто', callback_data: 'payout_method_crypto' }]]
    Обновить state: 'ambassador_payout_method'

- В callback хендлере добавить обработку 'payout_method_card', 'payout_method_sbp', 'payout_method_crypto':
  - Сохранить метод в bot_states data
  - Запросить реквизиты: "Введите реквизиты (номер карты / телефон / адрес):"
  - Обновить state: 'ambassador_payout_details'

- 'ambassador_payout_details':
  - Принять текст как payment_details
  - Создать запись в ambassador_payout_requests через supabaseRequest
  - Очистить bot_states
  - Отправить подтверждение: "✅ Заявка принята! Мы обработаем её в течение 3 рабочих дней."
  - Отправить уведомление в env.ADMIN_CHAT_ID (если задан):
    "📋 Новая заявка на выплату амбассадора {chatId}: {amount} ₽ ({method})"

В cloudflare/workers/client-webhook/supabase.js добавь:

export async function createPayoutRequest(env, { ambassadorChatId, amount, paymentMethod, paymentDetails }) {
  return await supabaseRequest(env, 'ambassador_payout_requests', {
    method: 'POST',
    body: JSON.stringify({
      ambassador_chat_id: String(ambassadorChatId),
      amount,
      payment_method: paymentMethod,
      payment_details: paymentDetails,
    }),
  });
}

Минимальный diff. Не рефакторить существующий код.
Не изменять другие хендлеры.
```

---

## ПРОМПТ 6: Список рефералов — данные

**Файл для открытия:** `frontend/src/services/supabase.js`

```
В файле frontend/src/services/supabase.js найди функцию getReferralStats().

В ней есть запрос к таблице referral_tree. После получения данных из referral_tree,
но до формирования возвращаемого объекта, добавь batch-запрос имён пользователей:

const referredIds = [...new Set((referrals || []).map(r => r.referred_chat_id).filter(Boolean))];
let namesMap = {};
if (referredIds.length > 0) {
  const { data: usersData } = await supabase
    .from('users')
    .select('chat_id, name')
    .in('chat_id', referredIds);
  namesMap = (usersData || []).reduce((acc, u) => {
    acc[u.chat_id] = u.name || '—';
    return acc;
  }, {});
}
const referralsWithNames = (referrals || []).map(r => ({
  ...r,
  referred_name: namesMap[r.referred_chat_id] || '—',
}));

В возвращаемом объекте замени referrals (или referrals_list) на referralsWithNames.

Минимальный diff. Не менять другие функции.
Не менять структуру возвращаемых данных кроме добавления поля referred_name.
```

---

## ПРОМПТ 7: Список рефералов — UI

**Файл для открытия:** `frontend/src/pages/Community.jsx`

```
В файле frontend/src/pages/Community.jsx найди место после блока с последними наградами
или в конце основного контента страницы.

Добавь блок списка рефералов. Данные берутся из referralStats.referrals_list
(уже загружается на странице через getReferralStats).

Блок:
- Показывать только если referralStats?.referrals_list?.length > 0
- Заголовок: t('referral_list_title')
- Для каждого реферала в списке — карточка:
  - Слева: имя (ref.referred_name), под ним мелко: дата (ref.registered_at) + уровень если > 1
  - Справа: если ref.total_earned_points > 0 — показать "+N баллов" зелёным цветом
- Использовать стили в духе существующих блоков: var(--tg-theme-secondary-bg-color), borderRadius: 16, padding: 16
- Иконка Users из lucide-react (она уже импортирована на странице или добавь импорт)
- Локализация через функцию t() которая уже используется на странице

Не добавлять новые зависимости.
Не изменять существующие блоки.
Вставить новый блок минимальным diff.
```

---

## ПРОМПТ 8: Переводы для списка рефералов

**Файл для открытия:** `frontend/src/utils/i18n.js`

```
В файле frontend/src/utils/i18n.js найди объект с переводами (translations или аналогичный).

Добавь следующие ключи в оба языка (ru и en), сохраняя существующую структуру файла:

referral_list_title:    { ru: 'Приглашённые друзья', en: 'Invited Friends' },
referral_list_empty:    { ru: 'Пока никого не пригласили', en: 'No one invited yet' },
referral_level_short:   { ru: 'Уровень {n}', en: 'Level {n}' },
referral_earned_points: { ru: '+{n} баллов', en: '+{n} pts' },

Если в файле используется другая структура (например функция t() с объектом),
адаптируй ключи под существующий формат.

Минимальный diff. Не менять ничего кроме добавления этих 4 ключей.
```

---

## ПРОМПТ 9: HMAC-верификация вебхуков

**Файл для открытия:** `cloudflare/workers/client-webhook/index.js`

```
В файле cloudflare/workers/client-webhook/index.js (главный fetch-хендлер)
добавь проверку подлинности запроса от Telegram.

Telegram при настроенном secret_token присылает заголовок:
X-Telegram-Bot-Api-Secret-Token: {значение}

В начало обработчика POST-запроса добавь:

const secretToken = env.WEBHOOK_SECRET;
if (secretToken) {
  const incoming = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
  if (incoming !== secretToken) {
    console.warn('[webhook] Invalid secret token from', request.headers.get('cf-connecting-ip'));
    return new Response('Unauthorized', { status: 401 });
  }
}

В файл wrangler.toml для client-webhook добавь:
[vars]
WEBHOOK_SECRET = ""   # заполнить в Cloudflare Dashboard → Workers → Settings → Variables

Выполни то же самое для:
- cloudflare/workers/partner-webhook/index.js
- cloudflare/workers/admin-webhook/index.js

Не менять логику обработки обновлений.
Минимальный diff в каждом файле.
```

---

## ПРОМПТ 10: Валидация входных данных API

**Файл для открытия:** `cloudflare/workers/api/index.js`

```
В файле cloudflare/workers/api/index.js в хендлере POST /transaction
(или в функции executeTransaction) добавь валидацию входных данных.

Перед вызовом executeTransaction добавь:

function validateTransactionInput(clientChatId, partnerChatId, txnType, rawAmount) {
  const errors = [];
  if (!clientChatId || isNaN(Number(clientChatId))) {
    errors.push('clientChatId must be a valid number');
  }
  if (!partnerChatId || isNaN(Number(partnerChatId))) {
    errors.push('partnerChatId must be a valid number');
  }
  if (!['accrual', 'spend'].includes(txnType)) {
    errors.push('txnType must be "accrual" or "spend"');
  }
  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    errors.push('rawAmount must be a positive finite number');
  }
  if (amount > 1_000_000) {
    errors.push('rawAmount exceeds maximum allowed value of 1,000,000');
  }
  return errors;
}

В хендлере перед вызовом executeTransaction:

const validationErrors = validateTransactionInput(clientChatId, partnerChatId, txnType, rawAmount);
if (validationErrors.length > 0) {
  return new Response(JSON.stringify({ error: 'Validation failed', details: validationErrors }), {
    status: 400,
    headers: corsHeaders(request),
  });
}

Не изменять логику executeTransaction.
Не трогать другие эндпоинты.
```

---

## ПРОМПТ 11: Атомарная транзакция через Supabase RPC (P2)

**Файл для открытия:** `migrations/add_ambassador_program.sql`

```
Создай новый файл migrations/add_execute_transaction_rpc.sql

Содержимое — хранимая процедура для PostgreSQL, которая атомарно выполняет
начисление/списание баллов, запись транзакции и списание депозита партнёра.

CREATE OR REPLACE FUNCTION execute_transaction_atomic(
  p_client_chat_id  TEXT,
  p_partner_chat_id TEXT,
  p_txn_type        TEXT,
  p_raw_amount      NUMERIC,
  p_points          INT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_balance NUMERIC;
  v_new_balance     NUMERIC;
  v_txn_id          INTEGER;
  v_deposit         NUMERIC;
BEGIN
  SELECT balance INTO v_current_balance
  FROM users WHERE chat_id = p_client_chat_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF p_txn_type = 'spend' AND p_points > v_current_balance THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance',
                              'new_balance', v_current_balance);
  END IF;

  v_new_balance := CASE p_txn_type
    WHEN 'accrual' THEN v_current_balance + p_points
    WHEN 'spend'   THEN v_current_balance - p_points
    ELSE v_current_balance
  END;

  UPDATE users SET balance = v_new_balance WHERE chat_id = p_client_chat_id;

  INSERT INTO transactions (
    client_chat_id, partner_chat_id, total_amount,
    earned_points, spent_points, operation_type, description, date_time
  ) VALUES (
    p_client_chat_id, p_partner_chat_id,
    CASE WHEN p_txn_type = 'accrual' THEN p_raw_amount ELSE 0 END,
    CASE WHEN p_txn_type = 'accrual' THEN p_points ELSE 0 END,
    CASE WHEN p_txn_type = 'spend'   THEN p_points ELSE 0 END,
    CASE WHEN p_txn_type = 'accrual' THEN 'accrual' ELSE 'redemption' END,
    'Транзакция ' || p_txn_type || ' ' || p_points || ' баллов',
    NOW()
  )
  RETURNING id INTO v_txn_id;

  IF p_txn_type = 'accrual' THEN
    SELECT deposit_balance INTO v_deposit
    FROM partners WHERE chat_id = p_partner_chat_id FOR UPDATE;

    UPDATE partners
    SET deposit_balance = COALESCE(v_deposit, 0) - p_points,
        total_cashback_issued = COALESCE(total_cashback_issued, 0) + p_points
    WHERE chat_id = p_partner_chat_id;

    INSERT INTO partner_cashback_log (
      partner_chat_id, client_chat_id, transaction_id,
      check_amount, cashback_points, cashback_amount
    ) VALUES (
      p_partner_chat_id, p_client_chat_id, v_txn_id,
      p_raw_amount, p_points, p_points
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'points', p_points,
    'transaction_id', v_txn_id
  );
END;
$$;

Добавь комментарий о назначении в начале файла.
```

---

# ПОРЯДОК ВЫПОЛНЕНИЯ

```
ДЕНЬ 1 (P0):
  1. Промпт 1 → применить миграцию add_karma_calculation_rpc.sql в Supabase
  2. Промпт 2 → деплой api worker
  3. Промпт 3 → деплой client-webhook worker
  4. Промпт 4 → применить миграцию add_ambassador_payout_requests.sql
  5. Промпт 5 → деплой client-webhook worker

ДЕНЬ 2 (P1):
  6. Промпт 6 → frontend
  7. Промпт 7 → frontend
  8. Промпт 8 → frontend
  9. Промпт 9 → деплой всех трёх webhook workers
  10. Промпт 10 → деплой api worker

ДЕНЬ 3 (P2):
  11. Промпт 11 → применить миграцию, обновить api/index.js для вызова RPC
```

---

# КРИТЕРИИ ГОТОВНОСТИ

| Задача | Как проверить |
|--------|--------------|
| Карма | Провести тестовую транзакцию → karma_score в users должна измениться |
| Выплаты | Нажать «Запросить выплату» → пройти флоу до подтверждения → запись в ambassador_payout_requests |
| Список рефералов | Открыть Community → видеть карточки с именами рефералов |
| HMAC | Отправить POST на вебхук без заголовка → получить 401 |
| Валидация | Отправить rawAmount=-1 → получить 400 с описанием ошибки |
| Атомарность | При симулированном сбое на шаге 2 — баланс не должен измениться |
