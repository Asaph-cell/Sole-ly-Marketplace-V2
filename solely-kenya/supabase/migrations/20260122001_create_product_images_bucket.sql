-- Create product-images storage bucket with proper RLS policies
-- This bucket stores all vendor product uploads

-- Create the bucket if it doesn't exist (PUBLIC so images can be displayed)
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow authenticated vendors to upload product images
CREATE POLICY "Vendors can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'product-images'
);

-- Allow public read access to product images
CREATE POLICY "Public read access for product images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');

-- Allow vendors to update their own product images
CREATE POLICY "Vendors can update own product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'product-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow vendors to delete their own product images
CREATE POLICY "Vendors can delete own product images"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'product-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);
