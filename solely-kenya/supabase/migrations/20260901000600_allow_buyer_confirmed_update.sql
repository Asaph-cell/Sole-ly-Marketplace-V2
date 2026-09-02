-- ============================================================
-- FIX enforce_order_update_rules: allow customers to set buyer_confirmed
-- ============================================================
-- 20260901000200_orders_update_guardrails.sql locked the customer actor
-- down to only ['status', 'updated_at']. That missed a real, live write:
-- OrderConfirmationModal.tsx sets `buyer_confirmed = true` directly from
-- the browser when a buyer confirms receipt and leaves a review. Since
-- then, that update has been silently rejected by this trigger (caught
-- and only console.warn'd client-side), so buyer_confirmed never actually
-- flips to true and the "confirm delivery" button/badge never clears for
-- buyers who already confirmed.
--
-- This does not weaken anything: buyer_confirmed is a one-way,
-- informational flag (it does not gate escrow release, which runs off
-- auto_release_at / the OTP flow), so allowing the order's own customer
-- to set it is safe.
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
    allowed_keys := array['status', 'buyer_confirmed', 'updated_at'];

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
