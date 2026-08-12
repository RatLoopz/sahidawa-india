-- Revoke EXECUTE on security definer RPCs from PUBLIC/anon role and grant exclusively to service_role.
-- Fixes side-channel data leak where anon key could invoke get_scan_counts and get_failed_pg_cron_jobs.

-- 1. get_scan_counts
CREATE OR REPLACE FUNCTION public.get_scan_counts(p_batch_number text)
RETURNS TABLE (count_24h bigint, count_7d bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') AS count_24h,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS count_7d
    FROM public.scan_history
    WHERE batch_number = p_batch_number AND created_at >= NOW() - INTERVAL '7 days';
$$;

REVOKE EXECUTE ON FUNCTION public.get_scan_counts(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_scan_counts(text) TO service_role;

-- 2. get_failed_pg_cron_jobs
CREATE OR REPLACE FUNCTION public.get_failed_pg_cron_jobs(p_job_name text, p_since_time timestamptz)
RETURNS TABLE (
    jobid bigint,
    runid bigint,
    command text,
    status text,
    return_message text,
    start_time timestamptz,
    end_time timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cjd.jobid,
        cjd.runid,
        cjd.command,
        cjd.status,
        cjd.return_message,
        cjd.start_time,
        cjd.end_time
    FROM cron.job_run_details cjd
    JOIN cron.job cj ON cjd.jobid = cj.jobid
    WHERE cj.jobname = p_job_name
      AND cjd.status = 'failed'
      AND cjd.start_time > p_since_time
    ORDER BY cjd.start_time DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_failed_pg_cron_jobs(text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_failed_pg_cron_jobs(text, timestamptz) TO service_role;
