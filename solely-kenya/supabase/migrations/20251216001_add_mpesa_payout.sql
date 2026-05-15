-- Add M-Pesa number field for vendor payouts
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS mpesa_number TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.mpesa_number IS 'Vendor M-Pesa number for receiving payouts (required for vendors)';

-- Create index for faster payout processing
CREATE INDEX IF NOT EXISTS idx_profiles_mpesa_number ON public.profiles(mpesa_number) WHERE mpesa_number IS NOT NULL;
