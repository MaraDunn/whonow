# Waitlist Mode Deployment Fix

Your app has been rebuilt with waitlist mode enabled. Follow these steps to deploy it:

## ✅ Step 1: Deploy the New Build (COMPLETED)

The waitlist build has been created in the `dist/` folder. You now need to deploy this folder to your hosting platform.

### If using Netlify:
1. Go to your Netlify dashboard
2. Drag and drop the `dist/` folder, OR
3. If using Git integration, push the changes and Netlify will auto-deploy (make sure `netlify.toml` is in your repo - it already has the correct build command)

### If using Vercel:
1. Go to your Vercel dashboard
2. In your project settings, set the build command to: `npm run build:waitlist`
3. Set the output directory to: `dist`
4. Redeploy your project

### If using other platforms (S3, Cloudflare Pages, etc.):
1. Upload the contents of the `dist/` folder to your hosting platform
2. Make sure your build command is set to `npm run build:waitlist` for future deployments

---

## ⚙️ Step 2: Configure Supabase Edge Function Secrets

You need to set environment variables in Supabase to enable waitlist mode on the backend:

1. Go to **Supabase Dashboard** → Your Project → **Project Settings** → **Edge Functions** (or look for **Secrets**)
2. Add/Update these secrets:

   | Secret Name | Value | Purpose |
   |------------|-------|---------|
   | `APP_LAUNCH_MODE` | `waitlist` | Blocks all app Edge Functions (except waitlist function) |
   | `ALLOWED_ORIGINS` | `https://yourdomain.com,https://www.yourdomain.com` | Replace with your actual domain(s). Comma-separated list. |

**Important:** Replace `yourdomain.com` with your actual domain. For example:
- If your domain is `whonow.com`, set it to: `https://whonow.com,https://www.whonow.com`
- If you have a subdomain like `app.whonow.com`, include that too

---

## 🔒 Step 3: Disable Email Signups in Supabase

1. Go to **Supabase Dashboard** → **Authentication** → **Providers** → **Email**
2. Turn **OFF** "Enable email signups"
3. This prevents anyone from creating accounts even if they try to call the API directly

**Note:** When you're ready to go live, turn this back **ON**.

---

## ✅ Step 4: Verify Waitlist RLS Migration

The waitlist table should have RLS enabled. If you haven't applied the migration yet:

```bash
supabase db push
```

Or manually check in Supabase Dashboard → **Database** → **Tables** → `waitlist` → make sure RLS is enabled.

---

## 🧪 Step 5: Test Your Deployment

After deploying, test these:

- [ ] Visit `https://yourdomain.com` → Should show the waitlist page (not the full app)
- [ ] Try visiting `https://yourdomain.com/app` → Should redirect to `/`
- [ ] Try visiting `https://yourdomain.com/auth` → Should redirect to `/`
- [ ] Submit an email on the waitlist form → Should succeed with no CORS errors
- [ ] Check browser console → Should see `[LaunchMode] IS_WAITLIST_MODE: true`

---

## 🚀 When You're Ready to Go Live

1. **Rebuild:** Run `npm run build` (without `:waitlist`)
2. **Deploy:** Deploy the new `dist/` folder
3. **Supabase:** Set `APP_LAUNCH_MODE=live` (or remove it - default is `live`)
4. **Auth:** Turn **ON** "Enable email signups" in Supabase

---

## Quick Checklist

- [x] Built with waitlist mode (`npm run build:waitlist`)
- [ ] Deployed `dist/` folder to hosting platform
- [ ] Set `APP_LAUNCH_MODE=waitlist` in Supabase Edge Function secrets
- [ ] Set `ALLOWED_ORIGINS` with your domain(s) in Supabase
- [ ] Disabled email signups in Supabase Auth
- [ ] Verified waitlist RLS migration is applied
- [ ] Tested the deployment
