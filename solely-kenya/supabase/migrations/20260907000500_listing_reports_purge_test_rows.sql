-- ============================================================
-- listing_reports: final purge of verification rows
-- ============================================================
-- 20260907000400 revoked anon's SELECT/UPDATE/DELETE privileges, and the
-- revoke itself was then verified by filing one more report through the
-- app's anonymous path (the one operation that must still succeed). That
-- check left a second row behind, and by design nothing outside the
-- database owner can delete from this table.
--
-- Matching on the marker short code and the two throwaway addresses so
-- this cannot touch a real complaint.
-- ============================================================

delete from public.listing_reports
where product_short_code = 'VERIFY-TEST'
   or reporter_email in ('verify@example.com', 'postcheck@example.com');
