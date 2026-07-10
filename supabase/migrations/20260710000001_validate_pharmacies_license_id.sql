-- Prevent short or invalid pharmacy license IDs.
-- Enforces that any non-NULL license_id must be at least 3 characters long,
-- ensuring consistency with the API layer's registration validation schema.
ALTER TABLE public.pharmacies
ADD CONSTRAINT pharmacies_license_id_length
CHECK (license_id IS NULL OR char_length(license_id) >= 3);
