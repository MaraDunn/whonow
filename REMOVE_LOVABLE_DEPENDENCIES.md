# Removing Lovable Dependencies

This guide will help you remove all remaining Lovable dependencies from your project.

## Found Dependencies

### 1. ✅ **lovable-tagger** Package (Optional - Dev Dependency)
- **Location**: `package.json`, `vite.config.ts`
- **Impact**: Low - Only used for development component tagging
- **Action**: Can be removed or kept (doesn't affect production)

### 2. ⚠️ **Hardcoded Lovable URLs** (Important - Needs Update)
- **Location**: 
  - `supabase/functions/slack-integration/index.ts` (line 24)
  - `supabase/functions/_shared/security.ts` (line 14)
- **Impact**: High - These are fallback URLs that will break if Lovable project is removed
- **Action**: **MUST UPDATE** with your production URL

### 3. 📝 **Documentation References** (Optional)
- **Location**: `README.md`, `index.html`
- **Impact**: None - Just documentation/metadata
- **Action**: Optional cleanup

### 4. 🔍 **LOVABLE_API_KEY** (Not Found in Use)
- **Location**: Mentioned in `SECURITY.md`
- **Impact**: None - Not actually used in code
- **Action**: Documentation only, can be ignored

---

## Step-by-Step Removal

### Step 1: Update Edge Function URLs

#### A. Update Slack Integration Function

**File**: `supabase/functions/slack-integration/index.ts`

**Find** (line 24):
```typescript
const appUrl = Deno.env.get("APP_URL") || "https://4bf33c78-836d-463a-a955-3c63d9df84b3.lovableproject.com";
```

**Replace with**:
```typescript
const appUrl = Deno.env.get("APP_URL") || "http://localhost:8080";
// Or your production URL: "https://yourdomain.com"
```

#### B. Update Security CORS Configuration

**File**: `supabase/functions/_shared/security.ts`

**Find** (line 14):
```typescript
const ALLOWED_ORIGINS = [
  "https://4bf33c78-836d-463a-a955-3c63d9df84b3.lovableproject.com",
  "http://localhost:5173",
  "http://localhost:3000",
];
```

**Replace with**:
```typescript
const ALLOWED_ORIGINS = [
  "http://localhost:8080",  // Your local dev URL
  "http://localhost:5173",  // Alternative local port
  "http://localhost:3000",  // Alternative local port
  // Add your production URL here:
  // "https://yourdomain.com",
];
```

**Better approach**: Use environment variable:
```typescript
const ALLOWED_ORIGINS = [
  Deno.env.get("APP_URL") || "http://localhost:8080",
  "http://localhost:5173",
  "http://localhost:3000",
  ...(Deno.env.get("ALLOWED_ORIGINS")?.split(",") || []),
].filter(Boolean);
```

### Step 2: Remove lovable-tagger (Optional)

If you don't need component tagging:

**A. Remove from package.json**:
```bash
npm uninstall lovable-tagger
```

**B. Update vite.config.ts**:

**Find**:
```typescript
import { componentTagger } from "lovable-tagger";
```

**Replace with** (remove the import and usage):
```typescript
// Remove: import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()].filter(Boolean),  // Remove componentTagger()
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
```

**OR** keep it if you want component tagging in development (it's harmless).

### Step 3: Update Documentation (Optional)

#### A. Update README.md

Replace Lovable-specific content with your own project documentation.

#### B. Update index.html

**Find** (lines 13, 17):
```html
<meta property="og:image" content="https://lovable.dev/opengraph-image-p98pqg.png" />
<meta name="twitter:image" content="https://lovable.dev/opengraph-image-p98pqg.png" />
```

**Replace with** your own OpenGraph image URLs or remove if not needed.

### Step 4: Set Environment Variables for Edge Functions

In your Supabase Dashboard:

1. Go to **Edge Functions** → **Settings**
2. Add secrets:
   - `APP_URL`: Your production URL (e.g., `https://yourdomain.com`)
   - `ALLOWED_ORIGINS`: Comma-separated list of allowed origins (optional)

This ensures edge functions use your URLs instead of hardcoded Lovable URLs.

---

## Quick Fix Script

Run this to automatically update the critical files:

```bash
# Update slack-integration function
sed -i '' 's|https://4bf33c78-836d-463a-a955-3c63d9df84b3.lovableproject.com|http://localhost:8080|g' supabase/functions/slack-integration/index.ts

# Update security.ts
sed -i '' 's|https://4bf33c78-836d-463a-a955-3c63d9df84b3.lovableproject.com|http://localhost:8080|g' supabase/functions/_shared/security.ts
```

**Note**: Replace `http://localhost:8080` with your actual production URL.

---

## Verification Checklist

After making changes:

- [ ] Updated `supabase/functions/slack-integration/index.ts` with your URL
- [ ] Updated `supabase/functions/_shared/security.ts` with your URLs
- [ ] Set `APP_URL` environment variable in Supabase Edge Functions
- [ ] Test Slack integration (if used)
- [ ] Test Teams integration (if used)
- [ ] Removed `lovable-tagger` (optional)
- [ ] Updated `README.md` (optional)
- [ ] Updated `index.html` OpenGraph images (optional)

---

## Priority

**HIGH PRIORITY** (Must fix):
1. ✅ Update URLs in `slack-integration/index.ts`
2. ✅ Update URLs in `_shared/security.ts`
3. ✅ Set `APP_URL` environment variable in Supabase

**LOW PRIORITY** (Optional):
1. Remove `lovable-tagger` package
2. Update documentation files
3. Update OpenGraph images

---

## Testing

After updating:

1. **Test local development**: Ensure app works at `http://localhost:8080`
2. **Test Slack integration**: If you use Slack, test the OAuth flow
3. **Test Teams integration**: If you use Teams, test the OAuth flow
4. **Check browser console**: Ensure no CORS errors
5. **Check Supabase logs**: Verify edge functions work correctly

---

## Summary

The **critical dependencies** are the hardcoded Lovable URLs in edge functions. These must be updated to prevent broken redirects and CORS issues.

The `lovable-tagger` package is harmless and can be kept for development, or removed if you don't need component tagging.

