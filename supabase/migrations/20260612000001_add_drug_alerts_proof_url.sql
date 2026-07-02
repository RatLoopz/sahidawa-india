-- Add proof_image_url column to drug_alerts table
ALTER TABLE public.drug_alerts ADD COLUMN IF NOT EXISTS proof_image_url TEXT;
