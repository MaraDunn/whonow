# Auth Email Templates

Verification and other auth emails are sent by **Supabase Auth**, not by app code. This project includes a branded HTML template for the **Confirm sign up** (verification) email so users receive a professional email with WhoNow branding and a button CTA instead of a plain link.

## Template location

- **Confirm sign up (verification):** `supabase/templates/confirm-signup.html`

The template uses Supabase’s [Go template](https://pkg.go.dev/text/template) variables: `{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .SiteURL }}`. The logo is loaded from `{{ .SiteURL }}/logo-icon.png`, so the app must serve `public/logo-icon.png` at the root and **Site URL** in Supabase must match your app origin.

## How to apply the template

### Hosted Supabase (Dashboard)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → **Authentication** → **Email Templates** → **Confirm sign up**.
2. Set **Subject** to: `Verify your WhoNow account`.
3. Paste the full HTML from `supabase/templates/confirm-signup.html` into the body editor. The Dashboard uses the same variables (`{{ .ConfirmationURL }}`, etc.); no replacement needed.
4. In **Authentication** → **URL Configuration**, set **Site URL** to your app origin (e.g. `https://app.whonow.com`) so `{{ .SiteURL }}/logo-icon.png` resolves correctly and the logo appears in the email.

### Local / self-hosted

The repo config already points Auth at the template for local development:

- In `supabase/config.toml`, the section `[auth.email.template.confirmation]` sets:
  - `subject = "Verify your WhoNow account"`
  - `content_path = "./supabase/templates/confirm-signup.html"`

Ensure **Site URL** in your local Supabase Auth config (or `.env`) matches the URL where your app runs (e.g. `http://localhost:5173`) so the logo loads when testing.

## Site URL requirement

**Site URL** (Auth → URL Configuration in the Dashboard, or equivalent in config) must be the base URL of your app. It is used for:

- The verification link redirect after the user clicks **Verify my email**.
- The logo in the email: `{{ .SiteURL }}/logo-icon.png` (your app must serve `logo-icon.png` at the root).

If Site URL is wrong, the logo may not load in the email and redirects may fail.

### Logo not loading in the email

If the verification email shows a broken image where the logo should be:

1. **Supabase Dashboard** → **Authentication** → **URL Configuration**.
2. Set **Site URL** to the **public URL of your web app** (the place where your app is deployed and where `/logo-icon.png` is served). For example: `https://app.whonow.com` or `https://whonow.co`.
3. Do **not** use the Supabase project URL (e.g. `https://xxx.supabase.co`) or `tauri://localhost` as Site URL — neither serves your app’s assets, so the logo request will fail.
4. Keep **Redirect URLs** as-is (you can still list both your web app and `tauri://localhost/auth` so verification works from desktop and web). Site URL only affects the *logo* image URL and default redirect; the actual link in the email uses the redirect URL from the sign-up request.

After saving, new verification emails will use the correct logo URL.

## Optional: other auth emails

The same layout (logo, colors, button + fallback link, footer) can be reused for:

- **Reset password** (recovery) – same `{{ .ConfirmationURL }}`; different copy.
- **Change email address** – uses `{{ .ConfirmationURL }}` and optionally `{{ .NewEmail }}`.

Add `supabase/templates/recovery.html` and `supabase/templates/email-change.html` if you want a consistent branded look for those emails, then configure them in the Dashboard or in `config.toml` under `[auth.email.template.recovery]` and `[auth.email.template.email_change]`.
