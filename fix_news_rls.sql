-- ==============================================================================
-- FIX NEWS RLS: Allow service_role to manage news safely
-- ==============================================================================
-- Запустите этот скрипт в SQL Editor вашего проекта Supabase.
-- Он:
--   1) Удалит старую небезопасную политику "Service role can do everything" (если она ещё есть)
--   2) Создаст новую безопасную политику только для роли service_role
--
-- ВАЖНО:
--   - Ваш backend / админ-бот должен использовать service_role ключ, а не anon.
--   - Публичным (anon) пользователям доступ к таблице news по-прежнему будет закрыт.
-- ==============================================================================

-- 1. Удаляем старую широкую политику, если осталась
DROP POLICY IF EXISTS "Service role can do everything" ON news;

-- 2. Создаём явную политику для service_role, если её ещё нет
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'news'
          AND policyname = 'Service role can manage news'
    ) THEN
        CREATE POLICY "Service role can manage news"
            ON news
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END;
$$;


