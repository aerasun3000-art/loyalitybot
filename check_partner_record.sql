-- Проверка записи партнера в базе
-- Замените 6300830308 на нужный chat_id

-- 1. Проверить, существует ли запись
SELECT 
    chat_id,
    name,
    phone,
    company_name,
    city,
    district,
    status,
    created_at
FROM partner_applications
WHERE chat_id = '6300830308';

-- 2. Проверить тип данных chat_id
SELECT 
    column_name,
    data_type,
    character_maximum_length
FROM information_schema.columns
WHERE table_name = 'partner_applications'
  AND column_name = 'chat_id';

-- 3. Проверить все записи (для отладки)
SELECT 
    chat_id,
    status,
    created_at
FROM partner_applications
ORDER BY created_at DESC
LIMIT 10;

-- 4. Проверить RLS политики для UPDATE
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
WHERE tablename = 'partner_applications'
  AND cmd = 'UPDATE';









