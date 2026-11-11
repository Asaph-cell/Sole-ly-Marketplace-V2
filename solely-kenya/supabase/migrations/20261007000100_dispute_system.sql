-- ============================================================
-- DISPUTE & DELIVERY RESOLUTION SYSTEM
-- ============================================================
-- Implements docs/DISPUTE_SYSTEM_SPEC.md. Every rule that moves money
-- or changes an order now runs server-side (order-action for user
-- actions, order-engine for timers), so clients can no longer change
-- an order's status directly.
--
-- Adds:
--   1. order_timers            - one row per running clock (ship, deliver,
--                                release, fix, return, buyer-unavailable...)
--   2. order_packing_checklists- what the vendor says is in the box
--   3. dispute_offers          - structured partial refund / replacement /
--                                refund-with-return offers
--   4. vendor_strikes          - 3 in a rolling 90 days suspends the vendor
--   5. vendor suspension       - profiles.suspended_at; hides listings,
--                                blocks new listings and new orders
--   6. buyer suspension        - account_bans 'suspended' blocks new orders
--   7. disputes columns        - category, stage, outcome, deadlines
--   8. platform settings       - every new time window, admin-editable
-- ============================================================

-- ------------------------------------------------------------
-- 1. ORDER TIMERS
-- ------------------------------------------------------------
create table public.order_timers (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  kind          text not null check (kind in (
                  'ship',              -- A1: accepted, not shipped yet
                  'deliver',           -- A4: shipped, not arrived yet
                  'release',           -- arrived, waiting for buyer
                  'checklist_hold',    -- buyer objected to the packing checklist
                  'vendor_response',   -- dispute opened, vendor hasn't answered
                  'negotiation',       -- offers exchanged, no agreement yet
                  'fix',               -- vendor fixing missing items / swap / replacement
                  'return_confirm',    -- buyer handed the item back
                  'buyer_unavailable'  -- B3 grace period
                )),
  status        text not null default 'active'
                  check (status in ('active', 'done', 'cancelled', 'escalated', 'fired')),
  started_at    timestamptz not null default now(),
  due_at        timestamptz not null,
  -- Next moment the engine has something to do (a reminder, or due_at).
  next_at       timestamptz not null,
  stage         int not null default 0,
  extensions    int not null default 0,
  meta          jsonb not null default '{}'::jsonb,
  resolved_at   timestamptz,
  created_at    timestamptz not null default now()
);

-- Only one live clock of each kind per order.
create unique index order_timers_one_active
  on public.order_timers(order_id, kind) where status = 'active';
create index order_timers_due on public.order_timers(next_at) where status = 'active';

alter table public.order_timers enable row level security;

-- Buyer, vendor and admins can see an order's clocks (the UI shows
-- "ship by 2:30pm"). Nobody writes from the client.
create policy "order_timers_select_participants"
  on public.order_timers for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_timers.order_id
        and (o.customer_id = auth.uid() or o.vendor_id = auth.uid())
    )
    or public.has_role(auth.uid(), 'admin'::app_role)
  );

-- ------------------------------------------------------------
-- 2. PACKING CHECKLIST
-- ------------------------------------------------------------
create table public.order_packing_checklists (
  order_id        uuid primary key references public.orders(id) on delete cascade,
  -- [{order_item_id, name, size, color, quantity}]
  items           jsonb not null,
  description     text not null,
  photo_path      text,
  confirmed_at    timestamptz not null default now(),
  buyer_status    text not null default 'pending'
                    check (buyer_status in ('pending', 'approved', 'objected', 'timed_out')),
  buyer_note      text,
  buyer_responded_at timestamptz,
  updated_at      timestamptz not null default now()
);

alter table public.order_packing_checklists enable row level security;

create policy "packing_checklists_select_participants"
  on public.order_packing_checklists for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_packing_checklists.order_id
        and (o.customer_id = auth.uid() or o.vendor_id = auth.uid())
    )
    or public.has_role(auth.uid(), 'admin'::app_role)
  );

-- ------------------------------------------------------------
-- 3. DISPUTE OFFERS
-- ------------------------------------------------------------
create table public.dispute_offers (
  id            uuid primary key default gen_random_uuid(),
  dispute_id    uuid not null references public.disputes(id) on delete cascade,
  made_by       text not null check (made_by in ('vendor', 'buyer')),
  kind          text not null check (kind in ('partial_refund', 'replacement', 'refund_with_return')),
  amount_ksh    numeric(12,2),
  note          text,
  status        text not null default 'pending'
                  check (status in ('pending', 'accepted', 'declined', 'withdrawn', 'expired')),
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  check (kind <> 'partial_refund' or (amount_ksh is not null and amount_ksh > 0))
);

