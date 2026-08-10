-- =============================================================================
-- SahiDawa — Restrict Public Read on counterfeit_reports (PII breach #4200)
-- =============================================================================
-- PROBLEM:
--   The `reports_public_read` policy granted anon/authenticated `SELECT ...
--   USING (true)` over EVERY column of counterfeit_reports. Because the anon
--   key is embedded in client-side code, anyone could query the PostgREST REST
--   API and exfiltrate citizen reporters' personal data — reporter_phone, full
--   street address, pincode, and exact GPS coordinates (report_location) —
--   including reports still in a pending/unverified state.
--
-- FIX:
--   Drop the permissive policy, then expose ONLY a non-PII column allowlist to
--   anon/authenticated. Because table-level SELECT in PostgreSQL overrides
--   column grants, we revoke the table-level SELECT first, then re-grant the
--   individual safe columns. The RLS row policy (`USING (true)`) keeps the
--   public transparency model working for the allowed columns.
--
--   Blocked (PII / internal-only) columns:
--     reporter_id, reporter_phone, address, pincode, report_location
--     ip_address, report_hash, risk_score, is_escalated,
--     duplicate_group_id, snoozed_until
--
-- IMPACT:
--   Privileged server-side flows use the RLS-bypassing service_role key, so
--   the API report flows (submit, /mine, admin list) are unaffected. Only the
--   anon/authenticated surface—which previously exposed ALL columns—is now
--   scoped to the non-PII allowlist.
-- =============================================================================

-- 1. Undefine the "anyone can read every column" policy.
DROP POLICY IF EXISTS "reports_public_read" ON public.counterfeit_reports;

-- 2. Remove table-level SELECT for client roles so the column-level grants in
--    step 3 become the effective access surface. INSERT (report submission)
--    and owner UPDATE are intentionally untouched.
REVOKE SELECT ON public.counterfeit_reports FROM anon, authenticated;

-- 3. Re-add a row-level policy so public transparency reads still return rows.
CREATE POLICY "reports_public_read_non_pii"
    ON public.counterfeit_reports
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- 4. Grant SELECT on exactly the non-PII display columns.
GRANT SELECT (
    id,
    medicine_id,
    scanned_barcode,
    reported_brand_name,
    manufacturer,
    description,
    pharmacy_name,
    city,
    state,
    photo_url,
    photo_urls,
    district,
    status,
    created_at
) ON public.counterfeit_reports TO anon, authenticated;