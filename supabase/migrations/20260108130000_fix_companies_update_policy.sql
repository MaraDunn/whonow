-- Fix companies UPDATE policy to include WITH CHECK clause
-- This ensures admins can update all fields including branding colors

DROP POLICY IF EXISTS "Users can update their company if admin" ON public.companies;

CREATE POLICY "Users can update their company if admin"
  ON public.companies FOR UPDATE
  TO authenticated
  USING (
    id = public.get_user_company_id(auth.uid()) 
    AND public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    id = public.get_user_company_id(auth.uid()) 
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

