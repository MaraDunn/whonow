-- Full-text search for contacts: search vector, index, and search_contacts RPC.
-- Used when totalCount >= 500 to avoid loading all contacts into the client.
-- Uses trigger (not GENERATED) because to_tsvector('english', ...) is not immutable.

DROP TRIGGER IF EXISTS contacts_search_vector_update ON public.contacts;

ALTER TABLE public.contacts
  DROP COLUMN IF EXISTS search_vector;

ALTER TABLE public.contacts
  ADD COLUMN search_vector tsvector;

CREATE OR REPLACE FUNCTION public.contacts_search_vector_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A')
    || setweight(to_tsvector('english', coalesce(NEW.company, '')), 'A')
    || setweight(to_tsvector('english', coalesce(NEW.role, '')), 'B')
    || setweight(to_tsvector('english', coalesce(NEW.description, '')), 'C')
    || setweight(to_tsvector('english', coalesce(array_to_string(coalesce(NEW.tags, '{}'), ' '), '')), 'B');
  RETURN NEW;
END;
$$;

CREATE TRIGGER contacts_search_vector_update
  BEFORE INSERT OR UPDATE OF name, company, role, description, tags
  ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.contacts_search_vector_trigger();

UPDATE public.contacts
SET search_vector = (
  setweight(to_tsvector('english', coalesce(name, '')), 'A')
  || setweight(to_tsvector('english', coalesce(company, '')), 'A')
  || setweight(to_tsvector('english', coalesce(role, '')), 'B')
  || setweight(to_tsvector('english', coalesce(description, '')), 'C')
  || setweight(to_tsvector('english', coalesce(array_to_string(coalesce(tags, '{}'), ' '), '')), 'B')
)
WHERE search_vector IS NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_search_vector
  ON public.contacts USING GIN (search_vector)
  WHERE deleted_at IS NULL;

-- RPC: search contacts for a user with same visibility as count_active_contacts
CREATE OR REPLACE FUNCTION public.search_contacts(
  _user_id UUID,
  _query text,
  _limit int DEFAULT 50
)
RETURNS SETOF public.contacts
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH user_company AS (
    SELECT company_id FROM public.profiles WHERE id = _user_id LIMIT 1
  ),
  q AS (
    SELECT plainto_tsquery('english', _query) AS q
  )
  SELECT c.*
  FROM public.contacts c
  CROSS JOIN user_company uc
  CROSS JOIN q
  WHERE c.deleted_at IS NULL
    AND NOT ('my-profile' = ANY(c.tags))
    AND (c.owner_id = _user_id OR (c.company_id = uc.company_id AND c.is_shared = true))
    AND c.search_vector @@ q.q
  ORDER BY ts_rank(c.search_vector, q.q) DESC
  LIMIT _limit;
$$;

GRANT EXECUTE ON FUNCTION public.search_contacts(UUID, text, int) TO authenticated;
