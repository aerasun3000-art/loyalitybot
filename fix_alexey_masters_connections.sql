-- ============================================
-- ИСПРАВЛЕНИЕ: Связь мастеров с Алексеем для Revenue Share
-- Chat ID Алексея: 406631153
-- ============================================

-- ШАГ 1: Найти последних партнеров (чтобы найти 3 мастеров)
-- ============================================
-- Выполните этот запрос, чтобы найти chat_id 3 мастеров
SELECT 
    chat_id,
    name,
    company_name,
    business_type,
    partner_type,
    partner_level,
    referred_by_chat_id,
    created_at
FROM partners 
ORDER BY created_at DESC 
LIMIT 10;

-- ШАГ 2: Найти мастеров по признаку (если знаете их имена или другие данные)
-- ============================================
-- Замените 'ИМЯ_МАСТЕРА' на реальные имена или названия компаний
-- SELECT 
--     chat_id,
--     name,
--     company_name,
--     business_type,
--     partner_type,
--     referred_by_chat_id
-- FROM partners 
-- WHERE name ILIKE '%ИМЯ_МАСТЕРА%' 
--    OR company_name ILIKE '%НАЗВАНИЕ%'
-- ORDER BY created_at DESC;

-- ============================================
-- ШАГ 3: ИСПРАВЛЕНИЕ (выполняйте после того, как найдете chat_id мастеров)
-- ============================================

-- ⚠️ ВАЖНО: Замените 'CHAT_ID_МАСТЕРА_1', 'CHAT_ID_МАСТЕРА_2', 'CHAT_ID_МАСТЕРА_3'
-- на реальные chat_id из Шага 1

-- 3.1. Установить referred_by_chat_id для мастеров
UPDATE partners
SET referred_by_chat_id = '406631153'
WHERE chat_id IN (
    'CHAT_ID_МАСТЕРА_1',  -- ⚠️ ЗАМЕНИТЕ на реальный chat_id
    'CHAT_ID_МАСТЕРА_2',  -- ⚠️ ЗАМЕНИТЕ на реальный chat_id
    'CHAT_ID_МАСТЕРА_3'   -- ⚠️ ЗАМЕНИТЕ на реальный chat_id
);

-- 3.2. Создать записи в partner_network (для Revenue Share)
INSERT INTO partner_network (referrer_chat_id, referred_chat_id, level, is_active)
VALUES 
    ('406631153', 'CHAT_ID_МАСТЕРА_1', 1, true),  -- ⚠️ ЗАМЕНИТЕ на реальный chat_id
    ('406631153', 'CHAT_ID_МАСТЕРА_2', 1, true),  -- ⚠️ ЗАМЕНИТЕ на реальный chat_id
    ('406631153', 'CHAT_ID_МАСТЕРА_3', 1, true)   -- ⚠️ ЗАМЕНИТЕ на реальный chat_id
ON CONFLICT (referrer_chat_id, referred_chat_id) 
DO UPDATE SET 
    level = 1,
    is_active = true;

-- 3.3. (Опционально) Установить partner_type='master' и partner_level=3
UPDATE partners
SET 
    partner_type = 'master',
    partner_level = 3
WHERE chat_id IN (
    'CHAT_ID_МАСТЕРА_1',  -- ⚠️ ЗАМЕНИТЕ на реальный chat_id
    'CHAT_ID_МАСТЕРА_2',  -- ⚠️ ЗАМЕНИТЕ на реальный chat_id
    'CHAT_ID_МАСТЕРА_3'   -- ⚠️ ЗАМЕНИТЕ на реальный chat_id
);

-- ============================================
-- ШАГ 4: ПРОВЕРКА РЕЗУЛЬТАТА
-- ============================================

-- Проверка: сколько мастеров теперь связано с Алексеем
SELECT 
    'Проверка результата' as check_type,
    COUNT(*) as total_masters_with_referred_by,
    COUNT(CASE WHEN p.partner_type = 'master' THEN 1 END) as masters_with_tag,
    COUNT(CASE WHEN pn.id IS NOT NULL THEN 1 END) as masters_in_network
FROM partners p
LEFT JOIN partner_network pn ON (
    pn.referred_chat_id = p.chat_id 
    AND pn.referrer_chat_id = '406631153'
    AND pn.level = 1
)
WHERE p.referred_by_chat_id = '406631153';

-- Детальная проверка каждого мастера
SELECT 
    p.chat_id,
    p.name,
    p.company_name,
    p.referred_by_chat_id,
    CASE WHEN p.referred_by_chat_id = '406631153' THEN '✅' ELSE '❌' END as referred_by_ok,
    CASE WHEN pn.id IS NOT NULL THEN '✅' ELSE '❌' END as in_network_ok,
    p.partner_type,
    p.partner_level
FROM partners p
LEFT JOIN partner_network pn ON (
    pn.referred_chat_id = p.chat_id 
    AND pn.referrer_chat_id = '406631153'
    AND pn.level = 1
)
WHERE p.referred_by_chat_id = '406631153'
ORDER BY p.name;

