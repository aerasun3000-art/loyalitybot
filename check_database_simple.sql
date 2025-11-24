-- =====================================================
-- БЫСТРАЯ ПРОВЕРКА БАЗЫ ДАННЫХ
-- Компактный отчет о готовности к бета-версии
-- =====================================================

-- =====================================================
-- 1. СВОДКА ПО ТАБЛИЦАМ
-- =====================================================

SELECT 
    '=== ПРОВЕРКА ТАБЛИЦ ===' AS check_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users')
        THEN '✅ users' ELSE '❌ users - отсутствует'
    END AS basic_tables,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'referral_tree')
        THEN '✅ referral_tree' ELSE '❌ referral_tree - выполните: supabase_mlm_referral_system_clean.sql'
    END AS mlm_tables,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'promoters')
        THEN '✅ promoters' ELSE '❌ promoters - выполните: supabase_promoters_ugc_leaderboard.sql'
    END AS promoter_tables,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leaderboard_periods')
        THEN '✅ leaderboard_periods' ELSE '❌ leaderboard_periods - выполните: supabase_promoters_ugc_leaderboard.sql'
    END AS leaderboard_tables;

-- =====================================================
-- 2. ДЕТАЛЬНАЯ ПРОВЕРКА ВСЕХ ТАБЛИЦ
-- =====================================================

SELECT 
    '=== ДЕТАЛЬНАЯ ПРОВЕРКА ТАБЛИЦ ===' AS section;

-- Все необходимые таблицы
SELECT 
    t.table_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = t.table_name
        ) THEN '✅ Создана'
        ELSE '❌ Отсутствует'
    END AS status,
    CASE 
        WHEN t.table_name IN ('referral_tree', 'referral_rewards') THEN 'Выполните: supabase_mlm_referral_system_clean.sql'
        WHEN t.table_name IN ('promoters', 'ugc_content', 'promo_materials', 'material_downloads', 
                              'leaderboard_periods', 'leaderboard_rankings', 'leaderboard_metrics', 'prize_distributions')
        THEN 'Выполните: supabase_promoters_ugc_leaderboard.sql'
        ELSE ''
    END AS action_required
FROM (
    SELECT unnest(ARRAY[
        'users', 'partners', 'partner_applications', 'transactions', 'nps_ratings', 'promotions', 'services',
        'referral_tree', 'referral_rewards',
        'promoters', 'ugc_content', 'promo_materials', 'material_downloads',
        'leaderboard_periods', 'leaderboard_rankings', 'leaderboard_metrics', 'prize_distributions'
    ]) AS table_name
) t
ORDER BY status, t.table_name;

-- =====================================================
-- 3. ПРОВЕРКА ФУНКЦИЙ
-- =====================================================

SELECT 
    '' AS section,
    '=== ПРОВЕРКА ФУНКЦИЙ ===' AS check_type;

SELECT 
    f.function_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_schema = 'public'
            AND routine_name = f.function_name
            AND routine_type = 'FUNCTION'
        ) THEN '✅ Создана'
        ELSE '❌ Отсутствует'
    END AS status,
    'Выполните: supabase_promoters_ugc_leaderboard.sql' AS action_required
FROM (
    SELECT unnest(ARRAY[
        'generate_promo_code',
        'update_promoter_on_ugc_approval',
        'recalculate_leaderboard_ranks',
        'activate_upcoming_periods',
        'create_monthly_leaderboard_period'
    ]) AS function_name
) f
ORDER BY status, f.function_name;

-- =====================================================
-- 4. ПРОВЕРКА СТОЛБЦОВ В USERS
-- =====================================================

SELECT 
    '' AS section,
    '=== ПРОВЕРКА СТОЛБЦОВ В USERS ===' AS check_type;

-- Промоутеры столбцы
SELECT 
    c.column_name AS users_column,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'users' 
            AND column_name = c.column_name
        ) THEN '✅ Есть'
        ELSE '❌ Отсутствует'
    END AS status,
    CASE 
        WHEN c.column_name IN ('is_promoter', 'promoter_since') 
        THEN 'ALTER TABLE users ADD COLUMN IF NOT EXISTS ' || c.column_name || ' BOOLEAN DEFAULT false;'
        WHEN c.column_name = 'promoter_since' 
        THEN 'ALTER TABLE users ADD COLUMN IF NOT EXISTS promoter_since TIMESTAMP;'
        WHEN c.column_name LIKE 'referral%' OR c.column_name = 'referral_level'
        THEN 'Выполните: supabase_mlm_referral_system_clean.sql'
        WHEN c.column_name LIKE 'leaderboard%' OR c.column_name = 'current_leaderboard_period_id'
        THEN 'ALTER TABLE users ADD COLUMN IF NOT EXISTS ' || c.column_name || ' NUMERIC(10,2) DEFAULT 0;'
        ELSE ''
    END AS sql_to_add
