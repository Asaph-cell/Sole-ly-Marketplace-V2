-- ============================================================
-- ADD 'paused' TO product_status
-- ============================================================
-- admin-action's pause_product has always tried to set products.status
-- to 'paused', but product_status only ever defined 'active' |
-- 'out_of_stock' | 'draft' - so every Pause click fails with an invalid
-- enum value error. This adds the value the code already assumed existed.
-- ============================================================

ALTER TYPE public.product_status ADD VALUE IF NOT EXISTS 'paused';
