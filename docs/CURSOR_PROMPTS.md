# Cursor промпты — пошаговая реализация

**Статус перед стартом:**
- ✅ Список рефералов (Community) — уже готов
- ⚠️ HMAC-верификация — есть, но слабая (шаг 9)
- ❌ Карма — шаги 1–4
- ❌ Выплаты амбассадорам — шаги 5–7
- ❌ Валидация /transactions — шаг 8

**Порядок выполнения строгий: каждый следующий шаг зависит от предыдущего.**

---

## ШАГ 1 — Карма: SQL-функция

**Открыть в Cursor:** `migrations/add_karma_to_users.sql`

**Промпт:**
```
Создай новый файл рядом: migrations/add_karma_calculation_rpc.sql

Вставь в него точно следующее содержимое:

-- Migration: Karma Recalculation RPC
-- Purpose: пересчёт karma_score и karma_level для пользователя
-- Date: 2026-02

CREATE OR REPLACE FUNCTION recalculate_karma(p_chat_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_txn_count  INT;
  v_avg_nps    NUMERIC;
  v_ref_count  INT;
  v_last_visit TIMESTAMPTZ;
  v_score      NUMERIC;
  v_level      TEXT;
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

Не изменяй никакие существующие файлы.
```

**После выполнения:** применить SQL в Supabase Dashboard → SQL Editor.

---

## ШАГ 2 — Карма: хелпер в API Worker

**Открыть в Cursor:** `cloudflare/workers/api/supabase.js`

**Промпт:**
```
В файле cloudflare/workers/api/supabase.js добавь новую экспортируемую
функцию в самый конец файла (после последней экспортируемой функции):

/**
 * Recalculate karma score for user (non-blocking RPC call)
 */
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
      console.error('[recalculateKarma] RPC failed:', err);
    }
  } catch (e) {
    console.error('[recalculateKarma] error:', e);
  }
}

Не изменяй ничего кроме добавления этой функции в конец файла.
Сохрани все существующие функции и импорты без изменений.
```

---

## ШАГ 3 — Карма: вызов после транзакции

**Открыть в Cursor:** `cloudflare/workers/api/index.js`

**Промпт:**
```
В файле cloudflare/workers/api/index.js нужно сделать два изменения.

ИЗМЕНЕНИЕ 1 — добавить импорт.
В строке 6 файла есть импорт:
  import { supabaseRequest, getUserByChatId, getPartnerByChatId, getAmbassadorChatIdByCode, isPartnerInAmbassadorList, createAmbassadorEarning, attributeTransactionToAmbassador } from './supabase.js';

Замени его на:
  import { supabaseRequest, getUserByChatId, getPartnerByChatId, getAmbassadorChatIdByCode, isPartnerInAmbassadorList, createAmbassadorEarning, attributeTransactionToAmbassador, recalculateKarma } from './supabase.js';

ИЗМЕНЕНИЕ 2 — вызов после успешной транзакции.
Найди в функции executeTransaction следующий блок (строки 237–241):

    return {
      success: true,
      new_balance: newBalance,
      points: transactionPoints,
    };

Замени его на:

    // Пересчёт кармы (fire-and-forget, не блокирует ответ)
    recalculateKarma(env, clientChatId).catch(() => {});

    return {
      success: true,
      new_balance: newBalance,
      points: transactionPoints,
    };

Больше ничего не меняй.
```

---

## ШАГ 4 — Карма: хелпер + вызов после NPS

**Открыть в Cursor:** `cloudflare/workers/client-webhook/supabase.js`

