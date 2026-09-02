-- ============================================================
-- RECONCILE disputes ADMIN COLUMNS
-- ============================================================
-- 20260427_solely_v2_schema.sql added dispute_type/admin_resolution/
-- admin_notes/admin_resolved_at to disputes, but none of them appear in
-- the generated src/integrations/supabase/types_utf8.ts - strong evidence
-- that migration never actually ran against the live database the types
-- were generated from. All IF NOT EXISTS, safe no-op either way.
--
-- Also adds refund_amount, which notify-dispute-update/index.ts already
-- references (dispute.refund_amount) - previously always undefined since
-- the column never existed, silently leaving the "refund amount" line in
-- that email blank.
-- ============================================================

ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS dispute_type TEXT,
  ADD COLUMN IF NOT EXISTS admin_resolution TEXT,
  ADD COLUMN IF NOT EXISTS admin_notes TEXT,
  ADD COLUMN IF NOT EXISTS admin_resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(12,2);
