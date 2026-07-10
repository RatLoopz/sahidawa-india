CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TYPE shoutout_status AS ENUM ('PENDING', 'POSTED', 'FAILED');

CREATE TABLE public.linkedin_shoutouts (
    pr_number INTEGER PRIMARY KEY,
    pr_url TEXT,
    author TEXT,
    labels TEXT,
    status shoutout_status NOT NULL DEFAULT 'PENDING',
    retry_count INTEGER NOT NULL DEFAULT 0,
    next_retry_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    error_log TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.linkedin_shoutouts ENABLE ROW LEVEL SECURITY;

-- Only service role can access this table
CREATE POLICY "Service role can manage linkedin_shoutouts" ON public.linkedin_shoutouts
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Create a trigger for updated_at
CREATE TRIGGER set_linkedin_shoutouts_updated_at
    BEFORE UPDATE ON public.linkedin_shoutouts
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Add index on status for faster retry queries
CREATE INDEX idx_linkedin_shoutouts_status_retry ON public.linkedin_shoutouts (status, next_retry_at);
