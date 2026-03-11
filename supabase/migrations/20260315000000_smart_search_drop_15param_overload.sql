-- Drop the 15-param overload to eliminate PostgREST overload ambiguity.
-- Only the 16-param version (with _role_keywords) should exist; the app always sends _role_keywords.
DROP FUNCTION IF EXISTS public.smart_search_contacts(uuid, text, timestamptz, timestamptz, timestamptz, timestamptz, text, text, text[], text, text, text, boolean, boolean, int);
