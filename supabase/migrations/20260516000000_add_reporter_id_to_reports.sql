-- Add reporter_id to counterfeit_reports so citizens can view "their" reports
-- via GET /reports/mine. Nullable + ON DELETE SET NULL preserves existing
-- anonymous rows and lets users delete their account without losing the
-- report itself (which still helps the heatmap).

ALTER TABLE counterfeit_reports
    ADD COLUMN IF NOT EXISTS reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_counterfeit_reports_reporter_id
    ON counterfeit_reports(reporter_id);
