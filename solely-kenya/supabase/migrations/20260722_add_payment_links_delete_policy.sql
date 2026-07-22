-- ============================================================
-- ADD DELETE POLICY FOR PAYMENT LINKS
-- Date: 2026-07-22
-- Fix: Vendors could not delete their own payment links because
--      the original migration omitted a DELETE RLS policy.
--      Supabase silently returned 0 affected rows, so the UI
--      appeared to delete the link but it reappeared on refresh.
-- ============================================================

CREATE POLICY "Vendors can delete own payment links"
  ON public.payment_links FOR DELETE
  USING (auth.uid() = vendor_id AND has_role(auth.uid(), 'vendor'::app_role));

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
