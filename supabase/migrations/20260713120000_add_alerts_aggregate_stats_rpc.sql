-- =============================================================================
-- Fix #3001: Paginated Calculations on Live Alerts Log Stats Panel
--
-- The "Critical / Banned" and "Impacted Areas" stats cards on the Alerts page
-- were being derived client-side from the paginated `allAlerts` array, so they
-- only reflected whatever page(s) had been loaded so far instead of the full
-- system-wide totals.
--
-- This RPC computes both totals in a single fast aggregate query over the
-- *entire* (unpaginated) drug_alerts table, honoring the same active-alert
-- and filter conditions as GET /api/v1/alerts, so the API can return correct
-- system-wide counts alongside the paginated page of results.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_alerts_aggregate_stats(
    p_brand TEXT DEFAULT NULL,
    p_region TEXT DEFAULT NULL,
    p_batch_number TEXT DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_critical_count INT;
    v_impacted_regions_count INT;
BEGIN
    SELECT
        COUNT(*) FILTER (
            WHERE m.cdsco_approval_status = 'banned'
               OR m.is_counterfeit_alert IS TRUE
               OR da.alert_type ILIKE 'banned'
        ),
        COUNT(DISTINCT da.state)
    INTO v_critical_count, v_impacted_regions_count
    FROM public.drug_alerts da
    LEFT JOIN public.medicines m ON m.id = da.medicine_id
    WHERE (da.snoozed_until IS NULL OR da.snoozed_until <= NOW())
      AND (p_brand IS NULL OR da.reported_brand_name ILIKE '%' || p_brand || '%')
      AND (p_region IS NULL OR da.state ILIKE '%' || p_region || '%')
      AND (p_batch_number IS NULL OR da.batch_number = p_batch_number);

    RETURN jsonb_build_object(
        'totalCriticalCount', COALESCE(v_critical_count, 0),
        'totalImpactedRegionsCount', COALESCE(v_impacted_regions_count, 0)
    );
END;
$$;

COMMENT ON FUNCTION public.get_alerts_aggregate_stats IS
    'Returns system-wide (unpaginated) critical-alert and impacted-region counts for the Alerts page stats panel. See issue #3001.';
