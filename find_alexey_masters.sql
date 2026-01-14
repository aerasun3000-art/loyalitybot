-- ============================================
-- ПОИСК 3 МАСТЕРОВ, КОТОРЫХ ПРИГЛАСИЛ АЛЕКСЕЙ
-- Chat ID Алексея: 406631153
-- ============================================

-- 1. Проверка: существует ли Алексей в системе
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

-- 2. Поиск мастеров с referred_by_chat_id = 406631153
-- (мастера, которых пригласил Алексей)
SELECT 
    'Мастера, приглашенные Алексеем' as check_type,
    chat_id,
    name,
    company_name,
    business_type,
    partner_type,
    partner_level,
    referred_by_chat_id,
    created_at
FROM partners 
WHERE referred_by_chat_id = '406631153'
ORDER BY created_at DESC;

-- 3. Поиск в partner_applications (если мастера еще в заявках)
SELECT 
    'Заявки мастеров, приглашенных Алексеем' as check_type,
    chat_id,
    name,
    company_name,
    business_type,
    status,
    referred_by_chat_id,
    created_at
FROM partner_applications 
WHERE referred_by_chat_id = '406631153'
ORDER BY created_at DESC;

-- 4. Записи в partner_network (мастера в сети Алексея)
SELECT 
    'Записи в partner_network' as check_type,
    pn.referrer_chat_id,
    pn.referred_chat_id as master_chat_id,
    p.name as master_name,
    p.company_name,
    pn.level,
    pn.is_active,
    pn.registered_at
FROM partner_network pn
JOIN partners p ON p.chat_id = pn.referred_chat_id
WHERE pn.referrer_chat_id = '406631153'
ORDER BY pn.level, pn.registered_at DESC;

-- 5. Итоговая сводка: все мастера Алексея
SELECT 
    p.chat_id as master_chat_id,
    p.name as master_name,
    p.company_name,
    p.business_type,
    p.partner_type,
    p.partner_level,
    p.referred_by_chat_id,
    CASE WHEN p.referred_by_chat_id = '406631153' THEN '✅' ELSE '❌' END as linked_to_alexey,
    CASE WHEN pn.id IS NOT NULL THEN '✅' ELSE '❌' END as in_network,
    pn.level as network_level,
    p.created_at
FROM partners p
LEFT JOIN partner_network pn ON (
    pn.referred_chat_id = p.chat_id 
    AND pn.referrer_chat_id = '406631153'
)
WHERE p.referred_by_chat_id = '406631153'
ORDER BY p.created_at DESC;

