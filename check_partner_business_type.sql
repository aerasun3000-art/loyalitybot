-- Проверка business_type партнёра и группировки услуг
-- Выполните этот запрос в Supabase SQL Editor

-- 1. Данные партнёра (критично для группировки!)
SELECT 
    chat_id,
    name,
    company_name,
    work_mode,
    city,
    district,
    business_type,  -- ⚠️ Это определяет группировку!
    category_group
FROM partners
WHERE chat_id::text = '406631153';

-- 2. Категории услуг партнёра
SELECT 
    s.category as service_category,
    COUNT(*) as count,
    STRING_AGG(s.title, ', ' ORDER BY s.created_at DESC) as services
FROM services s
WHERE s.partner_chat_id::text = '406631153'
  AND s.approval_status = 'Approved'
  AND s.is_active = true
GROUP BY s.category
ORDER BY count DESC;

-- 3. Как будут сгруппированы услуги на фронтенде
-- (используется: partner.business_type ИЛИ service.category)
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

-- 4. Проблема: если business_type NULL, услуги группируются по service.category
-- Решение: установить business_type = 'psychology' (или основную категорию)
SELECT 
    CASE 
        WHEN p.business_type IS NULL THEN '⚠️ business_type NULL - услуги группируются по service.category'
        WHEN p.business_type != s.category THEN '⚠️ business_type != service.category - может быть несколько групп'
        ELSE '✅ business_type совпадает с категориями услуг'
    END as grouping_issue,
    COUNT(*) as affected_services
FROM services s
LEFT JOIN partners p ON s.partner_chat_id::text = p.chat_id::text
WHERE s.partner_chat_id::text = '406631153'
  AND s.approval_status = 'Approved'
  AND s.is_active = true
GROUP BY (p.business_type IS NULL), (p.business_type != s.category);
