-- ============================================
-- Создание записей партнёров для услуг без партнёров
-- Выполните этот скрипт в Supabase SQL Editor
-- ============================================

-- 1. Найти услуги, у которых нет партнёра в таблице partners
SELECT 
    s.partner_chat_id,
    COUNT(*) as services_count,
    STRING_AGG(DISTINCT s.category, ', ') as categories
FROM services s
LEFT JOIN partners p ON s.partner_chat_id::text = p.chat_id::text
WHERE s.approval_status = 'Approved'
  AND s.is_active = true
  AND p.chat_id IS NULL
  AND s.partner_chat_id IS NOT NULL
GROUP BY s.partner_chat_id;

-- 2. Создать записи партнёров для услуг без партнёров
-- Используем данные из partner_applications, если они есть, иначе минимальные данные
INSERT INTO partners (
    chat_id,
    name,
    company_name,
    business_type,
    work_mode,
    city,
    district
)
SELECT DISTINCT
    s.partner_chat_id::text as chat_id,
    COALESCE(
        pa.name,
        pa.contact_person,
        'Партнёр ' || s.partner_chat_id
    ) as name,
    COALESCE(pa.company_name, '') as company_name,
    -- Используем самую частую категорию услуг партнёра как business_type
    (
        SELECT s2.category
        FROM services s2
        WHERE s2.partner_chat_id::text = s.partner_chat_id::text
          AND s2.approval_status = 'Approved'
          AND s2.is_active = true
          AND s2.category IS NOT NULL
        GROUP BY s2.category
        ORDER BY COUNT(*) DESC
        LIMIT 1
    ) as business_type,
    COALESCE(pa.work_mode, 'hybrid') as work_mode, -- По умолчанию hybrid, чтобы показывать во всех городах
    COALESCE(pa.city, '') as city,
    COALESCE(pa.district, '') as district
FROM services s
LEFT JOIN partners p ON s.partner_chat_id::text = p.chat_id::text
LEFT JOIN partner_applications pa ON s.partner_chat_id::text = pa.chat_id::text
WHERE s.approval_status = 'Approved'
  AND s.is_active = true
  AND p.chat_id IS NULL
  AND s.partner_chat_id IS NOT NULL
ON CONFLICT (chat_id) DO NOTHING; -- Если партнёр уже существует, не обновляем

-- 3. Проверка результата: сколько партнёров было создано
SELECT 
    COUNT(*) as created_partners_count
FROM partners p
WHERE EXISTS (
    SELECT 1 FROM services s
    WHERE s.partner_chat_id::text = p.chat_id::text
      AND s.approval_status = 'Approved'
      AND s.is_active = true
);

-- 4. Проверка: остались ли услуги без партнёров
SELECT 
    COUNT(*) as services_without_partner
FROM services s
LEFT JOIN partners p ON s.partner_chat_id::text = p.chat_id::text
WHERE s.approval_status = 'Approved'
  AND s.is_active = true
  AND p.chat_id IS NULL
  AND s.partner_chat_id IS NOT NULL;

-- 5. Показать созданных партнёров
SELECT 
    p.chat_id,
    p.name,
    p.company_name,
    p.business_type,
    p.work_mode,
    p.city,
    (SELECT COUNT(*) FROM services s WHERE s.partner_chat_id::text = p.chat_id::text AND s.approval_status = 'Approved' AND s.is_active = true) as services_count
FROM partners p
WHERE EXISTS (
    SELECT 1 FROM services s
    WHERE s.partner_chat_id::text = p.chat_id::text
      AND s.approval_status = 'Approved'
      AND s.is_active = true
)
ORDER BY services_count DESC;