**Промпт:**
```
В файле cloudflare/workers/client-webhook/supabase.js нужно сделать два изменения.

ИЗМЕНЕНИЕ 1 — добавить функцию в конец файла:

/**
 * Recalculate karma score for user (non-blocking RPC call)
 */
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
      console.error('[recalculateKarma] RPC failed:', err);
    }
  } catch (e) {
    console.error('[recalculateKarma] error:', e);
  }
}

Затем открой файл cloudflare/workers/client-webhook/client.js.

ИЗМЕНЕНИЕ 2 — импортировать recalculateKarma.
В строке 32 есть закрывающая скобка импорта из './supabase.js':
  canAmbassadorAddPartner,
} from './supabase.js';

Добавь recalculateKarma в этот импорт:
  canAmbassadorAddPartner,
  recalculateKarma,
} from './supabase.js';

ИЗМЕНЕНИЕ 3 — вызов после сохранения NPS-оценки.
В функции handleNpsRating найди строку (около строки 269):
  const ratingId = await saveNpsRating(env, { clientChatId: chatId, partnerChatId, rating });

Сразу после неё добавь:
  // Пересчёт кармы (fire-and-forget)
  recalculateKarma(env, chatId).catch(() => {});

Больше ничего не меняй.
```

---

## ШАГ 5 — Выплаты: SQL-миграция

**Открыть в Cursor:** `migrations/add_ambassador_program.sql`

**Промпт:**
```
Создай новый файл рядом: migrations/add_ambassador_payout_requests.sql

Вставь точно следующее содержимое:

-- Migration: Ambassador Payout Requests
-- Purpose: таблица заявок на выплату для амбассадоров
-- Date: 2026-02

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

CREATE INDEX IF NOT EXISTS idx_payout_requests_status
  ON ambassador_payout_requests(status);
CREATE INDEX IF NOT EXISTS idx_payout_requests_ambassador
  ON ambassador_payout_requests(ambassador_chat_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_created
  ON ambassador_payout_requests(created_at DESC);

Не изменяй никакие существующие файлы.
```

**После выполнения:** применить SQL в Supabase Dashboard → SQL Editor.

---

## ШАГ 6 — Выплаты: хелпер в supabase.js

**Открыть в Cursor:** `cloudflare/workers/client-webhook/supabase.js`

**Промпт:**
```
В файле cloudflare/workers/client-webhook/supabase.js добавь в конец файла
(после функции recalculateKarma, которую добавили на шаге 4) новую функцию:

/**
 * Create ambassador payout request
 */
export async function createPayoutRequest(env, { ambassadorChatId, amount, paymentMethod, paymentDetails }) {
  try {
    const result = await supabaseRequest(env, 'ambassador_payout_requests', {
      method: 'POST',
      body: JSON.stringify({
        ambassador_chat_id: String(ambassadorChatId),
        amount: Number(amount),
        payment_method: paymentMethod,
        payment_details: paymentDetails,
      }),
    });
    return result && result[0] ? result[0] : null;
  } catch (e) {
    console.error('[createPayoutRequest]', e);
    return null;
  }
}

/**
 * Get ambassador pending balance
 */
export async function getAmbassadorBalance(env, chatId) {
  try {
    const rows = await supabaseRequest(env,
      `ambassadors?chat_id=eq.${encodeURIComponent(chatId)}&select=balance_pending`);
    return rows && rows[0] ? (rows[0].balance_pending || 0) : 0;
  } catch (e) {
    console.error('[getAmbassadorBalance]', e);
    return 0;
  }
}

Не изменяй ничего кроме добавления этих двух функций в конец файла.
```

---

## ШАГ 7 — Выплаты: флоу в боте

**Открыть в Cursor:** `cloudflare/workers/client-webhook/client.js`

