CREATE TABLE IF NOT EXISTS public.asha_workers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(15),
    district VARCHAR(100),
    state VARCHAR(100),
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asha_workers_location
ON public.asha_workers
USING GIST(location);

CREATE OR REPLACE FUNCTION get_nearest_asha_workers(
    query_lat DOUBLE PRECISION,
    query_lng DOUBLE PRECISION,
    search_radius_km DOUBLE PRECISION DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    name VARCHAR(255),
    phone_number VARCHAR(15),
    district VARCHAR(100),
    state VARCHAR(100),
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    distance DOUBLE PRECISION
)
AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.name,
        a.phone_number,
        a.district,
        a.state,
        ST_Y(a.location::geometry) AS lat,
        ST_X(a.location::geometry) AS lng,
        ROUND(
            (
                ST_Distance(
                    a.location,
                    ST_SetSRID(ST_MakePoint(query_lng, query_lat), 4326)::geography
                ) / 1000.0
            )::numeric,
            2
        )::double precision AS distance
    FROM public.asha_workers a
    WHERE a.location IS NOT NULL
      AND ST_DWithin(
            a.location,
            ST_SetSRID(ST_MakePoint(query_lng, query_lat), 4326)::geography,
            search_radius_km * 1000
      )
    ORDER BY distance ASC
    LIMIT 200;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;