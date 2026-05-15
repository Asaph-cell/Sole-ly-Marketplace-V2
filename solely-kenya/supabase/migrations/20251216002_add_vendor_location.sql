-- Add vendor location fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS vendor_city TEXT,
ADD COLUMN IF NOT EXISTS vendor_county TEXT,
ADD COLUMN IF NOT EXISTS vendor_address_line1 TEXT,
ADD COLUMN IF NOT EXISTS vendor_address_line2 TEXT,
ADD COLUMN IF NOT EXISTS vendor_postal_code TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.vendor_city IS 'Vendor''s city/town for delivery fee calculation';
COMMENT ON COLUMN public.profiles.vendor_county IS 'Vendor''s county for metro area detection';
COMMENT ON COLUMN public.profiles.vendor_address_line1 IS 'Vendor''s primary address';
COMMENT ON COLUMN public.profiles.vendor_address_line2 IS 'Vendor''s secondary address (optional)';
COMMENT ON COLUMN public.profiles.vendor_postal_code IS 'Vendor''s postal code (optional)';

-- Create index for faster delivery fee lookup by county
CREATE INDEX IF NOT EXISTS idx_profiles_vendor_county ON public.profiles(vendor_county);
CREATE INDEX IF NOT EXISTS idx_profiles_vendor_city ON public.profiles(vendor_city);
