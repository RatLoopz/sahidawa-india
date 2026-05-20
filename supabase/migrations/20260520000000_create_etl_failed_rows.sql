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

CREATE INDEX IF NOT EXISTS idx_etl_failed_rows_status
    ON etl_failed_rows(status);

CREATE INDEX IF NOT EXISTS idx_etl_failed_rows_pipeline_name
    ON etl_failed_rows(pipeline_name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_etl_failed_rows_unique_logical_row
    ON etl_failed_rows(pipeline_name, source_table, row_fingerprint);
