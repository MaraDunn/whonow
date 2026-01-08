-- Fix RLS policy to allow company members to view company subscriptions
-- This enables members who join via invite code to access company subscription features

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can view company subscription" ON public.subscriptions;

-- Create a new policy that allows company members to view subscriptions of other company members
-- This way, if an admin has a subscription, all company members can see it and inherit the tier
CREATE POLICY "Users can view company subscriptions"
ON public.subscriptions FOR SELECT
USING (
  -- User can view their own subscription
  user_id = auth.uid()
  OR
  -- User can view subscriptions of other users in their company
  (
    company_id IS NOT NULL 
    AND company_id = public.get_user_company_id(auth.uid())
  )
  OR
  -- User can view subscriptions where the user_id belongs to someone in their company
  (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = subscriptions.user_id
      AND p.company_id = public.get_user_company_id(auth.uid())
    )
  )
);

