-- Исправление существующих услуг: создание партнёров для услуг без партнёров
-- ВНИМАНИЕ: Выполняйте этот скрипт осторожно, проверьте результаты перед применением

-- 1. Просмотр услуг без партнёров (для проверки)
SELECT 
    s.id,
    s.title,
    s.partner_chat_id,
    s.category,
    s.created_at
FROM services s
LEFT JOIN partners p ON s.partner_chat_id = p.chat_id
WHERE s.approval_status = 'Approved' 
  AND s.is_active = true
  AND p.chat_id IS NULL
ORDER BY s.created_at DESC
LIMIT 20;

-- 2. Создание партнёров для услуг без партнёров
-- (Раскомментируйте и выполните после проверки запроса выше)

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
SELECT DISTINCT
    s.partner_chat_id as chat_id,
    'Партнёр ' || s.partner_chat_id as name,
    'Компания партнёра' as company_name,
    'hybrid' as work_mode,  -- Показывать во всех городах
    '' as city,
    'Все' as district,
    s.category as business_type  -- Использовать категорию первой услуги
FROM services s
LEFT JOIN partners p ON s.partner_chat_id = p.chat_id
WHERE s.approval_status = 'Approved' 
  AND s.is_active = true
  AND p.chat_id IS NULL
  AND s.partner_chat_id IS NOT NULL
ON CONFLICT (chat_id) DO NOTHING;
*/

-- 3. Проверка результата
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