create index dispute_offers_dispute on public.dispute_offers(dispute_id);
alter table public.dispute_offers enable row level security;

create policy "dispute_offers_select_participants"
  on public.dispute_offers for select
  using (
    exists (
      select 1 from public.disputes d
      where d.id = dispute_offers.dispute_id
        and (d.customer_id = auth.uid() or d.vendor_id = auth.uid())
    )
    or public.has_role(auth.uid(), 'admin'::app_role)
  );

-- ------------------------------------------------------------
-- 4. DISPUTE COLUMNS
-- ------------------------------------------------------------
-- dispute_type already exists with a check constraint; widen it to the
-- categories the new "Something wrong?" flow offers.
alter table public.disputes drop constraint if exists disputes_dispute_type_check;
alter table public.disputes add constraint disputes_dispute_type_check
  check (dispute_type in (
    'item_not_received', -- A1/A4/A12: never got it
    'not_as_advertised', -- A2
    'item_broken',       -- A3/A10: damaged, torn, not working
    'wrong_item',        -- A5/A8: wrong product, size, colour
    'missing_items',     -- A7
    'wrong_order',       -- A9: someone else's order
    'other'
  ));

alter table public.disputes
  add column if not exists stage text not null default 'negotiating'
    check (stage in (
      'negotiating',        -- buyer & vendor working it out
      'awaiting_fix',       -- vendor sending missing items / swap / replacement
      'fix_sent',           -- vendor says it's sent; buyer to confirm
      'awaiting_return',    -- vendor collecting the item
      'return_handed',      -- buyer says they handed it back
      'buyer_choice',       -- A7 fix window passed: refund missing items or accept
      'with_admin',         -- Solely decides
      'resolved'
    )),
  add column if not exists raised_by text not null default 'buyer'
    check (raised_by in ('buyer', 'vendor', 'system')),
  add column if not exists missing_item_ids uuid[],
  add column if not exists accepted_offer_id uuid references public.dispute_offers(id),
  add column if not exists escalated_at timestamptz,
  add column if not exists escalation_reason text,
  add column if not exists return_note text,
  add column if not exists return_handed_at timestamptz,
  -- Who the outcome favoured; feeds the abusive-buyer counter.
  add column if not exists outcome text
    check (outcome in ('buyer', 'vendor', 'split', 'none')),
  add column if not exists appeal_requested_at timestamptz,
  add column if not exists appeal_requested_by text check (appeal_requested_by in ('buyer', 'vendor'));

-- ------------------------------------------------------------
-- 5. VENDOR STRIKES & SUSPENSION
-- ------------------------------------------------------------
create table public.vendor_strikes (
  id          uuid primary key default gen_random_uuid(),
  vendor_id   uuid not null references public.profiles(id) on delete cascade,
  order_id    uuid references public.orders(id) on delete set null,
  reason      text not null check (reason in (
                'not_shipped',              -- A1: accepted, never shipped, went silent
                'not_delivered',            -- A4: shipped, went silent
                'false_buyer_unavailable',  -- B3 claim disproved by Solely's call
                'admin'                     -- added manually
              )),
  notes       text,
  created_at  timestamptz not null default now(),
  voided_at   timestamptz,
  voided_by   uuid references public.profiles(id),
  void_reason text
);

create index vendor_strikes_vendor on public.vendor_strikes(vendor_id, created_at desc);
alter table public.vendor_strikes enable row level security;

create policy "vendor_strikes_select_own_or_admin"
  on public.vendor_strikes for select
  using (vendor_id = auth.uid() or public.has_role(auth.uid(), 'admin'::app_role));

alter table public.profiles
  add column if not exists suspended_at timestamptz,
  add column if not exists suspension_reason text;

-- SECURITY DEFINER so RLS policies and triggers can ask "is this vendor
-- suspended?" without the caller needing to read other people's profiles.
create or replace function public.is_vendor_suspended(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = target and suspended_at is not null);
$$;

create or replace function public.is_buyer_suspended(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.account_bans
    where user_id = target and lifted_at is null
  );
