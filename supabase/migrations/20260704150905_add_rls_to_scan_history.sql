ALTER TABLE public.scan_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own scan history"
ON public.scan_history
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
