-- Проверка всех услуг партнёра и причин, почему они не отображаются
-- Выполните этот запрос в Supabase SQL Editor

-- 1. Все услуги партнёра 406631153 с их статусами
SELECT 
    s.id,
    s.title,
    s.approval_status,
    s.is_active,
    s.category,
    s.price_points,
    s.created_at,
    CASE 
        WHEN s.approval_status = 'Approved' AND s.is_active = true THEN '✅ Должна отображаться'
        WHEN s.approval_status = 'Pending' THEN '⏳ На модерации'
        WHEN s.approval_status = 'Rejected' THEN '❌ Отклонена'
        WHEN s.is_active = false THEN '🚫 Неактивна'
        ELSE '❓ Неизвестный статус'
    END as display_status
FROM services s
WHERE s.partner_chat_id = '406631153'
ORDER BY s.created_at DESC;

-- 2. Данные партнёра (важно для фильтрации)
SELECT 
    chat_id,
    name,
    company_name,
    work_mode,
    city,
    district,
    business_type,
    category_group
FROM partners
WHERE chat_id = '406631153';

-- 3. Статистика услуг партнёра по статусам
SELECT 
    approval_status,
    is_active,
    COUNT(*) as count,
    STRING_AGG(title, ', ' ORDER BY created_at DESC) as services
FROM services
WHERE partner_chat_id = '406631153'
GROUP BY approval_status, is_active
ORDER BY approval_status, is_active;

-- 4. Проверка: все ли одобренные услуги имеют одинаковую категорию
SELECT 
    category,
    COUNT(*) as count,
    STRING_AGG(title, ', ' ORDER BY created_at DESC) as services
FROM services
WHERE partner_chat_id = '406631153'
  AND approval_status = 'Approved'
  AND is_active = true
GROUP BY category
ORDER BY count DESC;

-- 5. Сравнение: какие услуги должны отображаться vs какие есть
SELECT 
    'Всего услуг партнёра' as description,
    COUNT(*) as count
FROM services
WHERE partner_chat_id = '406631153'

UNION ALL

SELECT 
    'Одобренных и активных' as description,
    COUNT(*) as count
FROM services
WHERE partner_chat_id = '406631153'
  AND approval_status = 'Approved'
  AND is_active = true;
