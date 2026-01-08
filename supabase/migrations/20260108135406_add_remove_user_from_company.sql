-- Function to remove a user from a company (admin only)
-- This sets the user's company_id to NULL and removes their roles
CREATE OR REPLACE FUNCTION public.remove_user_from_company(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_admin_company_id uuid;
  v_user_company_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Get admin's company ID
  v_admin_company_id := public.get_user_company_id(auth.uid());

  -- Check if admin is actually an admin
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  -- Get user's company ID
  v_user_company_id := public.get_user_company_id(p_user_id);

  -- Verify user is in the same company as admin
  IF v_user_company_id IS NULL OR v_user_company_id != v_admin_company_id THEN
    RAISE EXCEPTION 'user_not_in_company';
  END IF;

  -- Prevent admin from removing themselves
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_remove_self';
  END IF;

  -- Remove user from company (set company_id to NULL)
  UPDATE public.profiles
  SET company_id = NULL
  WHERE id = p_user_id;

  -- Remove all user roles (they're no longer in the company)
  DELETE FROM public.user_roles
  WHERE user_id = p_user_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_user_from_company(uuid) TO authenticated;

