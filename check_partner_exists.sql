-- ============================================
-- Проверка существования партнера с chat_id = 4066311153
-- ============================================

-- 1. Проверка в таблице partners
SELECT 
  chat_id,
  name,
  company_name,
  business_type,
  status,
  created_at
FROM partners
WHERE chat_id = '4066311153';

-- 2. Проверка в таблице partner_applications (заявки)
SELECT 
  chat_id,
  name,
  company_name,
  business_type,
  status,
  created_at
FROM partner_applications
WHERE chat_id = '4066311153';

-- 3. Поиск похожих chat_id (если была опечатка)
SELECT 
  chat_id,
  name,
  company_name,
  business_type
FROM partners
WHERE chat_id LIKE '%406631115%'
   OR chat_id LIKE '%6311153%'
ORDER BY created_at DESC;

-- 4. Все партнеры с категорией mindfulness_coaching
SELECT 
  chat_id,
  name,
  company_name,
  business_type,
  status
FROM partners
WHERE business_type = 'mindfulness_coaching'
ORDER BY created_at DESC;

-- 5. Последние зарегистрированные партнеры
SELECT 
  chat_id,
  name,
  company_name,
  business_type,
  status,
  created_at
FROM partners
ORDER BY created_at DESC
LIMIT 10;

-- 6. Последние заявки партнеров
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


