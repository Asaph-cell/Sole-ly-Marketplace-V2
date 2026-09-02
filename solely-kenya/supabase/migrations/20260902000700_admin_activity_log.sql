-- ============================================================
-- ADMIN ACTIVITY LOG
-- ============================================================
-- No durable record of admin actions has ever existed - no way to trace
-- who revoked/penalized a vendor, deleted a product, or resolved a dispute
-- after the fact. This adds an append-only audit trail written by
-- admin-action and resolve-dispute (both service-role, so RLS bypass is
-- already how they operate - no client insert path is needed or granted).
-- ============================================================

create table public.admin_activity_log (
  id           uuid primary key default gen_random_uuid(),
  admin_id     uuid not null references public.profiles(id) on delete restrict,
  action_type  text not null check (action_type in (
    'pause_product','restore_product','delete_product',
    'penalize_vendor','revoke_vendor','restore_vendor',
    'resolve_dispute_release','resolve_dispute_refund',
    'resolve_dispute_partial_refund','resolve_dispute_close'
  )),
  target_type  text not null check (target_type in ('product','vendor','dispute')),
  target_id    uuid not null,
  -- Denormalized so a vendor's admin history is a plain equality filter
  -- instead of a polymorphic OR across target_type/target_id. Resolvable
  -- for every action type: product actions know the product's vendor_id,
  -- dispute actions know the order's vendor_id, vendor actions know
  -- target_id itself.
  vendor_id    uuid references public.profiles(id) on delete set null,
  details      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index idx_admin_activity_log_created_at on public.admin_activity_log(created_at desc);
create index idx_admin_activity_log_vendor_id  on public.admin_activity_log(vendor_id);
create index idx_admin_activity_log_admin_id   on public.admin_activity_log(admin_id);

alter table public.admin_activity_log enable row level security;

create policy "Admins can view activity log"
  on public.admin_activity_log for select
  using (public.has_role(auth.uid(), 'admin'::app_role));

-- Deliberately no insert/update/delete policy for anyone. Only the
-- service-role key (used exclusively by admin-action and resolve-dispute)
-- writes, and it bypasses RLS entirely. Append-only, including for admins.

grant select on public.admin_activity_log to authenticated;
