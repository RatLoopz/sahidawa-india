-- User-owned scan records live in user_scan_history. The scan_history table is
-- an anonymous/service-owned anomaly log and does not have a user_id column.
ALTER TABLE public.user_scan_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own scan history" ON public.user_scan_history;
CREATE POLICY "Users can manage their own scan history"
ON public.user_scan_history
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