**Промпт:**
```
В файле cloudflare/workers/client-webhook/client.js нужно сделать четыре изменения.

---

ИЗМЕНЕНИЕ 1 — импортировать новые функции.
Найди в начале файла строку:
  canAmbassadorAddPartner,
  recalculateKarma,
} from './supabase.js';

Замени на:
  canAmbassadorAddPartner,
  recalculateKarma,
  createPayoutRequest,
  getAmbassadorBalance,
} from './supabase.js';

---

ИЗМЕНЕНИЕ 2 — заменить стаб ambassador_payout.
Найди блок (строки 689–695):

    if (data === 'ambassador_payout') {
      await editMessageText(
        env.TOKEN_CLIENT, chatId, callbackQuery.message.message_id,
        '💳 Запрос выплаты — в разработке. Обратитесь в поддержку.'
      );
      return { success: true };
    }

Замени его на:

    if (data === 'ambassador_payout') {
      const pendingBalance = await getAmbassadorBalance(env, chatId);
      if (pendingBalance < 500) {
        await editMessageText(
          env.TOKEN_CLIENT, chatId, callbackQuery.message.message_id,
          `💳 Минимальная сумма выплаты — 500 ₽.\nВаш баланс к выплате: <b>${Math.floor(pendingBalance)} ₽</b>`,
          { parseMode: 'HTML' }
        );
        return { success: true };
      }
      await setBotState(env, chatId, 'ambassador_payout_amount', { balance: pendingBalance });
      await editMessageText(
        env.TOKEN_CLIENT, chatId, callbackQuery.message.message_id,
        `💳 Введите сумму для вывода (от 500 до ${Math.floor(pendingBalance)} ₽):`
      );
      return { success: true };
    }

---

ИЗМЕНЕНИЕ 3 — добавить обработку callback-кнопок выбора метода.
Найди строку (в конце блока if/else в handleAmbassador):

    return { success: false };
  } catch (e) {
    logError('handleAmbassador', e, { chatId, data });

Перед этой строкой `return { success: false };` добавь:

    if (data === 'payout_method_card' || data === 'payout_method_sbp' || data === 'payout_method_crypto') {
      const stateRow = await getBotState(env, chatId);
      if (!stateRow || stateRow.state !== 'ambassador_payout_method') {
        return { success: false };
      }
      const methodMap = { payout_method_card: 'card', payout_method_sbp: 'sbp', payout_method_crypto: 'crypto' };
      const labelMap = { payout_method_card: 'Номер карты (16 цифр)', payout_method_sbp: 'Номер телефона для СБП', payout_method_crypto: 'Адрес крипто-кошелька' };
      const method = methodMap[data];
      await setBotState(env, chatId, 'ambassador_payout_details', { ...stateRow.data, method });
      await editMessageText(
        env.TOKEN_CLIENT, chatId, callbackQuery.message.message_id,
        `📝 Введите реквизиты:\n${labelMap[data]}`
      );
      return { success: true };
    }

---

ИЗМЕНЕНИЕ 4 — обработка текстовых состояний.
Найди функцию handleNpsReview. В начале этой функции (около строки 288) после:
  const stateRow = await getBotState(env, chatId);
  if (!stateRow || stateRow.state !== 'awaiting_nps_review') return false;

Добавь ПЕРЕД этим условием новый блок обработки состояний выплаты:

  // Обработка ввода суммы выплаты
  if (stateRow && stateRow.state === 'ambassador_payout_amount') {
    const amount = parseFloat(text.replace(',', '.'));
    const maxAmount = stateRow.data?.balance || 0;
    if (!Number.isFinite(amount) || amount < 500 || amount > maxAmount) {
      await sendTelegramMessage(
        env.TOKEN_CLIENT, chatId,
        `❌ Введите сумму от 500 до ${Math.floor(maxAmount)} ₽:`
      );
      return true;
    }
    await setBotState(env, chatId, 'ambassador_payout_method', { ...stateRow.data, amount });
    await sendTelegramMessage(
      env.TOKEN_CLIENT, chatId,
      '💳 Выберите способ получения:',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '💳 Карта', callback_data: 'payout_method_card' }],
            [{ text: '📱 СБП (по номеру телефона)', callback_data: 'payout_method_sbp' }],
            [{ text: '₿ Крипто', callback_data: 'payout_method_crypto' }],
          ]
        }
      }
    );
    return true;
  }

  // Обработка ввода реквизитов выплаты
  if (stateRow && stateRow.state === 'ambassador_payout_details') {
    const { amount, method, balance } = stateRow.data || {};
    await clearBotState(env, chatId);
    const req = await createPayoutRequest(env, {
      ambassadorChatId: chatId,
      amount,
      paymentMethod: method,
      paymentDetails: text.trim(),
    });
    await sendTelegramMessage(
      env.TOKEN_CLIENT, chatId,
      `✅ Заявка на выплату <b>${Math.floor(amount)} ₽</b> принята!\n\nМы обработаем её в течение 3 рабочих дней.`,
      { parseMode: 'HTML' }
    );
    if (env.ADMIN_CHAT_ID) {
      const methodLabel = { card: 'Карта', sbp: 'СБП', crypto: 'Крипто' }[method] || method;
      sendTelegramMessage(
        env.TOKEN_CLIENT, env.ADMIN_CHAT_ID,
        `📋 Новая заявка на выплату амбассадора\nID: ${chatId}\nСумма: ${Math.floor(amount)} ₽\nСпособ: ${methodLabel}`,
        { parseMode: 'HTML' }
      ).catch(() => {});
    }
    return true;
  }

Важно: вставить этот блок ПЕРЕД строкой `if (!stateRow || stateRow.state !== 'awaiting_nps_review') return false;`

Также нужно добавить новые callback_data в routeUpdate.
Найди в функции routeUpdate блок (строки 817–822):

    if (callbackData === 'become_ambassador' || callbackData === 'ambassador_cabinet' ||
        callbackData === 'amb_confirm' || callbackData?.startsWith('amb_partner_') ||
        callbackData === 'ambassador_earnings' || callbackData === 'ambassador_add_partner' ||
        callbackData === 'ambassador_payout') {
      return await handleAmbassador(env, update);
    }

Замени на:

    if (callbackData === 'become_ambassador' || callbackData === 'ambassador_cabinet' ||
        callbackData === 'amb_confirm' || callbackData?.startsWith('amb_partner_') ||
        callbackData === 'ambassador_earnings' || callbackData === 'ambassador_add_partner' ||
        callbackData === 'ambassador_payout' ||
        callbackData === 'payout_method_card' || callbackData === 'payout_method_sbp' ||
        callbackData === 'payout_method_crypto') {
      return await handleAmbassador(env, update);
    }

Не изменяй ничего кроме описанных мест.
```

