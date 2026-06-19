ALTER TABLE public.medicines
    ADD COLUMN IF NOT EXISTS is_cdsco_verified BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS cdsco_match_score DOUBLE PRECISION DEFAULT 0,
    ADD COLUMN IF NOT EXISTS matched_cdsco_product TEXT,
    ADD COLUMN IF NOT EXISTS matched_cdsco_manufacturer TEXT,
    ADD COLUMN IF NOT EXISTS product_match_score DOUBLE PRECISION DEFAULT 0,
    ADD COLUMN IF NOT EXISTS manufacturer_match_score DOUBLE PRECISION DEFAULT 0;
