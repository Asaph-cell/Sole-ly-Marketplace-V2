-- Add refunded_at timestamp to payments table for tracking refund processing
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

-- Add refunded_at timestamp to escrow_transactions table
ALTER TABLE public.escrow_transactions ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;
