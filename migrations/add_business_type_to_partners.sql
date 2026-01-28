-- Добавляем поле business_type в partners если его нет
ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS business_type TEXT;

-- Комментарий
COMMENT ON COLUMN partners.business_type IS 'Категория услуг партнера (nail_care, restaurant, fitness и т.д.)';

-- Создаем индекс
CREATE INDEX IF NOT EXISTS idx_partners_business_type ON partners(business_type);
