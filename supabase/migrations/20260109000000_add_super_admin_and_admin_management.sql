-- Add owner_id column to companies table to track super admin (original creator)
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Set owner_id for existing companies based on the oldest admin in each company
-- This assumes the first admin is the creator
UPDATE public.companies c
SET owner_id = (
  SELECT ur.user_id
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role = 'admin'::app_role
    AND p.company_id = c.id
  ORDER BY ur.id ASC  -- Assuming earlier IDs mean earlier creation
  LIMIT 1
)
WHERE c.owner_id IS NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_companies_owner_id ON public.companies(owner_id);

-- Function to check if user is super admin (owner) of a company
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.companies 
    WHERE id = _company_id 
      AND owner_id = _user_id
  )
$$;

-- Function to check if current user is super admin of their company
-- If owner_id is null (backwards compatibility), any admin is treated as super admin
CREATE OR REPLACE FUNCTION public.is_current_user_super_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_owner_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  v_company_id := public.get_user_company_id(auth.uid());
  
  IF v_company_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check if user is super admin (owner)
  IF public.is_super_admin(auth.uid(), v_company_id) THEN
    RETURN true;
  END IF;

  -- Backwards compatibility: if no owner is set and user is admin, treat as super admin
  SELECT owner_id INTO v_owner_id
  FROM public.companies
  WHERE id = v_company_id;

  IF v_owner_id IS NULL AND public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Function to grant admin role to a user (super admin only)
CREATE OR REPLACE FUNCTION public.grant_admin_role(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_super_admin_company_id uuid;
  v_user_company_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Get super admin's company ID
  v_super_admin_company_id := public.get_user_company_id(auth.uid());

  -- Check if current user is super admin
  IF NOT public.is_current_user_super_admin() THEN
    RAISE EXCEPTION 'insufficient_privilege: only super admin can grant admin role';
  END IF;

  -- If no owner is set, set the current user as owner (backwards compatibility)
  UPDATE public.companies
  SET owner_id = auth.uid()
  WHERE id = v_super_admin_company_id AND owner_id IS NULL;

  -- Get user's company ID
  v_user_company_id := public.get_user_company_id(p_user_id);

  -- Verify user is in the same company
  IF v_user_company_id IS NULL OR v_user_company_id != v_super_admin_company_id THEN
    RAISE EXCEPTION 'user_not_in_company';
  END IF;

  -- Prevent super admin from granting admin to themselves (they're already super admin)
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_grant_admin_to_self';
  END IF;

  -- Grant admin role (or update if member role exists)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, 'admin'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- If user has member role, we should remove it (optional - could keep both, but cleaner to have just admin)
  DELETE FROM public.user_roles
  WHERE user_id = p_user_id AND role = 'member'::app_role;

  RETURN true;
END;
$$;

-- Function to revoke admin role from a user (super admin only)
CREATE OR REPLACE FUNCTION public.revoke_admin_role(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_super_admin_company_id uuid;
  v_user_company_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Get super admin's company ID
  v_super_admin_company_id := public.get_user_company_id(auth.uid());

  -- Check if current user is super admin
  IF NOT public.is_current_user_super_admin() THEN
    RAISE EXCEPTION 'insufficient_privilege: only super admin can revoke admin role';
  END IF;

  -- Get user's company ID
  v_user_company_id := public.get_user_company_id(p_user_id);

  -- Verify user is in the same company
  IF v_user_company_id IS NULL OR v_user_company_id != v_super_admin_company_id THEN
    RAISE EXCEPTION 'user_not_in_company';
  END IF;

  -- Prevent super admin from revoking admin from themselves
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_revoke_admin_from_self';
  END IF;

  -- Remove admin role
  DELETE FROM public.user_roles
  WHERE user_id = p_user_id AND role = 'admin'::app_role;

  -- Grant member role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, 'member'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN true;
END;
$$;

-- Function to refresh invite code (super admin only)
CREATE OR REPLACE FUNCTION public.refresh_company_invite_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_company_id uuid;
  v_new_invite_code text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Check if current user is super admin
  IF NOT public.is_current_user_super_admin() THEN
    RAISE EXCEPTION 'insufficient_privilege: only super admin can refresh invite code';
  END IF;

  -- Get user's company ID
  v_company_id := public.get_user_company_id(auth.uid());

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'user_not_in_company';
  END IF;

  -- Generate new invite code
  v_new_invite_code := encode(gen_random_bytes(6), 'hex');

  -- Update company invite code (retry if collision, though unlikely)
  LOOP
    BEGIN
      UPDATE public.companies
      SET invite_code = v_new_invite_code,
          updated_at = now()
      WHERE id = v_company_id;
      EXIT; -- Success, exit loop
    EXCEPTION
      WHEN unique_violation THEN
        -- Code collision, generate new one
        v_new_invite_code := encode(gen_random_bytes(6), 'hex');
    END;
  END LOOP;

  RETURN v_new_invite_code;
END;
$$;

-- Function to delete organization (super admin only)
CREATE OR REPLACE FUNCTION public.delete_company()
RETURNS boolean
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

  -- Check if current user is super admin
  IF NOT public.is_current_user_super_admin() THEN
    RAISE EXCEPTION 'insufficient_privilege: only super admin can delete organization';
  END IF;

  -- Get user's company ID
  v_company_id := public.get_user_company_id(auth.uid());

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'user_not_in_company';
  END IF;

  -- Delete company (CASCADE will handle related data)
  DELETE FROM public.companies
  WHERE id = v_company_id;

  RETURN true;
END;
$$;

-- Update create_company function to set owner_id
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

  -- Ensure a profile exists
  INSERT INTO public.profiles (id)
  VALUES (auth.uid())
  ON CONFLICT (id) DO NOTHING;

  IF public.get_user_company_id(auth.uid()) IS NOT NULL THEN
    RAISE EXCEPTION 'already_in_company';
  END IF;

  INSERT INTO public.companies (name, owner_id)
  VALUES (p_name, auth.uid())
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_current_user_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_admin_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_admin_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_company_invite_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_company() TO authenticated;

