-- ============================================
-- Исправление таблицы partner_applications
-- На основе скриншота видно несколько проблем:
-- 1. PRIMARY KEY - это id, а не chat_id
-- 2. Поле company_name называется company_nam (опечатка)
-- 3. Возможно отсутствует поле created_at
-- ============================================

-- 1. Исправляем опечатку в названии поля company_nam -> company_name
DO $$ 
BEGIN
    -- Проверяем, существует ли поле company_nam
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'partner_applications' 
        AND column_name = 'company_nam'
    ) THEN
        -- Переименовываем поле
        ALTER TABLE partner_applications 
        RENAME COLUMN company_nam TO company_name;
        
        RAISE NOTICE 'Поле company_nam переименовано в company_name';
    ELSE
        RAISE NOTICE 'Поле company_nam не найдено, возможно уже исправлено';
    END IF;
END $$;

-- 2. Добавляем поле created_at, если его нет
ALTER TABLE partner_applications 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- 3. Обновляем created_at для существующих записей, если оно NULL
UPDATE partner_applications 
SET created_at = NOW() 
WHERE created_at IS NULL;

-- 4. Убеждаемся, что поля city и district имеют значения по умолчанию
ALTER TABLE partner_applications 
ALTER COLUMN city SET DEFAULT '';

ALTER TABLE partner_applications 
ALTER COLUMN district SET DEFAULT '';

-- 5. Обновляем NULL значения в city и district
UPDATE partner_applications 
SET city = '' WHERE city IS NULL;

UPDATE partner_applications 
SET district = '' WHERE district IS NULL;

-- 6. Проверяем, можно ли использовать chat_id как уникальный ключ
-- Если PRIMARY KEY - это id, а chat_id должен быть уникальным
DO $$ 
BEGIN
    -- Проверяем, есть ли уникальный индекс на chat_id
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE tablename = 'partner_applications' 
        AND indexname LIKE '%chat_id%'
    ) THEN
        -- Создаем уникальный индекс на chat_id
        CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_applications_chat_id 
        ON partner_applications(chat_id) 
        WHERE chat_id IS NOT NULL AND chat_id != '';
        
        RAISE NOTICE 'Создан уникальный индекс на chat_id';
    END IF;
END $$;

-- 7. Настраиваем RLS policies (если еще не настроены)
ALTER TABLE partner_applications ENABLE ROW LEVEL SECURITY;

-- Удаляем старые policies, если они есть
DROP POLICY IF EXISTS "Allow public insert" ON partner_applications;
DROP POLICY IF EXISTS "Allow public select" ON partner_applications;
DROP POLICY IF EXISTS "Allow public update" ON partner_applications;
DROP POLICY IF EXISTS "Allow service role update" ON partner_applications;

-- Policy для INSERT: разрешаем всем вставлять заявки
CREATE POLICY "Allow public insert" ON partner_applications
    FOR INSERT
    TO public
    WITH CHECK (true);

-- Policy для SELECT: разрешаем всем читать заявки
CREATE POLICY "Allow public select" ON partner_applications
    FOR SELECT
    TO public
    USING (true);

-- Policy для UPDATE: разрешаем обновлять только админам
CREATE POLICY "Allow service role update" ON partner_applications
    FOR UPDATE
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 8. Финальная проверка структуры
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'partner_applications'
ORDER BY ordinal_position;









