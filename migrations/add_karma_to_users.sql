-- ============================================
-- Karma Indicator (Social Capital) - Phase 1
-- Дата: 2025-02
-- ============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS karma_score NUMERIC(5,2) DEFAULT 50;
ALTER TABLE users ADD COLUMN IF NOT EXISTS karma_level TEXT DEFAULT 'reliable';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_karma_level_check;
ALTER TABLE users ADD CONSTRAINT users_karma_level_check CHECK (karma_level IN ('sprout', 'reliable', 'regular', 'golden'));

COMMENT ON COLUMN users.karma_score IS 'Социальный капитал 0–100: NPS, рефералы, регулярность';
COMMENT ON COLUMN users.karma_level IS 'Уровень кармы: sprout, reliable, regular, golden';

CREATE INDEX IF NOT EXISTS idx_users_karma_score ON users(karma_score);
