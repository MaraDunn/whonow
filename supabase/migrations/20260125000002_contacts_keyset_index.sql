-- Index for keyset (cursor) pagination on contacts list.
-- Supports "next page" queries: WHERE (created_at, id) < (cursor) ORDER BY created_at DESC, id DESC.
-- Keeps page N fetches fast regardless of total rows (unlike OFFSET which scans N*page_size rows).
CREATE INDEX IF NOT EXISTS idx_contacts_deleted_created_id
  ON public.contacts (created_at DESC NULLS LAST, id DESC NULLS LAST)
  WHERE deleted_at IS NULL;
