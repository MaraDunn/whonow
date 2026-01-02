-- Add directory_type column to folders table to distinguish folder types
-- 'contacts' = regular contact folders (default)
-- 'clients' = client directory folders
-- 'team' = team/employee directory folders

ALTER TABLE public.folders 
ADD COLUMN directory_type text NOT NULL DEFAULT 'contacts';

-- Add check constraint for valid directory types
ALTER TABLE public.folders 
ADD CONSTRAINT folders_directory_type_check 
CHECK (directory_type IN ('contacts', 'clients', 'team'));

-- Create index for faster filtering by directory type
CREATE INDEX idx_folders_directory_type ON public.folders(directory_type);