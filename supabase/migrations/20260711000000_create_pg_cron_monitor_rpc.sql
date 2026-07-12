-- RPC to fetch failed pg_cron jobs, allowing the API service_role to access cron.job_run_details
CREATE OR REPLACE FUNCTION get_failed_pg_cron_jobs(p_job_name text, p_since_time timestamptz)
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
