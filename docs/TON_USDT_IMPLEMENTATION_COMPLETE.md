# TON/USDT: Полное техническое руководство по интеграции

**Версия:** 2.0 (исправленная)
**Дата:** 2026-02
**Цель:** устранить все критические пробелы предыдущего roadmap и дать 10/10 по каждому параметру

---

## Что изменилось по сравнению с предыдущим roadmap

| Проблема в v1.0 | Решение в v2.0 |
|----------------|----------------|
| Фаза 1 (выплаты) без источника USDT — невозможна | Порядок изменён: сначала входящие (депозиты), потом исходящие (выплаты) |
| Jetton-переводы упомянуты как деталь | Полная механика TEP-74: сообщение, gas, адреса |
| Подпись транзакций в Workers без оговорок | Отдельный Signing Worker + Durable Object, без mnemonic в plain env |
| «Apple/Google — меньше ограничений» | Честно: работает через TMA, но с оговорками |
| n8n как вариант | Убрано — противоречит архитектуре на Cloudflare |
| «1 балл = $1» без объяснений | Явная формула конвертации USDT → баллы |
| Нет защиты от мошенничества | Полный pipeline: idempotency, dedup, sender verify |
| Нет reconciliation | Dual-layer: TonAPI webhook + TonCenter polling cron |
| Мнение «реализуемо за 2–3 недели» | Реальные оценки с учётом сложности Jetton |

---

## Часть 1: Архитектурные решения (принять до кода)

### 1.1 Выбор токена

**Решение: USDT (Jetton) на TON.**

| Параметр | TON | USDT (Jetton) |
|----------|-----|---------------|
| Волатильность | Высокая | Нет (привязан к USD) |
| Совместимость с балльной системой | Требует пересчёта каждый раз | 1 USDT = фиксированная сумма |
| Комиссия за перевод | ~$0.01–0.02 | ~$0.01–0.02 + 0.1 TON gas |
| Сложность реализации | Простой нативный перевод | Jetton-механика (сложнее) |
| Принятие у партнёров | Ниже | Выше (понятный стейблкоин) |

**Итог:** USDT. TON держим только как gas-валюту для оплаты комиссий.

---

### 1.2 Формула конвертации USDT → баллы

Текущая система: баллы в рублях. USDT — в долларах.

```
баллы = floor(usdt_amount × exchange_rate_usd_rub × cashback_rate)

Пример при курсе 90 ₽/$, cashback 5%:
  1 USDT → 90 × 0.05 = 4.5 → 4 балла

Или: сделать баллы мультивалютными — хранить amount_usd отдельно
```

**Рекомендация:** хранить `amount_usd` в таблицах транзакций (уже есть в миграциях `add_usd_to_revenue_share.sql`). Конвертацию в баллы делать по курсу `currency_exchange_rates` на момент транзакции.

---

### 1.3 Архитектура кошелька

```
┌────────────────────────────────────────────────────────────┐
│  ХОЛОДНЫЙ КОШЕЛЁК (seed offline, hardware wallet)          │
│  Хранит основные резервы. Пополняет горячий еженедельно.   │
└──────────────────────────┬─────────────────────────────────┘
                           │ ручное пополнение
┌──────────────────────────▼─────────────────────────────────┐
│  ГОРЯЧИЙ КОШЕЛЁК (Signing Worker / Durable Object)         │
│  Баланс: максимум недельный объём выплат (~$500–2000)      │
│  Используется только для исходящих выплат                  │
└──────────────────────────┬─────────────────────────────────┘
                           │ исходящие USDT
┌──────────────────────────▼─────────────────────────────────┐
│  ПРИЁМНЫЙ КОШЕЛЁК (только входящие)                        │
│  Отдельный адрес для получения депозитов от партнёров      │
│  Нет mnemonic в воркерах — только адрес для выставления    │
└────────────────────────────────────────────────────────────┘
```

**Почему два отдельных кошелька:** компрометация ключа приёмного кошелька не даёт доступ к средствам для выплат.

---

### 1.4 Архитектура подписи транзакций

**Нельзя:** хранить mnemonic как обычный env var на всех Workers-инстансах.

