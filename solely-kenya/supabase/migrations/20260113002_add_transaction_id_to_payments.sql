-- Add transaction_id column to payments table
-- This is required by the intasend-webhook to store IntaSend's invoice_id

ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS transaction_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON public.payments(transaction_id);
