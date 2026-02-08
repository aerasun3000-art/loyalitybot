-- ============================================
-- Исправление: добавить недостающие FK и RLS-политики
-- Дата: 2026-02-08
-- ============================================

-- 1. Добавить FK partner_chat_id -> partners(chat_id) в reactivation_events
ALTER TABLE reactivation_events
ADD CONSTRAINT fk_reactivation_partner
FOREIGN KEY (partner_chat_id) REFERENCES partners(chat_id) ON DELETE CASCADE;

-- 2. Добавить FK partner_chat_id -> partners(chat_id) в client_visit_stats
ALTER TABLE client_visit_stats
ADD CONSTRAINT fk_client_visit_stats_partner
FOREIGN KEY (partner_chat_id) REFERENCES partners(chat_id) ON DELETE CASCADE;

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

-- 4. Включить RLS на ton_payments
ALTER TABLE ton_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read ton_payments"
ON ton_payments
FOR SELECT
TO anon, authenticated, service_role
USING (true);

CREATE POLICY "Allow insert ton_payments"
ON ton_payments
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Allow update ton_payments"
ON ton_payments
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow delete ton_payments"
ON ton_payments
FOR DELETE
TO service_role
USING (true);
