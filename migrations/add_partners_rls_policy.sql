-- ============================================
-- RLS политика для анонимного доступа к таблице partners
-- Необходима для отображения данных партнёров на фронтенде
-- Выполните этот скрипт в Supabase SQL Editor
-- ============================================

-- Включаем RLS для таблицы partners (если ещё не включено)
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

-- Удаляем старую политику, если она существует (для пересоздания)
DROP POLICY IF EXISTS "Allow anonymous read access to partners" ON partners;

-- Создаём политику для анонимного чтения (SELECT)
-- Это позволяет фронтенду загружать данные партнёров для отображения услуг
CREATE POLICY "Allow anonymous read access to partners"
ON partners
FOR SELECT
TO anon
USING (true);

-- Комментарий к политике
COMMENT ON POLICY "Allow anonymous read access to partners" ON partners IS 
'Разрешает анонимным пользователям (фронтенд) читать данные партнёров для отображения услуг. 
Необходимо для корректной работы страницы услуг, где показываются названия партнёров.';

-- Проверка: убеждаемся, что политика создана
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename = 'partners'
  AND policyname = 'Allow anonymous read access to partners';
