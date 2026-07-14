-- ============================================================
-- Add short_code to payment_links for prettier URLs
-- Date: 2026-07-14
-- ============================================================

ALTER TABLE public.payment_links
ADD COLUMN IF NOT EXISTS short_code TEXT UNIQUE;

-- We want to populate existing payment links with a unique short code.
-- We can just use the first 8 characters of their UUID which is practically unique enough for existing rows.
UPDATE public.payment_links
SET short_code = UPPER(SUBSTRING(id::text FROM 1 FOR 8))
WHERE short_code IS NULL;

-- Create an index to quickly look up links by short_code
CREATE INDEX IF NOT EXISTS idx_payment_links_short_code ON public.payment_links(short_code);
