# Waitlist Deployment

Use this checklist when deploying the **waitlist-only** build so visitors can only sign up for the waitlist and cannot access the app, create accounts, or call app Edge Functions.

**Included in this codebase:** waitlist route/guard, `build:waitlist` script, RLS on `waitlist` (blocks direct client inserts), rate limit on the waitlist Edge Function (10 requests/min per IP).

---

## 0. Local / .env (optional)

For local waitlist builds, `.env` can include:

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (required)
- `VITE_APP_LAUNCH_MODE=waitlist` — optional when using `npm run build:waitlist`, which sets it for you

Example:

```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
VITE_APP_LAUNCH_MODE=waitlist
```

---

## 1. Build the waitlist frontend

```bash
npm run build:waitlist
```

This sets `VITE_APP_LAUNCH_MODE=waitlist` at build time. Deploy the `dist/` output to your domain (Vercel, Netlify, S3, etc.).

---

## 2. Supabase: Edge Function secrets

In **Supabase Dashboard → Project Settings → Edge Functions** (or **Secrets**), set:

| Secret / Env         | Value     | Purpose |
|----------------------|-----------|---------|
| `APP_LAUNCH_MODE`    | `waitlist`| Makes all app Edge Functions return 403. The `waitlist` function is **not** gated and keeps working. |
| `ALLOWED_ORIGINS`    | `https://yourdomain.com,https://www.yourdomain.com` | Comma-separated. Add your production origin(s) so the waitlist form’s `fetch` gets valid CORS. Omit = only localhost works. |

---

## 3. Supabase Auth: disable new signups

In **Supabase Dashboard → Authentication → Providers → Email**:

- Turn **OFF** “Enable email signups”.

This blocks `supabase.auth.signUp()` even if someone calls it from the console with your anon key. The in-app `useAuth` already blocks sign-up/sign-in in waitlist mode; this is a second layer.

**When you go live:** turn “Enable email signups” back **ON**.

---

## 4. Run the waitlist RLS migration

If you haven’t applied it yet:

```bash
supabase db push
```

Or apply the migration that enables RLS on `public.waitlist` with **no** policies for `anon` or `authenticated`. Inserts then work only via the waitlist Edge Function (service role). Direct `supabase.from('waitlist').insert()` from the client is blocked.

---

## 5. Quick check

- [ ] `npm run build:waitlist` and deploy `dist/`
- [ ] `APP_LAUNCH_MODE=waitlist` in Supabase Edge Function secrets
- [ ] `ALLOWED_ORIGINS` includes your production URL(s)
- [ ] Email signups **disabled** in Supabase Auth
- [ ] Waitlist RLS migration applied
- [ ] Visit `https://yourdomain.com` → only waitlist page; `/app` and `/auth` redirect to `/`
- [ ] Submit an email on the waitlist form → success; no CORS errors

---

## When you go live

1. Build with **live** mode: `npm run build` (or `VITE_APP_LAUNCH_MODE=live vite build`).
2. Set `APP_LAUNCH_MODE=live` in Supabase (or remove it; default is `live`).
3. Turn **ON** “Enable email signups” in Supabase Auth.
