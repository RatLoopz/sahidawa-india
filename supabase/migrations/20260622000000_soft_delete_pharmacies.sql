-- Migration: Add soft delete columns to pharmacies table
-- Adds is_active and deleted_at columns, plus an index on is_active

ALTER TABLE public.pharmacies
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE NOT NULL,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_pharmacies_is_active ON public.pharmacies(is_active);

-- Update get_nearest_pharmacies to filter by is_active = true
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

-- Update get_pharmacies_in_bounds to filter by is_active = true
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
    AND p.is_active = true
    AND ST_Intersects(
          p.location,
          ST_MakeEnvelope(bound_west, bound_south, bound_east, bound_north, 4326)::geography
        )
  ORDER BY distance ASC
  LIMIT 200;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Update get_pharmacies_in_bounds_delta to return is_active and deleted_at,
-- and return soft-deleted pharmacies if since is specified.
CREATE OR REPLACE FUNCTION get_pharmacies_in_bounds_delta(
  bound_south DOUBLE PRECISION,
  bound_west  DOUBLE PRECISION,
  bound_north DOUBLE PRECISION,
  bound_east  DOUBLE PRECISION,
  since       TIMESTAMP WITH TIME ZONE DEFAULT NULL
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
  distance    DOUBLE PRECISION,
  updated_at  TIMESTAMP WITH TIME ZONE,
  is_active   BOOLEAN,
  deleted_at  TIMESTAMP WITH TIME ZONE
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
    p.deleted_at
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

-- Create delete_pharmacy RPC
CREATE OR REPLACE FUNCTION delete_pharmacy(pharmacy_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.pharmacies
  SET is_active = false,
      deleted_at = NOW()
  WHERE id = pharmacy_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Create restore_pharmacy RPC
CREATE OR REPLACE FUNCTION restore_pharmacy(pharmacy_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.pharmacies
  SET is_active = true,
      deleted_at = NULL
  WHERE id = pharmacy_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
