-- Сравнение отображающихся и неотображающихся услуг
-- Выполните этот запрос в Supabase SQL Editor

-- 1. Все услуги с их партнёрами (отображающиеся и неотображающиеся)
SELECT 
    s.id,
    s.title,
    s.partner_chat_id,
    s.approval_status,
    s.is_active,
    s.category,
    s.created_at,
    -- Данные партнёра
    p.chat_id as partner_exists,
    p.name as partner_name,
    p.work_mode,
    p.city,
    p.district,
    p.business_type,
    -- Флаг: есть ли партнёр
    CASE 
        WHEN p.chat_id IS NOT NULL THEN '✅ Партнёр найден'
        ELSE '❌ Партнёр НЕ найден'
    END as partner_status
FROM services s
LEFT JOIN partners p ON s.partner_chat_id = p.chat_id
WHERE s.approval_status = 'Approved' 
  AND s.is_active = true
ORDER BY s.created_at DESC;

-- 2. Только услуги БЕЗ партнёров (не должны отображаться)
SELECT 
    s.id,
    s.title,
    s.partner_chat_id,
    s.category,
    s.created_at,
    '❌ Партнёр отсутствует в таблице partners' as issue
FROM services s
LEFT JOIN partners p ON s.partner_chat_id = p.chat_id
WHERE s.approval_status = 'Approved' 
  AND s.is_active = true
  AND p.chat_id IS NULL
ORDER BY s.created_at DESC;

-- 3. Услуги с партнёрами, но с проблемами (offline без города)
SELECT 
    s.id,
    s.title,
    s.partner_chat_id,
    s.category,
    p.work_mode,
    p.city,
    p.district,
    CASE 
        WHEN p.work_mode = 'offline' AND (p.city IS NULL OR p.city = '') THEN '⚠️ Offline партнёр без города'
        WHEN p.work_mode IS NULL THEN '⚠️ work_mode не установлен'
        ELSE '✅ OK'
    END as issue
FROM services s
INNER JOIN partners p ON s.partner_chat_id = p.chat_id
WHERE s.approval_status = 'Approved' 
  AND s.is_active = true
  AND (
    (p.work_mode = 'offline' AND (p.city IS NULL OR p.city = ''))
    OR p.work_mode IS NULL
  )
ORDER BY s.created_at DESC;

-- 4. Сравнение категорий: какие категории есть у отображающихся услуг
SELECT 
    s.category,
    COUNT(*) as service_count,
    COUNT(DISTINCT s.partner_chat_id) as partner_count,
    COUNT(CASE WHEN p.chat_id IS NOT NULL THEN 1 END) as services_with_partner,
    COUNT(CASE WHEN p.chat_id IS NULL THEN 1 END) as services_without_partner
FROM services s
LEFT JOIN partners p ON s.partner_chat_id = p.chat_id
WHERE s.approval_status = 'Approved' 
  AND s.is_active = true
GROUP BY s.category
ORDER BY service_count DESC;
