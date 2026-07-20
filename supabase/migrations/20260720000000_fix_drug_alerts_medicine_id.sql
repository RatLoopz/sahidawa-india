-- 1. Create a function to auto-link medicine_id for drug_alerts based on batch and brand/manufacturer
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
          manufacturer = NEW.manufacturer 
          OR brand_name = NEW.reported_brand_name
        )
      LIMIT 1
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Attach the trigger to drug_alerts
DROP TRIGGER IF EXISTS trg_drug_alerts_link_medicine ON public.drug_alerts;
CREATE TRIGGER trg_drug_alerts_link_medicine
  BEFORE INSERT OR UPDATE
  ON public.drug_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.link_drug_alert_to_medicine();

-- 3. Backfill existing records that have NULL medicine_id
UPDATE public.drug_alerts da
SET medicine_id = m.id
FROM public.medicines m
WHERE da.medicine_id IS NULL
  AND m.batch_number = da.batch_number
  AND (m.manufacturer = da.manufacturer OR m.brand_name = da.reported_brand_name);
