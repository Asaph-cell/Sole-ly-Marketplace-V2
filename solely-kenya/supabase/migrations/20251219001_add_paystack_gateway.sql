-- Add Paystack to payment gateway enum
-- This migration adds 'paystack' as a valid payment gateway option

DO $$
BEGIN
  -- Check if 'paystack' already exists in the enum
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumtypid = 'payment_gateway'::regtype 
    AND enumlabel = 'paystack'
  ) THEN
    ALTER TYPE payment_gateway ADD VALUE 'paystack';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    -- Already exists, ignore
    NULL;
END $$;
