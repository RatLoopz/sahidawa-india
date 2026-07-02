-- =============================================================================
-- SahiDawa — Add updated_at tracking to pharmacies (for delta sync, #2260)
-- =============================================================================
-- The pharmacies table only had created_at. Delta sync needs a column that
-- changes whenever a row is modified, so clients can ask "give me everything
-- that changed since <timestamp>" instead of re-fetching the full bounding
-- box on every map pan/zoom.
-- =============================================================================

ALTER TABLE public.pharmacies
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Backfill existing rows so updated_at is never null for pre-existing data.
UPDATE public.pharmacies SET updated_at = created_at WHERE updated_at IS NULL;

-- Generic trigger function (idempotent — reused if other tables add the
-- same pattern later).
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pharmacies_set_updated_at ON public.pharmacies;
CREATE TRIGGER trg_pharmacies_set_updated_at
    BEFORE UPDATE ON public.pharmacies
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Index to make "WHERE updated_at > :since" cheap at scale.
CREATE INDEX IF NOT EXISTS idx_pharmacies_updated_at ON public.pharmacies(updated_at);