-- Add reporter_phone column to counterfeit_reports for SMS confirmation
ALTER TABLE counterfeit_reports
  ADD COLUMN IF NOT EXISTS reporter_phone VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_counterfeit_reports_phone
  ON counterfeit_reports(reporter_phone);
