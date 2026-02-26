-- ============================================
-- Миграция: USDT-поддержка и входящие депозиты
-- Дата: 2026-02
-- ============================================

-- 1. Добавить поля для USDT и направления платежа
ALTER TABLE ton_payments
  ADD COLUMN IF NOT EXISTS usdt_amount   NUMERIC(18,6),
  ADD COLUMN IF NOT EXISTS jetton_master VARCHAR(48),
  ADD COLUMN IF NOT EXISTS token_type    VARCHAR(10) DEFAULT 'ton',
  ADD COLUMN IF NOT EXISTS direction     VARCHAR(10) DEFAULT 'outgoing',
  ADD COLUMN IF NOT EXISTS sender_address VARCHAR(48);

-- 2. Добавить CHECK-ограничения на новые поля (идемпотентно через DO)
DO $$ BEGIN
  ALTER TABLE ton_payments ADD CONSTRAINT ton_payments_token_type_check
    CHECK (token_type IN ('ton', 'usdt'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE ton_payments ADD CONSTRAINT ton_payments_direction_check
    CHECK (direction IN ('incoming', 'outgoing'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Расширить payment_type — добавить 'deposit'
--    (удаляем старый constraint и создаём новый)
ALTER TABLE ton_payments
  DROP CONSTRAINT IF EXISTS ton_payments_payment_type_check;

ALTER TABLE ton_payments
  ADD CONSTRAINT ton_payments_payment_type_check
    CHECK (payment_type IN ('revenue_share', 'referral_commission', 'manual', 'deposit'));

-- 4. Индексы
CREATE INDEX IF NOT EXISTS idx_ton_payments_direction
  ON ton_payments(direction);

CREATE INDEX IF NOT EXISTS idx_ton_payments_sender
  ON ton_payments(sender_address)
  WHERE sender_address IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ton_payments_jetton
  ON ton_payments(jetton_master)
  WHERE jetton_master IS NOT NULL;

-- 5. Комментарии
COMMENT ON COLUMN ton_payments.usdt_amount    IS 'Сумма в USDT (6 знаков после запятой)';
COMMENT ON COLUMN ton_payments.jetton_master  IS 'Адрес Jetton-мастера (контракт USDT)';
COMMENT ON COLUMN ton_payments.token_type     IS 'ton — нативный TON, usdt — Jetton USDT';
COMMENT ON COLUMN ton_payments.direction      IS 'incoming — от партнёра, outgoing — выплата партнёру';
COMMENT ON COLUMN ton_payments.sender_address IS 'TON-адрес отправителя (кошелёк партнёра)';
