-- Add snoozed_until column to expiry_tracker_items
ALTER TABLE public.expiry_tracker_items
ADD COLUMN snoozed_until TIMESTAMPTZ;
