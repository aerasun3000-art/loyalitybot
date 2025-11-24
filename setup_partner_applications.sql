-- ============================================
-- Полная настройка таблицы partner_applications
-- Выполните этот скрипт в SQL Editor вашего проекта Supabase
-- ============================================

-- 1. Создаем таблицу partner_applications, если её нет
CREATE TABLE IF NOT EXISTS partner_applications (
    chat_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    company_name TEXT NOT NULL,
    city TEXT DEFAULT '',
    district TEXT DEFAULT '',
    status TEXT DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Добавляем поля city и district, если их еще нет (на случай, если таблица уже существовала)
ALTER TABLE partner_applications 
ADD COLUMN IF NOT EXISTS city TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS district TEXT DEFAULT '';

-- 3. Обновляем значения по умолчанию для существующих записей
UPDATE partner_applications 
SET city = '' WHERE city IS NULL;
UPDATE partner_applications 
SET district = '' WHERE district IS NULL;

-- 4. Создаем индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_partner_applications_status ON partner_applications(status);
CREATE INDEX IF NOT EXISTS idx_partner_applications_city ON partner_applications(city);
CREATE INDEX IF NOT EXISTS idx_partner_applications_created_at ON partner_applications(created_at);

-- 5. Настраиваем RLS (Row Level Security) policies
-- Включаем RLS
ALTER TABLE partner_applications ENABLE ROW LEVEL SECURITY;

-- Удаляем старые policies, если они есть
DROP POLICY IF EXISTS "Allow public insert" ON partner_applications;
DROP POLICY IF EXISTS "Allow public select" ON partner_applications;
DROP POLICY IF EXISTS "Allow public update" ON partner_applications;

-- Policy для INSERT: разрешаем всем вставлять заявки (для регистрации партнеров)
CREATE POLICY "Allow public insert" ON partner_applications
    FOR INSERT
    TO public
    WITH CHECK (true);

-- Policy для SELECT: разрешаем всем читать заявки (для проверки статуса)
CREATE POLICY "Allow public select" ON partner_applications
    FOR SELECT
    TO public
    USING (true);

-- Policy для UPDATE: разрешаем обновлять только админам (через service_role key)
-- Обычные пользователи не могут обновлять заявки напрямую
CREATE POLICY "Allow service role update" ON partner_applications
    FOR UPDATE
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 6. Добавляем комментарии к полям
COMMENT ON TABLE partner_applications IS 'Заявки на партнерство';
COMMENT ON COLUMN partner_applications.chat_id IS 'Telegram chat_id партнера (PRIMARY KEY)';
COMMENT ON COLUMN partner_applications.name IS 'Имя партнера';
COMMENT ON COLUMN partner_applications.phone IS 'Телефон партнера';
COMMENT ON COLUMN partner_applications.company_name IS 'Название компании';
COMMENT ON COLUMN partner_applications.city IS 'Город работы партнера (Online, New York, Los Angeles, etc.)';
COMMENT ON COLUMN partner_applications.district IS 'Район работы партнера (All для всех городов)';
COMMENT ON COLUMN partner_applications.status IS 'Статус заявки: Pending, Approved, Rejected';
COMMENT ON COLUMN partner_applications.created_at IS 'Дата создания заявки';

-- 7. Проверяем структуру таблицы
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns
WHERE table_name = 'partner_applications'
ORDER BY ordinal_position;









