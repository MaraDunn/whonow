# Lovable Dependencies Summary

## ✅ Found Dependencies

### 1. **Critical - Must Fix** ⚠️

**Hardcoded Lovable URLs in Edge Functions:**

1. **`supabase/functions/slack-integration/index.ts`** (line 24)
   - Fallback URL: `https://4bf33c78-836d-463a-a955-3c63d9df84b3.lovableproject.com`
   - **Impact**: OAuth redirects will fail if Lovable project is removed
   - **Fix**: Update to your production URL or use `APP_URL` env variable

2. **`supabase/functions/_shared/security.ts`** (line 14)
   - CORS allowed origin: `https://4bf33c78-836d-463a-a955-3c63d9df84b3.lovableproject.com`
   - **Impact**: CORS errors if your app runs on different domain
   - **Fix**: Update with your production URL(s)

### 2. **Optional - Can Remove** 📦

**lovable-tagger Package:**
- **Location**: `package.json` (devDependencies), `vite.config.ts`
- **Purpose**: Component tagging for development
- **Impact**: None - only used in development mode
- **Action**: Remove if you don't need component tagging

### 3. **Documentation Only** 📝

1. **`README.md`** - Contains Lovable project documentation
2. **`index.html`** - OpenGraph images from lovable.dev
3. **`SECURITY.md`** - Mentions `LOVABLE_API_KEY` (not actually used)

---

## Quick Fix

Run the automated script:

```bash
# For local development
./fix-lovable-urls.sh

# For production (replace with your URL)
./fix-lovable-urls.sh https://yourdomain.com
```

Or manually update the files as described in `REMOVE_LOVABLE_DEPENDENCIES.md`.

---

## Priority Actions

1. ✅ **Update edge function URLs** (HIGH PRIORITY)
   - Fix `slack-integration/index.ts`
   - Fix `_shared/security.ts`
   - Set `APP_URL` in Supabase Edge Functions settings

2. ⚠️ **Remove lovable-tagger** (OPTIONAL)
   - Only if you don't need component tagging
   - Safe to keep for development

3. 📝 **Update documentation** (OPTIONAL)
   - Update README.md
   - Update index.html OpenGraph images

---

## Files to Update

- ✅ `supabase/functions/slack-integration/index.ts` - **MUST FIX**
- ✅ `supabase/functions/_shared/security.ts` - **MUST FIX**
- ⚠️ `vite.config.ts` - Optional (remove lovable-tagger)
- ⚠️ `package.json` - Optional (remove lovable-tagger)
- 📝 `README.md` - Optional (documentation)
- 📝 `index.html` - Optional (metadata)

---

## Testing After Fix

1. Test Slack OAuth integration (if used)
2. Test Teams OAuth integration (if used)
3. Check browser console for CORS errors
4. Verify edge functions work correctly

---

## Summary

**2 critical files** need updating with your production URL.

**1 optional package** can be removed if desired.

Everything else is just documentation/metadata.

