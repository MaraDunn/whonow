# Quick Fix: Unable to Sign Up

## Most Common Issue: Email Confirmation Required

**90% of signup issues are caused by email confirmation being enabled without proper email configuration.**

### Fix Steps:

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard/project/yinicwvgwdjlkwjegrun

2. **Disable Email Confirmation (for development)**
   - Click **Authentication** in the left sidebar
   - Click **Providers**
   - Click **Email** provider
   - **Toggle OFF** "Confirm email"
   - Click **Save**

3. **Try signing up again**

## Alternative: Configure Email (for production)

If users reach "Check your email" but **never receive the verification email**, Supabase’s default sender only delivers to **team members** and has a very low rate limit. You must configure **custom SMTP** so verification emails go to all users.

See **[AUTH_EMAIL_SETUP.md](./AUTH_EMAIL_SETUP.md)** for step-by-step SMTP setup (Resend, SendGrid, Brevo, etc.) and troubleshooting.

## Other Common Issues

### Issue 2: Migrations Not Run

**Check:**
- Go to **SQL Editor** in Supabase Dashboard
- Run: `SELECT * FROM profiles LIMIT 1;`
- If you get an error, migrations haven't run

**Fix:**
- Run the `combined-migrations.sql` file in SQL Editor
- Or run migrations individually from `supabase/migrations/`

### Issue 3: Browser Console Errors

1. Open browser Developer Tools (F12)
2. Go to **Console** tab
3. Try signing up
4. Look for red error messages
5. Share the error message for further help

### Issue 4: Check Auth Logs

1. Go to Supabase Dashboard
2. Navigate to **Logs** → **Auth Logs**
3. Try signing up
4. Check for error messages in the logs

## Quick Test

Run the diagnostic script:
```bash
node diagnose-signup.js
```

This will check your configuration and identify issues.

## Still Not Working?

1. **Check the exact error message** in your browser console
2. **Verify your .env file** has the correct credentials:
   ```bash
   cat .env
   ```
3. **Check Supabase project status** - ensure it's not paused
4. **Verify you're using the correct project** - check the URL matches your project

## Need More Help?

See `TROUBLESHOOTING_SIGNUP.md` for detailed troubleshooting steps.

