-- Добавляет поле visibility_mode в таблицу promotions
-- public — акция видна всем
-- hide_competitors — скрыта от партнёров той же категории (business_type) и города

ALTER TABLE promotions
  ADD COLUMN IF NOT EXISTS visibility_mode TEXT NOT NULL DEFAULT 'public'
  CHECK (visibility_mode IN ('public', 'hide_competitors'));

CREATE INDEX IF NOT EXISTS idx_promotions_visibility_mode
  ON promotions (visibility_mode);

COMMENT ON COLUMN promotions.visibility_mode IS
  'public — видна всем; hide_competitors — скрыта от партнёров-конкурентов той же категории';
