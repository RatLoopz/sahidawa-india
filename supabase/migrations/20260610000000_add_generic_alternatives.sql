-- =============================================================================
-- SahiDawa — Generic Alternatives Table & Mapping Data
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.generic_alternatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_medicine_id TEXT NOT NULL,
  generic_medicine_id TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  generic_name TEXT NOT NULL,
  brand_price DECIMAL(10,2),
  jan_aushadhi_price DECIMAL(10,2) NOT NULL,
  savings_percentage INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast brand lookup
CREATE INDEX IF NOT EXISTS idx_alternatives_brand ON public.generic_alternatives(brand_medicine_id);

-- Enable Row Level Security
ALTER TABLE public.generic_alternatives ENABLE ROW LEVEL SECURITY;

-- Anon and authenticated users can SELECT
CREATE POLICY "generic_alternatives_public_read"
  ON public.generic_alternatives
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only service_role can write
CREATE POLICY "generic_alternatives_service_write"
  ON public.generic_alternatives
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Seed Lipitor 10mg and Generic Atorvastatin 10mg if not exist
INSERT INTO public.medicines (barcode_id, brand_name, generic_name, manufacturer, cdsco_approval_status, is_counterfeit_alert, mrp, jan_aushadhi_price, composition)
VALUES 
('8901234700010', 'Lipitor', 'Atorvastatin 10mg', 'Pfizer Ltd', 'approved', false, 120.00, 15.00, 'Atorvastatin Calcium 10mg'),
('8901234700011', 'Atorvastatin 10mg (Generic)', 'Atorvastatin 10mg', 'Jan Aushadhi', 'approved', false, 15.00, 15.00, 'Atorvastatin Calcium 10mg')
ON CONFLICT (barcode_id) DO NOTHING;

-- Seed other Generic Medicines for the mapping
INSERT INTO public.medicines (barcode_id, brand_name, generic_name, manufacturer, cdsco_approval_status, is_counterfeit_alert, mrp, jan_aushadhi_price, composition)
VALUES 
('8901234100010', 'Paracetamol 650mg (Generic)', 'Paracetamol 650mg', 'Jan Aushadhi', 'approved', false, 15.00, 15.00, 'Paracetamol IP 650mg'),
('8901234100011', 'Paracetamol 500mg (Generic)', 'Paracetamol 500mg', 'Jan Aushadhi', 'approved', false, 8.00, 8.00, 'Paracetamol IP 500mg'),
('8901234200020', 'Amoxicillin + Clavulanate (Generic)', 'Amoxicillin + Clavulanate', 'Jan Aushadhi', 'approved', false, 96.50, 96.50, 'Amoxycillin 500mg + Clavulanic Acid 125mg'),
('8901234200021', 'Amoxicillin 500mg (Generic)', 'Amoxicillin 500mg', 'Jan Aushadhi', 'approved', false, 42.00, 42.00, 'Amoxycillin Trihydrate IP 500mg'),
('8901234300020', 'Pantoprazole 40mg (Generic)', 'Pantoprazole 40mg', 'Jan Aushadhi', 'approved', false, 31.50, 31.50, 'Pantoprazole Sodium Sesquihydrate IP 40mg'),
('8901234700020', 'Amlodipine 5mg (Generic)', 'Amlodipine 5mg', 'Jan Aushadhi', 'approved', false, 8.00, 8.00, 'Amlodipine Besylate IP 5mg'),
('8901234700021', 'Atorvastatin 20mg (Generic)', 'Atorvastatin 20mg', 'Jan Aushadhi', 'approved', false, 22.00, 22.00, 'Atorvastatin Calcium 20mg')
ON CONFLICT (barcode_id) DO NOTHING;

-- Seed generic_alternatives mappings
-- 1. Lipitor (Atorvastatin 10mg)
INSERT INTO public.generic_alternatives (brand_medicine_id, generic_medicine_id, brand_name, generic_name, brand_price, jan_aushadhi_price, savings_percentage)
SELECT b.id::text, g.id::text, b.brand_name, g.brand_name, b.mrp, g.jan_aushadhi_price, ROUND(((b.mrp - g.jan_aushadhi_price) / b.mrp) * 100)::integer
FROM public.medicines b JOIN public.medicines g ON g.brand_name = 'Atorvastatin 10mg (Generic)' WHERE b.brand_name = 'Lipitor';

