-- Enable RLS on waitlist so only the waitlist Edge Function (service_role) can insert.
-- No policies for anon or authenticated: direct client inserts are blocked.
-- The waitlist Edge Function uses SUPABASE_SERVICE_ROLE_KEY and bypasses RLS.

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- No permissive policies: anon and authenticated get no access.
-- Service role (Edge Function) bypasses RLS and can still insert.
