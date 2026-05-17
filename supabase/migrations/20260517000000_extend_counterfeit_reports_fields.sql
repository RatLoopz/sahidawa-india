-- Extend counterfeit_reports to persist the full ReportWizard payload.
-- reporter_id was added in 20260516000000_add_reporter_id_to_reports.sql.

ALTER TABLE counterfeit_reports
  ADD COLUMN IF NOT EXISTS manufacturer    VARCHAR(255),
  ADD COLUMN IF NOT EXISTS description     TEXT,
  ADD COLUMN IF NOT EXISTS pharmacy_name   VARCHAR(255),
  ADD COLUMN IF NOT EXISTS address         TEXT,
  ADD COLUMN IF NOT EXISTS city            VARCHAR(100),
  ADD COLUMN IF NOT EXISTS state           VARCHAR(100),
  ADD COLUMN IF NOT EXISTS pincode         VARCHAR(10),
  ADD COLUMN IF NOT EXISTS photo_urls      TEXT[] DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_counterfeit_reports_pincode
  ON counterfeit_reports(pincode);
