-- =====================================================
-- ДИАГНОСТИКА БАЗЫ ДАННЫХ
-- Проверка готовности системы к бета-версии
-- =====================================================
-- Выполните этот скрипт в Supabase SQL Editor
-- Он покажет, что уже есть и что нужно добавить

-- =====================================================
-- 1. ПРОВЕРКА ОСНОВНЫХ ТАБЛИЦ
-- =====================================================

SELECT 
    '=== ПРОВЕРКА ОСНОВНЫХ ТАБЛИЦ ===' AS section,
    '' AS info;

-- Основные таблицы системы
WITH required_tables AS (
    SELECT unnest(ARRAY[
        'users', 'partners', 'partner_applications', 
        'transactions', 'nps_ratings', 'promotions', 'services'
    ]) AS table_name
),
existing_tables AS (
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
)
SELECT 
    CASE 
        WHEN et.table_name IS NOT NULL THEN '✅ Создана'
        ELSE '❌ Отсутствует'
    END AS status,
    rt.table_name AS table_name,
    '' AS details
FROM required_tables rt
LEFT JOIN existing_tables et ON rt.table_name = et.table_name
ORDER BY status, rt.table_name;

-- =====================================================
-- 2. ПРОВЕРКА MLM ТАБЛИЦ
-- =====================================================

SELECT 
    '' AS section,
    '=== ПРОВЕРКА MLM СИСТЕМЫ ===' AS info;

WITH required_mlm_tables AS (
    SELECT unnest(ARRAY[
        'referral_tree', 'referral_rewards'
    ]) AS table_name
),
existing_tables AS (
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
)
SELECT 
    CASE 
        WHEN et.table_name IS NOT NULL THEN '✅ Создана'
        ELSE '❌ Отсутствует - выполните: supabase_mlm_referral_system_clean.sql'
    END AS status,
    rt.table_name AS table_name,
    '' AS details
FROM required_mlm_tables rt
LEFT JOIN existing_tables et ON rt.table_name = et.table_name
ORDER BY status, rt.table_name;

-- =====================================================
-- 3. ПРОВЕРКА ТАБЛИЦ ПРОМОУТЕРОВ И UGC
-- =====================================================

SELECT 
    '' AS section,
    '=== ПРОВЕРКА ПРОМОУТЕРОВ И UGC ===' AS info;

WITH required_promoter_tables AS (
    SELECT unnest(ARRAY[
        'promoters', 'ugc_content', 'promo_materials', 'material_downloads'
    ]) AS table_name
),
existing_tables AS (
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
)
SELECT 
    CASE 
        WHEN et.table_name IS NOT NULL THEN '✅ Создана'
        ELSE '❌ Отсутствует - выполните: supabase_promoters_ugc_leaderboard.sql'
    END AS status,
    rt.table_name AS table_name,
    '' AS details
FROM required_promoter_tables rt
LEFT JOIN existing_tables et ON rt.table_name = et.table_name
ORDER BY status, rt.table_name;

-- =====================================================
-- 4. ПРОВЕРКА ТАБЛИЦ ЛИДЕРБОРДА
-- =====================================================

SELECT 
    '' AS section,
    '=== ПРОВЕРКА ЛИДЕРБОРДА ===' AS info;

WITH required_leaderboard_tables AS (
    SELECT unnest(ARRAY[
        'leaderboard_periods', 'leaderboard_rankings', 
        'leaderboard_metrics', 'prize_distributions'
    ]) AS table_name
),
existing_tables AS (
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
)
SELECT 
    CASE 
        WHEN et.table_name IS NOT NULL THEN '✅ Создана'
        ELSE '❌ Отсутствует - выполните: supabase_promoters_ugc_leaderboard.sql'
    END AS status,
    rt.table_name AS table_name,
    '' AS details
FROM required_leaderboard_tables rt
LEFT JOIN existing_tables et ON rt.table_name = et.table_name
ORDER BY status, rt.table_name;

-- =====================================================
-- 5. ПРОВЕРКА СТОЛБЦОВ В ТАБЛИЦЕ USERS
-- =====================================================

SELECT 
    '' AS section,
    '=== ПРОВЕРКА СТОЛБЦОВ В USERS ===' AS info;

