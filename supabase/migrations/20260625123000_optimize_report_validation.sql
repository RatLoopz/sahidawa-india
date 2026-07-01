-- =============================================================================
-- Optimize Report Validation: Unique Constraint, Indexes, and RPC
-- =============================================================================

-- 1. Unique constraint for race condition prevention
ALTER TABLE public.counterfeit_reports 
ADD CONSTRAINT uq_report_hash UNIQUE (report_hash);

-- 2. Performance indexes for anti-abuse checks
CREATE INDEX IF NOT EXISTS idx_cr_ip_created ON public.counterfeit_reports (ip_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cr_district_created ON public.counterfeit_reports (district, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cr_medicine_created ON public.counterfeit_reports (reported_brand_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cr_hash ON public.counterfeit_reports (report_hash);

-- 3. RPC to consolidate 10 validation queries into a single round-trip
CREATE OR REPLACE FUNCTION validate_report_submission(
    p_report_hash TEXT,
    p_medicine_name TEXT,
    p_pharmacy_name TEXT,
    p_city TEXT,
    p_district TEXT,
    p_ip_address TEXT,
    p_user_id UUID
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_dedup_deadline TIMESTAMP WITH TIME ZONE := NOW() - INTERVAL '24 hours';
    v_burst_deadline TIMESTAMP WITH TIME ZONE := NOW() - INTERVAL '1 hour';
    
    v_duplicate_count INT;
    v_first_dup_id UUID;
    v_fuzzy_count INT;
    v_first_fuzzy_id UUID;
    v_ip_burst_count INT;
    v_district_burst_count INT;
    v_medicine_burst_count INT;
    v_reputation_count INT;
    v_geo_count INT;
    v_sybil_district_count INT;
    v_sybil_medicine_count INT;
    v_pharmacy_valid BOOLEAN := FALSE;
    
    v_result jsonb;
BEGIN
    -- 0. Deduplication check
    SELECT COUNT(*), (array_agg(id ORDER BY created_at DESC))[1]
    INTO v_duplicate_count, v_first_dup_id
    FROM counterfeit_reports
    WHERE report_hash = p_report_hash AND created_at >= v_dedup_deadline;
    
    -- 1. Fuzzy duplicate
    v_fuzzy_count := 0;
    IF p_pharmacy_name IS NOT NULL AND length(trim(p_pharmacy_name)) >= 4 THEN
        SELECT COUNT(*), (array_agg(id))[1]
        INTO v_fuzzy_count, v_first_fuzzy_id
        FROM counterfeit_reports
        WHERE reported_brand_name = p_medicine_name
          AND city = p_city
          AND pharmacy_name ILIKE (substring(trim(p_pharmacy_name) from 1 for 4) || '%')
          AND created_at >= v_dedup_deadline;
    END IF;
    
    -- 2. Burst: IP
    v_ip_burst_count := 0;
    IF p_ip_address IS NOT NULL THEN
        SELECT COUNT(*)
        INTO v_ip_burst_count
        FROM counterfeit_reports
        WHERE ip_address = p_ip_address AND created_at >= v_burst_deadline;
    END IF;
    
    -- 3. Burst: District
    v_district_burst_count := 0;
    IF p_district IS NOT NULL THEN
        SELECT COUNT(*)
        INTO v_district_burst_count
        FROM counterfeit_reports
        WHERE district = p_district AND created_at >= v_burst_deadline;
    END IF;
    
    -- 4. Burst: Medicine
    v_medicine_burst_count := 0;
    IF p_medicine_name IS NOT NULL THEN
        SELECT COUNT(*)
        INTO v_medicine_burst_count
        FROM counterfeit_reports
        WHERE reported_brand_name = p_medicine_name AND created_at >= v_burst_deadline;
    END IF;
    
    -- 5. Reputation
    v_reputation_count := 0;
    IF p_user_id IS NOT NULL THEN
        SELECT COUNT(*)
        INTO v_reputation_count
        FROM counterfeit_reports
        WHERE reporter_id = p_user_id AND status = 'false_alarm';
    END IF;
    
    -- 6. Geographic diversity
    v_geo_count := 0;
    IF p_ip_address IS NOT NULL THEN
        SELECT COUNT(DISTINCT district)
        INTO v_geo_count
        FROM counterfeit_reports
        WHERE ip_address = p_ip_address AND created_at >= v_burst_deadline;
    END IF;
    
    -- 7. Sybil: District
    v_sybil_district_count := 0;
    IF p_ip_address IS NOT NULL AND p_district IS NOT NULL THEN
        SELECT COUNT(DISTINCT ip_address)
        INTO v_sybil_district_count
        FROM counterfeit_reports
        WHERE district = p_district AND created_at >= v_burst_deadline;
    END IF;
    
    -- 8. Sybil: Medicine
    v_sybil_medicine_count := 0;
    IF p_ip_address IS NOT NULL AND p_medicine_name IS NOT NULL THEN
        SELECT COUNT(DISTINCT ip_address)
        INTO v_sybil_medicine_count
        FROM counterfeit_reports
        WHERE reported_brand_name = p_medicine_name AND created_at >= v_burst_deadline;
    END IF;
    
    -- 9. Pharmacy verification
    v_pharmacy_valid := FALSE;
    IF p_pharmacy_name IS NOT NULL AND trim(p_pharmacy_name) <> '' THEN
        SELECT EXISTS (
            SELECT 1 FROM pharmacies WHERE name ILIKE ('%' || p_pharmacy_name || '%')
        ) INTO v_pharmacy_valid;
    ELSE
        -- If no pharmacy name provided, we default to passing the check
        v_pharmacy_valid := TRUE; 
    END IF;
    
    v_result := jsonb_build_object(
        'duplicate_count', v_duplicate_count,
        'first_dup_id', v_first_dup_id,
        'fuzzy_count', v_fuzzy_count,
        'first_fuzzy_id', v_first_fuzzy_id,
        'ip_burst_count', v_ip_burst_count,
        'district_burst_count', v_district_burst_count,
        'medicine_burst_count', v_medicine_burst_count,
        'reputation_count', v_reputation_count,
        'geo_count', v_geo_count,
        'sybil_district_count', v_sybil_district_count,
        'sybil_medicine_count', v_sybil_medicine_count,
        'pharmacy_valid', v_pharmacy_valid
    );
    
    RETURN v_result;
END;
$$;
