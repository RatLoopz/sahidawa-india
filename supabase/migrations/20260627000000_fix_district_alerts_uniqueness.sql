-- =============================================================================
-- SahiDawa — Fix district_alerts uniqueness and add counterfeit_reports index
-- =============================================================================
-- WHY THIS EXISTS:
--   district_alerts currently has a UNIQUE constraint on (district) alone.
--   Because the alert upsert in apps/api/src/routes/reports.ts uses
--   onConflict: "district", only ONE alert row can exist per district —
--   so if 5 fake reports come in for Medicine A and separately 5 for
--   Medicine B in the same district, the second upsert silently overwrites
--   the first. Citizens checking the alert feed for that district only
--   ever see the most recently updated medicine, never both.
--
--   The correct uniqueness is per (district, medicine_name) pair, not per
--   district. This migration:
--     1. Drops the old district-only unique constraint
--     2. Adds a composite unique constraint on (district, medicine_name)
--     3. Adds an index on counterfeit_reports (status, district, is_escalated)
--        to support the COUNT query in the same code path, which is
--        currently an unindexed sequential scan on every admin status update
--
--   SAFETY NOTE: step 2 will fail if any existing rows already violate the
--   new composite constraint (i.e. duplicate (district, medicine_name)
--   pairs slipped in some other way before this migration). The DO block
--   below checks for that first and raises a clear, actionable error
--   instead of letting Postgres fail with an opaque constraint-violation
--   message, or worse, succeeding silently and discarding ambiguous data.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Pre-flight check — abort with a clear message if duplicates would
--    violate the new composite constraint. If this fires, the duplicates
--    must be resolved manually (e.g. merge alert_level by taking the max,
--    or decide which row is authoritative) before re-running this migration.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT district, medicine_name
        FROM district_alerts
        GROUP BY district, medicine_name
        HAVING COUNT(*) > 1
    ) AS dupes;

    IF duplicate_count > 0 THEN
        RAISE EXCEPTION
            'Migration aborted: % duplicate (district, medicine_name) pair(s) found in district_alerts. '
            'Resolve these rows manually before re-running this migration. '
            'Run: SELECT district, medicine_name, COUNT(*) FROM district_alerts '
            'GROUP BY district, medicine_name HAVING COUNT(*) > 1;',
            duplicate_count;
    END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Drop the old district-only unique constraint and add the composite one.
--    Constraint name assumed as Postgres's default naming convention for a
--    table-level UNIQUE on a single column (<table>_<column>_key). If your
--    actual constraint has a different name, check with:
--      \d district_alerts
--    and adjust the DROP CONSTRAINT line accordingly before applying.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE district_alerts
    DROP CONSTRAINT IF EXISTS district_alerts_district_key;

ALTER TABLE district_alerts
    ADD CONSTRAINT district_alerts_district_medicine_key
    UNIQUE (district, medicine_name);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Audit trail columns (minimal scope — see issue discussion).
--    previous_alert_level records what the level was before this upsert,
--    so an admin panel can show "escalated from medium to high" history
--    without needing a full separate audit table.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE district_alerts
    ADD COLUMN IF NOT EXISTS previous_alert_level TEXT;

ALTER TABLE district_alerts
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Index to support the COUNT query in the district-alert trigger path:
--      .eq("district", ...).eq("status", "verified_fake").eq("is_escalated", false)
--    Column order matches equality-filter order for optimal index usage.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cr_status_district_escalated
    ON counterfeit_reports (status, district, is_escalated);
    