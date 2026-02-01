-- Test if contacts exist and have search_vector
SELECT 
  id, 
  name, 
  role, 
  company,
  CASE WHEN search_vector IS NULL THEN 'MISSING' ELSE 'EXISTS' END as search_vector_status
FROM contacts 
WHERE deleted_at IS NULL 
  AND NOT ('my-profile' = ANY(COALESCE(tags, '{}')))
LIMIT 5;
