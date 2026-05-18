-- SahiDawa Core Database Schema (PostgreSQL for Supabase)

-- Enable PostGIS extension for Pharmacy Mapping (Phase 2)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enable pgvector extension for RAG embeddings (Phase 3)
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable pg_trgm extension for fuzzy text matching (Phase 2)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Medicines Table (Master Data from CDSCO)
CREATE TABLE IF NOT EXISTS medicines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barcode_id VARCHAR(100) UNIQUE, -- EAN/UPC barcode
    brand_name VARCHAR(255),
    generic_name VARCHAR(500) NOT NULL,
    manufacturer VARCHAR(255) NOT NULL,
    batch_number VARCHAR(100),
    manufacturing_date DATE,
    expiry_date DATE,
    composition TEXT,
    strength VARCHAR(100),
    dosage_form VARCHAR(100),
    schedule VARCHAR(50),
    source VARCHAR(100) DEFAULT 'manual',
    cdsco_approval_status VARCHAR(50) DEFAULT 'approved', -- 'approved', 'recalled', 'banned'
    is_counterfeit_alert BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Pharmacy Locations Table (Jan Aushadhi Stores)
CREATE TABLE IF NOT EXISTS pharmacies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    district VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20),
    is_verified BOOLEAN DEFAULT TRUE,
    location geography(POINT, 4326), -- PostGIS Point (Longitude, Latitude)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Community Counterfeit Reports (Heatmap Data)
CREATE TABLE IF NOT EXISTS counterfeit_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medicine_id UUID REFERENCES medicines(id),
    scanned_barcode VARCHAR(100),
    reported_brand_name VARCHAR(255),
    photo_url TEXT, -- Cloudinary URL
    report_location geography(POINT, 4326),
    district VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'verified_fake', 'false_alarm'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Audit Logs (Transparency for Admin Actions)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES auth.users(id),
    action VARCHAR(100) NOT NULL, -- e.g., 'VERIFIED_FAKE', 'UPDATE_MEDICINE'
    target_type VARCHAR(50) NOT NULL, -- e.g., 'REPORT', 'MEDICINE'
    target_id UUID NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. District Level Alerts
CREATE TABLE IF NOT EXISTS district_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    district VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    alert_level VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high'
    medicine_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_medicines_barcode ON medicines(barcode_id);
CREATE INDEX IF NOT EXISTS idx_pharmacies_location ON pharmacies USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_counterfeit_location ON counterfeit_reports USING GIST(report_location);
CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_logs(target_id);
CREATE INDEX IF NOT EXISTS idx_medicines_brand_name_trgm ON medicines USING gin (brand_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_medicines_generic_name_trgm ON medicines USING gin (generic_name gin_trgm_ops);

-- Constraints for Upsert Operations
ALTER TABLE medicines ADD CONSTRAINT idx_medicines_unique_variant UNIQUE NULLS NOT DISTINCT (generic_name, strength, dosage_form, source);

-- 4. Barcode Mappings (Real-world scanning intelligence)
CREATE TABLE IF NOT EXISTS barcode_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barcode_id VARCHAR(100) NOT NULL,
    medicine_id UUID REFERENCES medicines(id),
    scan_count INTEGER DEFAULT 1,
    confidence_score NUMERIC(3,2) DEFAULT 1.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(barcode_id, medicine_id)
);
CREATE INDEX IF NOT EXISTS idx_barcode_mappings_barcode ON barcode_mappings(barcode_id);

-- 5. Official Drug Alerts (CDSCO NSQ/Recalls)
CREATE TABLE IF NOT EXISTS drug_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medicine_id UUID REFERENCES medicines(id),
    reported_brand_name VARCHAR(255),
    manufacturer VARCHAR(255),
    batch_number VARCHAR(100),
    alert_type VARCHAR(100), -- 'nsq', 'recalled', 'counterfeit'
    risk_level VARCHAR(50) DEFAULT 'high',
    district VARCHAR(100),
    state VARCHAR(100),
    source_url TEXT,
    reported_at DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_drug_alerts_batch ON drug_alerts(batch_number);
