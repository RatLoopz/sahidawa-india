CREATE TABLE dose_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES medicine_schedules(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    log_date DATE NOT NULL,
    log_time TIME NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('taken', 'skipped')),
    taken_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (schedule_id, log_date, log_time)
);

CREATE INDEX idx_dose_logs_schedule_id ON dose_logs(schedule_id);
CREATE INDEX idx_dose_logs_user_id ON dose_logs(user_id);
CREATE INDEX idx_dose_logs_date ON dose_logs(log_date);

ALTER TABLE dose_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own dose logs"
    ON dose_logs
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role full access"
    ON dose_logs
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
