CREATE TABLE medicine_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    medicine_id UUID REFERENCES medicines(id) ON DELETE SET NULL,
    medicine_name TEXT NOT NULL,
    dosage TEXT NOT NULL DEFAULT '1 tablet',
    frequency INTEGER NOT NULL CHECK (frequency > 0),
    times JSONB NOT NULL DEFAULT '[]'::jsonb,
    start_date DATE NOT NULL,
    end_date DATE,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_medicine_schedules_user_id ON medicine_schedules(user_id);
CREATE INDEX idx_medicine_schedules_active ON medicine_schedules(is_active) WHERE is_active = true;

ALTER TABLE medicine_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own schedules"
    ON medicine_schedules
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role full access"
    ON medicine_schedules
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