$$;

grant execute on function public.is_vendor_suspended(uuid) to anon, authenticated;
grant execute on function public.is_buyer_suspended(uuid) to anon, authenticated;

-- Hide a suspended vendor's listings from everyone except the vendor and
-- admins. RESTRICTIVE, so it narrows every existing permissive SELECT
-- policy on products instead of being OR-ed with them.
create policy "products_hide_suspended_vendors"
  on public.products
  as restrictive
  for select
  using (
    vendor_id = auth.uid()
    or public.has_role(auth.uid(), 'admin'::app_role)
    or not public.is_vendor_suspended(vendor_id)
  );

-- Suspended vendors can't add listings or put one live.
create or replace function public.enforce_vendor_not_suspended_products()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  if public.is_vendor_suspended(new.vendor_id) then
    if tg_op = 'INSERT' then
      raise exception 'Your shop is suspended, so you can''t add new listings. Contact Solely support.';
    end if;
    if new.status = 'active' and old.status is distinct from 'active' then
      raise exception 'Your shop is suspended, so listings can''t go live. Contact Solely support.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists products_vendor_not_suspended on public.products;
create trigger products_vendor_not_suspended
before insert or update on public.products
for each row
execute function public.enforce_vendor_not_suspended_products();

-- account_bans: add a reversible 'suspended' type for abusive buyers.
alter table public.account_bans drop constraint if exists account_bans_ban_type_check;
alter table public.account_bans add constraint account_bans_ban_type_check
  check (ban_type in ('shadowban', 'permanent', 'suspended'));

-- ------------------------------------------------------------
-- 6. ORDERS: block sales to/from suspended accounts, and lock status
-- ------------------------------------------------------------
-- Extends enforce_order_insert_rules (20260929000100). New orders can't
-- be placed with a suspended vendor or by a suspended buyer.
create or replace function public.enforce_order_insert_rules()
returns trigger
language plpgsql
as $$
declare
  rate numeric;
