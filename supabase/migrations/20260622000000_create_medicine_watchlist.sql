-- Migration: Create medicine_watchlist table and RLS policies
CREATE TABLE IF NOT EXISTS public.medicine_watchlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    medicine_id UUID NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
    notify_price_change BOOLEAN NOT NULL DEFAULT true,
    notify_recall BOOLEAN NOT NULL DEFAULT true,
    notify_new_alternative BOOLEAN NOT NULL DEFAULT true,
    notify_stock_availability BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT medicine_watchlist_user_medicine_unique UNIQUE (user_id, medicine_id)
);

CREATE INDEX IF NOT EXISTS idx_medicine_watchlist_user_id ON public.medicine_watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_medicine_watchlist_medicine_id ON public.medicine_watchlist(medicine_id);

-- Enable RLS
ALTER TABLE public.medicine_watchlist ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage only their own rows
CREATE POLICY "medicine_watchlist_user_all"
    ON public.medicine_watchlist
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Policy: Service role has full bypass access
CREATE POLICY "medicine_watchlist_service_role"
    ON public.medicine_watchlist
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
