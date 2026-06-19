CREATE TABLE tracked_medicines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  session_id TEXT,
  medicine_id TEXT NOT NULL,
  medicine_name TEXT NOT NULL,
  batch_number TEXT,
  expiry_date DATE NOT NULL,
  notified_7d BOOLEAN DEFAULT FALSE,
  notified_14d BOOLEAN DEFAULT FALSE,
  notified_30d BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_tracked_expiry ON tracked_medicines(expiry_date);