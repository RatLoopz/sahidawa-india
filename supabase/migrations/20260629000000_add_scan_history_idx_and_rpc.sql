CREATE INDEX IF NOT EXISTS idx_scan_history_batch_created
ON scan_history (batch_number, created_at DESC);

CREATE OR REPLACE FUNCTION get_scan_counts(p_batch_number text)
RETURNS TABLE (count_24h bigint, count_7d bigint)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') AS count_24h,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS count_7d
    FROM scan_history
    WHERE batch_number = p_batch_number AND created_at >= NOW() - INTERVAL '7 days';
$$;
