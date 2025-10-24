-- ════════════════════════════════════════════════════════
-- 📸 Добавление поля image_url в таблицу promotions
-- ════════════════════════════════════════════════════════
-- 
-- Использование:
-- 1. Откройте Supabase Dashboard → SQL Editor
-- 2. Скопируйте весь этот файл
-- 3. Вставьте в SQL Editor
-- 4. Нажмите "Run" (или F5)
-- 
-- ════════════════════════════════════════════════════════

-- Добавляем колонку для хранения URL изображения из Supabase Storage
ALTER TABLE promotions
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Добавляем комментарий для документации
COMMENT ON COLUMN promotions.image_url IS 'URL изображения акции в Supabase Storage (bucket: promotion-images)';

-- Создаём индекс для оптимизации запросов с фильтрацией по image_url
CREATE INDEX IF NOT EXISTS idx_promotions_image_url 
ON promotions(image_url);

-- Опционально: добавляем constraint для валидации URL
-- ALTER TABLE promotions
-- ADD CONSTRAINT check_image_url_format 
-- CHECK (image_url IS NULL OR image_url ~* '^https?://');

-- ════════════════════════════════════════════════════════
-- ✅ Ожидаемый результат: "Success. No rows returned"
-- ════════════════════════════════════════════════════════

-- Проверка: посмотрите структуру таблицы
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'promotions' AND column_name = 'image_url';

-- Должно вернуть:
-- column_name | data_type | is_nullable
-- image_url   | text      | YES

