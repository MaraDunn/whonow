# Deploy OCR Accuracy Fixes

## Fixes Ready to Deploy

I've made the following improvements to fix the accuracy issues:

### 1. ✅ Tagline Filtering (Company Extraction)
**File:** `supabase/functions/scan-business-card/index.ts`

**What it does:**
- Filters out common tagline phrases like "CREATIVE SOLUTIONS"
- Prevents taglines from being extracted as company names
- Will extract the actual company name "LoremDesign" instead

**Changes:**
- Added `TAGLINE_PHRASES` constant with common tagline patterns
- Added `isTagline()` function to detect taglines
- Added tagline check in Priority 3 (ALL CAPS company extraction)

### 2. ✅ Better Logging (Debugging)
**Files:** 
- `supabase/functions/scan-business-card-ai/index.ts`
- `supabase/functions/scan-business-card/index.ts`

**What it does:**
- Logs OCR text output for debugging
- Helps identify email/name extraction issues

---

## Deployment Instructions

### Option 1: Supabase Dashboard (Recommended - No CLI needed)

1. **Deploy `scan-business-card` function:**
   - Go to: https://supabase.com/dashboard
   - Navigate to: **Edge Functions** → **scan-business-card**
   - Click **"Edit"** or **"View Code"**
   - Copy the entire contents of `supabase/functions/scan-business-card/index.ts`
   - Paste into the editor
   - Click **"Deploy"** or **"Save"**

2. **Deploy `scan-business-card-ai` function:**
   - Go to: **Edge Functions** → **scan-business-card-ai**
   - Click **"Edit"** or **"View Code"**
   - Copy the entire contents of `supabase/functions/scan-business-card-ai/index.ts`
   - Paste into the editor
   - Click **"Deploy"** or **"Save"**

### Option 2: Supabase CLI (If you install it)

```bash
# Install Supabase CLI first (if not installed)
brew install supabase/tap/supabase

# Link your project (first time only)
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the functions
supabase functions deploy scan-business-card
supabase functions deploy scan-business-card-ai
```

---

## Expected Results After Deployment

### Before (Current):
- Company: "CREATIVE SOLUTIONS" ❌ (tagline)
- Email: "" ❌ (not extracted)
- Name: "Alliam Loren" ❌ (missing W, wrong order)

### After (Expected):
- Company: "LoremDesign" or "Lorem Design" ✅ (actual company name)
- Email: (still need OCR text to debug)
- Name: (still need OCR text to debug)

**Note:** The tagline filtering will fix the company extraction immediately. Email and name issues need the OCR text output to debug further.

---

## Testing After Deployment

1. **Test with the same business card:**
   - Scan the card again
   - Check if company is now "LoremDesign" instead of "CREATIVE SOLUTIONS"

2. **Check Supabase Edge Function logs:**
   - Go to: **Edge Functions** → **scan-business-card-ai** → **Logs**
   - Look for: `"OCR Text (first 500 chars):"` 
   - Share the OCR text output so we can debug email/name issues

3. **Check parsing logs:**
   - Go to: **Edge Functions** → **scan-business-card** → **Logs**
   - Look for: `"Full OCR text for debugging:"`
   - Share the OCR text output

---

## Next Steps After Deployment

Once deployed, we need:

1. **OCR text output** from the logs to debug:
   - Email extraction (why email is empty)
   - Name extraction (why name is "Alliam Loren" instead of "William Lorem")

2. **Test results** to verify:
   - Company extraction is fixed
   - Other fields work correctly

---

## Files Changed

1. `supabase/functions/scan-business-card/index.ts`
   - Added tagline filtering
   - Added OCR text logging

2. `supabase/functions/scan-business-card-ai/index.ts`
   - Added OCR text logging

**Both files need to be deployed for the fixes to take effect.**

---

**Status:** ✅ Code changes complete, ready to deploy via Supabase Dashboard
