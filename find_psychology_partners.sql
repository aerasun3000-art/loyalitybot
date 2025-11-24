-- ============================================
-- Поиск партнеров-психологов в базе данных
-- Используйте этот скрипт перед выполнением create_psychology_services.sql
-- ============================================

-- 1. Поиск партнеров с категорией mindfulness_coaching
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
WHERE business_type = 'mindfulness_coaching'
ORDER BY created_at DESC;

-- 2. Поиск по ключевым словам в названии компании
SELECT 
  chat_id,
  name,
  company_name,
  business_type
FROM partners
WHERE company_name ILIKE '%психолог%'
   OR company_name ILIKE '%псих%'
   OR company_name ILIKE '%coach%'
   OR company_name ILIKE '%therapy%'
   OR company_name ILIKE '%mindfulness%'
   OR company_name ILIKE '%коуч%'
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

-- 4. Поиск партнеров, у которых уже есть услуги в категории psychology/mindfulness
SELECT DISTINCT
  p.chat_id,
  p.name,
  p.company_name,
  p.business_type,
  COUNT(s.id) as services_count
FROM partners p
LEFT JOIN services s ON p.chat_id = s.partner_chat_id 
  AND s.category IN ('psychology', 'mindfulness_coaching')
WHERE p.business_type = 'mindfulness_coaching'
   OR s.category IN ('psychology', 'mindfulness_coaching')
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


