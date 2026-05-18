DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'pharmacy_store_type'
    ) THEN
        CREATE TYPE pharmacy_store_type AS ENUM (
            'general',
            'jan_aushadhi',
            'verified_partner'
        );
    END IF;
END $$;


ALTER TABLE pharmacies
ADD COLUMN IF NOT EXISTS store_type pharmacy_store_type
DEFAULT 'general';

-- RPC function 

CREATE OR REPLACE FUNCTION get_nearest_pharmacies(
    query_lat DOUBLE PRECISION,
    query_lng DOUBLE PRECISION
)
RETURNS TABLE (
    name TEXT,
    address TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    distance DOUBLE PRECISION,
    is_verified BOOLEAN,
    store_type pharmacy_store_type
)
LANGUAGE sql
AS $$
    SELECT
        p.name,
        p.address,

        ST_Y(p.location::geometry) AS lat,
        ST_X(p.location::geometry) AS lng,

        (
            ST_Distance(
                p.location,
                ST_SetSRID(ST_MakePoint(query_lng, query_lat), 4326)::geography
            ) / 1000
        ) AS distance,

        p.is_verified,
        p.store_type

    FROM pharmacies p

    WHERE ST_DWithin(
        p.location,
        ST_SetSRID(ST_MakePoint(query_lng, query_lat), 4326)::geography,
        5000
    )

    ORDER BY
        p.location <-> ST_SetSRID(ST_MakePoint(query_lng, query_lat), 4326)::geography

    LIMIT 3;
$$;