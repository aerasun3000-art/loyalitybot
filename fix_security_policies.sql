-- ==============================================================================
-- CRITICAL SECURITY FIX: Remove Overly Permissive RLS Policies
-- ==============================================================================
-- This script removes policies that grant full access (SELECT, INSERT, UPDATE, DELETE)
-- to ALL users (including anonymous public) under the guise of "Service role".
--
-- In Supabase, the 'service_role' key automatically bypasses RLS, so these
-- policies are usually unnecessary. If you specifically need explicit policies
-- for service_role (e.g. for testing with a constrained role), they must
-- include 'TO service_role'.
-- ==============================================================================

-- 1. Fix 'messages' table
DROP POLICY IF EXISTS "Service role can do everything" ON messages;
-- (Optional) If you really wanted an explicit policy:
-- CREATE POLICY "Service role can do everything" ON messages FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. Fix 'news' table
DROP POLICY IF EXISTS "Service role can do everything" ON news;

-- 3. Fix 'partner_network' table
DROP POLICY IF EXISTS "Service role can manage network" ON partner_network;

-- 4. Fix 'partner_revenue_share' table
DROP POLICY IF EXISTS "Service role can manage revenue share" ON partner_revenue_share;

-- 5. Fix 'partner_recruitment_commissions' table
DROP POLICY IF EXISTS "Service role can manage commissions" ON partner_recruitment_commissions;

-- 6. Fix 'partner_activation_conditions' table
DROP POLICY IF EXISTS "Service role can manage activation" ON partner_activation_conditions;

-- 7. Fix 'partner_applications' table
-- "Allow public select" is dangerous as it exposes all applications to anyone.
-- We restrict it. If users need to check their status, they should ideally be authenticated
-- or use a secure function. For now, we'll restrict it to service_role (admins/bots).
DROP POLICY IF EXISTS "Allow public select" ON partner_applications;

-- If you need public inserts (for the application form), we keep "Allow public insert"
-- but ensure it's INSERT only. The existing one is:
-- CREATE POLICY "Allow public insert" ON partner_applications FOR INSERT TO public WITH CHECK (true);
-- This is generally acceptable for a public form, though rate-limiting is advised on the API layer.

-- We ensure there is a policy for service_role to manage applications
DROP POLICY IF EXISTS "Allow service role update" ON partner_applications;
CREATE POLICY "Service role can manage applications" 
    ON partner_applications 
    FOR ALL 
    TO service_role 
    USING (true) 
    WITH CHECK (true);

-- ==============================================================================
-- Verification
-- ==============================================================================
-- After running this, please verify that your backend bot still works. 
-- Since it uses the service_role key, it should continue to work fine without these policies.
-- Public users will no longer be able to read/modify these tables arbitrarily.
