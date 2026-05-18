-- 1. Insert Dummy Pharmacies (Hybrid Verified + General Stores)
-- Uses PostGIS geography POINT(Longitude, Latitude)

INSERT INTO public.pharmacies (
    id,
    name,
    address,
    district,
    state,
    phone_number,
    is_verified,
    store_type,
    location
)
VALUES

-- Verified Jan Aushadhi Stores
(
    '11111111-1111-1111-1111-111111111111',
    'Pradhan Mantri Bhartiya Jan Aushadhi Kendra - Delhi',
    'Connaught Place, New Delhi',
    'New Delhi',
    'Delhi',
    '9876543210',
    true,
    'jan_aushadhi',
    ST_SetSRID(ST_MakePoint(77.2177, 28.6304), 4326)::geography
),

(
    '22222222-2222-2222-2222-222222222222',
    'Jan Aushadhi Kendra - Mumbai',
    'Andheri West, Mumbai',
    'Mumbai Suburban',
    'Maharashtra',
    '9876543211',
    true,
    'jan_aushadhi',
    ST_SetSRID(ST_MakePoint(72.8277, 19.1363), 4326)::geography
),

(
    '33333333-3333-3333-3333-333333333333',
    'Jan Aushadhi Kendra - Bangalore',
    'Indiranagar, Bangalore',
    'Bengaluru Urban',
    'Karnataka',
    '9876543212',
    true,
    'jan_aushadhi',
    ST_SetSRID(ST_MakePoint(77.6408, 12.9784), 4326)::geography
),

-- General Pharmacy Stores
(
    '44444444-4444-4444-4444-444444444444',
    'Apollo Pharmacy - Chennai',
    'T Nagar, Chennai',
    'Chennai',
    'Tamil Nadu',
    '9876543213',
    false,
    'general',
    ST_SetSRID(ST_MakePoint(80.2341, 13.0418), 4326)::geography
),

(
    '55555555-5555-5555-5555-555555555555',
    'MedPlus Pharmacy - Hyderabad',
    'Banjara Hills, Hyderabad',
    'Hyderabad',
    'Telangana',
    '9876543214',
    false,
    'general',
    ST_SetSRID(ST_MakePoint(78.4483, 17.4126), 4326)::geography
),

-- Verified Partner Example
(
    '66666666-6666-6666-6666-666666666666',
    'SahiDawa Verified Partner - Pune',
    'Kothrud, Pune',
    'Pune',
    'Maharashtra',
    '9876543215',
    true,
    'verified_partner',
    ST_SetSRID(ST_MakePoint(73.8070, 18.5074), 4326)::geography
)

ON CONFLICT (id) DO NOTHING;

-- 2. Insert Dummy Medicines
-- Using brand_name, generic_name, manufacturer
INSERT INTO public.medicines (id, barcode_id, brand_name, generic_name, manufacturer, cdsco_approval_status)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '8901234567890', 'Dolo 650', 'Paracetamol 650mg', 'Micro Labs', 'approved'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '8901234567891', 'Augmentin 625 Duo', 'Amoxicillin + Clavulanate', 'GSK', 'approved'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '8901234567892', 'Fake-O-Cin', 'Spurious Antibiotic', 'Unknown', 'banned')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.medicines (barcode_id, brand_name, generic_name, manufacturer, batch_number, cdsco_approval_status, is_counterfeit_alert, composition) VALUES
('8901111111111', 'Augmentin 625 Duo', 'Amoxicillin + Clavulanic Acid', 'GlaxoSmithKline plc', 'B23059', 'recalled', true, 'Reported suspicious by 12 individual community mobile scanning units.'),
('8902222222222', 'Pan 40', 'Pantoprazole', 'Alkem Laboratories Ltd', 'UP992', 'recalled', false, 'Substandard active compound concentrations detected by regional inspectors.'),
('8903333333333', 'Paracetamol 500mg', 'Paracetamol', 'Cipla Ltd', 'HR4410', 'banned', true, 'Slight packaging variations and unapproved manufacturing batches observed.')
ON CONFLICT (id) DO NOTHING;
