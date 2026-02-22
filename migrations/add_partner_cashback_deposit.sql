-- Migration: add deposit_balance and partner_cashback_log
-- Purpose: track cashback issued by partner, deduct from partner deposit

-- 1. Add deposit fields to partners table
ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS deposit_balance NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_cashback_issued NUMERIC DEFAULT 0;

-- 2. Create partner_cashback_log table
CREATE TABLE IF NOT EXISTS partner_cashback_log (
  id              SERIAL PRIMARY KEY,
  partner_chat_id TEXT NOT NULL REFERENCES partners(chat_id),
  client_chat_id  TEXT NOT NULL REFERENCES users(chat_id),
  transaction_id  INTEGER REFERENCES transactions(id),
  check_amount    NUMERIC NOT NULL,
  cashback_points INTEGER NOT NULL,
  cashback_amount NUMERIC NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcl_partner_date
  ON partner_cashback_log (partner_chat_id, created_at);
