-- Add is_organization_folder flag to folders table
ALTER TABLE public.folders 
ADD COLUMN IF NOT EXISTS is_organization_folder BOOLEAN DEFAULT false;

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_folders_is_organization ON public.folders(is_organization_folder);
CREATE INDEX IF NOT EXISTS idx_folders_company_org ON public.folders(company_id, is_organization_folder);

-- Update RLS Policies for folders to support organization folders
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own and company folders" ON public.folders;
DROP POLICY IF EXISTS "Users can create folders" ON public.folders;
DROP POLICY IF EXISTS "Users can update their own folders or company folders if admin" ON public.folders;
DROP POLICY IF EXISTS "Users can delete their own folders or company folders if admin" ON public.folders;

-- Policy: Users can view their personal folders + all organization folders in their company
CREATE POLICY "Users can view their own and organization folders"
  ON public.folders FOR SELECT
  USING (
    -- Personal folders
    (owner_id = auth.uid() AND is_organization_folder = false)
    -- Organization folders in user's company
    OR (company_id = public.get_user_company_id(auth.uid()) AND is_organization_folder = true)
    -- Legacy data
    OR (company_id IS NULL AND owner_id IS NULL)
  );

-- Policy: Users can create personal folders; only admins can create organization folders
CREATE POLICY "Users can create folders based on role"
  ON public.folders FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND (
      -- Anyone can create personal folders
      (is_organization_folder = false AND owner_id = auth.uid())
      -- Only admins can create organization folders
      OR (is_organization_folder = true AND public.has_role(auth.uid(), 'admin') AND company_id = public.get_user_company_id(auth.uid()))
    )
  );

-- Policy: Users can update their own personal folders; only admins can update organization folders
CREATE POLICY "Users can update their folders based on ownership"
  ON public.folders FOR UPDATE
  USING (
    -- Personal folders - owner can update
    (owner_id = auth.uid() AND is_organization_folder = false)
    -- Organization folders - only admins can update
    OR (is_organization_folder = true AND company_id = public.get_user_company_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
  );

-- Policy: Users can delete their own personal folders; only admins can delete organization folders
CREATE POLICY "Users can delete their folders based on ownership"
  ON public.folders FOR DELETE
  USING (
    -- Personal folders - owner can delete
    (owner_id = auth.uid() AND is_organization_folder = false)
    -- Organization folders - only admins can delete
    OR (is_organization_folder = true AND company_id = public.get_user_company_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
  );

-- Add helpful comment
COMMENT ON COLUMN public.folders.is_organization_folder IS 
  'True if this is a shared organization folder (accessible to all company members). Only org admins can create/edit/delete organization folders.';

