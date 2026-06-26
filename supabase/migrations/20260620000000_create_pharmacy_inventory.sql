-- Create pharmacy inventory management table
CREATE TABLE IF NOT EXISTS public.pharmacy_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id UUID NOT NULL, -- Links to your main pharmacy registration profile
    medicine_name TEXT NOT NULL,
    batch_number TEXT NOT NULL,
    expiry_date DATE NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    mrp NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Basic performance indexes for looking up inventory rows efficiently
CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_pharmacy_id ON public.pharmacy_inventory(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_medicine_name ON public.pharmacy_inventory(medicine_name);

-- Turn on Row Level Security (RLS) to fulfill security requirements
ALTER TABLE public.pharmacy_inventory ENABLE ROW LEVEL SECURITY;

-- Policy: Pharmacies can read/write only their own items
CREATE POLICY "Allow authenticated pharmacies management access" 
ON public.pharmacy_inventory 
FOR ALL 
TO authenticated
USING (auth.uid() = pharmacy_id);