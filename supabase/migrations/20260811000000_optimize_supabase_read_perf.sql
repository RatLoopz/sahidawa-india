-- SahiDawa — Phase 5: Production Read Performance Optimizations
-- Issue: Database Scaling - Optimizing Supabase with read-replicas and B-tree/GIN text-search indexes.

-- 1. Counterfeit Reports Optimization
-- Index on medicine_id since verify/compare endpoints map reports back to their matched verified medicine.
CREATE INDEX IF NOT EXISTS idx_reports_medicine_id 
  ON public.counterfeit_reports(medicine_id) 
  WHERE medicine_id IS NOT NULL;

-- 2. Tracked Medicines Security & Query Optimization
-- Index on user_id to speed up RLS-filtered GET /api/v1/medicines/tracked queries.
CREATE INDEX IF NOT EXISTS idx_tracked_medicines_user_id 
  ON public.tracked_medicines(user_id);

-- 3. Generic Alternatives Search Optimization
-- Ensure pg_trgm is available for trigram-based GIN indexing.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram indexes on brand_name and generic_name to optimize wildcard wildcard ILIKE queries on alternatives.
CREATE INDEX IF NOT EXISTS idx_generic_alts_brand_name_trgm 
  ON public.generic_alternatives USING gin (brand_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_generic_alts_generic_name_trgm 
  ON public.generic_alternatives USING gin (generic_name gin_trgm_ops);
