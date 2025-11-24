-- =====================================================
-- ЕДИНАЯ ДИАГНОСТИКА БАЗЫ ДАННЫХ
-- Все результаты в одном запросе
-- =====================================================

WITH 
-- Все необходимые таблицы
required_tables AS (
    SELECT unnest(ARRAY[
        'users', 'partners', 'partner_applications', 
        'transactions', 'nps_ratings', 'promotions', 'services',
        'referral_tree', 'referral_rewards',
        'promoters', 'ugc_content', 'promo_materials', 'material_downloads',
        'leaderboard_periods', 'leaderboard_rankings', 
        'leaderboard_metrics', 'prize_distributions'
    ]) AS table_name,
    CASE 
        WHEN unnest(ARRAY[
            'users', 'partners', 'partner_applications', 
            'transactions', 'nps_ratings', 'promotions', 'services',
            'referral_tree', 'referral_rewards',
            'promoters', 'ugc_content', 'promo_materials', 'material_downloads',
            'leaderboard_periods', 'leaderboard_rankings', 
            'leaderboard_metrics', 'prize_distributions'
        ]) IN ('referral_tree', 'referral_rewards') THEN 'MLM'
        WHEN unnest(ARRAY[
            'users', 'partners', 'partner_applications', 
            'transactions', 'nps_ratings', 'promotions', 'services',
            'referral_tree', 'referral_rewards',
            'promoters', 'ugc_content', 'promo_materials', 'material_downloads',
            'leaderboard_periods', 'leaderboard_rankings', 
            'leaderboard_metrics', 'prize_distributions'
        ]) IN ('promoters', 'ugc_content', 'promo_materials', 'material_downloads') THEN 'Promoters'
        WHEN unnest(ARRAY[
            'users', 'partners', 'partner_applications', 
            'transactions', 'nps_ratings', 'promotions', 'services',
            'referral_tree', 'referral_rewards',
            'promoters', 'ugc_content', 'promo_materials', 'material_downloads',
            'leaderboard_periods', 'leaderboard_rankings', 
            'leaderboard_metrics', 'prize_distributions'
        ]) IN ('leaderboard_periods', 'leaderboard_rankings', 'leaderboard_metrics', 'prize_distributions') THEN 'Leaderboard'
        ELSE 'Basic'
    END AS category
),
-- Существующие таблицы
existing_tables AS (
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
),
-- Необходимые функции
required_functions AS (
    SELECT unnest(ARRAY[
        'generate_promo_code',
        'update_promoter_on_ugc_approval',
        'recalculate_leaderboard_ranks',
        'activate_upcoming_periods',
        'create_monthly_leaderboard_period'
    ]) AS function_name
),
-- Существующие функции
existing_functions AS (
    SELECT routine_name AS function_name
    FROM information_schema.routines 
    WHERE routine_schema = 'public'
    AND routine_type = 'FUNCTION'
),
-- Необходимые столбцы в users
required_columns AS (
    SELECT unnest(ARRAY[
        'is_promoter', 'promoter_since',
        'referral_code', 'referred_by_chat_id', 'total_referrals', 
        'active_referrals', 'total_referral_earnings', 'referral_level',
        'total_leaderboard_points', 'leaderboard_wins', 'current_leaderboard_period_id'
    ]) AS column_name
),
-- Существующие столбцы в users
existing_columns AS (
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users'
)

-- Основной результат
SELECT 
    '=== ДИАГНОСТИКА БАЗЫ ДАННЫХ ===' AS section,
    '' AS item,
    '' AS status,
    '' AS action
UNION ALL

SELECT 
    '' AS section,
    '📊 ТАБЛИЦЫ' AS item,
    '' AS status,
    '' AS action
UNION ALL

SELECT 
    rt.category AS section,
    rt.table_name AS item,
    CASE 
        WHEN et.table_name IS NOT NULL THEN '✅ Создана'
        ELSE '❌ Отсутствует'
    END AS status,
    CASE 
        WHEN et.table_name IS NULL AND rt.category = 'MLM' THEN '→ supabase_mlm_referral_system_clean.sql'
        WHEN et.table_name IS NULL AND rt.category IN ('Promoters', 'Leaderboard') THEN '→ supabase_promoters_ugc_leaderboard.sql'
        ELSE ''
    END AS action
FROM required_tables rt
LEFT JOIN existing_tables et ON rt.table_name = et.table_name
UNION ALL

SELECT 
    '' AS section,
    '' AS item,
    '' AS status,
    '' AS action
UNION ALL

SELECT 
    '' AS section,
    '⚙️ ФУНКЦИИ' AS item,
    '' AS status,
    '' AS action
UNION ALL

SELECT 
    'Functions' AS section,
    rf.function_name AS item,
    CASE 
        WHEN ef.function_name IS NOT NULL THEN '✅ Создана'
        ELSE '❌ Отсутствует'
    END AS status,
    CASE 
        WHEN ef.function_name IS NULL THEN '→ supabase_promoters_ugc_leaderboard.sql'
        ELSE ''
    END AS action
FROM required_functions rf
LEFT JOIN existing_functions ef ON rf.function_name = ef.function_name
UNION ALL

SELECT 
    '' AS section,
    '' AS item,
    '' AS status,
    '' AS action
UNION ALL

SELECT 
    '' AS section,
    '📋 СТОЛБЦЫ В USERS' AS item,
    '' AS status,
    '' AS action
UNION ALL

