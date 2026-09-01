-- ============================================================
-- FIX public_vendor_profiles: remove security_invoker
-- ============================================================
-- The previous migration created this view with
-- `security_invoker = true`, which makes the view evaluate RLS on
-- the underlying `profiles` table as the CALLING role (anon/
-- authenticated) - meaning the new owner-only profiles RLS still
-- applied inside the view and it returned zero rows for anyone but
-- the profile's own owner, defeating its entire purpose.
--
-- The correct behavior is the Postgres default (no security_invoker,
-- i.e. definer-style view semantics): the view runs with its OWNER's
-- privileges (the migration role, which bypasses RLS), so it can see
-- every row in `profiles`, while still only exposing the safe column
-- subset - access to the view itself is controlled purely by the
-- `grant select ... to anon, authenticated` below.
-- ============================================================

create or replace view public.public_vendor_profiles as
select
  id,
  store_name,
  full_name,
  store_logo_url,
  store_description,
  store_link,
  vendor_city,
  vendor_county,
  kyc_status,
  whatsapp_number,
  created_at
from public.profiles;

grant select on public.public_vendor_profiles to anon, authenticated;
