-- ============================================
-- ИСПРАВЛЕНИЕ: Связь 3 мастеров с Алексеем для Revenue Share
-- Chat ID Алексея: 406631153
-- 
-- Мастера:
-- 1. 521221007 - Роман А. (Psychologist, PR, mentoring)
-- 2. 6205824176 - Тота (Totally.nailed)
-- 3. 726690151 - Вера Санжеева (Yoga for queens)
-- ============================================

-- ШАГ 1: Установить referred_by_chat_id для мастеров
-- ============================================
UPDATE partners
SET referred_by_chat_id = '406631153'
WHERE chat_id IN (
    '521221007',  -- Роман А.
    '6205824176', -- Тота
    '726690151'   -- Вера Санжеева
);

-- ШАГ 2: Создать записи в partner_network (КРИТИЧНО для Revenue Share!)
-- ============================================
INSERT INTO partner_network (referrer_chat_id, referred_chat_id, level, is_active)
VALUES 
    ('406631153', '521221007', 1, true),   -- Роман А.
    ('406631153', '6205824176', 1, true),  -- Тота
    ('406631153', '726690151', 1, true)    -- Вера Санжеева
ON CONFLICT (referrer_chat_id, referred_chat_id) 
DO UPDATE SET 
    level = 1,
    is_active = true;

-- ШАГ 3: (Опционально) Установить partner_type='master' и partner_level=3
-- ============================================
UPDATE partners
SET 
    partner_type = 'master',
    partner_level = 3
WHERE chat_id IN (
    '521221007',  -- Роман А.
    '6205824176', -- Тота
    '726690151'   -- Вера Санжеева
)
AND (partner_type != 'master' OR partner_level != 3);

-- ============================================
-- ПРОВЕРКА РЕЗУЛЬТАТА
-- ============================================

-- Проверка 1: Сколько мастеров связано с Алексеем
SELECT 
    'Статистика' as check_type,
    COUNT(*) as total_masters_linked,
    COUNT(CASE WHEN pn.id IS NOT NULL THEN 1 END) as masters_in_network,
    COUNT(CASE WHEN p.partner_type = 'master' THEN 1 END) as masters_with_tag
FROM partners p
LEFT JOIN partner_network pn ON (
    pn.referred_chat_id = p.chat_id 
    AND pn.referrer_chat_id = '406631153'
    AND pn.level = 1
)
WHERE p.referred_by_chat_id = '406631153';

-- Проверка 2: Детальная информация по каждому мастеру
SELECT 
    p.chat_id,
    p.name,
    p.company_name,
    p.referred_by_chat_id,
    CASE WHEN p.referred_by_chat_id = '406631153' THEN '✅' ELSE '❌' END as referred_by_ok,
    CASE WHEN pn.id IS NOT NULL THEN '✅' ELSE '❌' END as in_network_ok,
    p.partner_type,
    p.partner_level,
    pn.level as network_level,
    pn.is_active as network_active
FROM partners p
LEFT JOIN partner_network pn ON (
    pn.referred_chat_id = p.chat_id 
    AND pn.referrer_chat_id = '406631153'
    AND pn.level = 1
)
WHERE p.chat_id IN (
    '521221007',  -- Роман А.
    '6205824176', -- Тота
    '726690151'   -- Вера Санжеева
)
ORDER BY p.name;

-- Ожидаемый результат:
-- ✅ total_masters_linked = 3
-- ✅ masters_in_network = 3
-- ✅ Все 3 мастера должны иметь ✅ в referred_by_ok и in_network_ok

