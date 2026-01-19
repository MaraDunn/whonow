# Netlify Build Fix Instructions

The `netlify.toml` file is correct in your `agents` branch, but Netlify might be:
1. Building from the wrong branch (`main` instead of `agents`)
2. Using a build command override in the Netlify UI

## Fix Option 1: Update Netlify Build Settings (Recommended)

1. Go to **Netlify Dashboard** → Your Site
2. Click **Site settings** (gear icon)
3. Go to **Build & deploy** → **Continuous Deployment**
4. Check **Production branch**: Should be `agents` (or change it to `agents`)
5. Scroll down to **Build settings**
6. Click **Edit settings**
7. **Build command**: Should be empty (to use `netlify.toml`) OR set to: `npm run build`
8. **Publish directory**: Should be `dist`
9. Click **Save**

## Fix Option 2: Add Environment Variable in Netlify UI

Even though it's in `netlify.toml`, also set it in the UI to be sure:

1. Go to **Site settings** → **Build & deploy** → **Environment**
2. Click **Add variable**
3. **Key**: `VITE_APP_LAUNCH_MODE`
4. **Value**: `waitlist`
5. **Scopes**: Check "Builds" (and optionally "Deploys")
6. Click **Save**

## Fix Option 3: Merge to Main Branch

If Netlify is building from `main`:

```bash
git checkout main
git merge agents
git push origin main
```

Then update Netlify to build from `main` branch.

## Verify the Fix

After making changes:
1. Go to **Deploys** tab
2. Click **Trigger deploy** → **Deploy site**
3. Watch the build logs - it should show:
   - Build command: `npm run build` (not `build:waitlist`)
   - Environment variable `VITE_APP_LAUNCH_MODE=waitlist` should be available
4. Build should succeed
5. Visit your site - should show waitlist page

## Current Status

✅ `netlify.toml` is correct in `agents` branch:
- Build command: `npm run build`
- Environment variable: `VITE_APP_LAUNCH_MODE = "waitlist"`

❌ Netlify is still trying to run `npm run build:waitlist` (which doesn't exist)

This means Netlify is either:
- Building from wrong branch
- Has a UI override for build command
- Hasn't picked up the latest `netlify.toml` changes
