-- Drop existing SELECT policy that allows orphan contacts to be visible
DROP POLICY IF EXISTS "Users can view their own and shared company contacts" ON contacts;

-- Create new stricter policy - only own contacts or shared company contacts
CREATE POLICY "Users can view their own and shared company contacts" ON contacts
  FOR SELECT USING (
    (owner_id = auth.uid()) OR 
    ((company_id = get_user_company_id(auth.uid())) AND (is_shared = true))
  );

-- Also fix folders table which has the same issue
DROP POLICY IF EXISTS "Users can view their own and company folders" ON folders;

CREATE POLICY "Users can view their own and company folders" ON folders
  FOR SELECT USING (
    (owner_id = auth.uid()) OR 
    ((company_id = get_user_company_id(auth.uid())) AND (owner_id IS NULL))
  );