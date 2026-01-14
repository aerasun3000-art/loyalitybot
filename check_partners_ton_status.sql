-- ============================================
-- ПРОВЕРКА СТАТУСА ПАРТНЕРОВ ДЛЯ TON COIN
-- Проверяет текущее состояние настройки TON кошельков
-- ============================================

-- 1. Все партнеры с их текущим статусом TON настройки
SELECT 
    p.chat_id,
    p.name,
    p.company_name,
    p.business_type,
    p.partner_type,
    COALESCE(p.ton_wallet_address, 'Не настроен') as ton_wallet,
    COALESCE(p.payment_method, 'bank') as payment_method,
    COALESCE(p.ton_wallet_verified, FALSE) as wallet_verified,
    p.ton_wallet_setup_at,
    -- Статистика по выплатам
    (SELECT COUNT(*) FROM partner_revenue_share prs 
     WHERE prs.partner_chat_id = p.chat_id 
     AND prs.status IN ('pending', 'approved')) as pending_payments,
    (SELECT COALESCE(SUM(final_amount), 0) FROM partner_revenue_share prs 
     WHERE prs.partner_chat_id = p.chat_id 
     AND prs.status IN ('pending', 'approved')) as pending_amount_usd,
    p.created_at
FROM partners p
ORDER BY p.created_at DESC;

-- 2. Партнеры БЕЗ настроенного TON кошелька
SELECT 
    p.chat_id,
    p.name,
    p.company_name,
    p.business_type,
    '❌ TON кошелек не настроен' as status,
    'bank' as current_payment_method
FROM partners p
WHERE p.ton_wallet_address IS NULL 
   OR p.ton_wallet_address = ''
ORDER BY p.created_at DESC;

-- 3. Партнеры С настроенным TON кошельком
SELECT 
    p.chat_id,
    p.name,
    p.company_name,
    SUBSTRING(p.ton_wallet_address, 1, 10) || '...' as wallet_preview,
    p.payment_method,
    CASE 
        WHEN p.ton_wallet_verified THEN '✅ Верифицирован'
        ELSE '⚠️ Не верифицирован'
    END as verification_status
FROM partners p
WHERE p.ton_wallet_address IS NOT NULL 
   AND p.ton_wallet_address != ''
ORDER BY p.ton_wallet_setup_at DESC;

-- 4. Партнеры с ожидающими выплатами (которым нужно настроить TON)
SELECT 
    p.chat_id,
    p.name,
    p.company_name,
    COUNT(prs.id) as pending_count,
    COALESCE(SUM(prs.final_amount), 0) as total_pending_usd,
    CASE 
        WHEN p.ton_wallet_address IS NULL THEN '❌ Нужно настроить TON кошелек'
        ELSE '✅ Кошелек настроен'
    END as action_needed
FROM partners p
LEFT JOIN partner_revenue_share prs ON prs.partner_chat_id = p.chat_id 
    AND prs.status IN ('pending', 'approved')
WHERE prs.id IS NOT NULL
GROUP BY p.chat_id, p.name, p.company_name, p.ton_wallet_address
ORDER BY total_pending_usd DESC;

