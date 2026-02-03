-- ============================================
-- Миграция: Добавление поля photo_url в partners
-- URL фото партнёра для карточек в каталоге услуг
-- ============================================

ALTER TABLE partners
ADD COLUMN IF NOT EXISTS photo_url TEXT;

COMMENT ON COLUMN partners.photo_url IS 'URL фото партнёра для карточек в каталоге услуг (кружок вместо иконки категории)';
