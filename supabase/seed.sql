-- SahiDawa Dummy Seed Data
-- This data is automatically loaded when you run `npx supabase start`

-- 1. Insert Dummy Pharmacies (Jan Aushadhi Kendras)
-- Using PostGIS Point(Longitude, Latitude) for the location column
INSERT INTO public.pharmacies (id, name, address, district, state, phone_number, is_verified, location)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Pradhan Mantri Bhartiya Jan Aushadhi Kendra - Delhi', 'Connaught Place, New Delhi', 'New Delhi', 'Delhi', '9876543210', true, ST_SetSRID(ST_MakePoint(77.2177, 28.6304), 4326)),
  ('22222222-2222-2222-2222-222222222222', 'Jan Aushadhi Kendra - Mumbai', 'Andheri West, Mumbai', 'Mumbai Suburban', 'Maharashtra', '9876543211', true, ST_SetSRID(ST_MakePoint(72.8277, 19.1363), 4326)),
  ('33333333-3333-3333-3333-333333333333', 'Jan Aushadhi Kendra - Bangalore', 'Indiranagar, Bangalore', 'Bengaluru Urban', 'Karnataka', '9876543212', true, ST_SetSRID(ST_MakePoint(77.6408, 12.9784), 4326))
ON CONFLICT (id) DO NOTHING;

-- 2. Insert Dummy Medicines
-- Using brand_name, generic_name, manufacturer
INSERT INTO public.medicines (
  id,
  barcode_id,
  brand_name,
  generic_name,
  manufacturer,
  cdsco_approval_status,
  mrp,
  jan_aushadhi_price
)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '8901234567890', 'Dolo 650', 'Paracetamol 650mg', 'Micro Labs', 'approved', 30.00, 15.00),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '8901234567891', 'Augmentin 625 Duo', 'Amoxicillin + Clavulanate', 'GSK', 'approved', 185.00, 96.50),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '8901234567892', 'Fake-O-Cin', 'Spurious Antibiotic', 'Unknown', 'banned', 79.00, NULL)
ON CONFLICT (barcode_id) DO NOTHING;

INSERT INTO public.medicines (
  barcode_id,
  brand_name,
  generic_name,
  manufacturer,
  batch_number,
  cdsco_approval_status,
  is_counterfeit_alert,
  composition,
  mrp,
  jan_aushadhi_price
) VALUES
('8901111111111', 'Augmentin 625 Duo', 'Amoxicillin + Clavulanic Acid', 'GlaxoSmithKline plc', 'B23059', 'recalled', true, 'Reported suspicious by 12 individual community mobile scanning units.', 189.50, 96.50),
('8902222222222', 'Pan 40', 'Pantoprazole', 'Alkem Laboratories Ltd', 'UP992', 'recalled', false, 'Substandard active compound concentrations detected by regional inspectors.', 168.00, 31.50),
('8903333333333', 'Paracetamol 500mg', 'Paracetamol', 'Cipla Ltd', 'HR4410', 'approved', false, 'Common fever and pain relief tablet for routine price comparison checks.', 20.00, 8.00),
('8904444444444', 'Cetirizine 10mg', 'Cetirizine', 'Sun Pharmaceutical Industries Ltd', 'CT1010', 'approved', false, 'Common antihistamine stocked for local compare testing.', 25.00, 5.00)
ON CONFLICT (barcode_id) DO NOTHING;
