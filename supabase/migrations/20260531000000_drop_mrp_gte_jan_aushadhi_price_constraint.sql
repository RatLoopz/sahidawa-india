-- Drop the artificial pricing constraint that assumes branded medicines are always >= generic prices
-- This constraint was causing ETL pipeline failures when commercial medicines had MRP < jan_aushadhi_price
-- In the real Indian pharmaceutical market, local/discounted brands can be cheaper than government ceiling prices

ALTER TABLE public.medicines
  DROP CONSTRAINT IF EXISTS medicines_mrp_gte_jan_aushadhi_price;
