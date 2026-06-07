-- Add manufacturers table
CREATE TABLE IF NOT EXISTS manufacturers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    license_number VARCHAR(100),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    phone VARCHAR(20),
    email VARCHAR(255),
    website TEXT,
    gmp_certified BOOLEAN DEFAULT FALSE,
    location geography(POINT, 4326),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manufacturers_name ON manufacturers(name);
CREATE INDEX IF NOT EXISTS idx_manufacturers_license ON manufacturers(license_number);
CREATE INDEX IF NOT EXISTS idx_manufacturers_location ON manufacturers USING GIST(location);

-- Add batches table
CREATE TABLE IF NOT EXISTS batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_number VARCHAR(100) NOT NULL,
    medicine_id UUID REFERENCES medicines(id) ON DELETE SET NULL,
    manufacturer_id UUID REFERENCES manufacturers(id) ON DELETE SET NULL,
    manufacturing_date DATE,
    expiry_date DATE,
    recall_status VARCHAR(50) DEFAULT 'none', -- 'none', 'recalled', 'under_review'
    recall_reason TEXT,
    quantity_produced INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_batches_batch_number ON batches(batch_number);
CREATE INDEX IF NOT EXISTS idx_batches_medicine_id ON batches(medicine_id);
CREATE INDEX IF NOT EXISTS idx_batches_manufacturer_id ON batches(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_batches_expiry_date ON batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_batches_recall_status ON batches(recall_status);

-- Link medicines to manufacturers
ALTER TABLE medicines
    ADD COLUMN IF NOT EXISTS manufacturer_id UUID REFERENCES manufacturers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_medicines_manufacturer_id ON medicines(manufacturer_id);

-- Row Level Security
ALTER TABLE public.manufacturers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;

-- Read policies (anyone can read)
CREATE POLICY "manufacturers_select_public"
    ON public.manufacturers FOR SELECT USING (true);

CREATE POLICY "batches_select_public"
    ON public.batches FOR SELECT USING (true);

-- Write policies (service_role only)
CREATE POLICY "manufacturers_write_service_role"
    ON public.manufacturers FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "batches_write_service_role"
    ON public.batches FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');