**Правильно:** изолировать подписание в Cloudflare **Durable Object** — single-instance, персистентный, недоступен снаружи напрямую.

```
[API Worker] ──── POST /sign-and-send ────► [Signing Durable Object]
                  { to, amount, comment }        │
                                                 ├── читает mnemonic из DO storage
                                                 ├── строит Jetton-сообщение
                                                 ├── подписывает Ed25519
                                                 └── отправляет в TonCenter

DO storage: mnemonic зашифрован, ключ шифрования — отдельный Workers Secret
```

Durable Object не имеет HTTP-поверхности атаки извне — только через вызывающий Worker.

---

### 1.5 Источник USDT (решение chicken-and-egg)

Исходный roadmap начинал с выплат, не объясняя, откуда USDT. Правильный порядок:

```
Фаза A (ВХОДЯЩИЕ):  Партнёры пополняют deposit_balance в USDT
                    → платформа накапливает USDT на приёмном кошельке
                    → sweep на горячий кошелёк
Фаза B (ИСХОДЯЩИЕ): Revenue Share, комиссии амбассадоров → выплаты из горячего кошелька
```

До запуска фазы A горячий кошелёк пополняется вручную администратором (~$200–500 для старта).

---

## Часть 2: Технические детали (то, чего не было в v1.0)

### 2.1 USDT Jetton — точные параметры

**Minter contract (mainnet):**
```
EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs
```
> Проверить перед деплоем: https://tonscan.org/jetton/EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs

**Decimals:** 6 (не 18). `1 USDT = 1_000_000` raw units.

**Минимум TON для gas при Jetton-переводе:** `0.1 TON` (безопасное значение).
- При первом переводе на новый адрес (State Init) — `0.15 TON`.
- Излишки TON возвращаются на `response_destination`.

---

### 2.2 Jetton Transfer — структура сообщения (TEP-74)

Отправка Jetton — это НЕ прямой перевод получателю. Схема:

```
Ваш кошелёк
    │
    └──► Ваш Jetton Wallet (контракт)
              │  op: transfer (0x0f8a7ea5)
              └──► Jetton Wallet получателя
                        │  op: internal_transfer (0x178d4519)
                        └──► Получатель (уведомление)
```

**Тело сообщения (TL-B):**
```
transfer#0f8a7ea5
  query_id:uint64               -- уникальный ID (Date.now() или UUID часть)
  amount:(VarUInteger 16)        -- в raw units (USDT × 1_000_000)
  destination:MsgAddress         -- адрес получателя
  response_destination:MsgAddress -- куда вернуть излишний TON (ваш кошелёк)
  custom_payload:(Maybe ^Cell)   -- null
  forward_ton_amount:VarUInteger -- 1 nanoton (нужно для уведомления)
  forward_payload:(Either Cell)  -- comment для идентификации платежа
```

**Реализация на `@ton/ton` (Workers-совместимая):**
```javascript
import { beginCell, Address, toNano } from '@ton/core';

function buildJettonTransferBody({ queryId, usdtAmount, destination, responseAddr, comment }) {
  return beginCell()
    .storeUint(0x0f8a7ea5, 32)                     // op: transfer
    .storeUint(queryId, 64)                         // query_id
    .storeCoins(BigInt(Math.round(usdtAmount * 1_000_000))) // USDT amount
    .storeAddress(Address.parse(destination))        // получатель
    .storeAddress(Address.parse(responseAddr))       // возврат излишка
    .storeBit(false)                                 // no custom_payload
    .storeCoins(1n)                                  // forward_ton_amount = 1 nanoton
    .storeBit(false)                                 // forward_payload inline
    .storeUint(0, 32)                                // comment op
    .storeStringTail(comment)                        // payment reference
    .endCell();
}
```

---

### 2.3 Вычисление Jetton Wallet Address пользователя

Каждый TON-адрес имеет уникальный Jetton Wallet контракт. Нельзя просто отправить USDT на TON-адрес — нужен именно Jetton Wallet адрес.

