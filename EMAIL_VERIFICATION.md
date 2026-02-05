# Email Verification

Users must verify their email address before they can use the app. This ensures only real, reachable email addresses can be used for accounts.

## How it works

1. **Sign up**: When a user signs up, Supabase sends a verification email. The app shows a "Check your email" screen and does not redirect to the app until the user has verified.
2. **Verify**: The user clicks the link in the email and is redirected to `/auth`. Supabase establishes a session from the link; the user can then use the app.
3. **Sign in**: If a user tries to sign in before verifying, they see "Please confirm your email address."
4. **Protected routes**: If a session exists but the email is not confirmed (e.g. confirmation was enabled later), the user is redirected to `/auth` and asked to verify.

## Email template (branded verification email)

A professional, branded HTML template for the verification email lives in `supabase/templates/confirm-signup.html`. It includes WhoNow branding and a button CTA instead of a plain link. See [docs/EMAIL_TEMPLATES.md](docs/EMAIL_TEMPLATES.md) for how to apply it (Dashboard vs local config) and the **Site URL** requirement so the logo loads.

## Supabase configuration

### Confirm email

- **Dashboard**: **Authentication** → **Providers** → **Email** → enable **Confirm email**.
- On hosted Supabase projects this is often **on by default**; verify it for your project.

### Redirect URLs

The confirmation link must redirect to a URL allowlisted in Supabase:

- **Dashboard**: **Authentication** → **URL Configuration** → **Redirect URLs**.
- Add the URLs where users land after clicking the confirmation link, for example:
  - `https://your-production-domain.com/auth`
  - `https://your-production-domain.com/`
  - `http://localhost:5173/auth` (and `/` if used for local dev)

The app uses `emailRedirectTo: origin + '/auth'` so users land on `/auth` after verifying. Ensure `/auth` (and any other URLs you use) is in the Redirect URLs list.

### Custom SMTP (production)

Supabase’s default email sender has low rate limits. For production:

- **Dashboard**: **Project Settings** → **Auth** → **SMTP**.
- Configure a custom SMTP server so verification emails are reliable and less likely to be flagged as spam.

## Resend verification email

On the "Check your email" screen, users can use **Resend verification email**. The button is disabled for 60 seconds after each send to avoid abuse. Note: Supabase’s `resend()` may not always preserve the original `emailRedirectTo` in the resent link; if that’s an issue, consider a custom auth email hook.
