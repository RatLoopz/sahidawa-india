CREATE TABLE IF NOT EXISTS public.expiry_tracker_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    brand_name TEXT NOT NULL,
    batch_number TEXT,
    expiry_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.expiry_tracker_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expiry_tracker_select"
ON public.expiry_tracker_items
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "expiry_tracker_insert"
ON public.expiry_tracker_items
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "expiry_tracker_update"
ON public.expiry_tracker_items
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "expiry_tracker_delete"
ON public.expiry_tracker_items
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_expiry_tracker_user_id
ON public.expiry_tracker_items(user_id);