WITH required_columns AS (
    SELECT unnest(ARRAY[
        'is_promoter', 'promoter_since', 'referral_code', 
        'referred_by_chat_id', 'total_referrals', 'active_referrals',
        'total_referral_earnings', 'referral_level',
        'total_leaderboard_points', 'leaderboard_wins', 
        'current_leaderboard_period_id'
    ]) AS column_name
),
existing_columns AS (
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users'
)
SELECT 
    CASE 
        WHEN ec.column_name IS NOT NULL THEN '✅ Есть'
        ELSE '❌ Отсутствует'
    END AS status,
    'users.' || rc.column_name AS column_name,
    CASE 
        WHEN rc.column_name IN ('is_promoter', 'promoter_since') 
            THEN 'Добавить: supabase_promoters_ugc_leaderboard.sql'
        WHEN rc.column_name LIKE 'referral%' OR rc.column_name IN ('referral_level')
            THEN 'Добавить: supabase_mlm_referral_system_clean.sql'
        WHEN rc.column_name LIKE 'leaderboard%' OR rc.column_name = 'current_leaderboard_period_id'
            THEN 'Добавить: supabase_promoters_ugc_leaderboard.sql'
        ELSE ''
    END AS details
FROM required_columns rc
LEFT JOIN existing_columns ec ON rc.column_name = ec.column_name
ORDER BY status, rc.column_name;

-- =====================================================
-- 6. ПРОВЕРКА ФУНКЦИЙ
-- =====================================================

SELECT 
    '' AS section,
    '=== ПРОВЕРКА ФУНКЦИЙ ===' AS info;

WITH required_functions AS (
    SELECT unnest(ARRAY[
        'generate_promo_code',
        'update_promoter_on_ugc_approval',
        'update_promoter_on_prize_win',
        'recalculate_leaderboard_ranks',
        'activate_upcoming_periods',
        'create_monthly_leaderboard_period',
        'update_leaderboard_rankings_updated_at'
    ]) AS function_name
),
existing_functions AS (
    SELECT routine_name AS function_name
    FROM information_schema.routines 
    WHERE routine_schema = 'public'
    AND routine_type = 'FUNCTION'
)
SELECT 
    CASE 
        WHEN ef.function_name IS NOT NULL THEN '✅ Создана'
        ELSE '❌ Отсутствует - выполните: supabase_promoters_ugc_leaderboard.sql'
    END AS status,
    rf.function_name AS function_name,
    '' AS details
FROM required_functions rf
LEFT JOIN existing_functions ef ON rf.function_name = ef.function_name
ORDER BY status, rf.function_name;

-- =====================================================
-- 7. ПРОВЕРКА ТРИГГЕРОВ
-- =====================================================

SELECT 
    '' AS section,
    '=== ПРОВЕРКА ТРИГГЕРОВ ===' AS info;

WITH required_triggers AS (
    SELECT unnest(ARRAY[
        'trigger_update_promoter_on_ugc_approval',
        'trigger_update_promoter_on_prize_win',
        'trigger_update_rankings_updated_at'
    ]) AS trigger_name
),
existing_triggers AS (
    SELECT trigger_name
    FROM information_schema.triggers 
    WHERE trigger_schema = 'public'
)
SELECT 
    CASE 
        WHEN et.trigger_name IS NOT NULL THEN '✅ Создан'
        ELSE '❌ Отсутствует - выполните: supabase_promoters_ugc_leaderboard.sql'
    END AS status,
    rt.trigger_name AS trigger_name,
    '' AS details
FROM required_triggers rt
LEFT JOIN existing_triggers et ON rt.trigger_name = et.trigger_name
ORDER BY status, rt.trigger_name;

-- =====================================================
-- 8. ПРОВЕРКА ИНДЕКСОВ
-- =====================================================

SELECT 
    '' AS section,
    '=== ПРОВЕРКА КЛЮЧЕВЫХ ИНДЕКСОВ ===' AS info;

WITH required_indexes AS (
    SELECT unnest(ARRAY[
        'idx_promoter_chat_id',
        'idx_promoter_code',
        'idx_ugc_promoter',
        'idx_ugc_status',
        'idx_period_active',
        'idx_rankings_score'
    ]) AS index_name
),
existing_indexes AS (
    SELECT indexname AS index_name
    FROM pg_indexes 
    WHERE schemaname = 'public'
)
SELECT 
    CASE 
        WHEN ei.index_name IS NOT NULL THEN '✅ Создан'
        ELSE '❌ Отсутствует'
    END AS status,
    ri.index_name AS index_name,
    '' AS details
FROM required_indexes ri
LEFT JOIN existing_indexes ei ON ri.index_name = ei.index_name
ORDER BY status, ri.index_name;

-- =====================================================
-- 9. ПРОВЕРКА RLS (Row Level Security)
-- =====================================================

SELECT 
    '' AS section,
    '=== ПРОВЕРКА RLS ПОЛИТИК ===' AS info;

