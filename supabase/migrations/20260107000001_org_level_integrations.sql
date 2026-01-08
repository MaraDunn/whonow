-- Migration: Organization-Level Integrations
-- This migration enables organization-level Slack and Teams integrations
-- so that org admins can connect once for the entire organization

-- Add scope column to track whether integration is user-level or org-level
ALTER TABLE public.integrations 
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'user' CHECK (scope IN ('user', 'organization'));

-- Add index for faster org-level integration lookups
CREATE INDEX IF NOT EXISTS idx_integrations_company_provider 
  ON public.integrations(company_id, provider) 
  WHERE scope = 'organization' AND is_active = true;

-- Update RLS policies to allow org members to view org-level integrations
DROP POLICY IF EXISTS "Users can view their own integrations" ON public.integrations;
CREATE POLICY "Users can view their own and org integrations"
  ON public.integrations FOR SELECT
  USING (
    auth.uid() = user_id 
    OR (
      scope = 'organization' 
      AND company_id = public.get_user_company_id(auth.uid())
    )
  );

-- Only admins can create org-level integrations
DROP POLICY IF EXISTS "Users can insert their own integrations" ON public.integrations;
CREATE POLICY "Users can insert their own or org integrations"
  ON public.integrations FOR INSERT
  WITH CHECK (
    (scope = 'user' AND auth.uid() = user_id)
    OR (
      scope = 'organization' 
      AND public.has_role(auth.uid(), 'admin'::app_role)
      AND company_id = public.get_user_company_id(auth.uid())
    )
  );

-- Only admins can update org-level integrations
DROP POLICY IF EXISTS "Users can update their own integrations" ON public.integrations;
CREATE POLICY "Users can update their own or org integrations"
  ON public.integrations FOR UPDATE
  USING (
    (scope = 'user' AND auth.uid() = user_id)
    OR (
      scope = 'organization'
      AND public.has_role(auth.uid(), 'admin'::app_role)
      AND company_id = public.get_user_company_id(auth.uid())
    )
  );

-- Only admins can delete org-level integrations
DROP POLICY IF EXISTS "Users can delete their own integrations" ON public.integrations;
CREATE POLICY "Users can delete their own or org integrations"
  ON public.integrations FOR DELETE
  USING (
    (scope = 'user' AND auth.uid() = user_id)
    OR (
      scope = 'organization'
      AND public.has_role(auth.uid(), 'admin'::app_role)
      AND company_id = public.get_user_company_id(auth.uid())
    )
  );

-- Update unique constraint to allow one org-level integration per provider per company
-- and one user-level integration per provider per user
ALTER TABLE public.integrations DROP CONSTRAINT IF EXISTS integrations_user_id_provider_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_integrations_user_provider 
  ON public.integrations(user_id, provider) 
  WHERE scope = 'user';
CREATE UNIQUE INDEX IF NOT EXISTS idx_integrations_company_provider_unique
  ON public.integrations(company_id, provider) 
  WHERE scope = 'organization';

-- Add comment to clarify the integration scope model
COMMENT ON COLUMN public.integrations.scope IS 
  'Determines if integration is user-level or organization-level. Organization-level integrations can only be managed by admins.';

