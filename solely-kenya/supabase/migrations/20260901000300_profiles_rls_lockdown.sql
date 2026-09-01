-- ============================================================
-- PROFILES RLS LOCKDOWN
-- ============================================================
-- A leftover `USING (true)` SELECT policy exposes every column of
-- every row - including mpesa_number, email, intasend_wallet_id -
-- to anyone holding the public anon key (i.e. anyone).
--
-- RLS restricts rows, not columns: a select("*") against the base
-- table would still return every column regardless of policy intent,
-- so the only correct fix is a view exposing just the safe columns,
-- with the base table locked to owner + admin only. Every public,
-- non-owner frontend read of `profiles` must be repointed at this
-- view (see accompanying frontend changes shipped in the same
-- deploy as this migration).
-- ============================================================

create or replace view public.public_vendor_profiles
with (security_invoker = true) as
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

drop policy if exists "Public can view basic vendor info" on public.profiles;
drop policy if exists "Users can view own full profile" on public.profiles;
drop policy if exists "Users can view all profiles" on public.profiles;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_select_admin" on public.profiles
  for select using (public.has_role(auth.uid(), 'admin'::app_role));
