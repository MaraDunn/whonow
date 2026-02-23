# Verification Email Not Sending — Quick Fix

When users sign up and see "Check your email" but **no verification email arrives**, Supabase is using its default sender, which only delivers to **Supabase org team members** and has a very low rate limit. You must configure **custom SMTP** in the Supabase Dashboard.

## Steps (in order)

### 1. Choose an SMTP provider

Use one you already have, or sign up for a transactional provider, for example:

- **[Resend](https://resend.com)** — simple, [Supabase SMTP guide](https://resend.com/docs/send-with-supabase-smtp)
- **[Brevo](https://www.brevo.com)** (formerly Sendinblue)
- **[SendGrid](https://sendgrid.com)**
- **[Postmark](https://postmarkapp.com)**

Get from the provider:

- **SMTP host** (e.g. `smtp.resend.com`)
- **Port** (often `465` or `587`)
- **Username** (often `resend` for Resend)
- **Password** or **API key** (used as SMTP password)
- A **From** address on a domain you control (e.g. `no-reply@whonow.co`)

### 2. Configure SMTP in Supabase

1. Open **[Supabase Dashboard](https://supabase.com/dashboard)** → your project.
2. Go to **Authentication** → **SMTP**  
   (or **Project Settings** → **Auth** and find the SMTP section).
3. Enable **Custom SMTP** and set:
   - **Sender email:** e.g. `no-reply@whonow.co`
   - **Sender name:** e.g. `WhoNow`
   - **Host:** from your provider (e.g. `smtp.resend.com`)
   - **Port:** `465` or `587`
   - **Username / Password:** from your provider
4. **Save.**

### 3. Confirm email is required (so the email is sent)

1. Go to **Authentication** → **Providers** → **Email**.
2. Ensure **Confirm email** is **ON**.
3. Save if you changed it.

### 4. Redirect URLs (so the link in the email works)

1. Go to **Authentication** → **URL Configuration** → **Redirect URLs**.
2. Add your production auth URL, e.g.:
   - `https://whonow.co/auth`
   - `https://www.whonow.co/auth`
3. For local dev you can also add `http://localhost:8080/auth` (or your dev port).

### 5. Test

1. Sign up with a **new** email (not one already in Auth).
2. Check inbox and spam.
3. If it still doesn’t arrive: **Dashboard** → **Logs** → **Auth Logs**, trigger sign-up or “Resend verification email”, and look for SMTP/email errors (wrong host, auth failed, etc.).

---

## Resend (example)

If you use Resend:

1. [Resend](https://resend.com) → **API Keys** — use an existing key or create one.
2. Add and verify your domain (e.g. `whonow.co`) in Resend.
3. In Supabase **Authentication** → **SMTP**:
   - **Host:** `smtp.resend.com`
   - **Port:** `465`
   - **Username:** `resend`
   - **Password:** your Resend API key (same key you use for the API; no separate SMTP password)
   - **Sender email:** e.g. `onboarding@whonow.co` (must be from your verified domain)

---

## More detail

- Full SMTP and troubleshooting: **[AUTH_EMAIL_SETUP.md](./AUTH_EMAIL_SETUP.md)**
- Supabase: [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Not receiving auth emails](https://supabase.com/docs/guides/troubleshooting/not-receiving-auth-emails-from-the-supabase-project)
