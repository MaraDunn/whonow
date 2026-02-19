-- Grant execute on has_role so Edge Functions (service role) and authenticated clients can call it.
-- Required for org-level Slack/Teams integration admin checks.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
