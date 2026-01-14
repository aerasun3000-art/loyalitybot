-- ==============================================================================
-- ВОССТАНОВЛЕНИЕ ПРАВ ДОСТУПА ДЛЯ ПАРТНЕРСКОГО БОТА
-- ==============================================================================
-- Этот скрипт восстанавливает RLS политики для таблиц, которые использует
-- партнерский бот после выполнения fix_security_policies.sql
--
-- ВАЖНО: Если бот использует service_role ключ, эти политики не нужны
-- (service_role автоматически обходит RLS). Но если бот использует anon ключ,
-- эти политики необходимы.
-- ==============================================================================

-- 1. Восстановление политик для таблицы 'messages'
DROP POLICY IF EXISTS "Service role can do everything" ON messages;
CREATE POLICY "Service role can do everything" 
    ON messages 
    FOR ALL 
    TO service_role 
    USING (true) 
    WITH CHECK (true);

-- 2. Восстановление политик для таблицы 'news'
DROP POLICY IF EXISTS "Service role can do everything" ON news;
CREATE POLICY "Service role can do everything" 
    ON news 
    FOR ALL 
    TO service_role 
    USING (true) 
    WITH CHECK (true);

-- 3. Восстановление политик для таблицы 'partner_network'
DROP POLICY IF EXISTS "Service role can manage network" ON partner_network;
CREATE POLICY "Service role can manage network" 
    ON partner_network 
    FOR ALL 
    TO service_role 
    USING (true) 
    WITH CHECK (true);

-- 4. Восстановление политик для таблицы 'partner_revenue_share'
DROP POLICY IF EXISTS "Service role can manage revenue share" ON partner_revenue_share;
CREATE POLICY "Service role can manage revenue share" 
    ON partner_revenue_share 
    FOR ALL 
    TO service_role 
    USING (true) 
    WITH CHECK (true);

-- 5. Восстановление политик для таблицы 'partner_recruitment_commissions'
DROP POLICY IF EXISTS "Service role can manage commissions" ON partner_recruitment_commissions;
CREATE POLICY "Service role can manage commissions" 
    ON partner_recruitment_commissions 
    FOR ALL 
    TO service_role 
    USING (true) 
    WITH CHECK (true);

-- 6. Восстановление политик для таблицы 'partner_activation_conditions'
DROP POLICY IF EXISTS "Service role can manage activation" ON partner_activation_conditions;
CREATE POLICY "Service role can manage activation" 
    ON partner_activation_conditions 
    FOR ALL 
    TO service_role 
    USING (true) 
    WITH CHECK (true);

-- 7. Восстановление политик для таблицы 'partner_applications'
-- В fix_security_policies.sql была удалена "Allow public select", что блокирует чтение через anon ключ
-- Восстанавливаем SELECT для anon роли (нужно для проверки статуса заявки ботом)
DROP POLICY IF EXISTS "Allow public select" ON partner_applications;
CREATE POLICY "Allow public select" 
    ON partner_applications 
    FOR SELECT 
    TO public 
    USING (true);

-- Политика INSERT для регистрации партнеров (должна быть, проверяем)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'partner_applications' 
        AND policyname = 'Allow public insert'
    ) THEN
        CREATE POLICY "Allow public insert" 
            ON partner_applications 
            FOR INSERT 
            TO public 
            WITH CHECK (true);
    END IF;
END $$;

-- Политика для service_role (уже должна быть создана в fix_security_policies.sql)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'partner_applications' 
        AND policyname = 'Service role can manage applications'
    ) THEN
        CREATE POLICY "Service role can manage applications" 
            ON partner_applications 
            FOR ALL 
            TO service_role 
            USING (true) 
            WITH CHECK (true);
    END IF;
END $$;

-- ==============================================================================
-- ПРИМЕЧАНИЕ: Если бот использует anon ключ вместо service_role
-- ==============================================================================
-- Если ваш бот использует anon ключ (как указано в env.example.txt),
-- у вас есть два варианта:
--
-- ВАРИАНТ 1 (РЕКОМЕНДУЕТСЯ): Переключить бот на service_role ключ
-- 1. Откройте Supabase Dashboard → Settings → API
-- 2. Скопируйте service_role ключ (НЕ anon!)
-- 3. Обновите переменную окружения SUPABASE_KEY в вашем .env или на сервере
-- 4. Перезапустите бота
--
-- ВАРИАНТ 2: Создать политики для anon роли (менее безопасно)
-- Раскомментируйте следующие строки, если нужно использовать anon ключ:
--
-- CREATE POLICY "Anon can manage messages" ON messages FOR ALL TO anon USING (true) WITH CHECK (true);
-- CREATE POLICY "Anon can manage news" ON news FOR ALL TO anon USING (true) WITH CHECK (true);
-- CREATE POLICY "Anon can manage network" ON partner_network FOR ALL TO anon USING (true) WITH CHECK (true);
-- CREATE POLICY "Anon can manage revenue share" ON partner_revenue_share FOR ALL TO anon USING (true) WITH CHECK (true);
-- CREATE POLICY "Anon can manage commissions" ON partner_recruitment_commissions FOR ALL TO anon USING (true) WITH CHECK (true);
-- CREATE POLICY "Anon can manage activation" ON partner_activation_conditions FOR ALL TO anon USING (true) WITH CHECK (true);
--
-- ВНИМАНИЕ: Политики для anon роли дают доступ ВСЕМ анонимным пользователям!
-- Это менее безопасно, чем использование service_role ключа.
-- ==============================================================================

-- Проверка: список всех политик для указанных таблиц
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies
WHERE tablename IN (
    'messages',
    'news',
    'partner_network',
    'partner_revenue_share',
    'partner_recruitment_commissions',
    'partner_activation_conditions',
    'partner_applications'
)
ORDER BY tablename, policyname;




