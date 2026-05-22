ALTER TABLE public.medicines
  ADD COLUMN IF NOT EXISTS mrp NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS jan_aushadhi_price NUMERIC(10, 2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    JOIN pg_class ON pg_class.oid = pg_constraint.conrelid
    JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
    WHERE pg_constraint.conname = 'medicines_mrp_non_negative'
      AND pg_namespace.nspname = 'public'
      AND pg_class.relname = 'medicines'
  ) THEN
    ALTER TABLE public.medicines
      ADD CONSTRAINT medicines_mrp_non_negative
      CHECK (mrp IS NULL OR mrp >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    JOIN pg_class ON pg_class.oid = pg_constraint.conrelid
    JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
    WHERE pg_constraint.conname = 'medicines_jan_aushadhi_price_non_negative'
      AND pg_namespace.nspname = 'public'
      AND pg_class.relname = 'medicines'
  ) THEN
    ALTER TABLE public.medicines
      ADD CONSTRAINT medicines_jan_aushadhi_price_non_negative
      CHECK (jan_aushadhi_price IS NULL OR jan_aushadhi_price >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    JOIN pg_class ON pg_class.oid = pg_constraint.conrelid
    JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
    WHERE pg_constraint.conname = 'medicines_mrp_gte_jan_aushadhi_price'
      AND pg_namespace.nspname = 'public'
      AND pg_class.relname = 'medicines'
  ) THEN
    ALTER TABLE public.medicines
      ADD CONSTRAINT medicines_mrp_gte_jan_aushadhi_price
      CHECK (
        mrp IS NULL
        OR jan_aushadhi_price IS NULL
        OR mrp >= jan_aushadhi_price
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_medicines_mrp
  ON public.medicines (mrp);

CREATE INDEX IF NOT EXISTS idx_medicines_jan_aushadhi_price
  ON public.medicines (jan_aushadhi_price);
