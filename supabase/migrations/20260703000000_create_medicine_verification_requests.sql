-- Create medicine verification requests table for admin OCR approval queue
CREATE TABLE IF NOT EXISTS public.medicine_verification_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medicine_name TEXT NOT NULL,
    medicine_id UUID REFERENCES public.medicines(id) ON DELETE SET NULL,
    image_url TEXT,
    ocr_extracted_text TEXT,
    ocr_raw_response JSONB,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mvr_status ON public.medicine_verification_requests(status);
CREATE INDEX IF NOT EXISTS idx_mvr_created_at ON public.medicine_verification_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mvr_submitted_by ON public.medicine_verification_requests(submitted_by);

-- RLS: enable row level security
ALTER TABLE public.medicine_verification_requests ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own requests
CREATE POLICY "mvr_insert_own"
    ON public.medicine_verification_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (submitted_by = auth.uid());

-- Authenticated users can view their own requests
CREATE POLICY "mvr_select_own"
    ON public.medicine_verification_requests
    FOR SELECT
    TO authenticated
    USING (submitted_by = auth.uid());

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION public.set_mvr_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER mvr_updated_at
    BEFORE UPDATE ON public.medicine_verification_requests
    FOR EACH ROW EXECUTE PROCEDURE public.set_mvr_updated_at();
