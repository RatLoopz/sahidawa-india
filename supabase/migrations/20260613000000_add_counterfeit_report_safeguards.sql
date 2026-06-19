-- Add safeguard columns to counterfeit_reports for abuse prevention
-- Issue #1235: Community Counterfeit Reports Can Be Artificially Amplified

ALTER TABLE counterfeit_reports
  ADD COLUMN IF NOT EXISTS ip_address VARCHAR(64), -- SHA-256 hash of client IP (privacy-preserving)
  ADD COLUMN IF NOT EXISTS report_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS risk_score REAL DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS is_escalated BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS duplicate_group_id UUID;

-- Index for deduplication lookups
CREATE INDEX IF NOT EXISTS idx_counterfeit_reports_hash ON counterfeit_reports(report_hash);
CREATE INDEX IF NOT EXISTS idx_counterfeit_reports_ip ON counterfeit_reports(ip_address);
CREATE INDEX IF NOT EXISTS idx_counterfeit_reports_risk_score ON counterfeit_reports(risk_score);
CREATE INDEX IF NOT EXISTS idx_counterfeit_reports_escalated ON counterfeit_reports(is_escalated);

-- Index for burst detection: district + created_at
CREATE INDEX IF NOT EXISTS idx_counterfeit_reports_district_created
  ON counterfeit_reports(district, created_at DESC);