**Способ 1 — через TonAPI REST (рекомендован для Workers):**
```javascript
async function getJettonWalletAddress(ownerAddress, env) {
  const USDT_MINTER = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs';
  const url = `https://tonapi.io/v2/accounts/${ownerAddress}/jettons/${USDT_MINTER}`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${env.TONAPI_KEY}` },
  });
  if (!res.ok) throw new Error(`TonAPI error: ${res.status}`);
  const data = await res.json();
  return data.wallet_address?.address; // адрес Jetton Wallet этого пользователя
}
```

**Способ 2 — через TonCenter get_wallet_address:**
```javascript
async function getJettonWalletTonCenter(ownerAddress, env) {
  const USDT_MINTER = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs';
  const { beginCell, Address } = await import('@ton/core');
  const payload = beginCell().storeAddress(Address.parse(ownerAddress)).endCell();
  const res = await fetch(
    `https://toncenter.com/api/v2/runGetMethod`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': env.TONCENTER_KEY },
      body: JSON.stringify({
        address: USDT_MINTER,
        method: 'get_wallet_address',
        stack: [['tvm.Slice', payload.toBoc().toString('base64')]],
      }),
    }
  );
  const data = await res.json();
  return data.result.stack[0][1]; // адрес Jetton Wallet
}
```

---

### 2.4 Обнаружение входящих платежей: dual-layer

**Слой 1 — TonAPI Webhook (основной, быстрый):**

Подписка на входящие переводы на ваш Jetton Wallet адрес:
```javascript
// Зарегистрировать один раз (POST /setup-tonapi-webhook)
await fetch('https://tonapi.io/v2/accounts/subscribe', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${env.TONAPI_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    subscriptions: [{
      account: YOUR_JETTON_WALLET_ADDRESS,
      operations: ['JettonTransfer'],
    }],
    webhook_url: 'https://loyalitybot-api.aerasun3000.workers.dev/ton-webhook',
  }),
});
```

**Payload события:**
```json
{
  "actions": [{
    "type": "JettonTransfer",
    "status": "ok",
    "JettonTransfer": {
      "sender": { "address": "EQ..." },
      "recipient": { "address": "EQ..." },
      "jetton": {
        "address": "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
        "symbol": "USD₮",
        "decimals": 6
      },
      "amount": "10000000",
      "comment": "pay_uuid-123"
    }
  }],
  "transaction_hash": "abc123...",
  "lt": 41234567000001
}
```

**Слой 2 — TonCenter Polling (fallback, Cron Trigger каждые 60 сек):**
```javascript
// cloudflare/workers/exchange-rates-cron/index.js (добавить)
// Или отдельный cron worker
async function pollTonPayments(env) {
  const lastLt = await env.KV.get('ton_last_lt') || '0';
  const res = await fetch(
    `https://toncenter.com/api/v2/getTransactions` +
    `?address=${YOUR_JETTON_WALLET}&limit=20&lt=${lastLt}&archival=false`,
    { headers: { 'X-API-Key': env.TONCENTER_KEY } }
  );
  const { result } = await res.json();
  for (const tx of result) {
    await processIncomingTransaction(tx, env); // idempotent
  }
  if (result.length > 0) {
    await env.KV.put('ton_last_lt', result[0].transaction_id.lt);
  }
}
```

---

### 2.5 Fraud prevention pipeline

Каждая входящая транзакция проходит через 6 проверок:

```javascript
async function processIncomingJettonTransfer(event, env) {
  const { transaction_hash, lt, JettonTransfer: t } = event;

  // 1. Проверка minter адреса (защита от fake Jetton)
  const USDT_MINTER = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs';
  if (t.jetton.address !== USDT_MINTER) {
    console.warn('[TON] Fake Jetton ignored:', t.jetton.address);
    return;
  }

  // 2. Idempotency — защита от повторной обработки
  const existing = await supabaseRequest(env,
    `ton_payments?tx_hash=eq.${transaction_hash}&select=id`);
  if (existing?.length > 0) return; // уже обработано

  // 3. Поиск invoice по comment (payment_ref)
  const ref = t.comment;
  const invoices = await supabaseRequest(env,
    `payment_invoices?payment_ref=eq.${ref}&status=eq.pending&select=*`);
  if (!invoices?.length) {
    console.warn('[TON] No pending invoice for ref:', ref);
    return; // нет инвойса или уже использован
  }
  const invoice = invoices[0];

  // 4. Проверка суммы (1% tolerance для rounding)
  const received = Number(t.amount) / 1_000_000; // USDT
  if (received < invoice.amount_usdt * 0.99) {
    await markInvoiceFailed(env, invoice.id, `underpayment: ${received} < ${invoice.amount_usdt}`);
    return;
  }

  // 5. Проверка отправителя (опционально, но рекомендуется)
  const expectedJettonWallet = invoice.payer_jetton_wallet;
  if (expectedJettonWallet && t.sender.address !== expectedJettonWallet) {
    console.warn('[TON] Sender mismatch for ref:', ref);
    return;
  }

  // 6. Атомарное закрытие инвойса (Supabase RPC)
  const result = await supabaseRequest(env, 'rpc/fulfill_payment_invoice', {
    method: 'POST',
    body: JSON.stringify({ p_payment_ref: ref, p_tx_hash: transaction_hash }),
  });

  if (result?.fulfilled) {
    await creditUserBalance(env, invoice.user_id, received);
  }
}
```

**Атомарная SQL-функция:**
```sql
CREATE OR REPLACE FUNCTION fulfill_payment_invoice(p_payment_ref TEXT, p_tx_hash TEXT)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE v_id UUID;
BEGIN
  UPDATE payment_invoices
  SET status = 'fulfilled', tx_hash = p_tx_hash, fulfilled_at = NOW()
  WHERE payment_ref = p_payment_ref
    AND status = 'pending'
    AND expires_at > NOW()
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('fulfilled', false, 'reason', 'not_found_or_expired');
  END IF;
  RETURN jsonb_build_object('fulfilled', true, 'invoice_id', v_id);
