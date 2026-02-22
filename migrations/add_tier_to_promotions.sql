-- Migration: Tier-based Promotions
-- Purpose: add user tiers (by balance) and min_tier/tier_visibility to promotions

-- 1. Add tier support to promotions
ALTER TABLE promotions
  ADD COLUMN IF NOT EXISTS min_tier TEXT
    CHECK (min_tier IN ('bronze','silver','gold','platinum','diamond')),
  ADD COLUMN IF NOT EXISTS tier_visibility TEXT NOT NULL DEFAULT 'all'
    CHECK (tier_visibility IN ('all', 'tier_only'));

-- 2. Cache user tier in users (for performance)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'bronze'
    CHECK (tier IN ('bronze','silver','gold','platinum','diamond'));

-- 3. Function: calculate tier from balance
CREATE OR REPLACE FUNCTION get_tier_for_balance(bal NUMERIC)
RETURNS TEXT AS $$
BEGIN
  IF bal >= 10000 THEN RETURN 'diamond';
  ELSIF bal >= 5000 THEN RETURN 'platinum';
  ELSIF bal >= 2000 THEN RETURN 'gold';
  ELSIF bal >= 500  THEN RETURN 'silver';
  ELSE RETURN 'bronze';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. Trigger: update tier when balance changes
CREATE OR REPLACE FUNCTION update_user_tier()
RETURNS TRIGGER AS $$
BEGIN
  NEW.tier := get_tier_for_balance(NEW.balance);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_user_tier ON users;
CREATE TRIGGER trg_update_user_tier
  BEFORE INSERT OR UPDATE OF balance ON users
  FOR EACH ROW EXECUTE FUNCTION update_user_tier();

-- 5. Backfill existing users
UPDATE users SET tier = get_tier_for_balance(balance);
