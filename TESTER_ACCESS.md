# Separate Link for Testers

Use a **separate URL** so testers get the full app (sign-in, `/app`, etc.) while your main site stays in waitlist mode.

## How it works

- **Main site** (e.g. `yourapp.com`): Built with `VITE_APP_LAUNCH_MODE=waitlist` and **no** `VITE_DEV_MODE`. Visitors see the waitlist landing; `/app` and sign-in are blocked.
- **Tester link**: Built with `VITE_APP_LAUNCH_MODE=waitlist` and **`VITE_DEV_MODE=true`**. That build bypasses waitlist restrictions, so testers get the full app.

Same codebase; different build env → different URL for testers.

---

## Option A: Second Netlify site (recommended)

1. In Netlify: **Add new site** → **Import an existing project** → same repo and branch as production.
2. **Site settings** → **Environment variables** → add:
   - `VITE_APP_LAUNCH_MODE` = `waitlist`
   - `VITE_DEV_MODE` = `true`
   - Same Supabase (and any other) vars as production.
3. **Build & deploy** → Build command: `npm run build` (or use the tester script below).
4. Give testers this site’s URL (e.g. `tester-site.netlify.app` or a custom subdomain like `app.yourdomain.com`).

Your main site’s env stays as-is (no `VITE_DEV_MODE`), so the main URL remains waitlist-only.

---

## Option B: Netlify branch deploy

1. Create a branch (e.g. `testers` or `staging`).
2. **Site settings** → **Environment variables** → **Edit variables** → **Scope by deploy context**.
3. Add a variable scoped to **Branch deploys** (or only to branch `testers`):
   - Key: `VITE_DEV_MODE`  
   - Value: `true`
4. Push to that branch (or open a PR from it). Netlify will build with `VITE_DEV_MODE=true`.
5. Share the branch deploy URL with testers (e.g. `testers--yoursite.netlify.app`).

Production branch (e.g. `main`) keeps current env, so production stays waitlist-only.

---

## Build script for tester deploys

Use this when the build is for the tester link (Option A or B):

```bash
npm run build:tester
```

This runs:

- `VITE_APP_LAUNCH_MODE=waitlist VITE_DEV_MODE=true vite build`

So the built app still has “waitlist” mode configured but bypasses it (full app). Deploy the `dist/` output to the tester URL.

---

## Checklist

- [ ] Main production URL has **no** `VITE_DEV_MODE` (or leave it unset).
- [ ] Tester URL is built with `VITE_DEV_MODE=true` (second site or branch deploy).
- [ ] Supabase and other env vars are set for the tester site/branch.
- [ ] Redirect URLs in Supabase include the tester URL (e.g. `https://tester-site.netlify.app/auth`) if testers will sign in there.
