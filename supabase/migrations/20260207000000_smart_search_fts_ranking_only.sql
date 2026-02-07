-- Use FTS (semantic_hint, name, company) for RANKING only, not FILTERING.
-- Previously, when _semantic_hint was passed, the RPC required c.search_vector @@ sq.q,
-- which filtered OUT contacts that didn't match the tsquery. Natural language queries
-- like "I need a logo" would match almost no one → 0 results.
-- Now we return contacts matching other filters and use FTS only for ordering.

CREATE OR REPLACE FUNCTION public.smart_search_contacts(
  _user_id UUID,
  _job_title text DEFAULT NULL,
  _date_range_from timestamptz DEFAULT NULL,
  _date_range_to timestamptz DEFAULT NULL,
  _last_contacted_from timestamptz DEFAULT NULL,
  _last_contacted_to timestamptz DEFAULT NULL,
  _name text DEFAULT NULL,
  _company text DEFAULT NULL,
  _tags text[] DEFAULT NULL,
  _location text DEFAULT NULL,
  _relationship_type text DEFAULT NULL,
  _semantic_hint text DEFAULT NULL,
  _limit int DEFAULT 10
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
    SELECT LEAST(GREATEST(COALESCE(_limit, 10), 1), 100) AS n
  ),
  search_query AS (
    SELECT 
      CASE 
        WHEN _semantic_hint IS NOT NULL AND _semantic_hint != '' THEN 
          plainto_tsquery('english', _semantic_hint)
        WHEN _name IS NOT NULL AND _name != '' THEN 
          plainto_tsquery('english', _name)
        WHEN _company IS NOT NULL AND _company != '' THEN 
          plainto_tsquery('english', _company)
        ELSE NULL
      END AS q
  ),
  filtered AS (
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
      c.company_id,
      CASE 
        WHEN sq.q IS NOT NULL THEN ts_rank(c.search_vector, sq.q)
        ELSE 0
      END AS rank
    FROM public.contacts c
    LEFT JOIN user_company uc ON true
    CROSS JOIN lim
    CROSS JOIN search_query sq
    WHERE c.deleted_at IS NULL
      AND NOT ('my-profile' = ANY(COALESCE(c.tags, '{}')))
      AND (
        c.owner_id = _user_id 
        OR (uc.company_id IS NOT NULL AND c.company_id = uc.company_id AND c.is_shared = true)
      )
      AND (
        _job_title IS NULL
        OR c.role ILIKE '%' || _job_title || '%'
        OR c.company ILIKE '%' || _job_title || '%'
        OR _job_title = ANY(c.tags)
      )
      AND (
        (_date_range_from IS NULL AND _date_range_to IS NULL)
        OR c.created_at BETWEEN COALESCE(_date_range_from, '-infinity'::timestamptz) 
                            AND COALESCE(_date_range_to, 'infinity'::timestamptz)
      )
      AND (
        (_last_contacted_from IS NULL AND _last_contacted_to IS NULL)
        OR (
          c.last_contacted_at IS NOT NULL
          AND c.last_contacted_at BETWEEN COALESCE(_last_contacted_from, '-infinity'::timestamptz) 
                                      AND COALESCE(_last_contacted_to, 'infinity'::timestamptz)
        )
      )
      AND (
        _name IS NULL 
        OR c.name ILIKE '%' || _name || '%'
      )
      AND (
        _company IS NULL 
        OR c.company ILIKE '%' || _company || '%'
      )
      AND (
        _tags IS NULL 
        OR c.tags && _tags
      )
      AND (
        _location IS NULL 
        OR c.city ILIKE '%' || _location || '%'
        OR c.state ILIKE '%' || _location || '%'
      )
      -- FTS (sq.q) used for RANKING only; removed filter that excluded non-matching contacts
      AND (
        _relationship_type IS NULL
        OR (_relationship_type = 'client' AND c.is_client = true)
      )
    ORDER BY 
      CASE 
        WHEN sq.q IS NOT NULL THEN ts_rank(c.search_vector, sq.q)
        ELSE 0
      END DESC,
      CASE WHEN _last_contacted_from IS NOT NULL OR _last_contacted_to IS NOT NULL 
           THEN c.last_contacted_at END DESC NULLS LAST,
      c.created_at DESC NULLS LAST,
      c.id DESC NULLS LAST
    LIMIT (SELECT lim.n FROM lim)
  )
  SELECT 
    id, name, email, phone, company, role, avatar, folder_id, tags,
    created_at, is_shared, owner_id, last_contacted_at, is_client, company_id
  FROM filtered;
$$;

COMMENT ON FUNCTION public.smart_search_contacts IS 
'Universal smart search: FTS used for ranking only (not filtering). Responsibility matching, time filters, location.';
