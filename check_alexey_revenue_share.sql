-- ============================================
-- ПРОВЕРКА И ИСПРАВЛЕНИЕ: Алексей и 3 мастера
-- Убеждаемся, что Алексей получит Revenue Share
-- ============================================

-- ШАГ 1: Chat ID Алексея
-- ============================================
-- Chat ID Алексея: 406631153
-- ============================================

-- Проверка: существует ли Алексей в системе
SELECT 
    'Проверка Алексея' as check_type,
    chat_id,
    name,
    company_name,
    partner_type,
    partner_level,
    referred_by_chat_id,
    created_at
FROM partners 
WHERE chat_id = '406631153';

-- ============================================
-- ШАГ 2: ПРОВЕРКА текущего состояния
-- ============================================

-- 2.1. Проверка: Есть ли у мастеров referred_by_chat_id = chat_id Алексея
-- Chat ID Алексея: 406631153
SELECT 
    'Проверка: referred_by_chat_id в partners' as check_type,
    p.chat_id,
    p.name,
    p.referred_by_chat_id,
    CASE 
        WHEN p.referred_by_chat_id = '406631153' THEN '✅ Правильно'
        WHEN p.referred_by_chat_id IS NULL THEN '❌ НЕТ (NULL)'
        ELSE '⚠️ Другой referrer: ' || p.referred_by_chat_id
    END as status,
    p.partner_type,
    p.partner_level
FROM partners p
WHERE p.referred_by_chat_id = '406631153'
ORDER BY p.name;

-- ИЛИ проверка конкретных мастеров (замените chat_id на реальные):
-- WHERE p.chat_id IN (
--     'CHAT_ID_МАСТЕРА_1',
--     'CHAT_ID_МАСТЕРА_2',
--     'CHAT_ID_МАСТЕРА_3'
-- )

-- 2.2. Проверка: Есть ли записи в partner_network
-- Chat ID Алексея: 406631153
SELECT 
    'Проверка: partner_network записи' as check_type,
    pn.referrer_chat_id as alexey_chat_id,
    pn.referred_chat_id as master_chat_id,
    p.name as master_name,
    pn.level,
    pn.is_active,
    CASE 
        WHEN pn.referrer_chat_id = '406631153' AND pn.level = 1 THEN '✅ Правильно'
        ELSE '⚠️ Проблема'
    END as status
FROM partner_network pn
JOIN partners p ON p.chat_id = pn.referred_chat_id
WHERE pn.referrer_chat_id = '406631153'
ORDER BY pn.level, pn.registered_at DESC;

-- 2.3. Проверка: partner_type и partner_level мастеров
SELECT 
    'Проверка: partner_type и partner_level' as check_type,
    p.chat_id,
    p.name,
    p.partner_type,
    p.partner_level,
    CASE 
        WHEN p.partner_type = 'master' AND p.partner_level = 3 THEN '✅ Правильно'
        WHEN p.partner_type = 'master' AND p.partner_level != 3 THEN '⚠️ partner_type=master, но partner_level не 3'
        WHEN p.partner_type IS NULL OR p.partner_type = 'regular' THEN '❌ НЕТ (regular или NULL)'
        ELSE '⚠️ partner_type = ' || p.partner_type
    END as status
FROM partners p
WHERE p.referred_by_chat_id = '406631153'
ORDER BY p.name;

-- ============================================
-- ШАГ 3: ИСПРАВЛЕНИЕ (выполняйте по очереди)
-- ============================================

-- 3.1. Установить referred_by_chat_id для мастеров в таблице partners
-- Chat ID Алексея: 406631153
-- ⚠️ Замените chat_id мастеров на реальные значения перед выполнением!
-- UPDATE partners
-- SET referred_by_chat_id = '406631153'
-- WHERE chat_id IN (
--     'CHAT_ID_МАСТЕРА_1',
--     'CHAT_ID_МАСТЕРА_2',
--     'CHAT_ID_МАСТЕРА_3'
-- )
-- AND (referred_by_chat_id IS NULL OR referred_by_chat_id != '406631153');

-- 3.2. Установить partner_type='master' и partner_level=3 для мастеров
-- ⚠️ Замените chat_id мастеров на реальные значения перед выполнением!
-- UPDATE partners
-- SET 
--     partner_type = 'master',
--     partner_level = 3
-- WHERE chat_id IN (
--     'CHAT_ID_МАСТЕРА_1',
--     'CHAT_ID_МАСТЕРА_2',
--     'CHAT_ID_МАСТЕРА_3'
-- )
-- AND (partner_type != 'master' OR partner_level != 3);

-- 3.3. Создать записи в partner_network (если их нет)
-- Chat ID Алексея: 406631153
-- ⚠️ Замените chat_id мастеров на реальные значения перед выполнением!
-- INSERT INTO partner_network (referrer_chat_id, referred_chat_id, level, is_active)
-- SELECT 
--     '406631153' as referrer_chat_id,
--     master_chat_id as referred_chat_id,
--     1 as level,
--     true as is_active
-- FROM unnest(ARRAY[
--     'CHAT_ID_МАСТЕРА_1',
--     'CHAT_ID_МАСТЕРА_2',
--     'CHAT_ID_МАСТЕРА_3'
-- ]) as master_chat_id
-- WHERE NOT EXISTS (
--     SELECT 1 
--     FROM partner_network pn
--     WHERE pn.referrer_chat_id = '406631153'
--     AND pn.referred_chat_id = master_chat_id
-- );

-- ============================================
-- ШАГ 4: ФИНАЛЬНАЯ ПРОВЕРКА
-- ============================================

-- 4.1. Итоговая проверка всех связей
-- Chat ID Алексея: 406631153
SELECT 
    'ИТОГОВАЯ ПРОВЕРКА' as check_type,
    p.chat_id as master_chat_id,
    p.name as master_name,
    p.referred_by_chat_id,
    CASE WHEN p.referred_by_chat_id = '406631153' THEN '✅' ELSE '❌' END as referred_by_ok,
    p.partner_type,
    CASE WHEN p.partner_type = 'master' THEN '✅' ELSE '❌' END as partner_type_ok,
    p.partner_level,
    CASE WHEN p.partner_level = 3 THEN '✅' ELSE '❌' END as partner_level_ok,
    CASE 
        WHEN pn.id IS NOT NULL THEN '✅' 
        ELSE '❌ НЕТ записи в partner_network' 
    END as network_record_ok
FROM partners p
LEFT JOIN partner_network pn ON (
    pn.referred_chat_id = p.chat_id 
    AND pn.referrer_chat_id = '406631153'
    AND pn.level = 1
)
WHERE p.referred_by_chat_id = '406631153'
ORDER BY p.name;

-- 4.2. Проверка: Сколько мастеров пригласил Алексей
-- Chat ID Алексея: 406631153
SELECT 
    'Статистика: Мастера Алексея' as check_type,
    COUNT(*) as total_masters,
    COUNT(CASE WHEN p.partner_type = 'master' THEN 1 END) as masters_with_tag,
    COUNT(CASE WHEN p.referred_by_chat_id = '406631153' THEN 1 END) as masters_linked_to_alexey,
    COUNT(CASE WHEN pn.id IS NOT NULL THEN 1 END) as masters_in_network
FROM partners p
LEFT JOIN partner_network pn ON (
    pn.referred_chat_id = p.chat_id 
    AND pn.referrer_chat_id = '406631153'
    AND pn.level = 1
)
WHERE p.referred_by_chat_id = '406631153';

