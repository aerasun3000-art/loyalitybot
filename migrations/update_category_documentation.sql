-- ============================================
-- Обновление документации категорий в базе данных
-- Синхронизация с фронтендом и ботами
-- Выполните этот скрипт в Supabase SQL Editor
-- ============================================

-- 1. Обновляем комментарий для services.category
-- Включает все категории, которые используются в боте и поддерживаются фронтендом
COMMENT ON COLUMN services.category IS 
'Категория услуги. Поддерживаемые значения:
Основные категории (канонические): nail_care, brow_design, hair_salon, hair_removal, facial_aesthetics, lash_services, massage_therapy, makeup_pmu, body_wellness, nutrition_coaching, mindfulness_coaching, image_consulting
Старые категории (маппятся на основные): manicure→nail_care, hairstyle→hair_salon, massage→massage_therapy, cosmetologist→facial_aesthetics, eyebrows→brow_design, eyelashes→lash_services, laser→hair_removal, makeup→makeup_pmu
Дополнительные категории: skincare→facial_aesthetics, cleaning, repair, delivery, fitness, spa, yoga, nutrition→nutrition_coaching, psychology→mindfulness_coaching';

-- 2. Обновляем комментарий для partners.business_type
-- Используются канонические категории (основные 12)
COMMENT ON COLUMN partners.business_type IS 
'Категория услуг партнера (канонические значения):
nail_care, brow_design, hair_salon, hair_removal, facial_aesthetics, lash_services, massage_therapy, makeup_pmu, body_wellness, nutrition_coaching, mindfulness_coaching, image_consulting
При создании услуги бот автоматически использует business_type партнера, если он установлен';

-- 3. Обновляем комментарий для partner_applications.business_type
COMMENT ON COLUMN partner_applications.business_type IS 
'Категория услуг партнера (копируется в partners.business_type при одобрении):
nail_care, brow_design, hair_salon, hair_removal, facial_aesthetics, lash_services, massage_therapy, makeup_pmu, body_wellness, nutrition_coaching, mindfulness_coaching, image_consulting';

-- 4. Проверка: какие категории используются в services
-- Показывает все уникальные категории в базе
SELECT 
    category,
    COUNT(*) as service_count,
    COUNT(CASE WHEN approval_status = 'Approved' AND is_active = true THEN 1 END) as active_approved_count
FROM services
WHERE category IS NOT NULL
GROUP BY category
ORDER BY service_count DESC;

-- 5. Проверка: какие категории используются в partners.business_type
SELECT 
    business_type,
    COUNT(*) as partner_count
FROM partners
WHERE business_type IS NOT NULL
GROUP BY business_type
ORDER BY partner_count DESC;

-- 6. Проверка несоответствий: категории в services, которых нет в partners.business_type
-- Это нормально, т.к. в services могут быть старые категории (manicure, hairstyle и т.д.)
SELECT DISTINCT
    s.category as service_category,
    COUNT(*) as count
FROM services s
LEFT JOIN partners p ON s.partner_chat_id::text = p.chat_id::text
WHERE s.category IS NOT NULL
  AND (p.business_type IS NULL OR s.category != p.business_type)
GROUP BY s.category
ORDER BY count DESC;

-- 7. Проверка: партнеры без business_type
SELECT 
    COUNT(*) as partners_without_business_type,
    COUNT(CASE WHEN EXISTS (
        SELECT 1 FROM services s 
        WHERE s.partner_chat_id::text = partners.chat_id::text 
        AND s.approval_status = 'Approved' 
        AND s.is_active = true
    ) THEN 1 END) as partners_with_services_but_no_business_type
FROM partners
WHERE business_type IS NULL;