-- 2. Dolo 650
INSERT INTO public.generic_alternatives (brand_medicine_id, generic_medicine_id, brand_name, generic_name, brand_price, jan_aushadhi_price, savings_percentage)
SELECT b.id::text, g.id::text, b.brand_name, g.brand_name, b.mrp, g.jan_aushadhi_price, ROUND(((b.mrp - g.jan_aushadhi_price) / b.mrp) * 100)::integer
FROM public.medicines b JOIN public.medicines g ON g.brand_name = 'Paracetamol 650mg (Generic)' WHERE b.brand_name = 'Dolo 650';

-- 3. Crocin 500
INSERT INTO public.generic_alternatives (brand_medicine_id, generic_medicine_id, brand_name, generic_name, brand_price, jan_aushadhi_price, savings_percentage)
SELECT b.id::text, g.id::text, b.brand_name, g.brand_name, b.mrp, g.jan_aushadhi_price, ROUND(((b.mrp - g.jan_aushadhi_price) / b.mrp) * 100)::integer
FROM public.medicines b JOIN public.medicines g ON g.brand_name = 'Paracetamol 500mg (Generic)' WHERE b.brand_name = 'Crocin 500';

-- 4. Calpol 650
INSERT INTO public.generic_alternatives (brand_medicine_id, generic_medicine_id, brand_name, generic_name, brand_price, jan_aushadhi_price, savings_percentage)
SELECT b.id::text, g.id::text, b.brand_name, g.brand_name, b.mrp, g.jan_aushadhi_price, ROUND(((b.mrp - g.jan_aushadhi_price) / b.mrp) * 100)::integer
FROM public.medicines b JOIN public.medicines g ON g.brand_name = 'Paracetamol 650mg (Generic)' WHERE b.brand_name = 'Calpol 650';

-- 5. Augmentin 625 Duo
INSERT INTO public.generic_alternatives (brand_medicine_id, generic_medicine_id, brand_name, generic_name, brand_price, jan_aushadhi_price, savings_percentage)
SELECT b.id::text, g.id::text, b.brand_name, g.brand_name, b.mrp, g.jan_aushadhi_price, ROUND(((b.mrp - g.jan_aushadhi_price) / b.mrp) * 100)::integer
FROM public.medicines b JOIN public.medicines g ON g.brand_name = 'Amoxicillin + Clavulanate (Generic)' WHERE b.brand_name = 'Augmentin 625 Duo';

-- 6. Amoxil 500
INSERT INTO public.generic_alternatives (brand_medicine_id, generic_medicine_id, brand_name, generic_name, brand_price, jan_aushadhi_price, savings_percentage)
SELECT b.id::text, g.id::text, b.brand_name, g.brand_name, b.mrp, g.jan_aushadhi_price, ROUND(((b.mrp - g.jan_aushadhi_price) / b.mrp) * 100)::integer
FROM public.medicines b JOIN public.medicines g ON g.brand_name = 'Amoxicillin 500mg (Generic)' WHERE b.brand_name = 'Amoxil 500';

-- 7. Pan 40
INSERT INTO public.generic_alternatives (brand_medicine_id, generic_medicine_id, brand_name, generic_name, brand_price, jan_aushadhi_price, savings_percentage)
SELECT b.id::text, g.id::text, b.brand_name, g.brand_name, b.mrp, g.jan_aushadhi_price, ROUND(((b.mrp - g.jan_aushadhi_price) / b.mrp) * 100)::integer
FROM public.medicines b JOIN public.medicines g ON g.brand_name = 'Pantoprazole 40mg (Generic)' WHERE b.brand_name = 'Pan 40';

-- 8. Norvasc 5
INSERT INTO public.generic_alternatives (brand_medicine_id, generic_medicine_id, brand_name, generic_name, brand_price, jan_aushadhi_price, savings_percentage)
SELECT b.id::text, g.id::text, b.brand_name, g.brand_name, b.mrp, g.jan_aushadhi_price, ROUND(((b.mrp - g.jan_aushadhi_price) / b.mrp) * 100)::integer
FROM public.medicines b JOIN public.medicines g ON g.brand_name = 'Amlodipine 5mg (Generic)' WHERE b.brand_name = 'Norvasc 5';

-- 9. Lipitor 20
INSERT INTO public.generic_alternatives (brand_medicine_id, generic_medicine_id, brand_name, generic_name, brand_price, jan_aushadhi_price, savings_percentage)
SELECT b.id::text, g.id::text, b.brand_name, g.brand_name, b.mrp, g.jan_aushadhi_price, ROUND(((b.mrp - g.jan_aushadhi_price) / b.mrp) * 100)::integer
FROM public.medicines b JOIN public.medicines g ON g.brand_name = 'Atorvastatin 20mg (Generic)' WHERE b.brand_name = 'Lipitor 20';
