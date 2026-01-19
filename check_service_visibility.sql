-- Проверка видимости услуги "тестовая 2" на фронтенде
-- Выполните этот запрос в Supabase SQL Editor

-- 1. Проверка услуги
SELECT 
    id,
    partner_chat_id,
    title,
    description,
    price_points,
    approval_status,
    is_active,
    category,
    created_at
FROM services
WHERE title = 'тестовая 2'
   OR partner_chat_id = '406631153'
ORDER BY created_at DESC
LIMIT 10;

-- 2. Проверка партнёра
SELECT 
    chat_id,
    name,
    company_name,
    city,
    district,
    work_mode,
    business_type,
    category_group
FROM partners
WHERE chat_id = '406631153';

-- 3. Проверка всех услуг этого партнёра
SELECT 
    s.id,
    s.title,
    s.approval_status,
    s.is_active,
    s.category,
    s.created_at,
    p.work_mode,
    p.city,
    p.district
FROM services s
LEFT JOIN partners p ON s.partner_chat_id = p.chat_id
WHERE s.partner_chat_id = '406631153'
ORDER BY s.created_at DESC;

-- 4. Проверка: все ли одобренные и активные услуги этого партнёра
SELECT 
    COUNT(*) as total_approved_active,
    COUNT(CASE WHEN approval_status = 'Approved' AND is_active = true THEN 1 END) as approved_active_count
FROM services
WHERE partner_chat_id = '406631153';
