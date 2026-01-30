-- Indexes for smart_search_contacts performance
-- Optimizes ILIKE queries (responsibility matching) and tag searches

-- Enable pg_trgm extension for trigram matching (fuzzy ILIKE)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Index for role ILIKE queries (e.g., role ILIKE '%marketing%')
-- Uses trigram matching for fast substring searches
CREATE INDEX IF NOT EXISTS idx_contacts_role_trgm
  ON public.contacts USING gin (role gin_trgm_ops)
  WHERE deleted_at IS NULL;

-- Index for company ILIKE queries (e.g., company ILIKE '%design%')
-- Helps with responsibility queries that match company name
CREATE INDEX IF NOT EXISTS idx_contacts_company_trgm
  ON public.contacts USING gin (company gin_trgm_ops)
  WHERE deleted_at IS NULL;

-- Index for tags array searches (responsibility matching via tags)
-- Uses GIN index for fast array overlap checks (tags && _tags)
CREATE INDEX IF NOT EXISTS idx_contacts_tags_gin
  ON public.contacts USING gin (tags)
  WHERE deleted_at IS NULL;

-- Index for time-based searches (created_at range queries)
-- Optimizes "who did I meet last week?" type queries
CREATE INDEX IF NOT EXISTS idx_contacts_created_at
  ON public.contacts (created_at DESC NULLS LAST)
  WHERE deleted_at IS NULL;

-- Index for location searches (city/state ILIKE)
CREATE INDEX IF NOT EXISTS idx_contacts_city_trgm
  ON public.contacts USING gin (city gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_state_trgm
  ON public.contacts USING gin (state gin_trgm_ops)
  WHERE deleted_at IS NULL;

-- Composite index for name searches (frequently used)
CREATE INDEX IF NOT EXISTS idx_contacts_name_trgm
  ON public.contacts USING gin (name gin_trgm_ops)
  WHERE deleted_at IS NULL;

-- Add helpful comments
COMMENT ON INDEX idx_contacts_role_trgm IS 'Trigram index for fast role ILIKE queries (responsibility matching)';
COMMENT ON INDEX idx_contacts_company_trgm IS 'Trigram index for fast company ILIKE queries';
COMMENT ON INDEX idx_contacts_tags_gin IS 'GIN index for fast tag array overlap searches';
COMMENT ON INDEX idx_contacts_created_at IS 'B-tree index for time-based range queries';
