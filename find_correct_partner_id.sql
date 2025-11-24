-- ============================================
-- Поиск правильного chat_id партнера-психолога
-- ============================================

-- 1. Все партнеры с категорией mindfulness_coaching (психологи/коучи)
SELECT 
  chat_id,
  name,
  company_name,
  business_type,
  status,
  created_at
FROM partners
WHERE business_type = 'mindfulness_coaching'
ORDER BY created_at DESC;

-- 2. Все партнеры (последние 20)
SELECT 
  chat_id,
  name,
  company_name,
  business_type,
  status
FROM partners
ORDER BY created_at DESC
LIMIT 20;

-- 3. Поиск по названию компании (замените 'НАЗВАНИЕ' на реальное название)
-- SELECT 
--   chat_id,
--   name,
--   company_name,
--   business_type
-- FROM partners
-- WHERE company_name ILIKE '%НАЗВАНИЕ%'
--    OR name ILIKE '%ИМЯ%';

-- 4. Заявки партнеров (если партнер еще не одобрен)
SELECT 
  chat_id,
  name,
  company_name,
  business_type,
  status,
  created_at
FROM partner_applications
WHERE business_type = 'mindfulness_coaching'
   OR company_name ILIKE '%психолог%'
   OR company_name ILIKE '%coach%'
   OR company_name ILIKE '%therapy%'
ORDER BY created_at DESC;

-- 5. Все заявки (последние 10)
SELECT 
  chat_id,
  name,
  company_name,
  business_type,
  status,
  created_at
FROM partner_applications
ORDER BY created_at DESC
LIMIT 10;


