-- Restore 15-param overload so callers that omit _role_keywords still resolve.
-- PostgREST matches by argument count; if the app sends 15 params (e.g. _role_keywords omitted when null),
-- this overload is used and forwards to the 16-param implementation with _role_keywords := NULL.
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
  SELECT * FROM public.smart_search_contacts(
    _user_id,
    _job_title,
    _date_range_from,
    _date_range_to,
    _last_contacted_from,
    _last_contacted_to,
    _name,
    _company,
    _tags,
    _location,
    _relationship_type,
    _semantic_hint,
    NULL::text[],
    _client_only,
    _shared_only,
    _limit
  );
$$;
GRANT EXECUTE ON FUNCTION public.smart_search_contacts(uuid, text, timestamptz, timestamptz, timestamptz, timestamptz, text, text, text[], text, text, text, boolean, boolean, int) TO authenticated;
