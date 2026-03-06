-- Smart folders: save a search to filter contacts (current and future)
-- Only for contact directory; stored as filter_criteria JSON (same shape as SearchQuery.filters).

ALTER TABLE public.folders
  ADD COLUMN IF NOT EXISTS is_smart_folder BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS filter_criteria JSONB DEFAULT NULL;

COMMENT ON COLUMN public.folders.is_smart_folder IS 'When true, folder is a saved search; filter_criteria holds SearchQuery.filters (name, company, job_title, tags, date_range, interaction_date_range, location, relationship_type).';
COMMENT ON COLUMN public.folders.filter_criteria IS 'For smart folders only: JSON object with optional keys name, company, job_title, tags (array), date_range { from, to }, interaction_date_range { from, to }, location, relationship_type.';

-- Restrict smart folders to contact directory
CREATE INDEX IF NOT EXISTS idx_folders_smart_contact ON public.folders(directory_type, is_smart_folder) WHERE is_smart_folder = true;
