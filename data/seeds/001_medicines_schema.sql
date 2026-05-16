-- Core medicines schema for Supabase verification lookups

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS medicines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    manufacturer TEXT NOT NULL,
    batch_number TEXT UNIQUE NOT NULL,
    expiry_date DATE NOT NULL,
    is_verified BOOLEAN DEFAULT TRUE,
    category TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read" ON medicines;
CREATE POLICY "public read" ON medicines FOR SELECT USING (true);