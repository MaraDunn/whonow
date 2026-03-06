-- Add 'org' directory type for Organization (shared contacts) directory folders and smart folders.
ALTER TABLE public.folders DROP CONSTRAINT IF EXISTS folders_directory_type_check;
ALTER TABLE public.folders ADD CONSTRAINT folders_directory_type_check
  CHECK (directory_type IN ('contacts', 'clients', 'team', 'org'));
