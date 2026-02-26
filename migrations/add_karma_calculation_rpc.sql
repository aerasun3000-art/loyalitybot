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