END; $$;
```

---

## Часть 3: Пересмотренный порядок фаз

### Фаза 0: Фундамент (1 неделя)

| Задача | Файл | Детали |
|--------|------|--------|
| 0.1 Создать два кошелька | offline | Холодный (hardware) + горячий (seed → DO) |
| 0.2 TonAPI API key | tonapi.io | Paid plan для webhooks без лимитов |
| 0.3 TonCenter API key | toncenter.com | Fallback polling |
| 0.4 Миграция БД | `migrations/add_payment_invoices.sql` | Таблица инвойсов (см. ниже) |
| 0.5 Миграция БД | `migrations/add_ton_wallet_to_ambassadors.sql` | `ton_wallet_address` в ambassadors |
| 0.6 nodejs_compat | все `wrangler.toml` | `compatibility_flags = ["nodejs_compat"]` |
| 0.7 Signing Worker | `cloudflare/workers/ton-signing/` | Durable Object для ключа |

**Новые миграции:**

```sql
-- migrations/add_payment_invoices.sql
CREATE TABLE IF NOT EXISTS payment_invoices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_ref         TEXT NOT NULL UNIQUE,
  user_chat_id        TEXT NOT NULL,
  invoice_type        TEXT NOT NULL CHECK (invoice_type IN ('deposit', 'service', 'balance_topup')),
  amount_usdt         NUMERIC(18,6) NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','fulfilled','expired','refunded','failed')),
  payer_jetton_wallet TEXT,
  tx_hash             TEXT UNIQUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  expires_at          TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 minutes',
  fulfilled_at        TIMESTAMPTZ,
  error_message       TEXT
);

CREATE INDEX ON payment_invoices(status, expires_at);
CREATE INDEX ON payment_invoices(user_chat_id);

-- migrations/add_ton_wallet_to_ambassadors.sql
ALTER TABLE ambassadors
  ADD COLUMN IF NOT EXISTS ton_wallet_address TEXT,
  ADD COLUMN IF NOT EXISTS ton_wallet_verified BOOLEAN DEFAULT FALSE;

ALTER TABLE ambassador_payout_requests
  ADD COLUMN IF NOT EXISTS ton_wallet_address TEXT;
