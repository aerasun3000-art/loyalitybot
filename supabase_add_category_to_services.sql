-- Добавление поля category в таблицу services
-- Это поле будет хранить тег категории услуги (manicure, hairstyle, massage и т.д.)

ALTER TABLE services 
ADD COLUMN IF NOT EXISTS category TEXT;

-- Добавляем комментарий к полю
-- Включает все категории, используемые в боте и поддерживаемые фронтендом
COMMENT ON COLUMN services.category IS 
'Категория услуги. Поддерживаемые значения:
Основные (канонические): nail_care, brow_design, hair_salon, hair_removal, facial_aesthetics, lash_services, massage_therapy, makeup_pmu, body_wellness, nutrition_coaching, mindfulness_coaching, image_consulting
Старые (маппятся): manicure→nail_care, hairstyle→hair_salon, massage→massage_therapy, cosmetologist→facial_aesthetics, eyebrows→brow_design, eyelashes→lash_services, laser→hair_removal, makeup→makeup_pmu
Дополнительные: skincare→facial_aesthetics, cleaning, repair, delivery, fitness, spa, yoga, nutrition→nutrition_coaching, psychology→mindfulness_coaching';

-- Создаём индекс для быстрого поиска по категориям
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);

-- Создаём индекс для комбинации category и approval_status для фильтрации
CREATE INDEX IF NOT EXISTS idx_services_category_approval ON services(category, approval_status) 
WHERE approval_status = 'Approved' AND is_active = true;








