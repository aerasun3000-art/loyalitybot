-- ============================================
-- Исправление: добавить недостающие FK и RLS-политики
-- Дата: 2026-02-08
-- ============================================

-- 1. Добавить FK partner_chat_id -> partners(chat_id) в reactivation_events
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_reactivation_partner') THEN
    ALTER TABLE reactivation_events
    ADD CONSTRAINT fk_reactivation_partner
    FOREIGN KEY (partner_chat_id) REFERENCES partners(chat_id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2. Добавить FK partner_chat_id -> partners(chat_id) в client_visit_stats
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_client_visit_stats_partner') THEN
    ALTER TABLE client_visit_stats
    ADD CONSTRAINT fk_client_visit_stats_partner
    FOREIGN KEY (partner_chat_id) REFERENCES partners(chat_id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Ужесточить RLS на partner_categories: убрать anon из INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "Allow insert partner_categories" ON partner_categories;
CREATE POLICY "Allow insert partner_categories"
ON partner_categories
FOR INSERT
TO authenticated, service_role
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update partner_categories" ON partner_categories;
CREATE POLICY "Allow update partner_categories"
ON partner_categories
FOR UPDATE
TO authenticated, service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow delete partner_categories" ON partner_categories;
CREATE POLICY "Allow delete partner_categories"
ON partner_categories
FOR DELETE
TO authenticated, service_role
USING (true);

-- 4. ton_payments — RLS добавится когда таблица будет создана
