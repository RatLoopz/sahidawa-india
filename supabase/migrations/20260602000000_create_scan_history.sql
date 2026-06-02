-- Create scan history table for duplicate scan anomaly detection
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
CREATE INDEX IF NOT EXISTS idx_scan_history_geo ON scan_history(latitude, longitude);
