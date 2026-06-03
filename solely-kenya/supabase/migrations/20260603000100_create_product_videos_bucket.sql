-- Create product-videos storage bucket with proper RLS policies
-- This bucket stores all vendor product video uploads

-- Create the bucket if it doesn't exist (PUBLIC so videos can be displayed)
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-videos', 'product-videos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow authenticated vendors to upload product videos
CREATE POLICY "Vendors can upload product videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'product-videos'
);

-- Allow public read access to product videos
CREATE POLICY "Public read access for product videos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-videos');

-- Allow vendors to update their own product videos
CREATE POLICY "Vendors can update own product videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'product-videos'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow vendors to delete their own product videos
CREATE POLICY "Vendors can delete own product videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'product-videos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);
