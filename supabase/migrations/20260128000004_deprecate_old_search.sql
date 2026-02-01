-- Deprecate old search_contacts RPC (replaced by smart_search_contacts)
-- This migration drops the old basic FTS-only search function

DROP FUNCTION IF EXISTS public.search_contacts(UUID, text, int);

-- Add comment noting the replacement
COMMENT ON FUNCTION public.smart_search_contacts IS 
'Universal smart search with NLP features (v2). 
Replaces deprecated search_contacts function. 
Supports: responsibility matching, time filters, text search, location.
Works consistently for 10 contacts or 10,000+ contacts.';
