-- Исправление RLS политик для обновления partner_applications
-- Выполните в Supabase SQL Editor

-- 1. Проверить текущие политики
SELECT 
    policyname,
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'partner_applications';

-- 2. Удалить старые политики UPDATE (если есть)
DROP POLICY IF EXISTS "Allow update partner_applications" ON partner_applications;
DROP POLICY IF EXISTS "Enable update for partner_applications" ON partner_applications;
DROP POLICY IF EXISTS "Users can update partner_applications" ON partner_applications;
DROP POLICY IF EXISTS "Allow service role to update partner_applications" ON partner_applications;
DROP POLICY IF EXISTS "Allow anon to update partner_applications" ON partner_applications;

-- 3. Создать политику для обновления (для anon роли)
-- Это позволит обновлять статус через anon ключ
CREATE POLICY "Allow anon to update partner_applications"
ON partner_applications
FOR UPDATE
TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);

-- 4. Проверить, что RLS включен
ALTER TABLE partner_applications ENABLE ROW LEVEL SECURITY;

-- 5. Проверить политики после создания
SELECT 
    policyname,
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'partner_applications'
ORDER BY cmd, policyname;









