-- =====================================================
-- ПРОСТАЯ ДИАГНОСТИКА - ВСЕ РЕЗУЛЬТАТЫ В ОДНОЙ ТАБЛИЦЕ
-- =====================================================

SELECT 
    'ТАБЛИЦЫ' AS category,
    'users' AS name,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') 
         THEN '✅' ELSE '❌' END AS status,
    CASE WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') 
         THEN 'Базовая таблица - должна существовать' ELSE '' END AS note

UNION ALL SELECT 'ТАБЛИЦЫ', 'referral_tree', 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'referral_tree') 
         THEN '✅' ELSE '❌' END,
    CASE WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'referral_tree') 
         THEN '→ supabase_mlm_referral_system_clean.sql' ELSE '' END

UNION ALL SELECT 'ТАБЛИЦЫ', 'referral_rewards', 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'referral_rewards') 
         THEN '✅' ELSE '❌' END,
    CASE WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'referral_rewards') 
         THEN '→ supabase_mlm_referral_system_clean.sql' ELSE '' END

UNION ALL SELECT 'ТАБЛИЦЫ', 'promoters', 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'promoters') 
         THEN '✅' ELSE '❌' END,
    CASE WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'promoters') 
         THEN '→ supabase_promoters_ugc_leaderboard.sql' ELSE '' END

UNION ALL SELECT 'ТАБЛИЦЫ', 'ugc_content', 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ugc_content') 
         THEN '✅' ELSE '❌' END,
    CASE WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ugc_content') 
         THEN '→ supabase_promoters_ugc_leaderboard.sql' ELSE '' END

UNION ALL SELECT 'ТАБЛИЦЫ', 'promo_materials', 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'promo_materials') 
         THEN '✅' ELSE '❌' END,
    CASE WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'promo_materials') 
         THEN '→ supabase_promoters_ugc_leaderboard.sql' ELSE '' END

UNION ALL SELECT 'ТАБЛИЦЫ', 'leaderboard_periods', 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leaderboard_periods') 
         THEN '✅' ELSE '❌' END,
    CASE WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leaderboard_periods') 
         THEN '→ supabase_promoters_ugc_leaderboard.sql' ELSE '' END

UNION ALL SELECT 'ТАБЛИЦЫ', 'leaderboard_rankings', 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leaderboard_rankings') 
         THEN '✅' ELSE '❌' END,
    CASE WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leaderboard_rankings') 
         THEN '→ supabase_promoters_ugc_leaderboard.sql' ELSE '' END

UNION ALL SELECT 'ФУНКЦИИ', 'generate_promo_code', 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'generate_promo_code') 
         THEN '✅' ELSE '❌' END,
    CASE WHEN NOT EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'generate_promo_code') 
         THEN '→ supabase_promoters_ugc_leaderboard.sql' ELSE '' END

UNION ALL SELECT 'ФУНКЦИИ', 'recalculate_leaderboard_ranks', 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'recalculate_leaderboard_ranks') 
         THEN '✅' ELSE '❌' END,
    CASE WHEN NOT EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'recalculate_leaderboard_ranks') 
         THEN '→ supabase_promoters_ugc_leaderboard.sql' ELSE '' END

UNION ALL SELECT 'ФУНКЦИИ', 'activate_upcoming_periods', 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'activate_upcoming_periods') 
         THEN '✅' ELSE '❌' END,
    CASE WHEN NOT EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'activate_upcoming_periods') 
         THEN '→ supabase_promoters_ugc_leaderboard.sql' ELSE '' END

UNION ALL SELECT 'СТОЛБЦЫ', 'users.is_promoter', 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'is_promoter') 
         THEN '✅' ELSE '❌' END,
    CASE WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'is_promoter') 
         THEN '→ supabase_promoters_ugc_leaderboard.sql' ELSE '' END

UNION ALL SELECT 'СТОЛБЦЫ', 'users.referral_code', 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'referral_code') 
         THEN '✅' ELSE '❌' END,
    CASE WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'referral_code') 
         THEN '→ supabase_mlm_referral_system_clean.sql' ELSE '' END

UNION ALL SELECT 'ДАННЫЕ', 'Активный период лидерборда', 
    CASE 
        WHEN EXISTS (SELECT 1 FROM leaderboard_periods WHERE status = 'active') THEN '✅'
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leaderboard_periods') THEN '❌'
        ELSE '⏸️'
    END,
    CASE 
        WHEN EXISTS (SELECT 1 FROM leaderboard_periods WHERE status = 'active') THEN ''
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leaderboard_periods') 
        THEN '→ init_beta_data.sql'
        ELSE '→ Сначала создайте таблицы'
    END

ORDER BY category, name;

