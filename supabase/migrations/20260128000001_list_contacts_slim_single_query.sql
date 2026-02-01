-- Replace list_contacts_slim with a single-query implementation.
-- One pass over visibility (BitmapOr of owned + shared indexes), one sort, one limit.
-- No UNION, no merge of two sorted streams, no second sort.
CREATE OR REPLACE FUNCTION public.list_contacts_slim(
  _user_id UUID,
  _cursor_created_at timestamptz DEFAULT NULL,
  _cursor_id uuid DEFAULT NULL,
  _limit int DEFAULT 100,
  _folder_id uuid DEFAULT NULL,
  _client_only boolean DEFAULT false,
  _ownership_filter text DEFAULT 'all'
)
RETURNS TABLE(
  id uuid,
  name text,
  email text,
  phone text,
  company text,
  role text,
  avatar text,
  folder_id uuid,
  tags text[],
  created_at timestamptz,
  is_shared boolean,
  owner_id uuid,
  last_contacted_at timestamptz,
  is_client boolean,
  company_id uuid
)
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
  visible AS (
    SELECT
      c.id,
      c.name,
      c.email,
      c.phone,
      c.company,
      c.role,
      c.avatar,
      c.folder_id,
      c.tags,
      c.created_at,
      c.is_shared,
      c.owner_id,
      c.last_contacted_at,
      c.is_client,
      c.company_id
    FROM public.contacts c
    LEFT JOIN user_company uc ON true
    CROSS JOIN lim
    WHERE c.deleted_at IS NULL
      AND NOT ('my-profile' = ANY(COALESCE(c.tags, '{}')))
      AND (
        (c.owner_id = _user_id AND _ownership_filter IN ('all', 'personal'))
        OR (uc.company_id IS NOT NULL AND c.company_id = uc.company_id AND c.is_shared = true AND _ownership_filter IN ('all', 'shared'))
      )
      AND (_folder_id IS NULL OR c.folder_id = _folder_id)
      AND (NOT _client_only OR c.is_client = true)
      AND (
        _cursor_created_at IS NULL OR _cursor_id IS NULL
        OR (c.created_at, c.id) < (_cursor_created_at, _cursor_id)
      )
    ORDER BY c.created_at DESC NULLS LAST, c.id DESC NULLS LAST
    LIMIT (SELECT lim.n FROM lim)
  )
  SELECT * FROM visible;
$$;
