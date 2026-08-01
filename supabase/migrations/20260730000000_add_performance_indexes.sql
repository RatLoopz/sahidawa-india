-- Performance indexes for common query patterns
-- Issue #3950: Database Repository Pattern, Index Optimization & Query Monitoring

-- ── Counterfeit Reports ──────────────────────────────────────────────────────
-- Composite index for paginated report listings filtered by district and status
CREATE INDEX IF NOT EXISTS idx_reports_district_status_created
  ON counterfeit_reports(district, status, created_at DESC);

-- Index for reporter lookups (user's report history)
CREATE INDEX IF NOT EXISTS idx_reports_reporter_created
  ON counterfeit_reports(reporter_id, created_at DESC);

-- Index for duplicate detection via report_hash
CREATE INDEX IF NOT EXISTS idx_reports_hash
  ON counterfeit_reports(report_hash);

-- ── Drug Alerts ──────────────────────────────────────────────────────────────
-- Composite index for medicine + district lookups (alert broadcasting)
CREATE INDEX IF NOT EXISTS idx_alerts_medicine_district
  ON drug_alerts(medicine_id, district);

-- Index for active alerts by severity
CREATE INDEX IF NOT EXISTS idx_alerts_active_severity
  ON drug_alerts(is_active, severity) WHERE is_active = true;

-- Index for district-based alert queries
CREATE INDEX IF NOT EXISTS idx_alerts_district_created
  ON drug_alerts(district, created_at DESC);

-- ── Medicines ────────────────────────────────────────────────────────────────
-- Partial index for verified medicines (common filter)
CREATE INDEX IF NOT EXISTS idx_medicines_verified
  ON medicines(is_cdsco_verified) WHERE is_cdsco_verified = true;

-- Partial index for counterfeit-flagged medicines
CREATE INDEX IF NOT EXISTS idx_medicines_counterfeit
  ON medicines(is_counterfeit_alert) WHERE is_counterfeit_alert = true;

-- Index for batch number lookups (traceability)
CREATE INDEX IF NOT EXISTS idx_medicines_batch_number
  ON medicines(batch_number);

-- ── Notification Subscribers ─────────────────────────────────────────────────
-- Index for phone-based lookups (OTP verification, subscription checks)
CREATE INDEX IF NOT EXISTS idx_subscribers_phone_active
  ON notification_subscribers(phone) WHERE is_active = true;

-- Composite index for district-based broadcasting
CREATE INDEX IF NOT EXISTS idx_subscribers_district_active
  ON notification_subscribers(district, is_active) WHERE is_active = true;

-- Index for user-based lookups
CREATE INDEX IF NOT EXISTS idx_subscribers_user_id
  ON notification_subscribers(user_id) WHERE user_id IS NOT NULL;

-- ── Scan History ─────────────────────────────────────────────────────────────
-- Index for user scan history lookups
CREATE INDEX IF NOT EXISTS idx_scan_history_user_created
  ON scan_history(user_id, created_at DESC);

-- ── Push Subscriptions ───────────────────────────────────────────────────────
-- Index for endpoint-based lookups (unsubscribe)
CREATE INDEX IF NOT EXISTS idx_push_subs_endpoint
  ON push_subscriptions(endpoint);

-- Index for user-based subscription management
CREATE INDEX IF NOT EXISTS idx_push_subs_user_id
  ON push_subscriptions(user_id) WHERE user_id IS NOT NULL;

-- ── Pharmacies ───────────────────────────────────────────────────────────────
-- Index for license ID lookups (registration validation)
CREATE INDEX IF NOT EXISTS idx_pharmacies_license_id
  ON pharmacies(license_id);

-- Index for status-based filtering (admin approval workflow)
CREATE INDEX IF NOT EXISTS idx_pharmacies_status
  ON pharmacies(status);

-- Composite index for district-based pharmacy queries
CREATE INDEX IF NOT EXISTS idx_pharmacies_district_status
  ON pharmacies(district, status);
