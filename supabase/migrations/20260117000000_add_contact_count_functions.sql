-- Additional functions for accurate contact counts

-- Function to count trashed contacts
CREATE OR REPLACE FUNCTION public.count_trashed_contacts(_user_id UUID)
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

  -- Count trashed contacts that the user can see
  SELECT COUNT(*) INTO contact_count
  FROM public.contacts
  WHERE deleted_at IS NOT NULL
    AND (
      owner_id = _user_id
      OR (company_id = user_company_id AND is_shared = true)
    );

  RETURN contact_count;
END;
$$;

-- Function to count contacts by folder
CREATE OR REPLACE FUNCTION public.count_contacts_by_folder(_user_id UUID, _folder_id UUID)
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

  -- Count contacts in the folder that the user can see
  SELECT COUNT(*) INTO contact_count
  FROM public.contacts
  WHERE folder_id = _folder_id
    AND deleted_at IS NULL
    AND NOT ('my-profile' = ANY(tags))
    AND (
      owner_id = _user_id
      OR (company_id = user_company_id AND is_shared = true)
    );

  RETURN contact_count;
END;
$$;

-- Function to count personal contacts (not shared)
CREATE OR REPLACE FUNCTION public.count_personal_contacts(_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  contact_count INTEGER;
BEGIN
  -- Count personal contacts (owned by user, not shared)
  SELECT COUNT(*) INTO contact_count
  FROM public.contacts
  WHERE owner_id = _user_id
    AND deleted_at IS NULL
    AND NOT ('my-profile' = ANY(tags))
    AND (is_shared = false OR is_shared IS NULL);

  RETURN contact_count;
END;
$$;

-- Function to count shared contacts
CREATE OR REPLACE FUNCTION public.count_shared_contacts(_user_id UUID)
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

  -- Count shared contacts that the user can see
  SELECT COUNT(*) INTO contact_count
  FROM public.contacts
  WHERE deleted_at IS NULL
    AND NOT ('my-profile' = ANY(tags))
    AND is_shared = true
    AND company_id = user_company_id;

  RETURN contact_count;
END;
$$;

-- Function to count client contacts
CREATE OR REPLACE FUNCTION public.count_client_contacts(_user_id UUID)
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

  -- Count client contacts that the user can see
  SELECT COUNT(*) INTO contact_count
  FROM public.contacts
  WHERE deleted_at IS NULL
    AND NOT ('my-profile' = ANY(tags))
    AND is_client = true
    AND (
      owner_id = _user_id
      OR (company_id = user_company_id AND is_shared = true)
    );

  RETURN contact_count;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.count_trashed_contacts(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_contacts_by_folder(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_personal_contacts(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_shared_contacts(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_client_contacts(UUID) TO authenticated;
