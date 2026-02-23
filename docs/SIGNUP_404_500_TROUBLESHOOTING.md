# Signup 404 and 500 Errors — What They Mean

You may see:

1. **404** — "Failed to load resource: the server responded with a status of 404"
2. **500** — On `https://yinicwvgwdjlkwjegrun.supabase.co/auth/v1/signup?redirect_to=https%3A%2F%2Fwhonow.co%2Fauth`

Here’s what’s going on and how to fix it.

---

## 404 error

A **404** means “URL not found.” The browser or app is requesting something that the server doesn’t have.

- **If you don’t see the full URL in the console:** Click the failed request in the Network tab and check the **Request URL**. That tells you what returned 404.
- **Typical cases:**
  - **Static asset** (JS, CSS, image, favicon) — path wrong or file missing on the server (e.g. wrong base path or build output).
  - **API or route** — you’re calling a URL that doesn’t exist (typo, wrong env, or route not deployed).

**What to do:** Fix the 404 by correcting the URL or ensuring that resource exists at that path. The signup **500** (below) is unrelated to a random 404 unless the 404 is for the same signup request (in that case the host might be wrong).

---

## 500 on Supabase signup

The **500** is returned by **Supabase Auth** on:

`.../auth/v1/signup?redirect_to=https%3A%2F%2Fwhonow.co%2Fauth`

So the failure is on the **server side** during signup. The app is sending `redirect_to=https://whonow.co/auth` (from `getAuthRedirectOrigin() + '/auth'`). Common causes:

### 1. Redirect URL not allowlisted (most common)

If `https://whonow.co/auth` is **not** in Supabase’s allowed list, the auth server can respond with **500**.

**Fix:**

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. **Authentication** → **URL Configuration** → **Redirect URLs**.
3. Add:
   - `https://whonow.co/auth`
   - `https://www.whonow.co/auth`
4. Save and try signup again.

### 2. Auth logs show the real error

Supabase logs the underlying error.

**Steps:**

1. Dashboard → **Logs** → **Auth Logs**.
2. Trigger signup again.
3. Find the failed signup and open the log entry — it will show the actual error (e.g. “redirect URL not allowed”, trigger failure, SMTP error).

Use that message to decide the fix below.

### 3. Database trigger failing

On signup, a trigger `handle_new_user` inserts a row into `public.profiles`. If that insert fails (e.g. constraint, missing column, RLS), Auth can return **500**.

**Check:**

- **Auth Logs** (above) for a Postgres/trigger error.
- In **SQL Editor**, run:  
  `SELECT * FROM profiles LIMIT 1;`  
  If this errors, migrations may not be applied.
- Ensure all migrations in `supabase/migrations/` have been run (e.g. via SQL Editor or `supabase db push`).

### 4. Email (SMTP) failure

If **Confirm email** is ON and sending the verification email fails (e.g. custom SMTP misconfigured, or default sender failing), some configurations return **500**.

**Fix:**

- Either configure **Custom SMTP** (see [VERIFICATION_EMAIL_FIX.md](../VERIFICATION_EMAIL_FIX.md) and [AUTH_EMAIL_SETUP.md](../AUTH_EMAIL_SETUP.md)),  
- Or temporarily turn **OFF** “Confirm email” under **Authentication** → **Providers** → **Email** (for dev only).

---

## Get the exact error (redirect URL already allowlisted)

If the redirect URL is already in the allowlist and you still get 500, you need the **exact error** from Supabase:

### 1. Auth logs (status 500)

