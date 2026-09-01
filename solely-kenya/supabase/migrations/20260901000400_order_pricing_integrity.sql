-- ============================================================
-- ORDER PRICING INTEGRITY
-- ============================================================
-- Checkout.tsx inserts orders/order_items/payments directly from
-- the browser, computing total_ksh/subtotal_ksh/unit_price_ksh/
-- line_total_ksh client-side. The governing RLS (orders_insert_customer,
-- payments_insert) only checks auth.uid() = customer_id - never that
-- the amounts are real. intasend-initiate-payment then trusts
-- order.total_ksh as-is to start the real IntaSend checkout. A
-- logged-in buyer can edit these numbers in devtools and pay far
-- less than the real price for real products.
--
-- Fix: derive prices from the one thing a buyer can't fake - the
-- vendor-controlled products.price_ksh - via two triggers. Both
-- bypass immediately for service-role (the guest/payment-link
-- checkout path in intasend-initiate-payment already computes
-- correct prices server-side and runs under service-role, so it is
-- unaffected either way).
-- ============================================================

-- 1. order_items: always derive price from the real product row, never trust the client.
create or replace function public.enforce_order_item_pricing()
returns trigger
language plpgsql
as $$
declare
  real_price numeric(10,2);
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  select price_ksh into real_price from public.products where id = new.product_id;
  if real_price is null then
    raise exception 'Product % not found or has no price', new.product_id;
  end if;

  new.unit_price_ksh := real_price;
  new.line_total_ksh := real_price * new.quantity;
  return new;
end;
$$;

drop trigger if exists order_items_enforce_pricing on public.order_items;
create trigger order_items_enforce_pricing
before insert on public.order_items
for each row
execute function public.enforce_order_item_pricing();

-- 2. payments: block creating a payment whose amount doesn't match the order,
--    and whose order's total doesn't match the (now-trustworthy) sum of items.
create or replace function public.enforce_payment_amount()
returns trigger
language plpgsql
as $$
declare
  order_total numeric(12,2);
  order_subtotal numeric(12,2);
  order_shipping numeric(12,2);
  items_sum numeric(12,2);
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  select total_ksh, subtotal_ksh, coalesce(shipping_fee_ksh, 0)
    into order_total, order_subtotal, order_shipping
    from public.orders where id = new.order_id;

  if order_total is null then
    raise exception 'Order % not found', new.order_id;
  end if;

  select coalesce(sum(line_total_ksh), 0) into items_sum
    from public.order_items where order_id = new.order_id;

  if items_sum = 0 then
    raise exception 'Cannot create a payment for an order with no items';
  end if;
  if abs(items_sum - order_subtotal) > 1 then
    raise exception 'Order subtotal (%) does not match item prices (%)', order_subtotal, items_sum;
  end if;
  if abs((order_subtotal + order_shipping) - order_total) > 1 then
    raise exception 'Order total (%) does not match subtotal + shipping (%)', order_total, order_subtotal + order_shipping;
  end if;
  if abs(new.amount_ksh - order_total) > 1 then
    raise exception 'Payment amount (%) does not match order total (%)', new.amount_ksh, order_total;
  end if;

  return new;
end;
$$;

drop trigger if exists payments_enforce_amount on public.payments;
create trigger payments_enforce_amount
before insert on public.payments
for each row
execute function public.enforce_payment_amount();
