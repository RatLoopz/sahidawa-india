-- SahiDawa Dummy Seed Data
-- This data is automatically loaded when you run `npx supabase start`

-- 1. Insert Dummy Pharmacies (Jan Aushadhi Kendras)
-- Assuming the table is named `pharmacies` (adjust if your schema differs)
-- Note: Make sure to run `npx supabase db reset` after changing this file.

INSERT INTO public.pharmacies (id, name, address, latitude, longitude, is_verified)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Pradhan Mantri Bhartiya Jan Aushadhi Kendra - Delhi', 'Connaught Place, New Delhi', 28.6304, 77.2177, true),
  ('22222222-2222-2222-2222-222222222222', 'Jan Aushadhi Kendra - Mumbai', 'Andheri West, Mumbai', 19.1363, 72.8277, true),
  ('33333333-3333-3333-3333-333333333333', 'Jan Aushadhi Kendra - Bangalore', 'Indiranagar, Bangalore', 12.9784, 77.6408, true)
ON CONFLICT (id) DO NOTHING;

-- 2. Insert Dummy Medicines
-- Assuming the table is named `medicines`
INSERT INTO public.medicines (id, name, generic_name, manufacturer, price_mrp, is_jan_aushadhi)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Paracetamol 500mg', 'Paracetamol', 'Generic Pharma', 15.00, true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Amoxicillin 250mg', 'Amoxicillin', 'Generic Pharma', 45.50, true),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Dolo 650', 'Paracetamol', 'Micro Labs', 30.00, false)
ON CONFLICT (id) DO NOTHING;

-- This allows contributors to instantly test "Nearest Pharmacy" and "Search Medicine" APIs!
