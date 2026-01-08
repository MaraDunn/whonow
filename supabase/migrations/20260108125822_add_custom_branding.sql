-- Add custom branding fields to companies table
-- These fields are only used for business tier organizations
-- 
-- IMPORTANT: This migration requires the companies table to exist.
-- The companies table is created in migration: 20251220201301_17c1fb46-2c05-4d82-811e-985089753c86.sql
-- 
-- If you get an error that the companies table doesn't exist:
-- 1. Run all migrations in order using the combined-migrations.sql file, OR
-- 2. Run the earlier migrations first (especially 20251220201301_*)

-- Check if companies table exists, if not, provide helpful error
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'companies') THEN
    RAISE EXCEPTION 'Companies table does not exist. Please run earlier migrations first, especially 20251220201301_17c1fb46-2c05-4d82-811e-985089753c86.sql which creates the companies table.';
  END IF;
END $$;

-- Add branding columns to companies table
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS favicon_url TEXT,
  ADD COLUMN IF NOT EXISTS primary_color TEXT,
  ADD COLUMN IF NOT EXISTS secondary_color TEXT;

-- Add comment to document the fields
COMMENT ON COLUMN public.companies.logo_url IS 'URL to custom logo for business tier organizations';
COMMENT ON COLUMN public.companies.favicon_url IS 'URL to custom favicon for business tier organizations';
COMMENT ON COLUMN public.companies.primary_color IS 'Primary brand color (hex code) for business tier organizations';
COMMENT ON COLUMN public.companies.secondary_color IS 'Secondary brand color (hex code) for business tier organizations';

-- NOTE: After running this migration, you need to create a storage bucket named "branding" in Supabase:
-- 1. Go to Storage in your Supabase dashboard
-- 2. Click "New bucket"
-- 3. Name: "branding"
-- 4. Make it public (or set up RLS policies to allow authenticated users to upload)
-- 5. Set up storage policies:
--    - Allow authenticated users to upload files
--    - Allow public read access

