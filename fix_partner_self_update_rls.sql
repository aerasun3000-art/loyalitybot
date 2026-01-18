-- Исправление RLS политик для обновления partner_applications и partners
-- Позволяет партнерам обновлять свои данные через дашборд
-- Выполните в Supabase SQL Editor

-- ============================================
-- 1. Исправление политик для partner_applications
-- ============================================

-- Проверить текущие политики для partner_applications
SELECT 
    policyname,
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'partner_applications'
ORDER BY cmd, policyname;

-- Удалить старые политики UPDATE (если есть)
DROP POLICY IF EXISTS "Allow update partner_applications" ON partner_applications;
DROP POLICY IF EXISTS "Enable update for partner_applications" ON partner_applications;
DROP POLICY IF EXISTS "Users can update partner_applications" ON partner_applications;
DROP POLICY IF EXISTS "Allow service role to update partner_applications" ON partner_applications;
DROP POLICY IF EXISTS "Allow anon to update partner_applications" ON partner_applications;
DROP POLICY IF EXISTS "Allow service role update" ON partner_applications;

-- Создать политику для обновления (для anon, authenticated и service_role)
-- Это позволит партнерам обновлять свои данные через дашборд
CREATE POLICY "Allow anon to update partner_applications"
ON partner_applications
FOR UPDATE
TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);

-- Убедиться, что RLS включен
ALTER TABLE partner_applications ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. Проверка и исправление политик для partners
-- ============================================

-- Проверить текущие политики для partners
SELECT 
    policyname,
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'partners'
ORDER BY cmd, policyname;

-- Удалить старые политики UPDATE для partners (если есть)
DROP POLICY IF EXISTS "Allow update partners" ON partners;
DROP POLICY IF EXISTS "Enable update for partners" ON partners;
DROP POLICY IF EXISTS "Users can update partners" ON partners;
DROP POLICY IF EXISTS "Allow service role to update partners" ON partners;
DROP POLICY IF EXISTS "Allow anon to update partners" ON partners;

-- Создать политику для обновления partners (для anon, authenticated и service_role)
CREATE POLICY "Allow anon to update partners"
ON partners
FOR UPDATE
TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);

-- Убедиться, что RLS включен
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. Проверка политик после исправления
-- ============================================

-- Проверить политики для partner_applications
SELECT 
    'partner_applications' as table_name,
    policyname,
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'partner_applications'
ORDER BY cmd, policyname;

-- Проверить политики для partners
SELECT 
    'partners' as table_name,
    policyname,
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'partners'
ORDER BY cmd, policyname;