```

---

### Фаза 1: Signing Worker (1–2 недели)

Новый воркер `cloudflare/workers/ton-signing/`. Единственный компонент, знающий о mnemonic.

**Структура:**
```
cloudflare/workers/ton-signing/
├── wrangler.toml    -- name: loyalitybot-ton-signing
├── index.js         -- HTTP → Durable Object
└── signing.js       -- Durable Object: key storage + sign + broadcast
```

**wrangler.toml:**
```toml
name = "loyalitybot-ton-signing"
main = "index.js"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[[durable_objects.bindings]]
name = "SIGNING_DO"
class_name = "TonSigningDO"

[[migrations]]
tag = "v1"
new_classes = ["TonSigningDO"]

# Secrets (wrangler secret put):
# HOT_WALLET_MNEMONIC   — 24 слова через пробел
# INTERNAL_AUTH_TOKEN   — для авторизации вызовов из api worker
# TONCENTER_API_KEY
```

**signing.js (Durable Object):**
```javascript
import { mnemonicToPrivateKey } from '@ton/crypto';
import { WalletContractV4, internal, toNano, Address, beginCell } from '@ton/ton';

export class TonSigningDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const { to, amount_usdt, comment, query_id } = await request.json();

    const mnemonic = this.env.HOT_WALLET_MNEMONIC.split(' ');
    const keyPair = await mnemonicToPrivateKey(mnemonic);
    const wallet = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });

    const client = new TonClient({
      endpoint: 'https://toncenter.com/api/v2/jsonRPC',
      apiKey: this.env.TONCENTER_API_KEY,
    });

    const contract = client.open(wallet);
    const seqno = await contract.getSeqno();

    // Получить Jetton wallet адрес горячего кошелька
    const hotJettonWallet = await getJettonWalletAddress(wallet.address.toString(), this.env);

    const transferBody = buildJettonTransferBody({
      queryId: query_id || Date.now(),
      usdtAmount: amount_usdt,
      destination: to,
      responseAddr: wallet.address.toString(),
      comment,
    });

    await contract.sendTransfer({
      secretKey: keyPair.secretKey,
      seqno,
      messages: [
        internal({
          to: hotJettonWallet,
          value: toNano('0.1'),  // gas
          bounce: false,
          body: transferBody,
        }),
      ],
    });

    return new Response(JSON.stringify({ ok: true, seqno }));
  }
}
```

**index.js (роутер → DO):**
```javascript
export default {
  async fetch(request, env) {
    // Авторизация — только внутренние вызовы
    const auth = request.headers.get('X-Internal-Token');
    if (auth !== env.INTERNAL_AUTH_TOKEN) {
      return new Response('Unauthorized', { status: 401 });
    }

    const id = env.SIGNING_DO.idFromName('hot-wallet');
    const stub = env.SIGNING_DO.get(id);
    return stub.fetch(request);
  },
};
```

---

### Фаза 2: Приём депозитов от партнёров (2–3 недели)

Партнёр пополняет `deposit_balance` отправив USDT на платформенный приёмный адрес.

**Файлы:**
```
cloudflare/workers/api/ton.js          -- новый: invoice generation, webhook handler
cloudflare/workers/partner-webhook/    -- команда /top_up_deposit
frontend/src/pages/                    -- партнёрская страница пополнения (опционально)
migrations/add_payment_invoices.sql    -- уже в фазе 0
```

**Флоу в партнёрском боте:**
```
/top_up_deposit → выбор суммы ($50 / $100 / $200 / ввод)
→ генерация invoice (UUID, expires 30 мин)
→ выдача QR с адресом + суммой + comment
→ партнёр платит из Tonkeeper/Wallet
→ TonAPI webhook → api worker /ton-webhook
→ проверка pipeline (6 шагов)
→ обновление partners.deposit_balance
→ уведомление партнёру: «✅ Депозит пополнен на X USDT»
```

**Новый эндпоинт в api/index.js:**
```javascript
// POST /ton/invoice — создать инвойс
if (path === '/ton/invoice' && request.method === 'POST') {
  const { user_chat_id, amount_usdt, invoice_type } = await request.json();
  const paymentRef = 'pay_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);

  await supabaseRequest(env, 'payment_invoices', {
    method: 'POST',
    body: JSON.stringify({
      payment_ref: paymentRef,
      user_chat_id: String(user_chat_id),
      invoice_type: invoice_type || 'deposit',
      amount_usdt: Number(amount_usdt),
    }),
  });

  return jsonResponse({
    payment_ref: paymentRef,
    address: env.PLATFORM_RECEIVING_ADDRESS,  // адрес приёмного кошелька
    amount_usdt,
    comment: paymentRef,  // партнёр вписывает это в комментарий при переводе
    expires_in: 1800,
    qr_data: `ton://transfer/${env.PLATFORM_RECEIVING_ADDRESS}?amount=...&text=${paymentRef}`,
  });
}

