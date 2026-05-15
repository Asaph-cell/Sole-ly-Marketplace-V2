-- ============================================================
-- Fix: products.category CHECK constraint & value backfill
-- Date: 2026-05-04
--
-- The v2 migration (20260427_solely_v2_schema.sql) added a CHECK
-- constraint limiting category to 'footwear|apparel|electronics'.
-- However:
--   1. The vendor form (and categories.ts) uses keys like 'shoes',
--      'womens-fashion', 'electronics', etc.
--   2. Existing products created before v2 have category = 'footwear'
--      (the legacy shoe-only default).
--
-- This migration:
--   a) Drops the restrictive CHECK constraint
--   b) Backfills 'footwear' → 'shoes' for legacy products
--   c) Sets category = 'shoes' as the new sensible default
-- ============================================================

-- 1. Drop the bad CHECK constraint (name may differ — drop by column approach)
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_category_check;

-- Also try the auto-generated name pattern
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.products'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%footwear%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.products DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

-- 2. Backfill: rename legacy 'footwear' → 'shoes'
UPDATE public.products
SET category = 'shoes'
WHERE category = 'footwear';

-- 3. Update the column default to 'shoes'
ALTER TABLE public.products
  ALTER COLUMN category SET DEFAULT 'shoes';

-- 4. Ensure subcategory column exists (already added in v2 migration, but safe to re-run)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS subcategory TEXT;

-- 5. Rebuild the category index
DROP INDEX IF EXISTS idx_products_category;
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_subcategory ON public.products(subcategory);

COMMENT ON COLUMN public.products.category IS
  'Top-level category key matching categories.ts: shoes, womens-fashion, mens-fashion, kids, beauty, bags, sports, electronics, home';
COMMENT ON COLUMN public.products.subcategory IS
  'Subcategory key matching categories.ts subcategories, e.g. sandals, sneakers, phones';
