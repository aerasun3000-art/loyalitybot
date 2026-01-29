-- ============================================
-- Миграция для поддержки мультикатегорий партнеров
-- Позволяет партнерам иметь несколько категорий услуг
-- Выполните в Supabase SQL Editor
-- ============================================

-- 1. Создаем таблицу для мультикатегорий партнеров
CREATE TABLE IF NOT EXISTS partner_categories (
  id SERIAL PRIMARY KEY,
  partner_chat_id TEXT NOT NULL REFERENCES partners(chat_id) ON DELETE CASCADE,
  business_type TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(partner_chat_id, business_type)
);

-- 2. Создаем индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_partner_categories_partner ON partner_categories(partner_chat_id);
CREATE INDEX IF NOT EXISTS idx_partner_categories_business_type ON partner_categories(business_type);
CREATE INDEX IF NOT EXISTS idx_partner_categories_primary ON partner_categories(partner_chat_id, is_primary) WHERE is_primary = true;

-- 3. Миграция существующих данных: переносим business_type из partners в partner_categories
INSERT INTO partner_categories (partner_chat_id, business_type, is_primary)
SELECT 
  chat_id,
  business_type,
  true
FROM partners
WHERE business_type IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM partner_categories 
    WHERE partner_categories.partner_chat_id = partners.chat_id 
      AND partner_categories.business_type = partners.business_type
  )
ON CONFLICT (partner_chat_id, business_type) DO NOTHING;

-- 4. Обновляем комментарии
COMMENT ON TABLE partner_categories IS 'Мультикатегории партнеров. Позволяет партнеру иметь несколько категорий услуг.';
COMMENT ON COLUMN partner_categories.partner_chat_id IS 'Chat ID партнера';
COMMENT ON COLUMN partner_categories.business_type IS 'Категория услуг (nail_care, restaurant, fashion, и т.д.)';
COMMENT ON COLUMN partner_categories.is_primary IS 'Основная категория партнера (используется для обратной совместимости)';

-- 5. Создаем функцию для получения всех категорий партнера
CREATE OR REPLACE FUNCTION get_partner_categories(p_chat_id TEXT)
RETURNS TABLE(business_type TEXT, is_primary BOOLEAN) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pc.business_type,
    pc.is_primary
  FROM partner_categories pc
  WHERE pc.partner_chat_id = p_chat_id
  ORDER BY pc.is_primary DESC, pc.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- 6. Создаем функцию для получения основной категории партнера (для обратной совместимости)
CREATE OR REPLACE FUNCTION get_partner_primary_category(p_chat_id TEXT)
RETURNS TEXT AS $$
DECLARE
  primary_cat TEXT;
BEGIN
  SELECT business_type INTO primary_cat
  FROM partner_categories
  WHERE partner_chat_id = p_chat_id AND is_primary = true
  LIMIT 1;
  
  -- Если нет в partner_categories, берем из partners.business_type (для обратной совместимости)
  IF primary_cat IS NULL THEN
    SELECT business_type INTO primary_cat
    FROM partners
    WHERE chat_id = p_chat_id;
  END IF;
  
  RETURN primary_cat;
END;
$$ LANGUAGE plpgsql;

-- 7. Обновляем RLS политики для partner_categories
ALTER TABLE partner_categories ENABLE ROW LEVEL SECURITY;

-- Политика для чтения (всем)
CREATE POLICY "Allow read partner_categories"
ON partner_categories
FOR SELECT
TO anon, authenticated, service_role
USING (true);

-- Политика для вставки (всем, для создания заявок)
CREATE POLICY "Allow insert partner_categories"
ON partner_categories
FOR INSERT
TO anon, authenticated, service_role
WITH CHECK (true);

-- Политика для обновления (всем)
CREATE POLICY "Allow update partner_categories"
ON partner_categories
FOR UPDATE
TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);

-- Политика для удаления (всем)
CREATE POLICY "Allow delete partner_categories"
ON partner_categories
FOR DELETE
TO anon, authenticated, service_role
USING (true);

-- 8. Проверка: сколько партнеров имеют категории
SELECT 
  COUNT(DISTINCT partner_chat_id) as partners_with_categories,
  COUNT(*) as total_category_assignments
FROM partner_categories;
