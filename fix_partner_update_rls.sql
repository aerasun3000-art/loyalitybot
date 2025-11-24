-- Исправление RLS политик для обновления partner_applications
-- Выполните в Supabase SQL Editor

-- 1. Удалить старые политики UPDATE (если есть)
DROP POLICY IF EXISTS "Allow update partner_applications" ON partner_applications;
DROP POLICY IF EXISTS "Enable update for partner_applications" ON partner_applications;
DROP POLICY IF EXISTS "Users can update partner_applications" ON partner_applications;

-- 2. Создать политику для обновления статуса (для сервисной роли)
-- Это позволит обновлять статус через service_role ключ
CREATE POLICY "Allow service role to update partner_applications"
ON partner_applications
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- 3. Альтернатива: разрешить обновление всем (если используется service_role)
-- Если вы используете service_role ключ в коде, эта политика не нужна
-- Но если используете anon ключ, нужна такая политика:

-- Для anon роли (если нужно)
-- CREATE POLICY "Allow anon to update partner_applications"
-- ON partner_applications
-- FOR UPDATE
-- TO anon
-- USING (true)
-- WITH CHECK (true);

-- 4. Проверить, что RLS включен
ALTER TABLE partner_applications ENABLE ROW LEVEL SECURITY;

-- 5. Проверить политики
SELECT 
    policyname,
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'partner_applications';









