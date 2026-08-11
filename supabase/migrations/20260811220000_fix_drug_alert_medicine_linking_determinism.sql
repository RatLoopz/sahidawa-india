-- Fix non-deterministic medicine linking for drug_alerts.
-- Prioritizes exact matches on both manufacturer and brand_name over single field matches,
-- and tie-breaks deterministically with created_at DESC, id ASC.

CREATE OR REPLACE FUNCTION public.link_drug_alert_to_medicine()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.medicine_id IS NULL THEN
    NEW.medicine_id := (
      SELECT id 
      FROM public.medicines 
      WHERE batch_number = NEW.batch_number 
        AND (
          (NEW.manufacturer IS NOT NULL AND manufacturer = NEW.manufacturer)
          OR (NEW.reported_brand_name IS NOT NULL AND brand_name = NEW.reported_brand_name)
        )
      ORDER BY
        (CASE WHEN (NEW.manufacturer IS NOT NULL AND manufacturer = NEW.manufacturer)
               AND (NEW.reported_brand_name IS NOT NULL AND brand_name = NEW.reported_brand_name) THEN 0
              WHEN (NEW.manufacturer IS NOT NULL AND manufacturer = NEW.manufacturer) THEN 1
              WHEN (NEW.reported_brand_name IS NOT NULL AND brand_name = NEW.reported_brand_name) THEN 2
              ELSE 3 END),
        created_at DESC,
        id ASC
      LIMIT 1
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Re-attach trigger
DROP TRIGGER IF EXISTS trg_drug_alerts_link_medicine ON public.drug_alerts;
CREATE TRIGGER trg_drug_alerts_link_medicine
  BEFORE INSERT OR UPDATE
  ON public.drug_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.link_drug_alert_to_medicine();

-- Deterministic backfill update for existing unlinked alerts
UPDATE public.drug_alerts da
SET medicine_id = (
  SELECT m.id
  FROM public.medicines m
  WHERE m.batch_number = da.batch_number
    AND (
      (da.manufacturer IS NOT NULL AND m.manufacturer = da.manufacturer)
      OR (da.reported_brand_name IS NOT NULL AND m.brand_name = da.reported_brand_name)
    )
  ORDER BY
    (CASE WHEN (da.manufacturer IS NOT NULL AND m.manufacturer = da.manufacturer)
           AND (da.reported_brand_name IS NOT NULL AND m.brand_name = da.reported_brand_name) THEN 0
          WHEN (da.manufacturer IS NOT NULL AND m.manufacturer = da.manufacturer) THEN 1
          WHEN (da.reported_brand_name IS NOT NULL AND m.brand_name = da.reported_brand_name) THEN 2
          ELSE 3 END),
    m.created_at DESC,
    m.id ASC
  LIMIT 1
)
WHERE da.medicine_id IS NULL;
