-- Fix two issues:
-- 1. "I need a contract" not finding Lawyer contacts: RESP_LEGAL_CONTRACTS role_keywords
--    now includes lawyer/attorney (client-side fix), but the SQL also needs to let FTS
--    matches through the job_title gate.
-- 2. "Invoicing for Jackson and Sons" not finding the contact whose description says
--    "Handles invoicing for: Jackson and Sons": the semantic_hint FTS matches the
--    search_vector but the contact is blocked by the job_title filter (role doesn't
--    match "finance"/"accounting"). Fix: when FTS strongly matches, let the contact
--    through the job_title gate.
DROP FUNCTION IF EXISTS public.smart_search_contacts(uuid, text, timestamptz, timestamptz, timestamptz, timestamptz, text, text, text[], text, text, text, text[], boolean, boolean, int);
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
  _role_keywords text[] DEFAULT NULL,
  _client_only boolean DEFAULT false,
  _shared_only boolean DEFAULT false,
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
    SELECT LEAST(GREATEST(COALESCE(_limit, 10), 1), 1000) AS n
  ),
  search_query AS (
    SELECT 
      CASE 
        WHEN _semantic_hint IS NOT NULL AND _semantic_hint != '' THEN plainto_tsquery('english', _semantic_hint)
        WHEN _name IS NOT NULL AND _name != '' THEN plainto_tsquery('english', _name)
        WHEN _company IS NOT NULL AND _company != '' THEN plainto_tsquery('english', _company)
        ELSE NULL
      END AS q
  ),
  filtered AS (
    SELECT
      c.id, c.name, c.email, c.phone, c.company, c.role, c.avatar, c.folder_id, c.tags,
      c.created_at, c.is_shared, c.owner_id, c.last_contacted_at, c.is_client, c.company_id,
      CASE WHEN sq.q IS NOT NULL THEN ts_rank(c.search_vector, sq.q) ELSE 0 END AS rank
    FROM public.contacts c
    LEFT JOIN user_company uc ON true
    CROSS JOIN lim
    CROSS JOIN search_query sq
    WHERE c.deleted_at IS NULL
      AND NOT ('my-profile' = ANY(COALESCE(c.tags, '{}')))
      AND (c.owner_id = _user_id OR (uc.company_id IS NOT NULL AND c.company_id = uc.company_id AND c.is_shared = true))
      AND (NOT _client_only OR c.is_client = true)
      AND (NOT _shared_only OR c.is_shared = true)
      AND (
        _job_title IS NULL
        -- Direct role match (job_title or expanded role_keywords)
        OR c.role ILIKE '%' || _job_title || '%'
        OR (_role_keywords IS NOT NULL AND array_length(_role_keywords, 1) > 0
            AND EXISTS (SELECT 1 FROM unnest(_role_keywords) AS kw WHERE c.role ILIKE '%' || kw || '%'))
        -- Tag match
        OR _job_title = ANY(c.tags)
        -- Company/description match gated by role null/empty/matching
        OR (
          (c.company ILIKE '%' || _job_title || '%' OR COALESCE(c.description, '') ILIKE '%' || _job_title || '%')
          AND (
            c.role IS NULL OR c.role = ''
            OR c.role ILIKE '%' || _job_title || '%'
            OR (_role_keywords IS NOT NULL AND array_length(_role_keywords, 1) > 0
                AND EXISTS (SELECT 1 FROM unnest(_role_keywords) AS kw WHERE c.role ILIKE '%' || kw || '%'))
          )
        )
        -- FTS passthrough: if semantic_hint produces a strong FTS match on the contact's
        -- search_vector (which indexes name, company, role, description, tags), let it
        -- through regardless of role. This handles "Invoicing for Jackson and Sons" where
        -- the description matches but the role doesn't match the responsibility department.
        OR (sq.q IS NOT NULL AND c.search_vector @@ sq.q)
      )
      AND ((_date_range_from IS NULL AND _date_range_to IS NULL) OR c.created_at BETWEEN COALESCE(_date_range_from, '-infinity'::timestamptz) AND COALESCE(_date_range_to, 'infinity'::timestamptz))
      AND ((_last_contacted_from IS NULL AND _last_contacted_to IS NULL) OR (c.last_contacted_at IS NOT NULL AND c.last_contacted_at BETWEEN COALESCE(_last_contacted_from, '-infinity'::timestamptz) AND COALESCE(_last_contacted_to, 'infinity'::timestamptz)))
      AND (_name IS NULL OR c.name ILIKE '%' || _name || '%')
      AND (
        _company IS NULL
        OR c.company ILIKE '%' || _company || '%'
        OR COALESCE(c.description, '') ILIKE '%' || _company || '%'
        OR (
          _company ~ '\s+and\s+'
          AND (
            SELECT bool_and(
              (COALESCE(c.company, '') || ' ' || COALESCE(c.description, '')) ILIKE '%' || trim(part) || '%'
            )
            FROM unnest(regexp_split_to_array(_company, '\s+and\s+', 'i')) AS part
          )
        )
      )
      AND (_tags IS NULL OR c.tags && _tags)
      AND (_location IS NULL OR c.city ILIKE '%' || _location || '%' OR c.state ILIKE '%' || _location || '%')
      AND (_relationship_type IS NULL OR (_relationship_type = 'client' AND c.is_client = true))
      AND (
        _semantic_hint IS NULL
        OR _semantic_hint = ''
        OR _job_title IS NOT NULL
        OR _date_range_from IS NOT NULL
        OR _date_range_to IS NOT NULL
        OR _last_contacted_from IS NOT NULL
        OR _last_contacted_to IS NOT NULL
        OR _name IS NOT NULL
        OR _company IS NOT NULL
        OR _tags IS NOT NULL
        OR _location IS NOT NULL
        OR _relationship_type IS NOT NULL
        OR (sq.q IS NOT NULL AND ts_rank(c.search_vector, sq.q) > 0)
      )
    ORDER BY rank DESC, CASE WHEN _last_contacted_from IS NOT NULL OR _last_contacted_to IS NOT NULL THEN c.last_contacted_at END DESC NULLS LAST, c.created_at DESC NULLS LAST, c.id DESC NULLS LAST
    LIMIT (SELECT lim.n FROM lim)
  )
  SELECT id, name, email, phone, company, role, avatar, folder_id, tags, created_at, is_shared, owner_id, last_contacted_at, is_client, company_id FROM filtered;
$$;
GRANT EXECUTE ON FUNCTION public.smart_search_contacts(uuid, text, timestamptz, timestamptz, timestamptz, timestamptz, text, text, text[], text, text, text, text[], boolean, boolean, int) TO authenticated;
COMMENT ON FUNCTION public.smart_search_contacts IS 'Smart search: role_keywords for synonym expansion, FTS passthrough for description matches, company/description gated by role. Limit 1-1000.';
