-- ============================================
-- БЫСТРЫЙ ПОИСК ПАРТНЕРОВ
-- Используйте для поиска chat_id Алексея и мастеров
-- ============================================

-- 1. Все партнеры (последние 20)
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
LIMIT 20;

-- 2. Поиск Алексея по имени
SELECT 
    chat_id,
    name,
    company_name,
    business_type,
    partner_type,
    referred_by_chat_id,
    created_at
FROM partners 
WHERE name ILIKE '%Алексей%' 
   OR name ILIKE '%Alex%'
   OR name ILIKE '%Алекс%'
ORDER BY created_at DESC;

-- 3. Партнеры с мастер-тегом
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
WHERE partner_type = 'master'
ORDER BY created_at DESC;

-- 4. Партнеры с referred_by_chat_id (те, кого кто-то пригласил)
SELECT 
    p.chat_id,
    p.name as master_name,
    p.company_name,
    p.referred_by_chat_id,
    referrer.name as referrer_name,
    referrer.company_name as referrer_company,
    p.partner_type,
    p.partner_level,
    p.created_at
FROM partners p
LEFT JOIN partners referrer ON referrer.chat_id = p.referred_by_chat_id
WHERE p.referred_by_chat_id IS NOT NULL
ORDER BY p.created_at DESC;

-- 5. Структура сети: кто кого пригласил
SELECT 
    referrer.name as referrer_name,
    referrer.chat_id as referrer_chat_id,
    referred.name as referred_name,
    referred.chat_id as referred_chat_id,
    pn.level,
    pn.is_active,
    pn.registered_at
FROM partner_network pn
JOIN partners referrer ON referrer.chat_id = pn.referrer_chat_id
JOIN partners referred ON referred.chat_id = pn.referred_chat_id
ORDER BY pn.registered_at DESC
LIMIT 50;

-- 6. Кто пригласил больше всего партнеров
SELECT 
    p.chat_id,
    p.name,
    p.company_name,
    COUNT(pn.id) as total_referred,
    COUNT(CASE WHEN pn.level = 1 THEN 1 END) as level_1_count,
    COUNT(CASE WHEN pn.level = 2 THEN 1 END) as level_2_count,
    COUNT(CASE WHEN pn.level = 3 THEN 1 END) as level_3_count
FROM partners p
LEFT JOIN partner_network pn ON pn.referrer_chat_id = p.chat_id
GROUP BY p.chat_id, p.name, p.company_name
HAVING COUNT(pn.id) > 0
ORDER BY total_referred DESC;

