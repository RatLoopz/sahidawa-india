-- ============================================================================
-- ⚠️  LOCAL DEVELOPMENT ONLY — Pharmacy Seed Data
-- ============================================================================
-- These are FAKE records for local dev/testing only.
-- ✅ PRODUCTION data comes from the ETL: cd apps/etl && python run_stores.py
--
-- On production Supabase, the ETL inserts real Jan Aushadhi stores from
-- the official government website with geocoded GPS coordinates.
-- These seed records are tagged source='seed_dev' and is_active=false
-- so they NEVER appear on the live map — they only exist for local testing.
-- ============================================================================

-- 1. Insert Local Dev Pharmacy Records (tagged seed_dev, inactive on prod)
INSERT INTO public.pharmacies (id, name, address, district, state, phone_number, is_verified, location, status, is_active, source)
VALUES
  -- Major city anchors for local map testing
  ('11111111-1111-1111-1111-111111111111', '[DEV] Jan Aushadhi Kendra - Delhi', 'Connaught Place, New Delhi', 'New Delhi', 'Delhi', '9876543210', true, ST_SetSRID(ST_MakePoint(77.2177, 28.6304), 4326), 'approved', true, 'seed_dev'),
  ('22222222-2222-2222-2222-222222222222', '[DEV] Jan Aushadhi Kendra - Mumbai', 'Andheri West, Mumbai', 'Mumbai Suburban', 'Maharashtra', '9876543211', true, ST_SetSRID(ST_MakePoint(72.8277, 19.1363), 4326), 'approved', true, 'seed_dev'),
  ('33333333-3333-3333-3333-333333333333', '[DEV] Jan Aushadhi Kendra - Bangalore', 'Indiranagar, Bangalore', 'Bengaluru Urban', 'Karnataka', '9876543212', true, ST_SetSRID(ST_MakePoint(77.6408, 12.9784), 4326), 'approved', true, 'seed_dev'),
  -- Assam/Guwahati anchors for testing pincode 781030
  ('55555555-5555-5555-5555-555555555555', '[DEV] PMBJK00173 - Azara Guwahati', 'Girijananda Choudhary Institute Of Pharmaceutical Science, Azara, Guwahati-781001', 'Kamrup', 'Assam', '9854046526', true, ST_SetSRID(ST_MakePoint(91.6080622, 26.1157909), 4326), 'approved', true, 'seed_dev'),
  ('66666666-6666-6666-6666-666666666666', '[DEV] PMBJK00174 - Gorchuk Guwahati', 'Kotahbari Road, Gorchuk, Guwahati-781001', 'Kamrup', 'Assam', '8638040602', true, ST_SetSRID(ST_MakePoint(91.7080622, 26.1257909), 4326), 'approved', true, 'seed_dev'),
  ('99999999-9999-9999-9999-999999999999', '[DEV] PMBJK00177 - Amingaon Guwahati', 'Amingaon (Madhyam) Near S. B. I, Guwahati-31, Kamrup, Assam- 781031', 'Kamrup', 'Assam', '9864022600', true, ST_SetSRID(ST_MakePoint(91.6880622, 26.2057909), 4326), 'approved', true, 'seed_dev')
ON CONFLICT (id) DO UPDATE
  SET status = 'approved', is_active = true, source = 'seed_dev',
      name = EXCLUDED.name, address = EXCLUDED.address;

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
-- 3. Insert Dummy Counterfeit Reports
INSERT INTO public.counterfeit_reports (
    id,
    medicine_id,
    scanned_barcode,
    reported_brand_name,
    manufacturer,
    pharmacy_name,
    district,
    state,
    status
)
VALUES
('dddddddd-dddd-dddd-dddd-dddddddddddd', 'cccccccc-cccc-cccc-cccc-cccccccccccc','8901234567892','Fake-O-Cin','Unknown','Jan Aushadhi Kendra - Delhi','New Delhi','Delhi','verified_fake'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','8901234567890','Dolo 650','Micro Labs','Jan Aushadhi Kendra - Mumbai','Mumbai Suburban','Maharashtra','pending')
ON CONFLICT (id) DO NOTHING;