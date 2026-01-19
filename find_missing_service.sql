-- Найти услугу, которая не отображается (разница между total и count)
-- Выполните этот запрос в Supabase SQL Editor

-- 1. Найти услугу БЕЗ партнёра (скорее всего это проблема)
SELECT 
    s.id,
    s.title,
    s.partner_chat_id,
    s.approval_status,
    s.is_active,
    s.category,
    s.created_at,
    '❌ Партнёр отсутствует' as issue
FROM services s
LEFT JOIN partners p ON s.partner_chat_id = p.chat_id
WHERE s.approval_status = 'Approved' 
  AND s.is_active = true
  AND p.chat_id IS NULL
ORDER BY s.created_at DESC;

-- 2. Проверить конкретно услугу "тестовая 2"
SELECT 
    s.id,
    s.title,
    s.partner_chat_id,
    s.approval_status,
    s.is_active,
    s.category,
    s.created_at,
    p.chat_id as partner_exists,
    p.name as partner_name,
    p.work_mode,
    p.city,
    p.district
FROM services s
LEFT JOIN partners p ON s.partner_chat_id = p.chat_id
WHERE s.title = 'тестовая 2'
   OR s.partner_chat_id = '406631153';

-- 3. Сравнить: услуги с партнёрами vs без партнёров
SELECT 
    CASE 
        WHEN p.chat_id IS NOT NULL THEN '✅ С партнёром'
        ELSE '❌ БЕЗ партнёра'
    END as status,
    COUNT(*) as count
FROM services s
LEFT JOIN partners p ON s.partner_chat_id = p.chat_id
WHERE s.approval_status = 'Approved' 
  AND s.is_active = true
GROUP BY (p.chat_id IS NOT NULL);

-- 4. Если партнёр отсутствует - создать его
-- (Раскомментируйте, если партнёр действительно отсутствует)
/*
INSERT INTO partners (
    chat_id,
    name,
    company_name,
    work_mode,
    city,
    district,
    business_type
)
SELECT 
    '406631153',
    'Партнёр из Нячанга',
    'Компания партнёра',
    'hybrid',
    'Нячанг',
    'Все',
    'psychology'
WHERE NOT EXISTS (
    SELECT 1 FROM partners WHERE chat_id = '406631153'
);
*/
