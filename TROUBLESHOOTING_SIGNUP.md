# Troubleshooting: Unable to Sign Up

If you're unable to sign up after migrating to your new Supabase project, follow these steps:

## Common Issues & Solutions

### 1. Email Confirmation Required

**Problem:** Supabase requires email confirmation by default, but you might not have email configured.

**Solution A: Disable Email Confirmation (Development)**
1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Providers** → **Email**
3. Toggle **"Confirm email"** to OFF
4. Save changes
5. Try signing up again

**Solution B: Configure Email (Production)**
1. Go to **Authentication** → **Email Templates**
2. Configure SMTP settings in **Settings** → **Auth**
3. Or use Supabase's built-in email service

### 2. Missing Database Trigger

**Problem:** The `handle_new_user` trigger might not exist, preventing profile creation.

**Check:**
```sql
-- Run this in Supabase SQL Editor
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
```

**Fix:** Re-run the migration that creates the trigger:
```sql
-- From migration: 20251220201301_17c1fb46-2c05-4d82-811e-985089753c86.sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 3. Missing Profiles Table

**Problem:** The `profiles` table might not exist.

**Check:**
```sql
-- Run this in Supabase SQL Editor
SELECT * FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'profiles';
```

**Fix:** Re-run the migration that creates the profiles table (migration `20251220201301_...`).

### 4. Row Level Security (RLS) Policies

**Problem:** RLS policies might be blocking profile creation.

**Check:**
```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'profiles';

-- Check policies
SELECT * FROM pg_policies WHERE tablename = 'profiles';
```

**Fix:** Ensure the trigger function has `SECURITY DEFINER` (it should from the migration).

### 5. Check Browser Console for Errors

1. Open your browser's Developer Tools (F12 or Cmd+Option+I)
2. Go to the **Console** tab
3. Try signing up again
4. Look for any error messages
5. Check the **Network** tab for failed API calls

### 6. Verify Supabase Connection

**Check your .env file:**
```bash
cd /Users/maradunn/whonow
cat .env
```

Ensure:
- `VITE_SUPABASE_URL` points to your new project
- `VITE_SUPABASE_PUBLISHABLE_KEY` is your new anon key
- `VITE_SUPABASE_PROJECT_ID` is your new project reference

### 7. Test Direct API Call

Run this in your browser console (on your app page):
```javascript
const { data, error } = await supabase.auth.signUp({
  email: 'test@example.com',
  password: 'Test1234!',
  options: {
    data: {
      full_name: 'Test User'
    }
  }
});
console.log('Sign up result:', { data, error });
```

This will show you the exact error message.

### 8. Check Supabase Logs

1. Go to your Supabase Dashboard
2. Navigate to **Logs** → **Auth Logs**
3. Try signing up
4. Check for any error messages

### 9. Verify All Migrations Ran

**Check migration status:**
```sql
-- In Supabase SQL Editor, check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

You should see tables like:
- `contacts`
- `profiles`
- `companies`
- `user_roles`
- etc.

### 10. Quick Diagnostic Query

Run this comprehensive check in Supabase SQL Editor:

```sql
-- Check if trigger exists
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname = 'on_auth_user_created';

-- Check if profiles table exists and has correct structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
ORDER BY ordinal_position;

-- Check if function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
AND routine_name = 'handle_new_user';
```

## Most Common Fix

**90% of signup issues are due to email confirmation being enabled.**

1. Go to **Authentication** → **Providers** → **Email**
2. Turn OFF **"Confirm email"**
3. Save
4. Try again

## Still Having Issues?

If none of these work:

1. **Check the exact error message** in browser console
2. **Check Supabase Auth logs** in dashboard
3. **Verify your .env file** has the correct new project credentials
4. **Ensure all migrations ran successfully** (check for errors in SQL Editor)

## Quick Test Script

Create a test file `test-signup.html` in your project root:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Test Signup</title>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
</head>
<body>
  <h1>Test Signup</h1>
  <input type="email" id="email" placeholder="Email">
  <input type="password" id="password" placeholder="Password">
  <button onclick="testSignup()">Test Signup</button>
  <pre id="result"></pre>

  <script>
    const SUPABASE_URL = 'YOUR_SUPABASE_URL';
    const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    async function testSignup() {
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: 'Test User'
          }
        }
      });
      
      document.getElementById('result').textContent = JSON.stringify({ data, error }, null, 2);
    }
  </script>
</body>
</html>
```

Replace `YOUR_SUPABASE_URL` and `YOUR_SUPABASE_ANON_KEY` with values from your `.env` file, then open in browser to test.

