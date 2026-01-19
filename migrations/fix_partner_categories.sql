-- Исправление категорий партнёров и услуг для единообразия
-- Выполните этот скрипт в Supabase SQL Editor

-- 1. Установить business_type для всех партнёров на основе их услуг
-- Используем самую частую категорию услуг партнёра
UPDATE partners p
SET business_type = (
  SELECT s.category
  FROM services s
  WHERE s.partner_chat_id::text = p.chat_id::text
    AND s.approval_status = 'Approved'
    AND s.is_active = true
  GROUP BY s.category
  ORDER BY COUNT(*) DESC
  LIMIT 1
)
WHERE p.business_type IS NULL
  AND EXISTS (
    SELECT 1 FROM services s 
    WHERE s.partner_chat_id::text = p.chat_id::text
      AND s.approval_status = 'Approved'
      AND s.is_active = true
  );

-- 2. Обновить категории услуг на business_type партнёра
-- Это гарантирует, что все услуги партнёра будут в одной группе
UPDATE services s
SET category = p.business_type
FROM partners p
WHERE s.partner_chat_id::text = p.chat_id::text
  AND p.business_type IS NOT NULL
  AND s.category != p.business_type
  AND s.approval_status = 'Approved'
  AND s.is_active = true;

-- 3. Проверка результата: сколько партнёров имеют business_type
SELECT 
    COUNT(*) as total_partners,
    COUNT(business_type) as partners_with_business_type,
    COUNT(*) - COUNT(business_type) as partners_without_business_type
FROM partners;

-- 4. Проверка: сколько услуг имеют категорию, соответствующую business_type партнёра
SELECT 
    COUNT(*) as total_services,
    COUNT(CASE WHEN s.category = p.business_type THEN 1 END) as services_matching_business_type,
    COUNT(CASE WHEN s.category != p.business_type OR p.business_type IS NULL THEN 1 END) as services_not_matching
FROM services s
LEFT JOIN partners p ON s.partner_chat_id::text = p.chat_id::text
WHERE s.approval_status = 'Approved' 
  AND s.is_active = true;

-- 5. Показать партнёров с разными категориями услуг (проблемные случаи)
SELECT 
    p.chat_id,
    p.name,
    p.business_type,
    COUNT(DISTINCT s.category) as different_categories_count,
    STRING_AGG(DISTINCT s.category, ', ' ORDER BY s.category) as categories_list
FROM partners p
INNER JOIN services s ON s.partner_chat_id::text = p.chat_id::text
WHERE s.approval_status = 'Approved' 
  AND s.is_active = true
GROUP BY p.chat_id, p.name, p.business_type
HAVING COUNT(DISTINCT s.category) > 1
ORDER BY different_categories_count DESC;
