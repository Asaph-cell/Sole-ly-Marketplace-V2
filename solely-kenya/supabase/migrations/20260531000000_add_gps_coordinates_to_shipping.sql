-- ============================================================
-- ADD GPS COORDINATES TO SHIPPING DETAILS
-- Date: 2026-05-31
-- Adds: gps_latitude and gps_longitude columns to support location pinning
-- ============================================================

ALTER TABLE public.order_shipping_details 
  ADD COLUMN IF NOT EXISTS gps_latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS gps_longitude NUMERIC;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
