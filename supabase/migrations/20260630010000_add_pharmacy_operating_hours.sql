-- =============================================================================
-- SahiDawa — Open Now filter support for Pharmacy & ASHA Map (#2862)
-- =============================================================================
-- Adds structured operating-hours data to pharmacies and threads it through
-- every RPC function the map already uses, so the client can evaluate
-- "is this pharmacy open right now" without an extra round trip.
--
-- operating_hours uses the OSM `opening_hours` syntax (the same format the
-- map already consumes for OSM-sourced pharmacies via the Overpass API —
-- see apps/web/app/[locale]/map/overpassApi.ts), e.g.:
--   "Mo-Sa 09:00-21:00; Su 10:00-14:00"
--   "24/7"
--   "Mo-Fr 20:00-02:00"   (overnight)
-- A NULL or unparseable value means "hours unavailable" and is handled as a
-- fallback case by the client (apps/web/lib/openingHours.ts), not by this
-- migration — keep validation light here.
-- =============================================================================

ALTER TABLE public.pharmacies
  ADD COLUMN IF NOT EXISTS operating_hours TEXT,
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata';

-- ─────────────────────────────────────────────────────────────────────────────
-- get_nearest_pharmacies — add operating_hours / timezone to the result set.
-- Return type is changing, so the existing function must be dropped first.
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS get_nearest_pharmacies(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION);

CREATE FUNCTION get_nearest_pharmacies(
  query_lat DOUBLE PRECISION,
  query_lng DOUBLE PRECISION,
  search_radius_km DOUBLE PRECISION DEFAULT 50
)
RETURNS TABLE (
  id              UUID,
  name            VARCHAR(255),
  address         TEXT,
  district        VARCHAR(100),
  state           VARCHAR(100),
  phone_number    VARCHAR(20),
  is_verified     BOOLEAN,
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  distance        DOUBLE PRECISION,
  operating_hours TEXT,
  timezone        VARCHAR(64)
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
    )::double precision AS distance,
    p.operating_hours,
    p.timezone
  FROM public.pharmacies p
  WHERE p.location IS NOT NULL
    AND p.status = 'approved'
    AND p.is_active = true
    AND ST_DWithin(
          p.location,
          ST_SetSRID(ST_MakePoint(query_lng, query_lat), 4326)::geography,
          search_radius_km * 1000
        )
  ORDER BY distance ASC
  LIMIT 200;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ─────────────────────────────────────────────────────────────────────────────
-- get_pharmacies_in_bounds — add operating_hours / timezone to the result set.
-- Current signature includes pagination (query_limit / query_offset).
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS get_pharmacies_in_bounds(
  DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER
);

CREATE FUNCTION get_pharmacies_in_bounds(
  bound_south DOUBLE PRECISION,
  bound_west  DOUBLE PRECISION,
  bound_north DOUBLE PRECISION,
  bound_east  DOUBLE PRECISION,
  query_limit INTEGER DEFAULT 200,
  query_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id              UUID,
  name            VARCHAR(255),
  address         TEXT,
  district        VARCHAR(100),
  state           VARCHAR(100),
  phone_number    VARCHAR(20),
  is_verified     BOOLEAN,
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  distance        DOUBLE PRECISION,
  operating_hours TEXT,
  timezone        VARCHAR(64)
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
    )::double precision AS distance,
    p.operating_hours,
    p.timezone
  FROM public.pharmacies p
  WHERE p.location IS NOT NULL
    AND p.status = 'approved'
    AND p.is_active = true
    AND ST_Intersects(
          p.location,
          ST_MakeEnvelope(bound_west, bound_south, bound_east, bound_north, 4326)::geography
        )
  ORDER BY distance ASC
  LIMIT query_limit
  OFFSET query_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ─────────────────────────────────────────────────────────────────────────────
-- get_pharmacies_in_bounds_delta — add operating_hours / timezone too, so
-- delta-synced clients can re-evaluate "open now" without a full refetch.
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS get_pharmacies_in_bounds_delta(
  DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TIMESTAMP WITH TIME ZONE
);

CREATE FUNCTION get_pharmacies_in_bounds_delta(
  bound_south DOUBLE PRECISION,
  bound_west  DOUBLE PRECISION,
  bound_north DOUBLE PRECISION,
  bound_east  DOUBLE PRECISION,
  since       TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE (
  id              UUID,
  name            VARCHAR(255),
  address         TEXT,
  district        VARCHAR(100),
  state           VARCHAR(100),
  phone_number    VARCHAR(20),
  is_verified     BOOLEAN,
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  distance        DOUBLE PRECISION,
  updated_at      TIMESTAMP WITH TIME ZONE,
  is_active       BOOLEAN,
  deleted_at      TIMESTAMP WITH TIME ZONE,
  operating_hours TEXT,
  timezone        VARCHAR(64)
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
    )::double precision AS distance,
    p.updated_at,
    p.is_active,
    p.deleted_at,
    p.operating_hours,
    p.timezone
  FROM public.pharmacies p
  WHERE p.location IS NOT NULL
    AND p.status = 'approved'
    AND ST_Intersects(
          p.location,
          ST_MakeEnvelope(bound_west, bound_south, bound_east, bound_north, 4326)::geography
        )
    AND (
      (since IS NULL AND p.is_active = true) OR
      (since IS NOT NULL AND p.updated_at > since)
    )
  ORDER BY distance ASC
  LIMIT 200;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
