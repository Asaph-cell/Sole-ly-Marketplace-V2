-- Create store-logos storage bucket with proper RLS policies
-- This bucket stores all vendor store profile pictures

-- Create the bucket if it doesn't exist (PUBLIC so images can be displayed)
INSERT INTO storage.buckets (id, name, public)
VALUES ('store-logos', 'store-logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow authenticated vendors to upload logos
CREATE POLICY "Vendors can upload store logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'store-logos'
);

-- Allow public read access to store logos
CREATE POLICY "Public read access for store logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'store-logos');

-- Allow vendors to update their own store logos
CREATE POLICY "Vendors can update own store logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'store-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow vendors to delete their own store logos
CREATE POLICY "Vendors can delete own store logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'store-logos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);
