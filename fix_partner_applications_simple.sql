-- ============================================
-- Упрощенная версия исправления таблицы
-- Выполняйте по одному блоку за раз
-- ============================================

-- БЛОК 1: Исправление опечатки company_nam -> company_name
-- (Выполните только если поле называется company_nam)
ALTER TABLE partner_applications 
RENAME COLUMN company_nam TO company_name;

-- БЛОК 2: Добавление поля created_at (если его нет)
ALTER TABLE partner_applications 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- БЛОК 3: Установка значений по умолчанию для city и district
ALTER TABLE partner_applications 
ALTER COLUMN city SET DEFAULT '';

ALTER TABLE partner_applications 
ALTER COLUMN district SET DEFAULT '';

-- БЛОК 4: Обновление NULL значений
UPDATE partner_applications 
SET city = '' WHERE city IS NULL;

UPDATE partner_applications 
SET district = '' WHERE district IS NULL;

UPDATE partner_applications 
SET created_at = NOW() WHERE created_at IS NULL;

-- БЛОК 5: Создание уникального индекса на chat_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_applications_chat_id 
ON partner_applications(chat_id) 
WHERE chat_id IS NOT NULL AND chat_id != '';

-- БЛОК 6: Настройка RLS (Row Level Security)
ALTER TABLE partner_applications ENABLE ROW LEVEL SECURITY;

-- БЛОК 7: Удаление старых policies (если есть)
DROP POLICY IF EXISTS "Allow public insert" ON partner_applications;
DROP POLICY IF EXISTS "Allow public select" ON partner_applications;
DROP POLICY IF EXISTS "Allow public update" ON partner_applications;
DROP POLICY IF EXISTS "Allow service role update" ON partner_applications;

-- БЛОК 8: Создание новых policies
CREATE POLICY "Allow public insert" ON partner_applications
    FOR INSERT
    TO public
    WITH CHECK (true);

CREATE POLICY "Allow public select" ON partner_applications
    FOR SELECT
    TO public
    USING (true);

CREATE POLICY "Allow service role update" ON partner_applications
    FOR UPDATE
    TO service_role
    USING (true)
    WITH CHECK (true);









