-- Add vendor response tracking to disputes
-- This allows admin to see when vendor has responded

ALTER TABLE public.disputes ADD COLUMN IF NOT EXISTS vendor_response TEXT;
ALTER TABLE public.disputes ADD COLUMN IF NOT EXISTS vendor_response_at TIMESTAMPTZ;
