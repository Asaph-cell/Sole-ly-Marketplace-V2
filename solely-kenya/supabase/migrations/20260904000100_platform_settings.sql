-- ============================================================
-- PLATFORM SETTINGS
-- ============================================================
-- No table has ever existed for platform-wide tunable parameters. The
-- commission rate, kill switches, and time windows that govern money
-- movement were hardcoded literals duplicated across many edge functions
-- and frontend files - independently, so they could (and did) drift: the
-- commission_ledger/orders default below was 10.00 while every real call
-- site actually charged 6. This table becomes the single source of
-- truth; admin-action's update_platform_setting case is the only writer,
-- so every change is audit-logged with a reason.
-- ============================================================

create table public.platform_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id) on delete set null
);

alter table public.platform_settings enable row level security;

-- Publicly readable: this is non-sensitive operational config (rates,
-- toggles, time windows), never secrets - and maintenance_mode must be
-- checkable before a visitor is authenticated.
create policy "Anyone can read platform settings"
  on public.platform_settings for select
  using (true);

-- Deliberately no insert/update/delete policy for anyone. Only the
-- service-role key (used exclusively by admin-action) writes, bypassing
-- RLS, so every change goes through the audited admin-action choke point.

grant select on public.platform_settings to anon, authenticated;

insert into public.platform_settings (key, value, description) values
  ('commission_rate_percent', '6', 'Platform commission percentage taken from each order.'),
  ('maintenance_mode', 'false', 'When true, the entire storefront shows a maintenance page.'),
  ('checkout_disabled', 'false', 'When true, checkout is blocked platform-wide (independent of maintenance mode).'),
  ('vendor_confirm_hours', '48', 'Hours a vendor has to confirm a new order before it auto-cancels and refunds.'),
  ('auto_dispute_days', '5', 'Days an order can sit undelivered before an automatic dispute is raised for review.'),
  ('pin_release_hours', '6', 'Hours after buyer PIN entry before escrow auto-releases to the vendor.'),
  ('minimum_auto_payout_ksh', '10000', 'Minimum pending balance (KES) before a vendor is auto-paid out.'),
  ('payout_fee_schedule', '[{"max_ksh": 100, "fee_ksh": 10}, {"max_ksh": 1000, "fee_ksh": 20}, {"fee_ksh": 100}]', 'Tiered IntaSend disbursement fee applied to vendor payouts, evaluated in order; the last entry (no max_ksh) is the fallback above the highest tier.');

-- ============================================================
-- Widen admin_activity_log for setting changes
-- ============================================================
-- target_id was NOT NULL uuid, fine for product/vendor/dispute targets -
-- but a settings key is text, not a uuid, and there's no row to point at.
-- Drop NOT NULL and use NULL for setting changes; the key/previous/new
-- value live in `details` instead.
alter table public.admin_activity_log alter column target_id drop not null;

alter table public.admin_activity_log drop constraint admin_activity_log_target_type_check;
alter table public.admin_activity_log add constraint admin_activity_log_target_type_check
  check (target_type in ('product','vendor','dispute','setting'));

alter table public.admin_activity_log drop constraint admin_activity_log_action_type_check;
alter table public.admin_activity_log add constraint admin_activity_log_action_type_check
  check (action_type in (
    'pause_product','restore_product','delete_product',
    'penalize_vendor','revoke_vendor','restore_vendor',
    'resolve_dispute_release','resolve_dispute_refund',
    'resolve_dispute_partial_refund','resolve_dispute_close',
    'update_platform_setting'
  ));

-- ============================================================
-- Fix the stale default (was 10.00, every real call site actually used 6)
-- so a row that ever omits commission_rate on insert can't silently drift
-- from the real rate again.
-- ============================================================
alter table public.orders alter column commission_rate set default 6;
