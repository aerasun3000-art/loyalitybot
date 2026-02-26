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