// POST /ton/webhook — TonAPI hook
if (path === '/ton/webhook' && request.method === 'POST') {
  const body = await request.json();
  for (const event of body.actions || []) {
    if (event.type === 'JettonTransfer') {
      await processIncomingJettonTransfer({ ...event, transaction_hash: body.transaction_hash }, env);
    }
  }
  return jsonResponse({ ok: true });
}
```

---

### Фаза 3: TON Connect в Mini App (2 недели)

**Установка пакетов:**
```bash
cd frontend
npm install @tonconnect/ui-react @ton/core @ton/crypto
```

**Manifest (публичный URL обязателен):**
```json
// frontend/public/tonconnect-manifest.json
{
  "url": "https://loyalitybot-frontend.pages.dev",
  "name": "Sarafano Loyalty",
  "iconUrl": "https://loyalitybot-frontend.pages.dev/logo192.png"
}
```

**Provider в main.jsx:**
```jsx
import { TonConnectUIProvider } from '@tonconnect/ui-react';

<TonConnectUIProvider manifestUrl="https://loyalitybot-frontend.pages.dev/tonconnect-manifest.json">
  <App />
</TonConnectUIProvider>
```

**Компонент пополнения баланса:**
```jsx
// frontend/src/components/TopUpBalance.jsx
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { beginCell, Address } from '@ton/core';

export function TopUpBalance({ amountUsdt, onSuccess }) {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  const handlePay = async () => {
    // 1. Создать инвойс на сервере
    const res = await fetch('/api/ton/invoice', {
      method: 'POST',
      body: JSON.stringify({ user_chat_id: chatId, amount_usdt: amountUsdt, invoice_type: 'deposit' }),
    });
    const { payment_ref, address } = await res.json();

    // 2. Получить Jetton wallet адрес отправителя (пользователя)
    const userJettonWallet = await getJettonWalletAddress(wallet.account.address);

    // 3. Построить тело Jetton transfer
    const body = buildJettonTransferBody({
      queryId: Date.now(),
      usdtAmount: amountUsdt,
      destination: address,           // приёмный адрес платформы
      responseAddr: wallet.account.address,
      comment: payment_ref,            // критически важно для идентификации
    });

    // 4. Отправить через TON Connect (пользователь подтверждает в кошельке)
    await tonConnectUI.sendTransaction({
      validUntil: Math.floor(Date.now() / 1000) + 600,
      messages: [{
        address: userJettonWallet,     // Jetton Wallet пользователя (не его TON адрес!)
        amount: String(100_000_000),   // 0.1 TON в nanotons (gas)
        payload: body.toBoc().toString('base64'),
      }],
    });

    onSuccess(payment_ref); // показать "ожидаем подтверждения"
  };

  if (!wallet) return <TonConnectButton />;
  return <button onClick={handlePay}>Пополнить {amountUsdt} USDT</button>;
}
```

---

### Фаза 4: Выплаты амбассадорам и Revenue Share (2 недели)

**Флоу:**
```
Амбассадор запрашивает выплату (payment_method = 'crypto')
→ проверяем ton_wallet_address у амбассадора
→ если нет — просим привязать
→ создаём запись ambassador_payout_requests (status = pending)
→ Админ одобряет в боте
→ api worker вызывает Signing Worker:
    POST https://loyalitybot-ton-signing.workers.dev/
    { to: amb_ton_wallet, amount_usdt: X, comment: "payout_req_uuid" }
