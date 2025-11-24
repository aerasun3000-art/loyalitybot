-- Добавление поля category в таблицу services
-- Это поле будет хранить тег категории услуги (manicure, hairstyle, massage и т.д.)

ALTER TABLE services 
ADD COLUMN IF NOT EXISTS category TEXT;

-- Добавляем комментарий к полю
COMMENT ON COLUMN services.category IS 'Категория услуги: manicure, hairstyle, massage, cosmetologist, eyebrows, eyelashes, laser, makeup, skincare, cleaning, repair, delivery, fitness, spa, yoga, nutrition, psychology';

-- Создаём индекс для быстрого поиска по категориям
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);

-- Создаём индекс для комбинации category и approval_status для фильтрации
CREATE INDEX IF NOT EXISTS idx_services_category_approval ON services(category, approval_status) 
WHERE approval_status = 'Approved' AND is_active = true;








