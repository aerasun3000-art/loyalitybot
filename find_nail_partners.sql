-- ============================================
-- Поиск партнеров-маникюров в базе данных
-- Используйте этот скрипт перед выполнением create_nail_services.sql
-- ============================================

-- 1. Поиск партнеров с категорией nail_care
SELECT 
  chat_id,
  name,
  company_name,
  business_type,
  city,
  district,
  status,
  created_at
FROM partners
WHERE business_type = 'nail_care'
ORDER BY created_at DESC;

-- 2. Поиск по ключевым словам в названии компании
SELECT 
  chat_id,
  name,
  company_name,
  business_type
FROM partners
WHERE company_name ILIKE '%маникюр%'
   OR company_name ILIKE '%nail%'
   OR company_name ILIKE '%ногти%'
   OR company_name ILIKE '%Totally%'
   OR company_name ILIKE '%Nailed%'
ORDER BY created_at DESC;

-- 3. Все партнеры (последние 20)
SELECT 
  chat_id,
  name,
  company_name,
  business_type,
  status
FROM partners
ORDER BY created_at DESC
LIMIT 20;

-- 4. Поиск партнеров, у которых уже есть услуги в категории nail_care
SELECT DISTINCT
  p.chat_id,
  p.name,
  p.company_name,
  p.business_type,
  COUNT(s.id) as services_count
FROM partners p
LEFT JOIN services s ON p.chat_id = s.partner_chat_id 
  AND s.category IN ('nail_care', 'manicure')
WHERE p.business_type = 'nail_care'
   OR s.category IN ('nail_care', 'manicure')
GROUP BY p.chat_id, p.name, p.company_name, p.business_type
ORDER BY services_count DESC, p.created_at DESC;

-- 5. Поиск по конкретному имени или компании (замените 'ПОИСК' на нужное значение)
-- SELECT 
--   chat_id,
--   name,
--   company_name,
--   business_type
-- FROM partners
-- WHERE name ILIKE '%ПОИСК%'
--    OR company_name ILIKE '%ПОИСК%';


