-- Add GIN trigram index on notification_subscribers.district to support ILIKE
-- queries used by broadcastDistrictAlerts() and broadcastDrugAlerts().
-- Without this index, each broadcast tick performs a sequential scan of the
-- entire table, which becomes increasingly expensive as the subscriber base grows.

CREATE INDEX IF NOT EXISTS idx_subs_district_trgm
  ON public.notification_subscribers
  USING GIN (district gin_trgm_ops);
