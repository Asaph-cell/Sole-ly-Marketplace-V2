-- ============================================================
-- ORDERS UPDATE GUARDRAILS
-- ============================================================
-- orders_update_customer / orders_update_vendor RLS policies only
-- check row ownership (auth.uid() = customer_id / vendor_id) - they
-- never restrict which COLUMNS or which STATUS VALUES may be set.
-- Confirmed exploitable today: Orders.tsx already does a raw
-- client-side `.update({status: "disputed"})` relying solely on
-- this policy, proving direct client updates are live, not just
-- theoretical.
--
-- Postgres RLS can't diff OLD vs NEW column values within a single
-- USING/WITH CHECK expression, so this uses a BEFORE UPDATE trigger
-- instead - the standard tool for this kind of rule.
--
-- Verified exact legitimate direct-from-client transitions (nothing
-- else exists in the live code):
--   customer: status -> 'disputed' only
--   vendor:   pending_vendor_confirmation -> accepted
--             {pending_vendor_confirmation, accepted} -> cancelled_by_vendor
--             accepted -> shipped
--             accepted -> arrived
--             shipped -> arrived
--             (alongside companion columns accepted_at, cancelled_at,
--              shipped_at, vendor_confirmed, auto_release_at)
-- Every other transition and every financial/ownership column
-- (total_ksh, payout_amount, commission_amount, vendor_id,
-- customer_id) is set only by edge functions using the service-role
-- key, which bypasses RLS but NOT triggers - hence the explicit
-- auth.role() = 'service_role' bypass below, which is required, not
-- redundant.
-- ============================================================

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
    return new;
  end if;

  is_customer := actor is not null and actor = old.customer_id;
  is_vendor   := actor is not null and actor = old.vendor_id;

  -- Which columns actually changed value in this UPDATE?
  select array_agg(n.key) into changed_keys
  from jsonb_each(to_jsonb(new)) n(key, value)
  join jsonb_each(to_jsonb(old)) o(key, value) using (key)
  where n.value is distinct from o.value;

  if is_customer then
    if new.status is distinct from old.status then
      if not (old.status <> 'disputed' and new.status = 'disputed') then
        raise exception 'Customers may only move an order to disputed status (attempted % -> %)', old.status, new.status;
      end if;
    end if;
    allowed_keys := array['status', 'updated_at'];

  elsif is_vendor then
    if new.status is distinct from old.status then
      if not (
        (old.status = 'pending_vendor_confirmation' and new.status = 'accepted')
        or (old.status in ('pending_vendor_confirmation', 'accepted') and new.status = 'cancelled_by_vendor')
        or (old.status = 'accepted' and new.status = 'shipped')
        or (old.status = 'accepted' and new.status = 'arrived')
        or (old.status = 'shipped' and new.status = 'arrived')
      ) then
        raise exception 'Vendor may not move order from % to %', old.status, new.status;
      end if;
    end if;
    allowed_keys := array['status', 'accepted_at', 'cancelled_at', 'shipped_at', 'vendor_confirmed', 'auto_release_at', 'updated_at'];

  else
    -- Should be unreachable (RLS's USING clause already restricts row
    -- visibility to customer_id/vendor_id), kept as defense-in-depth.
    raise exception 'Not authorized to update this order';
  end if;

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

drop trigger if exists orders_enforce_update_rules on public.orders;
create trigger orders_enforce_update_rules
before update on public.orders
for each row
execute function public.enforce_order_update_rules();