WITH required_tables_for_rls AS (
    SELECT unnest(ARRAY[
        'promoters', 'ugc_content', 'promo_materials',
        'leaderboard_periods', 'leaderboard_rankings', 
        'prize_distributions'
    ]) AS table_name
)
SELECT 
    CASE 
        WHEN pc.relrowsecurity = true THEN '✅ Включен'
        WHEN pc.relrowsecurity = false THEN '❌ Отключен'
        WHEN pc.relrowsecurity IS NULL THEN '❌ Таблица не существует'
        ELSE '❌ Отключен'
    END AS status,
    rtr.table_name AS table_name,
    CASE 
        WHEN pc.relrowsecurity = false OR pc.relrowsecurity IS NULL THEN 
            'Включите RLS: ALTER TABLE ' || rtr.table_name || ' ENABLE ROW LEVEL SECURITY;'
        ELSE ''
    END AS details
FROM required_tables_for_rls rtr
LEFT JOIN pg_class pc ON pc.relname = rtr.table_name AND pc.relkind = 'r'
LEFT JOIN pg_namespace pn ON pn.oid = pc.relnamespace AND pn.nspname = 'public'
WHERE EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = rtr.table_name
)
ORDER BY status, rtr.table_name;

-- =====================================================
-- 10. ИТОГОВАЯ СВОДКА
-- =====================================================

SELECT 
    '' AS section,
    '=== ИТОГОВАЯ СВОДКА ===' AS info;

SELECT 
    (SELECT COUNT(*) 
     FROM information_schema.tables 
     WHERE table_schema = 'public' 
     AND table_type = 'BASE TABLE'
     AND table_name IN (
         'users', 'partners', 'partner_applications', 
         'transactions', 'nps_ratings', 'promotions', 'services',
         'referral_tree', 'referral_rewards',
         'promoters', 'ugc_content', 'promo_materials', 'material_downloads',
         'leaderboard_periods', 'leaderboard_rankings', 
         'leaderboard_metrics', 'prize_distributions'
     )
    ) AS total_tables_created,
    (SELECT COUNT(*) 
     FROM information_schema.routines 
     WHERE routine_schema = 'public'
     AND routine_type = 'FUNCTION'
     AND routine_name IN (
         'generate_promo_code', 'update_promoter_on_ugc_approval',
         'recalculate_leaderboard_ranks', 'activate_upcoming_periods',
         'create_monthly_leaderboard_period'
     )
    ) AS total_functions_created,
    (SELECT COUNT(*) 
     FROM information_schema.tables 
     WHERE table_schema = 'public' 
     AND table_name IN ('promoters', 'ugc_content', 'promo_materials')
    ) AS promoter_tables_ready,
    CASE 
        WHEN (SELECT COUNT(*) FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name IN ('leaderboard_periods', 'leaderboard_rankings')) = 2 
        THEN '✅ Да'
        ELSE '❌ Нет'
    END AS leaderboard_ready,
    CASE 
        WHEN (SELECT COUNT(*) FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name IN ('referral_tree', 'referral_rewards')) = 2 
        THEN '✅ Да'
        ELSE '❌ Нет'
    END AS mlm_system_ready;

-- =====================================================
-- 11. РЕКОМЕНДАЦИИ
-- =====================================================

SELECT 
    '' AS section,
    '=== РЕКОМЕНДАЦИИ ПО ДЕЙСТВИЯМ ===' AS info;

-- Определяем, какие миграции нужно выполнить
SELECT 
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'referral_tree')
        THEN '⚠️  Выполните: supabase_mlm_referral_system_clean.sql'
        ELSE '✅ MLM система готова'
    END AS action_1,
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'promoters')
        THEN '⚠️  Выполните: supabase_promoters_ugc_leaderboard.sql'
        ELSE '✅ Промоутеры и UGC готовы'
    END AS action_2,
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leaderboard_periods')
        THEN '⚠️  Выполните: supabase_promoters_ugc_leaderboard.sql (включает лидерборд)'
        ELSE '✅ Лидерборд готов'
    END AS action_3,
    CASE 
        WHEN NOT EXISTS (
            SELECT 1 FROM leaderboard_periods WHERE status = 'active'
        ) AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leaderboard_periods')
        THEN '⚠️  Выполните: init_beta_data.sql (создаст первый период)'
        WHEN EXISTS (SELECT 1 FROM leaderboard_periods WHERE status = 'active')
        THEN '✅ Активный период лидерборда существует'
        ELSE '⏸️  Создайте период вручную или через init_beta_data.sql'
    END AS action_4;

-- =====================================================
-- КОНЕЦ ДИАГНОСТИКИ
-- =====================================================

SELECT 
    '' AS section,
    '=== ДИАГНОСТИКА ЗАВЕРШЕНА ===' AS info;

