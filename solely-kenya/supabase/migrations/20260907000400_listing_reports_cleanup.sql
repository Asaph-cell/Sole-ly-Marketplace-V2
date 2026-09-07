-- ============================================================
-- listing_reports: remove verification rows, tighten grants
-- ============================================================
-- Two follow-ups to 20260907000300.
--
-- 1. The anonymous-insert path was verified against the live database
--    by filing a real report through the app's own client. That left one
--    row behind, and there is deliberately no DELETE policy on this
--    table, so it cannot be removed from the application side. This
--    migration runs as the owner and clears it.
--
-- 2. RLS already prevented anon from deleting anything (no DELETE policy
--    means no row is ever visible to delete), but the table-level DELETE
--    privilege was still granted by Supabase's defaults. That made a
--    delete attempt return success-with-zero-rows rather than an outright
--    permission error, which is a confusing thing to debug and one policy
--    edit away from being a real hole. Revoking the privilege makes the
--    intent explicit and the failure loud.
-- ============================================================

delete from public.listing_reports
where product_short_code = 'VERIFY-TEST'
   or reporter_email = 'verify@example.com';

-- Reports are the audit trail of complaints received and acted on.
-- Nothing outside the database owner should be able to erase one.
revoke delete on public.listing_reports from anon, authenticated;

-- anon files reports and nothing else: no reading other people's
-- complaints, no editing them after the fact.
revoke select, update on public.listing_reports from anon;
