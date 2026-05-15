-- Add 'pending_payment' status to order_status enum
-- This status is used when an order is created but payment hasn't been confirmed yet

ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'pending_payment';

-- Must commit before using the new enum value in the same session
COMMIT;

-- Update the default status for new orders to pending_payment
ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'pending_payment';

