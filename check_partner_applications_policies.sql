-- ============================================
-- Проверка RLS политик для partner_applications
-- Выполните в Supabase SQL Editor
-- ============================================

-- Проверить все политики для partner_applications
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
