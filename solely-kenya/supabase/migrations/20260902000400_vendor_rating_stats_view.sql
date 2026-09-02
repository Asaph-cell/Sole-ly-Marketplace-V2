-- ============================================================
-- vendor_rating_stats VIEW
-- ============================================================
-- No aggregate over vendor_ratings has ever existed - every place that
-- shows an average rating (VendorRatings.tsx, AdminVendors.tsx) recomputes
-- it client-side, ad hoc, per page load, with a separate query per vendor.
-- This gives a single server-side source of truth to query instead,
-- and is what the new "vendors needing attention" dashboard widget and
-- the batched AdminVendors.tsx query both read from.
--
-- Threshold filtering (e.g. "at least 3 ratings") intentionally stays in
-- the querying code, not baked in here, so it can be tuned without another
-- migration. vendor_ratings already allows anyone to SELECT, so no extra
-- grant is needed for this view.
-- ============================================================

CREATE OR REPLACE VIEW public.vendor_rating_stats AS
SELECT
  vendor_id,
  avg(rating)::numeric(3,2) AS avg_rating,
  count(*) AS rating_count
FROM public.vendor_ratings
GROUP BY vendor_id;