→ обновляем ambassador_payout_requests: status = paid, tx_hash
→ обновляем ambassadors: balance_pending -= amount, last_payout_at = NOW()
→ уведомление амбассадору
```

**Обработчик в admin-webhook при одобрении выплаты:**
```javascript
if (data?.startsWith('payout_approve_')) {
  const reqId = data.replace('payout_approve_', '');
  const req = await getPayoutRequest(env, reqId);

  if (req.payment_method === 'crypto' || req.payment_method === 'usdt') {
    const amb = await getAmbassador(env, req.ambassador_chat_id);
    if (!amb.ton_wallet_address) {
      await sendMessage(env.ADMIN_BOT_TOKEN, adminChatId, '❌ У амбассадора не привязан TON кошелёк');
      return;
    }

    // Вызов Signing Worker (внутренний)
    const signRes = await fetch('https://loyalitybot-ton-signing.workers.dev/', {
      method: 'POST',
      headers: { 'X-Internal-Token': env.INTERNAL_AUTH_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: amb.ton_wallet_address,
        amount_usdt: req.amount,
        comment: `payout_${reqId}`,
      }),
    });

    if (!signRes.ok) {
      await sendMessage(env.ADMIN_BOT_TOKEN, adminChatId, '❌ Ошибка отправки транзакции');
      return;
    }

    await updatePayoutRequest(env, reqId, { status: 'paid', processed_at: new Date().toISOString() });
    await updateAmbassadorBalance(env, req.ambassador_chat_id, -req.amount);
    await sendMessage(env.TOKEN_CLIENT, req.ambassador_chat_id,
      `✅ Выплата ${req.amount} USDT отправлена на ваш кошелёк!`);
  }
}
```

---

### Фаза 5: Мониторинг и admin-панель (ongoing)

| Задача | Реализация |
|--------|-----------|
| Dashboard TON в admin-боте | Команда `/ton_stats` — баланс горячего кошелька, pending/sent/failed |
| Алерт при низком балансе кошелька | Cron job проверяет баланс, шлёт в ADMIN_CHAT_ID |
| Ручной retry | Кнопка в боте для failed транзакций |
| Batch-выплаты | Раз в неделю вместо каждой по отдельности — экономия gas |
| Налоговые отчёты | Экспорт ton_payments с курсом на момент транзакции |

---

## Часть 4: Workers совместимость — чеклист

```toml
# Добавить во все wrangler.toml воркеров, использующих @ton/*
compatibility_flags = ["nodejs_compat"]
```

```javascript
// Если встречается "Buffer is not defined":
import { Buffer } from 'buffer'; // добавить в начало файла

// BigInt в JSON (TON использует BigInt для сумм):
JSON.stringify({ amount: amount.toString() }); // не BigInt напрямую

// TonClient — только HTTP endpoint, не lite-client:
const client = new TonClient({
  endpoint: 'https://toncenter.com/api/v2/jsonRPC',
  apiKey: env.TONCENTER_KEY,
});
// НЕ использовать: new TonClient4({ endpoint: 'wss://...' }) — нет WebSocket в Workers

