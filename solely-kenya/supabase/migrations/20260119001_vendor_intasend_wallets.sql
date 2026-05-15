-- Add IntaSend Wallet ID columns for vendor wallet architecture
-- Each vendor will have their own IntaSend wallet for receiving payments

-- Add wallet ID to vendor_balances
ALTER TABLE vendor_balances 
  ADD COLUMN IF NOT EXISTS intasend_wallet_id TEXT,
  ADD COLUMN IF NOT EXISTS wallet_created_at TIMESTAMPTZ;

-- Add wallet ID to profiles for quick access
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS intasend_wallet_id TEXT;

-- Create index for wallet lookups
CREATE INDEX IF NOT EXISTS idx_vendor_balances_wallet ON vendor_balances(intasend_wallet_id);
CREATE INDEX IF NOT EXISTS idx_profiles_wallet ON profiles(intasend_wallet_id);

COMMENT ON COLUMN vendor_balances.intasend_wallet_id IS 'IntaSend wallet ID for this vendor';
COMMENT ON COLUMN profiles.intasend_wallet_id IS 'IntaSend wallet ID for vendor payouts';
