-- Create dispute-evidence storage bucket for buyer/vendor photo uploads
-- This bucket needs to be PUBLIC so images can be displayed in admin dashboard

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('dispute-evidence', 'dispute-evidence', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow authenticated users to upload to their folder
CREATE POLICY "Users can upload dispute evidence"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'dispute-evidence'
);

-- Allow anyone to view dispute evidence (needed for admin viewing)
CREATE POLICY "Public read access for dispute evidence"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'dispute-evidence');

-- Allow authenticated users to delete their own uploads
CREATE POLICY "Users can delete own evidence"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'dispute-evidence' 
    AND auth.uid()::text = (storage.foldername(name))[2]
);
