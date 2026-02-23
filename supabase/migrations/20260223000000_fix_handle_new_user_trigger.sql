-- Fix handle_new_user trigger for signup 500 errors.
-- Supabase runs this trigger in a context where auth.uid() may be null, so RLS
-- can block the insert. Using SECURITY DEFINER with an explicit search_path
-- and qualifying public.profiles ensures the function has the right privileges.
-- See: https://supabase.com/docs/guides/troubleshooting/resolving-500-status-authentication-errors-7bU5U8

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
  );
  RETURN NEW;
END;
$$;

-- Ensure the trigger exists (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
