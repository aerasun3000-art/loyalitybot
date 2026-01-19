-- Финальная проверка: все ли настройки правильные для отображения услуг
-- Выполните этот запрос в Supabase SQL Editor

-- 1. Полная информация о партнёре
SELECT 
    chat_id,
    name,
    business_type,
    work_mode,
    city,
    district,
    CASE 
        WHEN business_type IS NULL THEN '❌ business_type NULL'
        WHEN work_mode IS NULL THEN '⚠️ work_mode NULL'
        WHEN work_mode = 'offline' AND (city IS NULL OR city = '') THEN '⚠️ offline без города'
        WHEN work_mode IN ('online', 'hybrid') THEN '✅ Показывается везде'
        WHEN work_mode = 'offline' THEN '📍 Только в городе: ' || city
        ELSE '❓ Неизвестный статус'
    END as visibility_status
FROM partners
WHERE chat_id::text = '406631153';

-- 2. Если work_mode не установлен или offline без города - исправить:
-- Раскомментируйте и выполните, если нужно:

/*
UPDATE partners 
SET 
    work_mode = 'hybrid',  -- Показывать во всех городах
    city = COALESCE(city, 'Нячанг'),  -- Установить город, если пустой
    district = COALESCE(district, 'Все')  -- Установить район, если пустой
WHERE chat_id::text = '406631153';
*/

-- 3. Итоговая статистика услуг
SELECT 
    COUNT(*) as total_approved_active,
    COUNT(DISTINCT s.category) as different_categories,
    STRING_AGG(DISTINCT s.category, ', ') as categories_list
FROM services s
WHERE s.partner_chat_id::text = '406631153'
  AND s.approval_status = 'Approved'
  AND s.is_active = true;
