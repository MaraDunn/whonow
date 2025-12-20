-- Drop the existing update policy that's too restrictive
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create a new update policy that allows users to update their own profile
-- They can update any field except company_id (which should only be set by RPC functions)
CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid() 
  AND (
    -- Either company_id is not changing
    company_id IS NOT DISTINCT FROM (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  )
);