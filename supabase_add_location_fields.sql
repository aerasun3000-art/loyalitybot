-- Добавление полей city и district в таблицы partner_applications и partners
-- Выполните этот скрипт в SQL Editor вашего проекта Supabase

-- Добавляем поля в partner_applications (если их еще нет)
ALTER TABLE partner_applications 
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS district TEXT;

-- Добавляем поля в partners (если их еще нет)
ALTER TABLE partners
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS district TEXT;

-- Создаем индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_partners_city ON partners(city);
CREATE INDEX IF NOT EXISTS idx_partners_district ON partners(district);

-- Комментарии
COMMENT ON COLUMN partner_applications.city IS 'Город работы партнера';
COMMENT ON COLUMN partner_applications.district IS 'Район работы партнера';
COMMENT ON COLUMN partners.city IS 'Город работы партнера';
COMMENT ON COLUMN partners.district IS 'Район работы партнера';

