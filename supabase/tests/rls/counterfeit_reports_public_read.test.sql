BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(6);

-- RLS must be enabled on counterfeit_reports
SELECT ok(
    (
        SELECT relrowsecurity
        FROM pg_class
        WHERE oid = 'public.counterfeit_reports'::regclass
    ),
    'RLS enabled on counterfeit_reports'
);

-- --------------------------------------------------------------------
-- Seed a report row (as an admin/service-role context) that carries PII.
-- --------------------------------------------------------------------
INSERT INTO public.counterfeit_reports
(
    id,
    medicine_id,
    scanned_barcode,
    reported_brand_name,
    manufacturer,
    description,
    pharmacy_name,
    city,
    state,
    address,
    pincode,
    photo_url,
    photo_urls,
    report_location,
    district,
    status,
    reporter_phone,
    created_at
)
VALUES
(
    'dddddddd-0000-4000-8000-000000000004',
    NULL,
    'BC-100',
    'Acme-100',
    'Acme Pharma',
    'suspicious batch',
    'City Pharmacy',
    'Jaipur',
    'Rajasthan',
    '1 Main Street, Jaipur, RJ 302001',
    '302001',
    'https://cloud.example/photo.jpg',
    ARRAY['https://cloud.example/photo.jpg']::text[],
    ST_GeomFromText('POINT(75.7873 26.9124)', 4326)::geography,
    'verified_fake',
    '+911234567890'
) ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------------------
-- Act as the anonymous client.
-- --------------------------------------------------------------------
SET LOCAL ROLE anon;

-- Anonymous client may read only the non-PII display columns.
SELECT lives_ok(
    $$
    SELECT reported_brand_name, district, status, created_at
    FROM public.counterfeit_reports
    WHERE id = 'dddddddd-0000-4000-8000-000000000004';
    $$,
    'anon can read non-PII display columns'
);

-- An anonymous client must NOT be able to read reporter PII columns.
SELECT throws_ok(
    $$
    SELECT reporter_phone
    FROM public.counterfeit_reports
    WHERE id = 'dddddddd-0000-4000-8000-000000000004';
    $$,
    '42501',
    NULL,
    'anon cannot read reporter_phone'
);

SELECT throws_ok(
    $$
    SELECT address
    FROM public.counterfeit_reports
    WHERE id = 'dddddddd-0000-4000-8000-000000000004';
    $$,
    '42501',
    NULL,
    'anon cannot read reporter address'
);

SELECT throws_ok(
    $$
    SELECT pincode
    FROM public.counterfeit_reports
    WHERE id = 'dddddddd-0000-4000-8000-000000000004';
    $$,
    '42501',
    NULL,
    'anon cannot read reporter pincode'
);

SELECT throws_ok(
    $$
    SELECT report_location
    FROM public.counterfeit_reports
    WHERE id = 'dddddddd-0000-4000-8000-000000000004';
    $$,
    '42501',
    NULL,
    'anon cannot read report GPS coordinates'
);

SELECT * FROM finish();

ROLLBACK;