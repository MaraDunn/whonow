-- Function to count active contacts (excluding my-profile and deleted)
-- This function respects RLS policies and counts all contacts the user can see
CREATE OR REPLACE FUNCTION public.count_active_contacts(_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_company_id UUID;
  contact_count INTEGER;
BEGIN
  -- Get user's company ID
  SELECT company_id INTO user_company_id
  FROM public.profiles
  WHERE id = _user_id;

  -- Count contacts that the user can see (respecting RLS logic)
  -- Exclude deleted contacts and contacts with "my-profile" tag
  -- Matches the RLS policy: owner_id = auth.uid() OR (company_id matches AND is_shared = true)
  SELECT COUNT(*) INTO contact_count
  FROM public.contacts
  WHERE deleted_at IS NULL
    AND NOT ('my-profile' = ANY(tags))
    AND (
      owner_id = _user_id
      OR (company_id = user_company_id AND is_shared = true)
    );

  RETURN contact_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.count_active_contacts(UUID) TO authenticated;