begin
  if public.is_vendor_suspended(new.vendor_id) then
    raise exception 'This shop is not taking orders right now.';
  end if;
  if new.customer_id is not null and public.is_buyer_suspended(new.customer_id) then
    raise exception 'Your account is suspended. Contact Solely support.';
  end if;

  if auth.role() = 'service_role' then
    return new;
  end if;

  if coalesce(new.shipping_fee_ksh, 0) < 0 then
    raise exception 'Delivery fee cannot be negative';
  end if;
  if new.subtotal_ksh is null or new.subtotal_ksh <= 0 then
    raise exception 'Order subtotal must be positive';
  end if;

  select (value #>> '{}')::numeric into rate
    from public.platform_settings
   where key = 'commission_rate_percent';
  rate := coalesce(rate, 6);

  new.status            := 'pending_payment';
  new.commission_rate   := rate;
  new.commission_amount := round(new.subtotal_ksh * rate / 100, 2);
  new.payout_amount     := round(new.total_ksh - new.commission_amount, 2);
  new.payment_link_id   := null;

  -- Lifecycle columns are set later by the vendor flow or edge functions.
  new.accepted_at              := null;
  new.auto_release_at          := null;
  new.cancelled_at             := null;
  new.completed_at             := null;
  new.confirmed_at             := null;
  new.delivered_at             := null;
  new.shipped_at               := null;
  new.delivery_otp             := null;
  new.otp_generated_at         := null;
  new.otp_verified_at          := null;
  new.package_pin              := null;
  new.package_pin_generated_at := null;
  new.package_pin_entered_at   := null;
  new.payout_transferred_at    := null;
  new.dispute_id               := null;
  new.pre_dispute_status       := null;
  new.buyer_confirmed          := false;
  new.vendor_confirmed         := false;

  return new;
end;
$$;

-- Extends enforce_order_update_rules (20260902000500). Order status now
-- only ever changes server-side: accepting, shipping, arriving,
-- confirming, cancelling and disputing all go through order-action so
-- the matching timers, refunds and notifications can't be skipped.
create or replace function public.enforce_order_update_rules()
returns trigger
language plpgsql
as $$
declare
  actor uuid := auth.uid();
  is_customer boolean;
  is_vendor boolean;
  changed_keys text[];
  allowed_keys text[];
  disallowed text[];
begin
  -- Service-role (all internal edge functions) - completely unrestricted.
  -- BYPASSRLS does not exempt triggers, so this check is required.
  if auth.role() = 'service_role' then
    if new.status = 'disputed' and old.status is distinct from 'disputed' then
      new.pre_dispute_status := old.status;
    end if;
    return new;
  end if;

  is_customer := actor is not null and actor = old.customer_id;
  is_vendor   := actor is not null and actor = old.vendor_id;

  if not (is_customer or is_vendor) then
    -- Should be unreachable (RLS's USING clause already restricts row
    -- visibility to customer_id/vendor_id), kept as defense-in-depth.
    raise exception 'Not authorized to update this order';
  end if;

  if new.status is distinct from old.status then
    raise exception 'Order status can only be changed through Solely (attempted % -> %)', old.status, new.status;
  end if;

  select array_agg(n.key) into changed_keys
  from jsonb_each(to_jsonb(new)) n(key, value)
  join jsonb_each(to_jsonb(old)) o(key, value) using (key)
  where n.value is distinct from o.value;

  allowed_keys := array['updated_at'];

  if changed_keys is not null then
    select array_agg(k) into disallowed
    from unnest(changed_keys) k
    where k <> all(allowed_keys);

    if disallowed is not null and array_length(disallowed, 1) > 0 then
      raise exception 'Not allowed to modify: %', array_to_string(disallowed, ', ');
    end if;
  end if;

  return new;
end;
$$;

-- Running total refunded to the buyer. Partial refunds (missing items, an
-- agreed partial-refund offer) leave the order open, and the vendor's
-- eventual payout is computed from what's left - so the two can never
-- add up to more than the buyer paid.
alter table public.orders
  add column if not exists refunded_ksh numeric(12,2) not null default 0
    check (refunded_ksh >= 0);

-- ------------------------------------------------------------
-- 7. CHAT: order updates posted into the buyer-vendor conversation
-- ------------------------------------------------------------
alter table public.messages drop constraint if exists messages_message_type_check;
alter table public.messages add constraint messages_message_type_check
  check (message_type in (
    'text', 'image', 'delivery_proposal', 'delivery_accepted', 'delivery_rejected', 'system',
    'order_update'  -- packing checklist, vendor delivery updates, Solely notices
  ));

-- ------------------------------------------------------------
-- 8. SETTINGS
-- ------------------------------------------------------------
insert into public.platform_settings (key, value, description) values
  ('ship_first_reminder_hours', '1', 'A1: hours after acceptance before the first "ship this order" email.'),
  ('ship_expected_hours', '3', 'A1: hours after acceptance shipping is expected (second reminder).'),
  ('ship_deadline_hours', '8', 'A1: hours after acceptance before the buyer is refunded and the vendor gets a strike.'),
  ('ship_extension_hours', '3', 'A1: hours added each time the vendor sends an update.'),
  ('ship_max_extensions', '2', 'A1: updates allowed before the order goes to admin.'),
  ('night_pause_start', '"18:00"', 'Vendor clocks and the payment-release window pause from this time (Kenya time).'),
  ('night_pause_end', '"07:00"', 'Vendor clocks and the payment-release window resume at this time (Kenya time).'),
  ('support_hours', '"08:00-17:00"', 'Solely support hours (Kenya time), shown to vendors on "buyer unavailable".'),
  ('deliver_same_town_hours', '24', 'A4: delivery window when vendor and buyer are in the same town.'),
  ('deliver_same_county_hours', '24', 'A4: delivery window within the same county.'),
  ('deliver_other_county_hours', '48', 'A4: delivery window to a different county.'),
  ('deliver_far_hours', '72', 'A4: delivery window to the coast or border counties.'),
  ('deliver_east_africa_hours', '240', 'A4: delivery window outside Kenya, within East Africa.'),
  ('far_counties', '["Mombasa","Kwale","Kilifi","Tana River","Lamu","Taita Taveta","Mandera","Wajir","Garissa","Marsabit","Turkana","West Pokot","Isiolo","Samburu"]', 'A4: counties that get the long (coast/border) delivery window.'),
  ('deliver_checkin_hours', '[6, 2]', 'A4: hours before the deadline when the vendor is asked where the goods are.'),
  ('deliver_extension_hours', '24', 'A4: hours added each time the vendor sends an update.'),
  ('deliver_max_extensions', '3', 'A4: updates allowed before the order goes to admin.'),
  ('release_window_hours', '6', 'Hours after "arrived" before payment auto-releases to the vendor (night pause applies).'),
  ('release_second_prompt_hours', '2', 'Hours before release when the buyer is asked a second time.'),
  ('checklist_hold_hours', '2', 'Hours a buyer objection blocks shipping before it lifts on its own.'),
  ('vendor_response_hours', '48', 'Hours a vendor has to respond to a quality dispute before the buyer is refunded.'),
  ('negotiation_hours', '48', 'Hours buyer and vendor have to agree before the dispute goes to admin.'),
  ('missing_items_fix_hours', '36', 'A7: hours for the vendor to send missing items.'),
  ('wrong_order_fix_hours', '24', 'A9: hours for the vendor to swap a mixed-up order.'),
  ('replacement_fix_hours', '48', 'Hours for the vendor to send an agreed replacement.'),
  ('return_confirm_hours', '48', 'Hours a vendor has to confirm a returned item before the buyer is refunded.'),
  ('buyer_unavailable_grace_hours', '12', 'B3: hours a buyer has to respond after the vendor reports them unavailable.'),
  ('appeal_window_hours', '48', 'Hours either party has to ask Solely to review an automatic decision.'),
  ('strike_window_days', '90', 'Rolling window for counting vendor strikes.'),
  ('strikes_to_suspend', '3', 'Strikes within the window that suspend a vendor.'),
  ('buyer_lost_disputes_flag', '3', 'Lost disputes within the strike window that flag a buyer to admin.'),
  ('buyer_lost_disputes_suspend', '5', 'Lost disputes within the strike window that suspend a buyer.')
on conflict (key) do nothing;

-- pin_release_hours is replaced by release_window_hours (the Package PIN is gone).
delete from public.platform_settings where key = 'pin_release_hours';

-- ------------------------------------------------------------
-- 9. ADMIN ACTIVITY LOG: new action types
-- ------------------------------------------------------------
alter table public.admin_activity_log drop constraint admin_activity_log_action_type_check;
alter table public.admin_activity_log add constraint admin_activity_log_action_type_check
  check (action_type in (
    'pause_product','restore_product','delete_product',
    'penalize_vendor','revoke_vendor','restore_vendor',
    'resolve_dispute_release','resolve_dispute_refund',
    'resolve_dispute_partial_refund','resolve_dispute_close',
    'update_platform_setting','promote_to_admin','revoke_admin',
    'add_strike','void_strike','suspend_vendor','unsuspend_vendor',
    'suspend_buyer','unsuspend_buyer','reject_buyer_unavailable'
  ));

alter table public.admin_activity_log drop constraint admin_activity_log_target_type_check;
alter table public.admin_activity_log add constraint admin_activity_log_target_type_check
  check (target_type in ('product','vendor','dispute','setting','user','buyer','order'));

-- ------------------------------------------------------------
-- 10. BACKFILL: clocks for orders already in flight
-- ------------------------------------------------------------
-- Orders mid-way when this ships get a fair, generous clock starting now
-- (no reminders) so nothing is refunded or released the moment the
-- engine first runs. Pickup orders get none, as before.
create function public.order_is_pickup(target uuid) returns boolean
language sql stable as $$
  select exists (select 1 from public.order_shipping_details where order_id = target and delivery_type = 'pickup');
$$;

insert into public.order_timers (order_id, kind, due_at, next_at, meta)
select o.id, 'ship', now() + interval '8 hours', now() + interval '8 hours', '{"backfilled": true}'::jsonb
from public.orders o
where o.status = 'accepted' and not public.order_is_pickup(o.id);

insert into public.order_timers (order_id, kind, due_at, next_at, meta)
select o.id, 'deliver', d.due, d.due, '{"backfilled": true}'::jsonb
from public.orders o
cross join lateral (
  select greatest(coalesce(o.shipped_at, now()) + interval '48 hours', now() + interval '24 hours') as due
) d
where o.status = 'shipped' and not public.order_is_pickup(o.id);

insert into public.order_timers (order_id, kind, due_at, next_at, meta)
select o.id, 'release', now() + interval '6 hours', now() + interval '6 hours', '{"backfilled": true}'::jsonb
from public.orders o
where o.status in ('arrived', 'delivered') and not public.order_is_pickup(o.id);

drop function public.order_is_pickup(uuid);

notify pgrst, 'reload schema';
