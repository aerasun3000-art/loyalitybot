-- Проверка исправления: все ли услуги теперь в одной группе
-- Выполните этот запрос в Supabase SQL Editor

-- 1. Проверка business_type партнёра
SELECT 
    chat_id,
    business_type,
    work_mode,
    city,
    CASE 
        WHEN business_type IS NOT NULL THEN '✅ business_type установлен'
        ELSE '❌ business_type NULL'
    END as status
FROM partners
WHERE chat_id::text = '406631153';

-- 2. Как теперь будут группироваться услуги
SELECT 
    COALESCE(p.business_type, s.category) as grouping_category,
    COUNT(*) as service_count,
    STRING_AGG(s.title, ', ' ORDER BY s.created_at DESC) as services_in_group
FROM services s
LEFT JOIN partners p ON s.partner_chat_id::text = p.chat_id::text
WHERE s.partner_chat_id::text = '406631153'
  AND s.approval_status = 'Approved'
  AND s.is_active = true
GROUP BY COALESCE(p.business_type, s.category)
ORDER BY service_count DESC;

-- 3. Все услуги партнёра (должны быть видны)
SELECT 
    s.id,
    s.title,
    s.category as service_category,
    p.business_type as partner_business_type,
    COALESCE(p.business_type, s.category) as will_group_as,
    s.approval_status,
    s.is_active
FROM services s
LEFT JOIN partners p ON s.partner_chat_id::text = p.chat_id::text
WHERE s.partner_chat_id::text = '406631153'
  AND s.approval_status = 'Approved'
  AND s.is_active = true
ORDER BY s.created_at DESC;