---

## ШАГ 8 — Валидация: максимальная сумма

**Открыть в Cursor:** `cloudflare/workers/api/index.js`

**Промпт:**
```
В файле cloudflare/workers/api/index.js найди хендлер POST /transactions.
Там уже есть проверка (строки ~846–858):

    if (txn_type !== 'accrual' && txn_type !== 'spend') {
      return jsonResponse({
        success: false,
        error: 'Неверный тип транзакции. Используйте "accrual" или "spend".',
      }, 400);
    }

    if (amount <= 0) {
      return jsonResponse({
        success: false,
        error: 'Сумма должна быть больше 0',
      }, 400);
    }

Сразу после блока `if (amount <= 0) { ... }` добавь:

    if (!Number.isFinite(Number(amount))) {
      return jsonResponse({
        success: false,
        error: 'Сумма должна быть числом',
      }, 400);
    }

    if (Number(amount) > 1_000_000) {
      return jsonResponse({
        success: false,
        error: 'Сумма не может превышать 1 000 000',
      }, 400);
    }

Больше ничего не меняй.
```

---

## ШАГ 9 — HMAC: исправить слабую проверку

**Открыть в Cursor:** `cloudflare/workers/client-webhook/index.js`

**Промпт:**
```
В файле cloudflare/workers/client-webhook/index.js найди блок (строки 42–60):

      // Validate webhook secret token (if configured AND sent by Telegram)
      const secretToken = env.WEBHOOK_SECRET_TOKEN;
      const receivedToken = request.headers.get('X-Telegram-Bot-Api-Secret-Token');

      // Only validate if both secret token is configured AND Telegram sends it
      // If Telegram doesn't send the token header, we skip validation
      if (secretToken && receivedToken) {
        if (receivedToken !== secretToken) {
          console.error('[Webhook] Invalid secret token received');
          await logError('Webhook validation', new Error('Invalid secret token'), {
            url: request.url,
            method: request.method,
          }, request, env);
          return errorResponse('Unauthorized', 401);
        }
        console.log('[Webhook] Secret token validated successfully');
      } else if (secretToken && !receivedToken) {
        console.log('[Webhook] Secret token configured but not sent by Telegram - skipping validation');
      }

Замени его на:

      // Validate webhook secret token
      const secretToken = env.WEBHOOK_SECRET_TOKEN;
      if (secretToken) {
        const receivedToken = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
        if (receivedToken !== secretToken) {
          console.error('[Webhook] Invalid or missing secret token');
          await logError('Webhook validation', new Error('Invalid secret token'), {
            url: request.url,
            method: request.method,
          }, request, env);
          return errorResponse('Unauthorized', 401);
        }
        console.log('[Webhook] Secret token validated');
      }

Затем открой cloudflare/workers/admin-webhook/index.js и найди аналогичный блок (строки 42–60):

      // Validate webhook secret token (optional - only if configured and sent by Telegram)
      const secretToken = env.WEBHOOK_SECRET_TOKEN;
      const receivedToken = request.headers.get('X-Telegram-Bot-Api-Secret-Token');

      // Only validate if both secret token is configured AND Telegram sends it
      // If Telegram doesn't send the token header, we skip validation
      if (secretToken && receivedToken) {
        if (receivedToken !== secretToken) {
          console.error('[Webhook] Invalid secret token');
          await logError('Webhook validation', new Error('Invalid secret token'), {
            url: request.url,
            method: request.method,
          }, request, env);
          return errorResponse('Unauthorized', 401);
        }
        console.log('[Webhook] Secret token validated successfully');
      } else {
        console.log('[Webhook] Secret token validation skipped (not configured or not sent by Telegram)');
      }

Замени его на:

      // Validate webhook secret token
      const secretToken = env.WEBHOOK_SECRET_TOKEN;
      if (secretToken) {
        const receivedToken = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
        if (receivedToken !== secretToken) {
          console.error('[Webhook] Invalid or missing secret token');
          await logError('Webhook validation', new Error('Invalid secret token'), {
            url: request.url,
            method: request.method,
          }, request, env);
          return errorResponse('Unauthorized', 401);
        }
        console.log('[Webhook] Secret token validated');
      }

Не меняй ничего кроме этих двух блоков в двух файлах.
Partner-webhook не трогай — там уже правильная логика.
```

