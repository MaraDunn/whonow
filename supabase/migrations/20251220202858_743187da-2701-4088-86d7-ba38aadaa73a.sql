-- Ensure we can safely do idempotent role inserts
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_id_role_uidx
ON public.user_roles (user_id, role);

-- Prevent users from changing their company_id directly (company membership should be managed server-side)
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND company_id = public.get_user_company_id(auth.uid())
);

-- Scope role management to members of the same company
DROP POLICY IF EXISTS "Admins can manage roles in their company" ON public.user_roles;
CREATE POLICY "Admins can manage roles in their company"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND public.get_user_company_id(user_id) = public.get_user_company_id(auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND public.get_user_company_id(user_id) = public.get_user_company_id(auth.uid())
);

-- Create company + assign the current user as admin (atomic)
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

-- Join a company via invite code + assign member role (atomic)
CREATE OR REPLACE FUNCTION public.join_company(p_invite_code text)
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

  IF p_invite_code IS NULL OR btrim(p_invite_code) = '' THEN
    RAISE EXCEPTION 'invite_code_required';
  END IF;

  -- Ensure a profile exists
  INSERT INTO public.profiles (id)
  VALUES (auth.uid())
  ON CONFLICT (id) DO NOTHING;

  IF public.get_user_company_id(auth.uid()) IS NOT NULL THEN
    RAISE EXCEPTION 'already_in_company';
  END IF;

  SELECT c.id
  INTO v_company_id
  FROM public.companies c
  WHERE c.invite_code = lower(btrim(p_invite_code))
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'invalid_invite_code';
  END IF;

  UPDATE public.profiles
  SET company_id = v_company_id
  WHERE id = auth.uid();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'member'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN v_company_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_company(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_company(text) TO authenticated;