SELECT 
    'Users Columns' AS section,
    'users.' || rc.column_name AS item,
    CASE 
        WHEN ec.column_name IS NOT NULL THEN '✅ Есть'
        ELSE '❌ Отсутствует'
    END AS status,
    CASE 
        WHEN ec.column_name IS NULL AND rc.column_name IN ('is_promoter', 'promoter_since') 
        THEN '→ supabase_promoters_ugc_leaderboard.sql'
        WHEN ec.column_name IS NULL AND (rc.column_name LIKE 'referral%' OR rc.column_name = 'referral_level')
        THEN '→ supabase_mlm_referral_system_clean.sql'
        WHEN ec.column_name IS NULL 
        THEN '→ supabase_promoters_ugc_leaderboard.sql'
        ELSE ''
    END AS action
FROM required_columns rc
LEFT JOIN existing_columns ec ON rc.column_name = ec.column_name
UNION ALL

SELECT 
    '' AS section,
    '' AS item,
    '' AS status,
    '' AS action
UNION ALL

SELECT 
    '' AS section,
    '📈 ИТОГОВАЯ СВОДКА' AS item,
    '' AS status,
    '' AS action
UNION ALL

SELECT 
    'Summary' AS section,
    'MLM таблицы' AS item,
    (SELECT COUNT(*)::TEXT || '/2' 
     FROM required_tables rt
     JOIN existing_tables et ON rt.table_name = et.table_name
     WHERE rt.category = 'MLM') AS status,
    CASE 
        WHEN (SELECT COUNT(*) FROM required_tables rt
              JOIN existing_tables et ON rt.table_name = et.table_name
              WHERE rt.category = 'MLM') = 2 
        THEN '✅ Готово'
        ELSE '❌ Выполните: supabase_mlm_referral_system_clean.sql'
    END AS action
UNION ALL

SELECT 
    'Summary' AS section,
    'Промоутеры/UGC таблицы' AS item,
    (SELECT COUNT(*)::TEXT || '/4' 
     FROM required_tables rt
     JOIN existing_tables et ON rt.table_name = et.table_name
     WHERE rt.category = 'Promoters') AS status,
    CASE 
        WHEN (SELECT COUNT(*) FROM required_tables rt
              JOIN existing_tables et ON rt.table_name = et.table_name
              WHERE rt.category = 'Promoters') = 4 
        THEN '✅ Готово'
        ELSE '❌ Выполните: supabase_promoters_ugc_leaderboard.sql'
    END AS action
UNION ALL

SELECT 
    'Summary' AS section,
    'Лидерборд таблицы' AS item,
    (SELECT COUNT(*)::TEXT || '/4' 
     FROM required_tables rt
     JOIN existing_tables et ON rt.table_name = et.table_name
     WHERE rt.category = 'Leaderboard') AS status,
    CASE 
        WHEN (SELECT COUNT(*) FROM required_tables rt
              JOIN existing_tables et ON rt.table_name = et.table_name
              WHERE rt.category = 'Leaderboard') = 4 
        THEN '✅ Готово'
        ELSE '❌ Выполните: supabase_promoters_ugc_leaderboard.sql'
    END AS action
UNION ALL

SELECT 
    'Summary' AS section,
    'Функции' AS item,
    (SELECT COUNT(*)::TEXT || '/5' 
     FROM required_functions rf
     JOIN existing_functions ef ON rf.function_name = ef.function_name) AS status,
    CASE 
        WHEN (SELECT COUNT(*) FROM required_functions rf
              JOIN existing_functions ef ON rf.function_name = ef.function_name) = 5 
        THEN '✅ Готово'
        ELSE '❌ Выполните: supabase_promoters_ugc_leaderboard.sql'
    END AS action
UNION ALL

SELECT 
    'Summary' AS section,
    'Активный период лидерборда' AS item,
    CASE 
        WHEN EXISTS (SELECT 1 FROM leaderboard_periods WHERE status = 'active') THEN '✅ Есть'
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leaderboard_periods') THEN '❌ Нет'
        ELSE '❌ Таблица не создана'
    END AS status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM leaderboard_periods WHERE status = 'active') THEN ''
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leaderboard_periods') 
        THEN '→ Выполните: init_beta_data.sql'
        ELSE '→ Сначала создайте таблицы'
    END AS action
UNION ALL

SELECT 
    '' AS section,
    '' AS item,
    '' AS status,
    '' AS action
UNION ALL

SELECT 
    '' AS section,
    '=== ДИАГНОСТИКА ЗАВЕРШЕНА ===' AS item,
    '' AS status,
    '' AS action
ORDER BY 
    CASE section
        WHEN '=== ДИАГНОСТИКА БАЗЫ ДАННЫХ ===' THEN 1
        WHEN '📊 ТАБЛИЦЫ' THEN 2
        WHEN 'MLM' THEN 3
        WHEN 'Promoters' THEN 4
        WHEN 'Leaderboard' THEN 5
        WHEN 'Basic' THEN 6
        WHEN '⚙️ ФУНКЦИИ' THEN 7
        WHEN 'Functions' THEN 8
        WHEN '📋 СТОЛБЦЫ В USERS' THEN 9
        WHEN 'Users Columns' THEN 10
        WHEN '📈 ИТОГОВАЯ СВОДКА' THEN 11
        WHEN 'Summary' THEN 12
        WHEN '=== ДИАГНОСТИКА ЗАВЕРШЕНА ===' THEN 99
        ELSE 50
    END,
    item;

