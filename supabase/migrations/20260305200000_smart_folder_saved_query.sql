-- Smart folders as bookmarked search: store the raw query string and run the same
-- server-side smart_search_contacts RPC when viewing the folder (same as the search bar).

ALTER TABLE public.folders
  ADD COLUMN IF NOT EXISTS saved_search_query TEXT DEFAULT NULL;

COMMENT ON COLUMN public.folders.saved_search_query IS 'For smart folders: raw search query (e.g. "designers in San Francisco"). Used to run smart_search_contacts when the folder is opened, so results match the primary search bar.';