1. Open **Log Explorer**:  
   [https://supabase.com/dashboard/project/yinicwvgwdjlkwjegrun/logs/explorer](https://supabase.com/dashboard/project/yinicwvgwdjlkwjegrun/logs/explorer)
2. Set the log type to **Auth** (or filter by auth).
3. Set time range to include when you tried signup.
4. Trigger a signup again, then find the failed request (status 500).
5. **Double-click the row** to expand it and read the error message.

### 2. Postgres logs (trigger / constraint errors)

If the Auth log doesn't show the cause, check Postgres logs for errors from `supabase_auth_admin`: look for recent **ERROR** or **FATAL** entries around the time of signup. Messages often mention the trigger name, `handle_new_user`, `profiles`, constraint names, or "row-level security".

### 3. What the error usually means

| Log message / code | Likely cause | What to do |
|--------------------|--------------|------------|
| Trigger / function / `handle_new_user` | Trigger or RLS blocking insert into `profiles` | Apply migration `20260223000000_fix_handle_new_user_trigger.sql`, then retry. |
| `42501` / permission / must be owner | Trigger runs as a role that can't insert into `public.profiles` | Same migration; if it persists, check function owner and RLS on `profiles`. |
| `23503` / foreign key / constraint | A constraint on `auth.users` or `profiles` is failing | Fix or drop the constraint shown in the log. |
| `gomail` / SMTP / email | Sending verification email failed | Fix SMTP in **Authentication → SMTP**, or temporarily turn off **Confirm email** under **Providers → Email**. |
| **554 5.7.8 Access Restricted** (Zoho) | Zoho Mail is blocking SMTP from Supabase | See **Zoho "Access Restricted"** below; or switch to Resend/SendGrid, or turn off **Confirm email** temporarily. |
| Template / email template | Broken or invalid email template | **Authentication → Email Templates** → simplify or fix the "Confirm sign up" template. |

### 4. Trigger fix migration

If the logs point to the **trigger** (e.g. permission or RLS on `profiles`), run the migration that hardens `handle_new_user`:

- File: `supabase/migrations/20260223000000_fix_handle_new_user_trigger.sql`
- In Dashboard: **SQL Editor** → paste the contents of that file → Run.

Then try signup again.

---

## Zoho "554 5.7.8 Access Restricted" (confirmation email blocked)

If the Auth log shows **500: Error sending confirmation email** and the error body contains **554 5.7.8 Access Restricted**, **Zoho Mail** is rejecting the SMTP connection from Supabase. Zoho often restricts SMTP for third-party or cloud senders.

**Options (pick one):**

### A. Use a transactional email provider (recommended)

Switch Supabase to a provider meant for app emails (they allow sending from cloud servers):

1. **Supabase Dashboard** → **Authentication** → **SMTP**.
2. Configure **Custom SMTP** with a provider such as:
   - **[Resend](https://resend.com)** — verify your domain, create an API key, use SMTP or Resend’s Supabase guide.
   - **SendGrid**, **Brevo**, **Postmark**, etc.
3. Use a **From** address on a domain you control (e.g. `no-reply@whonow.co`).
4. See [VERIFICATION_EMAIL_FIX.md](../VERIFICATION_EMAIL_FIX.md) and [AUTH_EMAIL_SETUP.md](../AUTH_EMAIL_SETUP.md) for step-by-step SMTP setup.

### B. Fix Zoho (if you must keep Zoho)

- In Zoho Mail / Zoho Admin, check whether **SMTP access** is allowed for your account/domain and whether there are IP or “access restricted” rules that block Supabase’s servers.
- Ensure the **sender address** used in Supabase SMTP is a valid Zoho mailbox and that the password is correct (or use an app-specific password if Zoho requires it).
- Zoho’s announcement: [Zoho Mail Server Details](https://help.zoho.com/portal/en/community/topic/zoho-mail-server-details). If they no longer allow SMTP from third-party apps, use option A instead.

### C. Temporary workaround (dev only)

To get signup working without fixing email:

1. **Supabase Dashboard** → **Authentication** → **Providers** → **Email**.
2. Turn **OFF** “Confirm email”.
3. Save.

Users will be able to sign up without verifying email. Re-enable “Confirm email” and fix SMTP (A or B) before production.

---

## Quick checklist

- [ ] **Redirect URLs** include `https://whonow.co/auth` (and `https://www.whonow.co/auth` if you use www).
- [ ] **Auth Logs** (and Postgres logs if needed) checked for the exact error on signup.
- [ ] **Trigger:** if error is trigger/RLS, run `20260223000000_fix_handle_new_user_trigger.sql`.
- [ ] **Migrations** applied; `profiles` exists and is readable.
- [ ] **Email:** either “Confirm email” off (dev) or SMTP correctly set up (prod).

After fixing redirect URLs and checking Auth Logs, try signup again. If it still returns 500, the Auth Log entry will point to the next fix (trigger, email, or config).
