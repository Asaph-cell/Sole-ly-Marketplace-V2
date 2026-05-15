-- Commission & Escrow marketplace schema

-- 0. Cleanup legacy structures -----------------------------------------

drop table if exists commission_ledger cascade;
drop table if exists disputes cascade;
drop table if exists payouts cascade;
drop table if exists escrow_transactions cascade;
drop table if exists payments cascade;
drop table if exists order_shipping_details cascade;
drop table if exists order_items cascade;
drop table if exists orders cascade;
drop table if exists messages cascade;

drop type if exists dispute_reason;
drop type if exists dispute_status;
drop type if exists payout_method;
drop type if exists payout_status;
drop type if exists escrow_status;
drop type if exists payment_status;
drop type if exists payment_gateway;
drop type if exists order_status;

-- 1. Enums --------------------------------------------------------------

create type order_status as enum (
  'pending_vendor_confirmation',
  'accepted',
  'shipped',
  'delivered',
  'completed',
  'disputed',
  'cancelled_by_vendor',
  'cancelled_by_customer',
  'refunded'
);

create type payment_gateway as enum ('mpesa', 'card', 'paypal', 'flutterwave');

create type payment_status as enum ('pending', 'authorized', 'captured', 'refunded', 'chargeback');

create type escrow_status as enum ('held', 'released', 'refunded', 'withheld');

create type payout_status as enum ('pending', 'processing', 'paid', 'failed');

create type payout_method as enum ('mpesa', 'bank');

create type dispute_status as enum ('open', 'under_review', 'resolved_refund', 'resolved_release', 'closed');

create type dispute_reason as enum ('no_delivery', 'wrong_item', 'damaged', 'other');

-- 2. Tables -------------------------------------------------------------

create table orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  vendor_id uuid not null references profiles(id) on delete cascade,
  status order_status not null default 'pending_vendor_confirmation',
  subtotal_ksh numeric(12,2) not null,
  shipping_fee_ksh numeric(12,2) default 0,
  total_ksh numeric(12,2) not null,
  commission_rate numeric(5,2) not null default 10.00,
  commission_amount numeric(12,2) not null,
  payout_amount numeric(12,2) not null,
  auto_release_at timestamptz,
  accepted_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  buyer_confirmed boolean not null default false,
  vendor_confirmed boolean not null default false,
  dispute_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  product_name text not null,
  product_snapshot jsonb not null,
  quantity integer not null check (quantity > 0),
  unit_price_ksh numeric(10,2) not null,
  line_total_ksh numeric(12,2) not null
);

create table order_shipping_details (
  order_id uuid primary key references orders(id) on delete cascade,
  recipient_name text not null,
  phone text not null,
  email text,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  county text,
  postal_code text,
  country text not null default 'Kenya',
  delivery_notes text,
  courier_name text,
  tracking_number text,
  shipment_proof_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  gateway payment_gateway not null,
  status payment_status not null default 'pending',
  transaction_reference text,
  amount_ksh numeric(12,2) not null,
  currency text not null default 'KES',
  metadata jsonb,
  captured_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now()
);

create table escrow_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  payment_id uuid not null references payments(id) on delete cascade,
  status escrow_status not null default 'held',
  held_amount numeric(12,2) not null,
  commission_amount numeric(12,2) not null,
  release_amount numeric(12,2) not null,
  released_at timestamptz,
  refunded_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table payouts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  vendor_id uuid not null references profiles(id) on delete cascade,
  status payout_status not null default 'pending',
  method payout_method not null,
  amount_ksh numeric(12,2) not null,
  commission_amount numeric(12,2) not null,
  requested_at timestamptz not null default now(),
  processing_at timestamptz,
  paid_at timestamptz,
  failed_at timestamptz,
  reference text,
  failure_reason text
);

create table disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid unique not null references orders(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  vendor_id uuid not null references profiles(id) on delete cascade,
  status dispute_status not null default 'open',
  reason dispute_reason not null,
  description text,
  evidence_urls text[],
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution_notes text,
  resolved_by uuid references auth.users(id)
);

