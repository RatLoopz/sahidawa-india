-- Bulk Jan Aushadhi price back-fill RPC
--
-- WHY THIS EXISTS
-- ---------------
-- The ETL loader (apps/etl/src/loaders/supabase_loader.py :: merge_jan_aushadhi_price)
-- back-fills medicines.jan_aushadhi_price in batches. It previously used PostgREST
-- .upsert(), which compiles to INSERT ... ON CONFLICT. Even for rows that already
-- exist, PostgREST sends a full INSERT, so every payload was validated against the
-- table's NOT NULL columns (notably medicines.generic_name). The batch payload only
-- carries {id, jan_aushadhi_price}, so the INSERT path raised
--   "null value in column generic_name violates not-null constraint"
-- which forced a row-by-row PATCH fallback (~100x slower).
--
-- This function performs an atomic, set-based UPDATE of jan_aushadhi_price only,
-- keyed by id, in a single statement. It never inserts, so NOT NULL columns are
-- never touched and no other field can be corrupted.
--
-- Payload shape (single jsonb array argument):
--   [{"id": "<uuid>", "jan_aushadhi_price": 10.5}, ...]
--
-- Returns the number of rows actually updated.

CREATE OR REPLACE FUNCTION public.bulk_update_jan_aushadhi_price(p_updates jsonb)
RETURNS integer
LANGUAGE plpgsql
-- SECURITY INVOKER (the default): this function WRITES to medicines, so it must
-- run with the caller's privileges and stay subject to RLS. The ETL connects as
-- service_role (which the medicines_service_write policy in
-- 20260529000000_add_rls_policies.sql allows), so the back-fill works; any other
-- role's UPDATE is filtered out by RLS. Unlike the read-only RPCs in this repo,
-- exposing a writer with definer rights would let anon/authenticated callers edit
-- prices via PostgREST.
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated integer;
BEGIN
  IF p_updates IS NULL OR jsonb_typeof(p_updates) <> 'array' THEN
    RAISE EXCEPTION 'p_updates must be a JSON array of {id, jan_aushadhi_price} objects, got %',
      COALESCE(jsonb_typeof(p_updates), 'null');
  END IF;

  WITH payload AS (
    SELECT id, jan_aushadhi_price
    FROM jsonb_to_recordset(p_updates)
      AS x(id uuid, jan_aushadhi_price numeric)
    WHERE id IS NOT NULL
      AND jan_aushadhi_price IS NOT NULL
  ),
  changed AS (
    UPDATE public.medicines m
    SET jan_aushadhi_price = p.jan_aushadhi_price
    FROM payload p
    WHERE m.id = p.id
    RETURNING m.id
  )
  SELECT count(*) INTO v_updated FROM changed;

  RETURN v_updated;
END;
$$;

-- Postgres grants EXECUTE on new functions to PUBLIC by default, which would make
-- this writer callable by anon/authenticated through PostgREST. Lock it down to
-- the ETL's service_role so prices can only be back-filled by the loader.
REVOKE EXECUTE ON FUNCTION public.bulk_update_jan_aushadhi_price(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_update_jan_aushadhi_price(jsonb) TO service_role;
