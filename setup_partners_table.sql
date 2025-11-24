-- ============================================
-- Обновление таблицы partners (добавление полей city и district)
-- Выполните этот скрипт в SQL Editor вашего проекта Supabase
-- ============================================

-- 1. Создаем таблицу partners, если её нет
CREATE TABLE IF NOT EXISTS partners (
    chat_id TEXT PRIMARY KEY,
    name TEXT,
    company_name TEXT
);

-- 2. Добавляем поля city и district, если их еще нет
ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS city TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS district TEXT DEFAULT '';

-- 3. Обновляем значения по умолчанию для существующих записей
UPDATE partners 
SET city = '' WHERE city IS NULL;
UPDATE partners 
SET district = '' WHERE district IS NULL;

-- 4. Создаем индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_partners_city ON partners(city);
CREATE INDEX IF NOT EXISTS idx_partners_district ON partners(district);

-- 5. Добавляем комментарии
COMMENT ON COLUMN partners.city IS 'Город работы партнера';
COMMENT ON COLUMN partners.district IS 'Район работы партнера';









