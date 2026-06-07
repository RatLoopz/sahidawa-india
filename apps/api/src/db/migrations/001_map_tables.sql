-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Pharmacies table
CREATE TABLE IF NOT EXISTS pharmacies (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  type       TEXT CHECK (type IN ('Jan Aushadhi', 'private')) NOT NULL,
  lat        DOUBLE PRECISION NOT NULL,
  lng        DOUBLE PRECISION NOT NULL,
  address    TEXT,
  district   TEXT,
  state      TEXT,
  verified   BOOLEAN DEFAULT FALSE,
  location   GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (
               ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
             ) STORED
);

-- ASHA workers table
CREATE TABLE IF NOT EXISTS asha_workers (
  id       SERIAL PRIMARY KEY,
  name     TEXT NOT NULL,
  district TEXT,
  lat      DOUBLE PRECISION NOT NULL,
  lng      DOUBLE PRECISION NOT NULL,
  contact  TEXT,
  location GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (
               ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
             ) STORED
);

-- Spatial indexes for fast ST_DWithin queries
CREATE INDEX ON pharmacies USING GIST(location);
CREATE INDEX ON asha_workers USING GIST(location);

-- Function for nearby pharmacies
CREATE OR REPLACE FUNCTION get_nearby_pharmacies(
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  radius_m DOUBLE PRECISION
)
RETURNS TABLE (
  id INT, name TEXT, type TEXT, lat DOUBLE PRECISION, lng DOUBLE PRECISION,
  address TEXT, district TEXT, state TEXT, verified BOOLEAN, distance_km NUMERIC
) LANGUAGE sql STABLE AS $$
  SELECT id, name, type, lat, lng, address, district, state, verified,
    ROUND(ST_Distance(location, ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography)::numeric / 1000, 2) AS distance_km
  FROM pharmacies
  WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography, radius_m)
  ORDER BY distance_km ASC;
$$;

-- Function for nearby ASHA workers
CREATE OR REPLACE FUNCTION get_nearby_asha_workers(
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  radius_m DOUBLE PRECISION
)
RETURNS TABLE (
  id INT, name TEXT, district TEXT, lat DOUBLE PRECISION, lng DOUBLE PRECISION,
  contact TEXT, distance_km NUMERIC
) LANGUAGE sql STABLE AS $$
  SELECT id, name, district, lat, lng, contact,
    ROUND(ST_Distance(location, ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography)::numeric / 1000, 2) AS distance_km
  FROM asha_workers
  WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography, radius_m)
  ORDER BY distance_km ASC;
$$;