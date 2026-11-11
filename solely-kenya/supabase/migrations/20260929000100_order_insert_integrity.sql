-- ============================================================
-- ORDER INSERT INTEGRITY
-- ============================================================
-- Checkout.tsx and DeliveryNegotiation.tsx insert orders straight
-- from the browser, and orders_insert_customer only checks
-- auth.uid() = customer_id. Nothing stopped a buyer from inserting
-- an order that was already 'delivered', with a past auto_release_at,
-- vendor_id pointing at their own shop and any payout_amount - and
-- escrow_insert let them add a matching 'held' escrow row.
-- auto-release-escrow would then complete it and
-- transfer-to-vendor-wallet would pay payout_amount out of the
-- settlement wallet with no payment ever made.
--
-- order_pricing_integrity (20260901000400) already makes item prices
-- and order totals honest before a payment row can exist. This closes
-- the rest:
--   1. New client orders always start as pending_payment with every
--      lifecycle column cleared, and commission/payout are computed
--      here from platform_settings - never taken from the browser.
--   2. Every order item must belong to the order's vendor, so a buyer
--      can't route a real vendor's sale to their own wallet.
--   3. Clients can no longer create escrow rows at all. No client code
--      does; escrow is created server-side under service-role.
--
-- Service-role (edge functions) bypasses all of this, same as the
-- existing guardrail triggers.
-- ============================================================

-- 1. orders: server decides status and money split on client inserts.
create or replace function public.enforce_order_insert_rules()
returns trigger
language plpgsql
as $$
declare
  rate numeric;
begin
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

drop trigger if exists orders_enforce_insert_rules on public.orders;
create trigger orders_enforce_insert_rules
before insert on public.orders
for each row
execute function public.enforce_order_insert_rules();

-- 2. order_items: the product must belong to the order's vendor.
create or replace function public.enforce_order_item_vendor()
returns trigger
language plpgsql
as $$
declare
  product_vendor uuid;
  order_vendor uuid;
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  select vendor_id into product_vendor from public.products where id = new.product_id;
  select vendor_id into order_vendor from public.orders where id = new.order_id;

  if product_vendor is null or order_vendor is null or product_vendor <> order_vendor then
    raise exception 'Order item does not belong to this order''s vendor';
  end if;

  return new;
end;
$$;

drop trigger if exists order_items_enforce_vendor on public.order_items;
create trigger order_items_enforce_vendor
before insert on public.order_items
for each row
execute function public.enforce_order_item_vendor();

-- 3. escrow: clients never create escrow rows.
drop policy if exists "escrow_insert" on public.escrow_transactions;
