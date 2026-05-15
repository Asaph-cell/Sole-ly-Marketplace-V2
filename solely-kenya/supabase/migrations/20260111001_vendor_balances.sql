-- Vendor Balance Tracking for Automated Payouts
-- This migration creates the vendor_balances table and updates the payouts table

-- Create vendor_balances table
CREATE TABLE IF NOT EXISTS vendor_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  pending_balance DECIMAL(10, 2) DEFAULT 0 CHECK (pending_balance >= 0),
  total_earned DECIMAL(10, 2) DEFAULT 0,
  total_paid_out DECIMAL(10, 2) DEFAULT 0,
  last_payout_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_vendor_balances_vendor ON vendor_balances(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_balances_pending ON vendor_balances(pending_balance);

-- Update payouts table with new columns
ALTER TABLE payouts 
  ADD COLUMN IF NOT EXISTS trigger_type TEXT DEFAULT 'automatic' CHECK (trigger_type IN ('automatic', 'manual')),
  ADD COLUMN IF NOT EXISTS balance_before DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS fee_paid_by TEXT DEFAULT 'platform' CHECK (fee_paid_by IN ('platform', 'vendor'));

-- Initialize vendor_balances for existing vendors
INSERT INTO vendor_balances (vendor_id, pending_balance, total_earned)
SELECT 
  id,
  0,
  0
FROM profiles
WHERE store_name IS NOT NULL
ON CONFLICT (vendor_id) DO NOTHING;

-- Function to update vendor balance when order completes
CREATE OR REPLACE FUNCTION add_to_vendor_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- When order is completed, add to vendor's pending balance
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    INSERT INTO vendor_balances (vendor_id, pending_balance, total_earned)
    VALUES (
      NEW.vendor_id, 
      NEW.payout_amount,
      NEW.payout_amount
    )
    ON CONFLICT (vendor_id) 
    DO UPDATE SET 
      pending_balance = vendor_balances.pending_balance + EXCLUDED.pending_balance,
      total_earned = vendor_balances.total_earned + EXCLUDED.total_earned,
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on orders completion
DROP TRIGGER IF EXISTS order_completed_balance_trigger ON orders;
CREATE TRIGGER order_completed_balance_trigger
AFTER UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION add_to_vendor_balance();

-- Enable RLS on vendor_balances
ALTER TABLE vendor_balances ENABLE ROW LEVEL SECURITY;

-- Policy: Vendors can view their own balance
CREATE POLICY vendor_balances_select_own ON vendor_balances
  FOR SELECT
  USING (
    vendor_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: Only system/admin can update balances
CREATE POLICY vendor_balances_update_system ON vendor_balances
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

COMMENT ON TABLE vendor_balances IS 'Tracks vendor earnings and pending payout balances';
COMMENT ON COLUMN vendor_balances.pending_balance IS 'Current balance waiting to be paid out';
COMMENT ON COLUMN vendor_balances.total_earned IS 'Lifetime earnings from all completed orders';
COMMENT ON COLUMN vendor_balances.total_paid_out IS 'Total amount paid out to vendor';