create table commission_ledger (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  vendor_id uuid not null references profiles(id) on delete cascade,
  commission_rate numeric(5,2) not null,
  commission_amount numeric(12,2) not null,
  recorded_at timestamptz not null default now(),
  notes text
);

-- 3. Indexes ------------------------------------------------------------

create index orders_customer_idx on orders(customer_id);
create index orders_vendor_idx on orders(vendor_id);
create index orders_status_idx on orders(status);
create index orders_auto_release_idx on orders(auto_release_at) where auto_release_at is not null;

create index payments_order_idx on payments(order_id);
create index payments_status_idx on payments(status);

create index escrow_order_idx on escrow_transactions(order_id);
create index escrow_status_idx on escrow_transactions(status);

create index payouts_vendor_idx on payouts(vendor_id);
create index payouts_status_idx on payouts(status);

create index disputes_vendor_idx on disputes(vendor_id);
create index disputes_status_idx on disputes(status);

create index commission_vendor_idx on commission_ledger(vendor_id);

-- 4. Triggers -----------------------------------------------------------

create trigger orders_updated_at
before update on orders
for each row
execute procedure public.handle_updated_at();

create trigger order_shipping_details_updated_at
before update on order_shipping_details
for each row
execute procedure public.handle_updated_at();


-- 5. RLS ---------------------------------------------------------------

alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_shipping_details enable row level security;
alter table payments enable row level security;
alter table escrow_transactions enable row level security;
alter table payouts enable row level security;
alter table disputes enable row level security;
alter table commission_ledger enable row level security;

-- Orders policies

create policy "orders_select" on orders
  for select using (
    auth.uid() = customer_id
    or auth.uid() = vendor_id
    or has_role(auth.uid(), 'admin')
  );

create policy "orders_update_customer" on orders
  for update using (auth.uid() = customer_id)
  with check (auth.uid() = customer_id);

create policy "orders_update_vendor" on orders
  for update using (auth.uid() = vendor_id)
  with check (auth.uid() = vendor_id);

-- Order items policies

create policy "order_items_select" on order_items
  for select using (
    exists (
      select 1 from orders o
      where o.id = order_id
        and (auth.uid() = o.customer_id or auth.uid() = o.vendor_id or has_role(auth.uid(), 'admin'))
    )
  );

-- Shipping details policies

create policy "order_shipping_select" on order_shipping_details
  for select using (
    exists (
      select 1 from orders o
      where o.id = order_id
        and (auth.uid() = o.customer_id or auth.uid() = o.vendor_id or has_role(auth.uid(), 'admin'))
    )
  );

create policy "order_shipping_update_vendor" on order_shipping_details
  for update using (
    exists (
      select 1 from orders o
      where o.id = order_id and auth.uid() = o.vendor_id
    )
  ) with check (
    exists (
      select 1 from orders o
      where o.id = order_id and auth.uid() = o.vendor_id
    )
  );

-- Payments & escrow policies

create policy "payments_select" on payments
  for select using (
    exists (
      select 1 from orders o
      where o.id = order_id
        and (auth.uid() = o.customer_id or auth.uid() = o.vendor_id or has_role(auth.uid(), 'admin'))
    )
  );

create policy "escrow_select" on escrow_transactions
  for select using (
    exists (
      select 1 from orders o
      where o.id = order_id
        and (auth.uid() = o.customer_id or auth.uid() = o.vendor_id or has_role(auth.uid(), 'admin'))
    )
  );

-- Payouts

create policy "payouts_select_vendor" on payouts
  for select using (auth.uid() = vendor_id or has_role(auth.uid(), 'admin'));

-- Disputes

create policy "disputes_select" on disputes
  for select using (
    auth.uid() = customer_id
    or auth.uid() = vendor_id
    or has_role(auth.uid(), 'admin')
  );

create policy "disputes_insert_customer" on disputes
  for insert with check (auth.uid() = customer_id);

create policy "disputes_update_admin" on disputes
  for update using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));

-- Commission ledger (viewable by vendor & admin)

create policy "commission_select" on commission_ledger
  for select using (auth.uid() = vendor_id or has_role(auth.uid(), 'admin'));