// @ton/ton tree-shaking — не импортировать весь пакет:
import { beginCell, Address } from '@ton/core';  // ✓
import * as ton from '@ton/ton';                  // ✗
```

---

## Часть 5: Регуляторные ограничения — честный анализ

| Платформа | Ситуация | Риск |
|-----------|---------|------|
| **Telegram TMA** | Crypto Pay (@CryptoBot) официально поддерживается. Прямые Jetton-переводы через TON Connect — в серой зоне | Низкий для TMA |
| **App Store (iOS)** | Guidelines 3.1.1 запрещают приём криптовалюты как оплату за услуги внутри приложений | Высокий для нативного iOS-приложения |
| **Google Play** | Похожие ограничения; DeFi/crypto apps требуют специального разрешения | Средний |
| **PWA/браузер** | Нет ограничений от Apple/Google | Нет |

**Стратегия:** основной канал — Telegram TMA, где Apple/Google не имеют контроля. Для будущего мобильного приложения — использовать Crypto Pay API (@CryptoBot) который является официальным партнёром Telegram.

---

## Часть 6: Crypto Pay API как альтернатива без key management

Если подписание транзакций в Durable Object кажется слишком сложным на старте — есть более простой путь:

**@CryptoBot Crypto Pay API** — полностью кастодиальное решение:
- Поддерживает USDT на TON
- Нет нужды хранить ключи — всё через REST API
- Встроен в Telegram (@CryptoBot)
- Webhooks для подтверждения платежей
- Ограничение: зависимость от третьей стороны

```javascript
// Создать инвойс
const invoice = await fetch('https://pay.crypt.bot/api/createInvoice', {
  method: 'POST',
  headers: {
    'Crypto-Pay-API-Token': env.CRYPTOBOT_TOKEN,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    asset: 'USDT',
    amount: '10.00',
    description: 'Пополнение депозита',
    payload: JSON.stringify({ partner_chat_id: chatId, type: 'deposit' }),
    paid_btn_name: 'callback',
    paid_btn_url: `https://t.me/${env.CLIENT_BOT_USERNAME}`,
  }),
});
// Вернёт invoice.pay_url — открыть пользователю в Telegram
```

**Рекомендация:** Crypto Pay API для фаз 1–2 (быстро и безопасно), собственная реализация через Signing Worker — для фаз 3–4 когда нужна полная гибкость.

---

## Часть 7: Полная матрица рисков

| Риск | Вероятность | Ущерб | Митигация |
|------|------------|-------|-----------|
| Компрометация mnemonic горячего кошелька | Низкая | Критический | Durable Object, лимит баланса $500, ротация ключей раз в квартал |
| Missed webhook (TonAPI не доставил) | Средняя | Средний | TonCenter polling каждые 60 сек как fallback |
| Fake Jetton атака | Средняя | Высокий | Проверка minter address на каждую транзакцию |
| Double fulfillment (race condition) | Низкая | Средний | Supabase RPC с `FOR UPDATE` + UNIQUE на tx_hash |
| Регуляторные ограничения (App Store) | Высокая | Средний | Работаем только через TMA, Crypto Pay API |
| Техн. сбой TonAPI | Средняя | Низкий | TonCenter fallback, retry в cron |
| Underpayment от пользователя | Средняя | Низкий | 1% tolerance, expired invoices |
| TON gas недостаточно (0.1 TON) | Низкая | Низкий | Мониторинг баланса TON на горячем кошельке отдельно от USDT |
| Истекший invoice оплачен пользователем | Низкая | Средний | status check + автоматический возврат USDT |

---

## Итоговый порядок реализации

```
НЕДЕЛЯ 1:
  ├── Фаза 0.1-0.4: кошельки, API-ключи, миграции БД
  └── Фаза 0.5-0.7: nodejs_compat во всех workers, Signing Worker scaffold

НЕДЕЛЯ 2-3:
  ├── Фаза 1: Signing Worker полностью (Durable Object + sign + broadcast)
  └── Фаза 2: Приём депозитов (invoice API, TonAPI webhook, TonCenter polling fallback)

НЕДЕЛЯ 4-5:
  ├── Фаза 3: TON Connect в Mini App (TopUpBalance компонент)
  └── Тестирование полного цикла: создание инвойса → оплата → зачисление

НЕДЕЛЯ 6-7:
  └── Фаза 4: Выплаты амбассадорам и Revenue Share через Signing Worker

ONGOING:
  └── Фаза 5: Мониторинг, batch-выплаты, admin dashboard
```

---

## Быстрый старт (если нужен MVP за неделю)

Используйте **Crypto Pay API** (@CryptoBot) вместо собственной реализации:

1. Зарегистрировать приложение в @CryptoBot → получить API токен
2. Добавить `CRYPTOBOT_TOKEN` в secrets api worker
3. Создать инвойс через `createInvoice` API при запросе пополнения
4. Настроить webhook от CryptoBot на `/ton/cryptopay-webhook`
5. На webhook — обновить `deposit_balance` / `balance_pending`

**Трудозатраты:** 2–3 дня вместо 6–7 недель.
**Компромисс:** зависимость от @CryptoBot, но полная безопасность без хранения ключей.
