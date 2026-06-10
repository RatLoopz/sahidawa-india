-- =============================================================================
-- SahiDawa - Pharmacy moderation workflow
-- =============================================================================
-- Adds moderation status to pharmacies and restricts public map RPCs to
-- approved pharmacies only.
-- =============================================================================

ALTER TABLE public.pharmacies
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending';

ALTER TABLE public.pharmacies
DROP CONSTRAINT IF EXISTS pharmacies_status_check;

ALTER TABLE public.pharmacies
ADD CONSTRAINT pharmacies_status_check
CHECK (status IN ('pending', 'approved', 'rejected'));

UPDATE public.pharmacies
SET status = 'approved'
WHERE status = 'pending'
  AND is_verified IS TRUE;

CREATE INDEX IF NOT EXISTS idx_pharmacies_status ON public.pharmacies(status);

CREATE OR REPLACE FUNCTION get_nearest_pharmacies(
  query_lat DOUBLE PRECISION,
  query_lng DOUBLE PRECISION,
  search_radius_km DOUBLE PRECISION DEFAULT 50
)
RETURNS TABLE (
  id          UUID,
  name        VARCHAR(255),
  address     TEXT,
  district    VARCHAR(100),
  state       VARCHAR(100),
  phone_number VARCHAR(20),
  is_verified BOOLEAN,
  lat         DOUBLE PRECISION,
  lng         DOUBLE PRECISION,
  distance    DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.address,
    p.district,
    p.state,
    p.phone_number,
    p.is_verified,
    ST_Y(p.location::geometry) AS lat,
    ST_X(p.location::geometry) AS lng,
    ROUND(
      (ST_Distance(
        p.location,
        ST_SetSRID(ST_MakePoint(query_lng, query_lat), 4326)::geography
      ) / 1000.0)::numeric,
      2
    )::double precision AS distance
  FROM public.pharmacies p
  WHERE p.location IS NOT NULL
    AND p.status = 'approved'
    AND ST_DWithin(
          p.location,
          ST_SetSRID(ST_MakePoint(query_lng, query_lat), 4326)::geography,
          search_radius_km * 1000
        )
  ORDER BY distance ASC
  LIMIT 200;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION get_pharmacies_in_bounds(
  bound_south DOUBLE PRECISION,
  bound_west  DOUBLE PRECISION,
  bound_north DOUBLE PRECISION,
  bound_east  DOUBLE PRECISION
)
RETURNS TABLE (
  id          UUID,
  name        VARCHAR(255),
  address     TEXT,
  district    VARCHAR(100),
  state       VARCHAR(100),
  phone_number VARCHAR(20),
  is_verified BOOLEAN,
  lat         DOUBLE PRECISION,
  lng         DOUBLE PRECISION,
  distance    DOUBLE PRECISION
) AS $$
DECLARE
  center_lat DOUBLE PRECISION := (bound_south + bound_north) / 2.0;
  center_lng DOUBLE PRECISION := (bound_west + bound_east) / 2.0;
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.address,
    p.district,
    p.state,
    p.phone_number,
    p.is_verified,
    ST_Y(p.location::geometry) AS lat,
    ST_X(p.location::geometry) AS lng,
    ROUND(
      (ST_Distance(
        p.location,
        ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography
      ) / 1000.0)::numeric,
      2
    )::double precision AS distance
  FROM public.pharmacies p
  WHERE p.location IS NOT NULL
    AND p.status = 'approved'
    AND ST_Intersects(
          p.location,
          ST_MakeEnvelope(bound_west, bound_south, bound_east, bound_north, 4326)::geography
        )
  ORDER BY distance ASC
  LIMIT 200;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
