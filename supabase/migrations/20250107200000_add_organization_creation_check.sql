-- Add function to check if user can create organization (requires team/business tier)
CREATE OR REPLACE FUNCTION public.can_create_organization(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT tier IN ('team', 'business', 'enterprise', 'global_enterprise') 
     FROM public.subscriptions 
     WHERE user_id = _user_id AND status = 'active'),
    false
  )
$$;

-- Update create_company function to check subscription tier
CREATE OR REPLACE FUNCTION public.create_company(p_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'company_name_required';
  END IF;

  -- Check if user has the required subscription tier
  IF NOT public.can_create_organization(auth.uid()) THEN
    RAISE EXCEPTION 'organization_creation_requires_team_or_business_tier'
      USING HINT = 'Upgrade to Team or Business tier to create an organization';
  END IF;

  -- Ensure a profile exists
  INSERT INTO public.profiles (id)
  VALUES (auth.uid())
  ON CONFLICT (id) DO NOTHING;

  IF public.get_user_company_id(auth.uid()) IS NOT NULL THEN
    RAISE EXCEPTION 'already_in_company';
  END IF;

  INSERT INTO public.companies (name)
  VALUES (p_name)
  RETURNING id INTO v_company_id;

  UPDATE public.profiles
  SET company_id = v_company_id
  WHERE id = auth.uid();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'admin'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN v_company_id;
END;
$$;

COMMENT ON FUNCTION public.can_create_organization IS 
  'Checks if user has Team or Business tier subscription required for organization creation';

COMMENT ON FUNCTION public.create_company IS 
  'Creates a new organization. Requires Team or Business tier subscription. User becomes admin of the organization.';

