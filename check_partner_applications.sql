-- ============================================
-- Проверка структуры таблицы partner_applications
-- Выполните этот скрипт в SQL Editor вашего проекта Supabase
-- ============================================

-- 1. Просмотр всех колонок таблицы
SELECT 
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default,
    CASE 
        WHEN pk.constraint_name IS NOT NULL THEN 'YES'
        ELSE 'NO'
    END as is_primary_key
FROM information_schema.columns c
LEFT JOIN (
    SELECT 
        kcu.column_name,
        kcu.table_schema,
        kcu.table_name,
        tc.constraint_name,
        tc.constraint_type
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
        AND tc.table_name = kcu.table_name
    WHERE tc.table_name = 'partner_applications' 
        AND tc.constraint_type = 'PRIMARY KEY'
) pk ON c.column_name = pk.column_name
    AND c.table_schema = pk.table_schema
    AND c.table_name = pk.table_name
WHERE c.table_name = 'partner_applications'
    AND c.table_schema = 'public'
ORDER BY c.ordinal_position;

-- 2. Проверка ограничений (constraints)
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
    AND tc.table_name = kcu.table_name
WHERE tc.table_name = 'partner_applications'
    AND tc.table_schema = 'public'
ORDER BY tc.constraint_type, kcu.ordinal_position;

-- 3. Проверка RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'partner_applications';

-- 4. Просмотр нескольких записей (если есть)
SELECT * FROM partner_applications LIMIT 5;

