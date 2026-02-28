/**
 * TON/USDT Payout Cron — Phase 1
 *
 * Reads pending outgoing payments from ton_payments,
 * sends USDT to partner wallets via TON WalletV4,
 * updates status in Supabase.
 *
 * Run: node index.js
 * Requires env: SUPABASE_URL, SUPABASE_KEY, TON_MNEMONIC, TONAPI_KEY
 */

import { mnemonicToPrivateKey } from '@ton/crypto';
import { WalletContractV4, TonClient4, Address, toNano, internal, beginCell, JettonMaster } from '@ton/ton';

// ─── Config ─────────────────────────────────────────────────────────────────

const SUPABASE_URL    = process.env.SUPABASE_URL;
const SUPABASE_KEY    = process.env.SUPABASE_KEY;
const MNEMONIC        = process.env.TON_MNEMONIC;   // 24 слова через пробел
const TONAPI_KEY      = process.env.TONAPI_KEY;

const PLATFORM_WALLET = 'UQCdiz8-tpuz6Hp9cGniE0m2oPaOpRcj6x9hhzm_R77N9jdX';
const PLATFORM_RAW    = '0:9d8b3f3eb69bb3e87a7d7069e21349b6a0f68ea51723eb1f618739bf47becdf6';
const USDT_MASTER     = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs';
const TON_FOR_GAS     = toNano('0.05');   // TON на gas за каждый USDT-transfer
const FORWARD_AMOUNT  = toNano('0.01');   // forward_amount в jetton transfer
const BATCH_LIMIT     = 10;              // максимум выплат за один запуск
const TX_DELAY_MS     = 6000;            // пауза между транзакциями (сек)

// ─── Supabase helper ─────────────────────────────────────────────────────────

async function sb(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: opts.prefer || 'return=minimal',
      ...opts.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase ${opts.method || 'GET'} /${path} → ${res.status}: ${body}`);
  }
  return res.status === 204 ? null : res.json();
}

// ─── TonAPI helper ────────────────────────────────────────────────────────────

async function tonapi(path) {
  const res = await fetch(`https://tonapi.io/v2${path}`, {
    headers: { Authorization: `Bearer ${TONAPI_KEY}` },
  });
  if (!res.ok) throw new Error(`TonAPI ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

// ─── Get jetton wallet address for platform wallet ────────────────────────────

async function getPlatformJettonWallet(client) {
  const jettonMaster = client.open(JettonMaster.create(Address.parse(USDT_MASTER)));
  return await jettonMaster.getWalletAddress(Address.parse(PLATFORM_WALLET));
}

// ─── Build USDT transfer body (TEP-74) ───────────────────────────────────────

function buildUsdtTransfer(recipientAddr, usdtAmountUnits) {
  return beginCell()
    .storeUint(0xf8a7ea5, 32)          // op: transfer
    .storeUint(0, 64)                   // query_id
    .storeCoins(usdtAmountUnits)        // amount (6 decimals)
    .storeAddress(recipientAddr)        // destination
    .storeAddress(Address.parse(PLATFORM_WALLET)) // response_destination
    .storeBit(0)                        // no custom_payload
    .storeCoins(FORWARD_AMOUNT)         // forward_ton_amount
    .storeBit(0)                        // no forward_payload
    .endCell();
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // Validate env
  if (!SUPABASE_URL || !SUPABASE_KEY || !MNEMONIC || !TONAPI_KEY) {
    console.error('[ton-payout] Missing env vars: SUPABASE_URL, SUPABASE_KEY, TON_MNEMONIC, TONAPI_KEY');
    process.exit(1);
  }

  console.log(`[ton-payout] Starting — ${new Date().toISOString()}`);

  // 1. Fetch pending outgoing payments with partner wallet
  const payments = await sb(
    `ton_payments?direction=eq.outgoing&status=eq.pending` +
    `&select=id,partner_chat_id,usdt_amount,to_address,comment,payment_type` +
    `&order=created_at.asc&limit=${BATCH_LIMIT}`,
    { headers: { Prefer: 'return=representation' } }
  );

  if (!payments || payments.length === 0) {
    console.log('[ton-payout] No pending payments — exiting');
    return;
  }

  console.log(`[ton-payout] Found ${payments.length} pending payment(s)`);

  // 2. Derive wallet keypair from mnemonic
  const words = MNEMONIC.trim().split(/\s+/);
  const keyPair = await mnemonicToPrivateKey(words);

  // 3. Connect to TON via TonAPI v4 endpoint
  const client = new TonClient4({ endpoint: 'https://mainnet-v4.tonhubapi.com' });
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
  const contract = client.open(wallet);

  // Verify wallet address matches PLATFORM_WALLET
  const derivedAddr = wallet.address.toString({ bounceable: false });
  if (derivedAddr !== PLATFORM_WALLET) {
    console.error(`[ton-payout] Wallet mismatch! Derived: ${derivedAddr}, expected: ${PLATFORM_WALLET}`);
    process.exit(1);
  }

  // 4. Get platform jetton wallet address
  const jettonWalletAddr = await getPlatformJettonWallet(client);
  console.log(`[ton-payout] Platform jetton wallet: ${jettonWalletAddr.toString()}`);

  // 5. Get current seqno
  let seqno = await contract.getSeqno();
  console.log(`[ton-payout] Seqno: ${seqno}`);

  // 6. Process each payment
  for (const payment of payments) {
    const { id, partner_chat_id, usdt_amount, to_address, comment } = payment;

    if (!to_address) {
      console.warn(`[ton-payout] Payment ${id}: no to_address — skipping`);
      await sb(`ton_payments?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'failed', error_message: 'No recipient address' }),
      });
      continue;
    }

    let recipientAddr;
    try {
      recipientAddr = Address.parse(to_address);
    } catch {
      console.error(`[ton-payout] Payment ${id}: invalid address ${to_address}`);
      await sb(`ton_payments?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'failed', error_message: `Invalid address: ${to_address}` }),
      });
      continue;
    }

    const usdtUnits = BigInt(Math.round(Number(usdt_amount) * 1_000_000));
    if (usdtUnits <= 0n) {
      console.error(`[ton-payout] Payment ${id}: zero amount`);
      await sb(`ton_payments?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'failed', error_message: 'Zero amount' }),
      });
      continue;
    }

    // Mark as sending
    await sb(`ton_payments?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'sending', sent_at: new Date().toISOString() }),
    });

    try {
      const body = buildUsdtTransfer(recipientAddr, usdtUnits);

      await contract.sendTransfer({
        seqno,
        secretKey: keyPair.secretKey,
        messages: [
          internal({
            to: jettonWalletAddr,
            value: TON_FOR_GAS,
            body,
          }),
        ],
      });

      seqno++;

      await sb(`ton_payments?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'sent', from_address: PLATFORM_WALLET }),
      });

      console.log(`[ton-payout] ✅ Sent ${usdt_amount} USDT → ${to_address} (partner ${partner_chat_id})`);
    } catch (err) {
      console.error(`[ton-payout] ❌ Payment ${id} failed:`, err.message);
      await sb(`ton_payments?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'failed',
          error_message: err.message,
          retry_count: (payment.retry_count || 0) + 1,
          last_retry_at: new Date().toISOString(),
        }),
      });
    }

    // Пауза между транзакциями
    if (payments.indexOf(payment) < payments.length - 1) {
      await new Promise(r => setTimeout(r, TX_DELAY_MS));
    }
  }

  console.log(`[ton-payout] Done — ${new Date().toISOString()}`);
}

main().catch(err => {
  console.error('[ton-payout] Fatal error:', err);
  process.exit(1);
});
