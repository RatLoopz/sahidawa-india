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
    is_cdsco_verified BOOLEAN DEFAULT FALSE,
    cdsco_match_score DOUBLE PRECISION DEFAULT 0,
    matched_cdsco_product TEXT,
    matched_cdsco_manufacturer TEXT,
    product_match_score DOUBLE PRECISION DEFAULT 0,
    manufacturer_match_score DOUBLE PRECISION DEFAULT 0,
    mrp NUMERIC(10, 2),
    jan_aushadhi_price NUMERIC(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT medicines_mrp_non_negative CHECK (mrp IS NULL OR mrp >= 0),
    CONSTRAINT medicines_jan_aushadhi_price_non_negative CHECK (jan_aushadhi_price IS NULL OR jan_aushadhi_price >= 0)
);

-- 2. Pharmacy Locations Table (Jan Aushadhi Stores)
CREATE TABLE IF NOT EXISTS pharmacies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    license_id VARCHAR(100) UNIQUE,
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
    reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    manufacturer VARCHAR(255),
    description TEXT,
    pharmacy_name VARCHAR(255),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    photo_url TEXT, -- Cloudinary URL
    photo_urls TEXT[] DEFAULT '{}'::text[],
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
CREATE INDEX IF NOT EXISTS idx_medicines_batch_number ON medicines(batch_number);
CREATE INDEX IF NOT EXISTS idx_medicines_mrp ON medicines(mrp);
CREATE INDEX IF NOT EXISTS idx_medicines_jan_aushadhi_price ON medicines(jan_aushadhi_price);
CREATE INDEX IF NOT EXISTS idx_pharmacies_location ON pharmacies USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_counterfeit_location ON counterfeit_reports USING GIST(report_location);
CREATE INDEX IF NOT EXISTS idx_counterfeit_reports_reporter_id ON counterfeit_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_counterfeit_reports_pincode ON counterfeit_reports(pincode);
CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_logs(target_id);
CREATE INDEX IF NOT EXISTS idx_medicines_brand_name_trgm ON medicines USING gin (brand_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_medicines_generic_name_trgm ON medicines USING gin (generic_name gin_trgm_ops);

-- Constraints for Upsert Operations
ALTER TABLE medicines ADD CONSTRAINT idx_medicines_unique_variant UNIQUE NULLS NOT DISTINCT (generic_name, brand_name, manufacturer, barcode_id);

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

-- 6. Scan History (Duplicate scan and anomaly tracking)
CREATE TABLE IF NOT EXISTS scan_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_number VARCHAR(100) NOT NULL,
    medicine_id UUID REFERENCES medicines(id) ON DELETE SET NULL,
    barcode_id VARCHAR(100),
    client_ip INET,
    origin VARCHAR(255),
    user_agent TEXT,
    latitude NUMERIC(9,6),
    longitude NUMERIC(9,6),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scan_history_batch_number ON scan_history(batch_number);
CREATE INDEX IF NOT EXISTS idx_scan_history_created_at ON scan_history(created_at);

-- 7. Official Drug Alerts (CDSCO NSQ/Recalls)
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

-- 6. Web Push Subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint TEXT NOT NULL UNIQUE,
    subscription JSONB NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_updated_at ON push_subscriptions(updated_at DESC);

-- 7. Web Push Notification Delivery Events
CREATE TABLE IF NOT EXISTS push_notification_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id TEXT,
    notification_type TEXT NOT NULL DEFAULT 'recall_alert',
    endpoint_hash TEXT NOT NULL,
    endpoint_host TEXT NOT NULL DEFAULT 'unknown',
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
    http_status INTEGER CHECK (http_status IS NULL OR (http_status BETWEEN 100 AND 599)),
    failure_reason TEXT,
    error_code TEXT,
    error_name TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_notification_events_occurred_at ON push_notification_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_notification_events_status_occurred_at ON push_notification_events(status, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_notification_events_failure_reason ON push_notification_events(failure_reason) WHERE status = 'failed';
CREATE INDEX IF NOT EXISTS idx_push_notification_events_http_status ON push_notification_events(http_status) WHERE status = 'failed' AND http_status IS NOT NULL;

-- 8. ETL Failed Rows
CREATE TABLE IF NOT EXISTS etl_failed_rows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_name VARCHAR(100) NOT NULL,
    source_table VARCHAR(100) NOT NULL,
    row_fingerprint VARCHAR(64) NOT NULL,
    row_payload JSONB NOT NULL,
    medicine_name VARCHAR(500),
    unresolved_value TEXT,
    error_category VARCHAR(100),
    db_error_code VARCHAR(20),
    error_message TEXT,
    attempt_count INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'failed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_attempt_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_etl_failed_rows_status ON etl_failed_rows(status);
CREATE INDEX IF NOT EXISTS idx_etl_failed_rows_pipeline_name ON etl_failed_rows(pipeline_name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_etl_failed_rows_unique_logical_row
    ON etl_failed_rows(pipeline_name, source_table, row_fingerprint);
