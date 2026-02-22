-- Migration: Ambassador Program
-- Purpose: tables ambassadors, ambassador_partners, ambassador_earnings; partner commission; transaction attribution

-- 1. Таблица амбассадоров
CREATE TABLE IF NOT EXISTS ambassadors (
  chat_id            TEXT PRIMARY KEY REFERENCES users(chat_id),
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  status             TEXT NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'suspended', 'blocked')),
  tier_at_signup     TEXT NOT NULL
                       CHECK (tier_at_signup IN ('silver','gold','platinum','diamond')),
  max_partners       INT NOT NULL DEFAULT 3,
  ambassador_code    TEXT UNIQUE,
  total_earnings     NUMERIC DEFAULT 0,
  balance_pending    NUMERIC DEFAULT 0,
  last_payout_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ambassadors_status ON ambassadors(status);
CREATE INDEX IF NOT EXISTS idx_ambassadors_code ON ambassadors(ambassador_code);

-- 2. Связь амбассадор ↔ партнёры
CREATE TABLE IF NOT EXISTS ambassador_partners (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_chat_id   TEXT NOT NULL REFERENCES ambassadors(chat_id) ON DELETE CASCADE,
  partner_chat_id       TEXT NOT NULL REFERENCES partners(chat_id) ON DELETE CASCADE,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ambassador_chat_id, partner_chat_id)
);

CREATE INDEX IF NOT EXISTS idx_amb_partners_amb ON ambassador_partners(ambassador_chat_id);
CREATE INDEX IF NOT EXISTS idx_amb_partners_partner ON ambassador_partners(partner_chat_id);

-- 3. Начисления амбассадорам
CREATE TABLE IF NOT EXISTS ambassador_earnings (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_chat_id   TEXT NOT NULL REFERENCES ambassadors(chat_id),
  partner_chat_id      TEXT NOT NULL REFERENCES partners(chat_id),
  transaction_id       INTEGER REFERENCES transactions(id),
  check_amount         NUMERIC NOT NULL,
  commission_pct       NUMERIC NOT NULL,
  gross_amount         NUMERIC NOT NULL,
  platform_fee         NUMERIC NOT NULL,
  ambassador_amount    NUMERIC NOT NULL,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  payout_id            UUID
);

-- 4. Ставка комиссии у партнёра для амбассадоров
ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS ambassador_commission_pct NUMERIC DEFAULT 0.10;

-- 5. Атрибуция транзакции к амбассадору
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS ambassador_chat_id TEXT REFERENCES ambassadors(chat_id);

-- 6. Уникальный код амбассадора — автогенерация при регистрации
CREATE OR REPLACE FUNCTION generate_ambassador_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ambassador_code IS NULL THEN
    NEW.ambassador_code := 'amb_' || SUBSTRING(MD5(NEW.chat_id || NOW()::TEXT), 1, 8);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ambassador_code ON ambassadors;
CREATE TRIGGER trg_ambassador_code
  BEFORE INSERT ON ambassadors
  FOR EACH ROW EXECUTE FUNCTION generate_ambassador_code();
