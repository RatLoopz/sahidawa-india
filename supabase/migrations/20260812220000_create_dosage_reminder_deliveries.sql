CREATE TABLE IF NOT EXISTS public.dosage_reminder_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES public.medicine_schedules(id) ON DELETE CASCADE,
    scheduled_time TEXT NOT NULL,
    reminder_date DATE NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (schedule_id, scheduled_time, reminder_date)
);

CREATE INDEX IF NOT EXISTS idx_dosage_reminder_deliveries_date
    ON public.dosage_reminder_deliveries(reminder_date);
