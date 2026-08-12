CREATE TABLE IF NOT EXISTS public.pharmacy_partners (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    pharmacy_name TEXT NOT NULL,
    pharmacist_name TEXT NOT NULL,
    license_number TEXT NOT NULL UNIQUE,
    phone_number TEXT NOT NULL,
    email TEXT,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    pincode TEXT NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_pharmacy_partners_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pharmacy_partners_updated_at_trigger
    BEFORE UPDATE ON public.pharmacy_partners
    FOR EACH ROW
    EXECUTE FUNCTION update_pharmacy_partners_updated_at();

-- Enable RLS
ALTER TABLE public.pharmacy_partners ENABLE ROW LEVEL SECURITY;

-- Allow public to insert (registration)
CREATE POLICY "Allow public insert to pharmacy_partners"
ON public.pharmacy_partners
FOR INSERT
WITH CHECK (true);

-- Only authenticated users (admins) can read for now
CREATE POLICY "Allow authenticated read to pharmacy_partners"
ON public.pharmacy_partners
FOR SELECT
USING (auth.role() = 'authenticated');
