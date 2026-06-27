-- =============================================================================
-- SahiDawa — Delta sync RPC for pharmacy bounds queries (#2260)
-- =============================================================================
-- Adds get_pharmacies_in_bounds_delta, a variant of get_pharmacies_in_bounds
-- that accepts an optional `since` timestamp. When provided, only rows
-- created or updated after that timestamp are returned, drastically
-- shrinking payload size for repeat map-bounds requests (panning/zooming
-- over an area the client has already synced).
--
-- Deletions: pharmacies are hard-deleted today (no soft-delete/tombstone
-- column exists). This RPC does not report deleted IDs — that is a known
-- limitation called out in the PR description, not silently swept under
-- the rug. A follow-up issue should add a tombstone table or soft-delete
-- flag if deletions need to propagate to clients holding stale data.
-- =============================================================================

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
  updated_at  TIMESTAMP WITH TIME ZONE
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
    p.updated_at
  FROM public.pharmacies p
  WHERE p.location IS NOT NULL
    AND ST_Intersects(
          p.location,
          ST_MakeEnvelope(bound_west, bound_south, bound_east, bound_north, 4326)::geography
        )
    AND (since IS NULL OR p.updated_at > since)
  ORDER BY distance ASC
  LIMIT 200;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;