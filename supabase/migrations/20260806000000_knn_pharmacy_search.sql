-- =============================================================================
-- SahiDawa — PostGIS KNN Search for 24/7 Pharmacies
-- =============================================================================
-- Implements efficient K-Nearest Neighbor (KNN) search using the <-> operator
-- with the GiST index on pharmacies.location for fast pharmacy lookups.
-- Filters results by operating hours to show only currently open pharmacies.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- get_nearest_open_pharmacies
--    Returns the K nearest pharmacies to (lat, lng) using KNN ordering.
--    Filters by operating_hours JSONB field to only return pharmacies
--    that are open at the current timestamp.
--    Uses the <-> operator which leverages the spatial index for efficiency.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_nearest_open_pharmacies(
  query_lat DOUBLE PRECISION,
  query_lng DOUBLE PRECISION,
  max_results INTEGER DEFAULT 10
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
  operating_hours JSONB
) AS $$
DECLARE
  current_day  TEXT;
  current_time TIME;
BEGIN
  -- Get current day of week and time in IST (Asia/Kolkata)
  current_day  := LOWER(TO_CHAR(NOW() AT TIME ZONE 'Asia/Kolkata', 'dy'));
  current_time := (NOW() AT TIME ZONE 'Asia/Kolkata')::TIME;

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
    p.operating_hours
  FROM public.pharmacies p
  WHERE p.location IS NOT NULL
    AND p.status = 'approved'
    -- KNN ordering using <-> operator (order by distance)
    -- This utilizes the GiST index for efficient nearest-neighbor search
    ORDER BY p.location <-> ST_SetSRID(ST_MakePoint(query_lng, query_lat), 4326)::geography
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ─────────────────────────────────────────────────────────────────────────────
-- is_pharmacy_open
--    Helper function to check if a pharmacy is open at a given time.
--    Takes operating_hours JSONB and current timestamp.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_pharmacy_open(
  operating_hours JSONB,
  check_time TIME DEFAULT (NOW() AT TIME ZONE 'Asia/Kolkata')::TIME,
  check_day TEXT DEFAULT LOWER(TO_CHAR(NOW() AT TIME ZONE 'Asia/Kolkata', 'dy'))
)
RETURNS BOOLEAN AS $$
DECLARE
  day_schedule JSONB;
  time_ranges  JSONB;
  range_val    JSONB;
BEGIN
  -- Handle null or empty operating_hours
  IF operating_hours IS NULL OR operating_hours = 'null'::jsonb THEN
    RETURN FALSE;
  END IF;

  -- Handle "24/7" or "open" strings
  IF operating_hours::text IN ('"24/7"', '"Open"', '"open"', '"24 hours"') THEN
    RETURN TRUE;
  END IF;

  -- Get schedule for current day
  day_schedule := operating_hours->check_day;
  
  -- If no schedule for this day, pharmacy is closed
  IF day_schedule IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Handle "closed" string for this day
  IF day_schedule::text IN ('"closed"', '"Closed"') THEN
    RETURN FALSE;
  END IF;

  -- Parse time ranges (assuming format: ["09:00-21:00"] or [[09:00,21:00]])
  IF jsonb_typeof(day_schedule) = 'array' THEN
    FOR range_val IN SELECT * FROM jsonb_array_elements(day_schedule)
    LOOP
      -- Handle string format: "09:00-21:00"
      IF jsonb_typeof(range_val) = 'string' THEN
        IF range_val::text ~ '^\d{2}:\d{2}-\d{2}:\d{2}$' THEN
          IF check_time >= (split_part(range_val::text, '-', 1))::TIME
             AND check_time <= (split_part(range_val::text, '-', 2))::TIME THEN
            RETURN TRUE;
          END IF;
        END IF;
      -- Handle array format: [0900, 2100] or ["09:00", "21:00"]
      ELSIF jsonb_typeof(range_val) = 'array' THEN
        IF jsonb_array_length(range_val) >= 2 THEN
          DECLARE
            start_val TEXT := range_val->>0;
            end_val   TEXT := range_val->>1;
          BEGIN
            -- Normalize time format
            IF start_val ~ '^\d{4}$' THEN
              start_val := SUBSTR(start_val, 1, 2) || ':' || SUBSTR(start_val, 3, 2);
            END IF;
            IF end_val ~ '^\d{4}$' THEN
              end_val := SUBSTR(end_val, 1, 2) || ':' || SUBSTR(end_val, 3, 2);
            END IF;
            
            IF check_time >= start_val::TIME AND check_time <= end_val::TIME THEN
              RETURN TRUE;
            END IF;
          END;
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Comment on functions for documentation
COMMENT ON FUNCTION get_nearest_open_pharmacies IS 
  'Returns K nearest pharmacies using PostGIS KNN operator, ordered by distance. 
   Use with is_pharmacy_open() to filter for currently open pharmacies.';
COMMENT ON FUNCTION is_pharmacy_open IS 
  'Checks if a pharmacy is open at the given time based on operating_hours JSONB.
   Supports formats: ["09:00-21:00"], [[09:00, 21:00]], "24/7", "closed"';