---

## Итоговая таблица

| Шаг | Файл(ы) | Действие после |
|-----|---------|----------------|
| 1 | `migrations/add_karma_calculation_rpc.sql` (новый) | Применить в Supabase SQL Editor |
| 2 | `cloudflare/workers/api/supabase.js` | `wrangler deploy` для api worker |
| 3 | `cloudflare/workers/api/index.js` | `wrangler deploy` для api worker |
| 4 | `cloudflare/workers/client-webhook/supabase.js` + `client.js` | `wrangler deploy` для client-webhook |
| 5 | `migrations/add_ambassador_payout_requests.sql` (новый) | Применить в Supabase SQL Editor |
| 6 | `cloudflare/workers/client-webhook/supabase.js` | (включено в deploy шага 7) |
| 7 | `cloudflare/workers/client-webhook/client.js` | `wrangler deploy` для client-webhook |
| 8 | `cloudflare/workers/api/index.js` | `wrangler deploy` для api worker |
| 9 | `client-webhook/index.js` + `admin-webhook/index.js` | `wrangler deploy` для обоих workers |

## Как проверить каждый шаг

| Шаг | Проверка |
|-----|----------|
| 1–4 | Провести транзакцию в боте → проверить `users.karma_score` в Supabase → должно измениться от 50 |
| 5–7 | В боте нажать «Запросить выплату» → пройти флоу суммы → выбрать метод → ввести реквизиты → проверить таблицу `ambassador_payout_requests` в Supabase |
| 8 | POST на `/transactions` с `amount: -1` → должен вернуть 400. POST с `amount: 9999999` → тоже 400 |
| 9 | POST на вебхук без заголовка `X-Telegram-Bot-Api-Secret-Token` (при заполненном `WEBHOOK_SECRET_TOKEN` в env) → должен вернуть 401 |
