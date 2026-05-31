CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

CREATE OR REPLACE FUNCTION find_lasa_conflicts(target_name text)
RETURNS TABLE (name text, match_type text) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    brand_name::text,
    CASE 
      WHEN soundex(brand_name) = soundex(target_name) THEN 'sound-alike'::text
      ELSE 'look-alike'::text
    END as match_type
  FROM medicines
  WHERE brand_name IS NOT NULL
    AND brand_name NOT ILIKE target_name
    AND (
      soundex(brand_name) = soundex(target_name)
      OR similarity(brand_name, target_name) > 0.85
    )
  ORDER BY 
    CASE WHEN soundex(brand_name) = soundex(target_name) THEN 1 ELSE 0 END DESC,
    similarity(brand_name, target_name) DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
