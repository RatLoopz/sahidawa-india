CREATE TABLE ocr_synonyms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    original_term TEXT NOT NULL,
    normalized_term TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('misread', 'synonym')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS and allow admins to manage this table
ALTER TABLE ocr_synonyms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on ocr_synonyms" 
ON ocr_synonyms FOR SELECT TO public USING (true);

CREATE POLICY "Allow admin full access on ocr_synonyms" 
ON ocr_synonyms FOR ALL TO authenticated 
USING (auth.jwt() ->> 'role' = 'admin')
WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Add index on type for faster loading
CREATE INDEX idx_ocr_synonyms_type ON ocr_synonyms(type);
