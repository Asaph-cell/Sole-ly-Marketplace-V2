-- ============================================================
-- pre_dispute_status: snapshot the order's status before a dispute
-- ============================================================
-- Orders.tsx/OrderConfirmationModal file a dispute with a raw
-- `.update({status: 'disputed'})` and there has never been anywhere that
-- captures what the status was immediately beforehand. Without that
-- snapshot, a "Close/Dismiss" dispute resolution has no order state to
-- restore to - it would either have to leave the order stuck at
-- 'disputed' forever, or always pay the vendor (identical to "release"),
-- neither of which is what "dismiss" should mean.
--
-- This adds the column and extends enforce_order_update_rules (from
-- 20260901000200_orders_update_guardrails.sql, already patched once in
-- 20260901000600_allow_buyer_confirmed_update.sql) to auto-capture it.
--
-- Ordering matters: the snapshot is applied AFTER changed_keys is
-- computed and validated against each actor's allowed_keys, and after
-- the service-role early return. That means:
--   - it can never be spoofed by a client (it's not in anyone's
--     allowed_keys, and the diff used for validation is captured before
--     this runs, so setting it doesn't itself trip the "not allowed to
--     modify" check)
--   - it still fires for every path that can set status='disputed',
--     including a future service-role caller, since it's applied right
--     before every return.
-- ============================================================

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pre_dispute_status public.order_status;

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

  -- Which columns actually changed value in this UPDATE? Computed BEFORE
  -- the pre_dispute_status auto-snapshot below, so validation only ever
  -- sees what the client itself tried to change.
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

  -- Server-computed snapshot, applied only after all validation above has
  -- passed - see ordering note in the header comment.
  if new.status = 'disputed' and old.status is distinct from 'disputed' then
    new.pre_dispute_status := old.status;
  end if;

  return new;
end;
$$;
