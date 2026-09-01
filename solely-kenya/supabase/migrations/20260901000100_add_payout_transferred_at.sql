-- Idempotency guard for transfer-to-vendor-wallet: ensures a given order's
-- vendor payout can never be transferred to IntaSend more than once, even if
-- the function is called twice for the same order (retry, double-invoke, etc).
alter table public.orders
  add column if not exists payout_transferred_at timestamptz;

comment on column public.orders.payout_transferred_at is
  'Set the instant transfer-to-vendor-wallet successfully claims this order for payout. NULL means not yet transferred (or a previous attempt failed and was rolled back). Used as an atomic idempotency guard so the same order can never be transferred to IntaSend twice.';
