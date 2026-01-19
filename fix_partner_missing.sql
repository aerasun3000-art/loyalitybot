-- Исправление: создание записи партнёра, если её нет
-- Выполните этот запрос в Supabase SQL Editor

-- 1. Проверка: есть ли партнёр
SELECT 
    chat_id,
    name,
    company_name,
    work_mode,
    city,
    district
FROM partners
WHERE chat_id = '406631153';

-- 2. Если партнёр не найден, создайте его:
-- (Раскомментируйте и выполните, если партнёр отсутствует)

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
VALUES (
    '406631153',
    'Партнёр из Нячанга',  -- Замените на реальное имя
    'Компания партнёра',   -- Замените на реальное название
    'hybrid',               -- 'hybrid' или 'online' для показа во всех городах
    'Нячанг',              -- Замените на реальный город
    'Все',                  -- Или конкретный район
    'psychology'            -- Категория бизнеса
)
ON CONFLICT (chat_id) DO UPDATE SET
    work_mode = EXCLUDED.work_mode,
    city = EXCLUDED.city,
    district = EXCLUDED.district;
*/

-- 3. Проверка услуг этого партнёра после создания записи
SELECT 
    s.id,
    s.title,
    s.approval_status,
    s.is_active,
    s.category,
    p.work_mode,
    p.city,
    p.district
FROM services s
LEFT JOIN partners p ON s.partner_chat_id = p.chat_id
WHERE s.partner_chat_id = '406631153'
ORDER BY s.created_at DESC;
