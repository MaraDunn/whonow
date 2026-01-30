-- RPC: paginated contact list with keyset pagination and same visibility as count/search.
-- Uses UNION of index-friendly branches (owned vs shared) so each branch can use its partial index.
CREATE OR REPLACE FUNCTION public.list_contacts(
  _user_id UUID,
  _cursor_created_at timestamptz DEFAULT NULL,
  _cursor_id uuid DEFAULT NULL,
  _limit int DEFAULT 100,
  _folder_id uuid DEFAULT NULL,
  _client_only boolean DEFAULT false,
  _ownership_filter text DEFAULT 'all'
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
  lim AS (
    SELECT LEAST(GREATEST(COALESCE(_limit, 100), 1), 500) AS n
  ),
  owned AS (
    SELECT c.* FROM public.contacts c, lim
    WHERE c.deleted_at IS NULL
      AND c.owner_id = _user_id
      AND NOT ('my-profile' = ANY(COALESCE(c.tags, '{}')))
      AND (_ownership_filter = 'all' OR _ownership_filter = 'personal')
      AND (_folder_id IS NULL OR c.folder_id = _folder_id)
      AND (NOT _client_only OR c.is_client = true)
      AND (_cursor_created_at IS NULL OR _cursor_id IS NULL OR (c.created_at, c.id) < (_cursor_created_at, _cursor_id))
    ORDER BY c.created_at DESC NULLS LAST, c.id DESC NULLS LAST
    LIMIT (SELECT n FROM lim)
  ),
  shared AS (
    SELECT c.* FROM public.contacts c, user_company uc, lim
    WHERE c.deleted_at IS NULL
      AND c.company_id = uc.company_id
      AND c.is_shared = true
      AND NOT ('my-profile' = ANY(COALESCE(c.tags, '{}')))
      AND (_ownership_filter = 'all' OR _ownership_filter = 'shared')
      AND (_folder_id IS NULL OR c.folder_id = _folder_id)
      AND (NOT _client_only OR c.is_client = true)
      AND (_cursor_created_at IS NULL OR _cursor_id IS NULL OR (c.created_at, c.id) < (_cursor_created_at, _cursor_id))
    ORDER BY c.created_at DESC NULLS LAST, c.id DESC NULLS LAST
    LIMIT (SELECT n FROM lim)
  ),
  combined AS (
    SELECT * FROM owned
    UNION ALL
    SELECT * FROM shared
  )
  SELECT * FROM combined
  ORDER BY created_at DESC NULLS LAST, id DESC NULLS LAST
  LIMIT (SELECT n FROM lim);
$$;

GRANT EXECUTE ON FUNCTION public.list_contacts(UUID, timestamptz, uuid, int, uuid, boolean, text) TO authenticated;