FROM (
    SELECT unnest(ARRAY[
        'is_promoter', 'promoter_since',
        'referral_code', 'referred_by_chat_id', 'total_referrals', 
        'active_referrals', 'total_referral_earnings', 'referral_level',
        'total_leaderboard_points', 'leaderboard_wins', 'current_leaderboard_period_id'
    ]) AS column_name
) c
ORDER BY status, c.column_name;

-- =====================================================
-- 5. ИТОГОВЫЙ СТАТУС
-- =====================================================

SELECT 
    '' AS section,
    '=== ИТОГОВЫЙ СТАТУС ===' AS check_type;

SELECT 
    (SELECT COUNT(*) 
     FROM information_schema.tables 
     WHERE table_schema = 'public' 
     AND table_name IN (
         'referral_tree', 'referral_rewards'
     )
    ) AS mlm_tables_count,
    'из 2' AS mlm_total,
    CASE 
        WHEN (SELECT COUNT(*) FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name IN ('referral_tree', 'referral_rewards')) = 2 
        THEN '✅ MLM система готова'
        ELSE '❌ Выполните: supabase_mlm_referral_system_clean.sql'
    END AS mlm_status,
    
    (SELECT COUNT(*) 
     FROM information_schema.tables 
     WHERE table_schema = 'public' 
     AND table_name IN (
         'promoters', 'ugc_content', 'promo_materials', 'material_downloads'
     )
    ) AS promoter_tables_count,
    'из 4' AS promoter_total,
    CASE 
        WHEN (SELECT COUNT(*) FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name IN ('promoters', 'ugc_content', 'promo_materials', 'material_downloads')) = 4 
        THEN '✅ Промоутеры готовы'
        ELSE '❌ Выполните: supabase_promoters_ugc_leaderboard.sql'
    END AS promoter_status,
    
    (SELECT COUNT(*) 
     FROM information_schema.tables 
     WHERE table_schema = 'public' 
     AND table_name IN (
         'leaderboard_periods', 'leaderboard_rankings', 'leaderboard_metrics', 'prize_distributions'
     )
    ) AS leaderboard_tables_count,
    'из 4' AS leaderboard_total,
    CASE 
        WHEN (SELECT COUNT(*) FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name IN ('leaderboard_periods', 'leaderboard_rankings', 'leaderboard_metrics', 'prize_distributions')) = 4 
        THEN '✅ Лидерборд готов'
        ELSE '❌ Выполните: supabase_promoters_ugc_leaderboard.sql'
    END AS leaderboard_status;

-- =====================================================
-- 6. БЫСТРЫЕ SQL КОМАНДЫ ДЛЯ ИСПРАВЛЕНИЯ
-- =====================================================

SELECT 
    '' AS section,
    '=== SQL КОМАНДЫ ДЛЯ БЫСТРОГО ИСПРАВЛЕНИЯ ===' AS check_type;

-- Если таблицы отсутствуют, выводим рекомендации
SELECT 
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'referral_tree')
        THEN '⚠️  Выполните файл: supabase_mlm_referral_system_clean.sql'
        ELSE '✅ MLM таблицы готовы'
    END AS mlm_action,
    
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'promoters')
        THEN '⚠️  Выполните файл: supabase_promoters_ugc_leaderboard.sql'
        ELSE '✅ Таблицы промоутеров готовы'
    END AS promoter_action,
    
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leaderboard_periods')
        THEN '⚠️  Выполните файл: supabase_promoters_ugc_leaderboard.sql (включает лидерборд)'
        ELSE '✅ Таблицы лидерборда готовы'
    END AS leaderboard_action,
    
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leaderboard_periods')
        AND NOT EXISTS (SELECT 1 FROM leaderboard_periods WHERE status = 'active')
        THEN '⚠️  Выполните файл: init_beta_data.sql (создаст первый период)'
        WHEN EXISTS (SELECT 1 FROM leaderboard_periods WHERE status = 'active')
        THEN '✅ Активный период лидерборда существует'
        ELSE '⏸️  Создайте период вручную'
    END AS data_action;

