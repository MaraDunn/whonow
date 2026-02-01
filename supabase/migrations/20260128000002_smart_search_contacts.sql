-- Smart Search RPC: Multi-strategy search with structured filters
-- Replaces threshold-based client/server split with universal server-side search
-- Supports: responsibility matching, time filters, text search, location, tags

CREATE OR REPLACE FUNCTION public.smart_search_contacts(
  _user_id UUID,
  _job_title text DEFAULT NULL,           -- For responsibility queries (e.g., "marketing", "design")
  _date_range_from timestamptz DEFAULT NULL,
  _date_range_to timestamptz DEFAULT NULL,
  _name text DEFAULT NULL,
  _company text DEFAULT NULL,
  _tags text[] DEFAULT NULL,
  _location text DEFAULT NULL,
  _relationship_type text DEFAULT NULL,    -- 'client', 'vendor', etc. (future use)
  _semantic_hint text DEFAULT NULL,        -- For FTS ranking (general search terms)
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
  -- Build tsquery for text search (if semantic_hint, name, or company provided)
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
      -- Calculate rank for sorting (if doing text search)
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
      
      -- Base visibility: user owns contact OR company shared contact
      AND (
        c.owner_id = _user_id 
        OR (uc.company_id IS NOT NULL AND c.company_id = uc.company_id AND c.is_shared = true)
      )
      
      -- Responsibility filter: match job_title in role, company, or tags
      -- This handles queries like "who can make me a logo?" (job_title: "design")
      AND (
        _job_title IS NULL
        OR c.role ILIKE '%' || _job_title || '%'
        OR c.company ILIKE '%' || _job_title || '%'
        OR _job_title = ANY(c.tags)
      )
      
      -- Time range filter: created_at between dates
      -- This handles queries like "who did I meet last week?"
      AND (
        (_date_range_from IS NULL AND _date_range_to IS NULL)
        OR c.created_at BETWEEN COALESCE(_date_range_from, '-infinity'::timestamptz) 
                            AND COALESCE(_date_range_to, 'infinity'::timestamptz)
      )
      
      -- Name filter: exact or partial match
      AND (
        _name IS NULL 
        OR c.name ILIKE '%' || _name || '%'
      )
      
      -- Company filter: exact or partial match
      AND (
        _company IS NULL 
        OR c.company ILIKE '%' || _company || '%'
      )
      
      -- Tag filter: array overlap (any tag matches)
      AND (
        _tags IS NULL 
        OR c.tags && _tags
      )
      
      -- Location filter: match in city or state
      AND (
        _location IS NULL 
        OR c.city ILIKE '%' || _location || '%'
        OR c.state ILIKE '%' || _location || '%'
      )
      
      -- Full-text search filter (if semantic_hint provided)
      AND (
        sq.q IS NULL 
        OR c.search_vector @@ sq.q
      )
      
      -- Relationship type filter (for future use)
      AND (
        _relationship_type IS NULL
        OR (_relationship_type = 'client' AND c.is_client = true)
        -- Add more relationship types as needed
      )
    
    -- Order by: text rank (if searching), then created_at
    -- Note: Must repeat expression since PostgreSQL doesn't allow alias reference in same SELECT
    ORDER BY 
      CASE 
        WHEN sq.q IS NOT NULL THEN ts_rank(c.search_vector, sq.q)
        ELSE 0
      END DESC,
      c.created_at DESC NULLS LAST,
      c.id DESC NULLS LAST
    
    LIMIT (SELECT lim.n FROM lim)
  )
  -- Return results without rank column
  SELECT 
    id, name, email, phone, company, role, avatar, folder_id, tags,
    created_at, is_shared, owner_id, last_contacted_at, is_client, company_id
  FROM filtered;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.smart_search_contacts(
  UUID, text, timestamptz, timestamptz, text, text, text[], text, text, text, int
) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION public.smart_search_contacts IS 
'Universal smart search with NLP features: responsibility matching, time filters, text search, location. 
Works consistently for 10 contacts or 10,000+ contacts. Replaces threshold-based client/server split.';
