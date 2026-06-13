-- Prevent duplicate alerts for the same batch+manufacturer+brand combination.
-- Required for the ON CONFLICT DO NOTHING upsert in /ingest.
ALTER TABLE drug_alerts
    ADD CONSTRAINT drug_alerts_unique_alert
    UNIQUE (batch_number, manufacturer, reported_brand_name);