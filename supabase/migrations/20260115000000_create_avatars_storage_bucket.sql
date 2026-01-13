-- Create storage bucket for avatars
-- This migration sets up the storage policies for the avatars bucket
-- 
-- IMPORTANT: You must create the storage bucket manually in Supabase Dashboard first:
-- 1. Go to Storage in your Supabase dashboard
-- 2. Click "New bucket"
-- 3. Name: "avatars"
-- 4. Make it public (or set up RLS policies below)
-- 5. Click "Create bucket"
--
-- After creating the bucket, run this migration to set up the storage policies.

-- Create storage policies for avatars bucket
-- These policies allow authenticated users to upload and manage avatars
-- Files are stored in the root of the bucket (not in user-specific folders)

-- Policy: Allow authenticated users to upload avatars
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Allow authenticated users to upload avatars'
  ) THEN
    CREATE POLICY "Allow authenticated users to upload avatars"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'avatars');
  END IF;
END $$;

-- Policy: Allow authenticated users to update avatars
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Allow authenticated users to update avatars'
  ) THEN
    CREATE POLICY "Allow authenticated users to update avatars"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (bucket_id = 'avatars')
    WITH CHECK (bucket_id = 'avatars');
  END IF;
END $$;

-- Policy: Allow authenticated users to delete avatars
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Allow authenticated users to delete avatars'
  ) THEN
    CREATE POLICY "Allow authenticated users to delete avatars"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (bucket_id = 'avatars');
  END IF;
END $$;

-- Policy: Allow public read access to avatars (so images can be displayed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Allow public read access to avatars'
  ) THEN
    CREATE POLICY "Allow public read access to avatars"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'avatars');
  END IF;
END $$;
