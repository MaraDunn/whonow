# Company Tagline Filter Fix

## Issue Fixed

**Problem:** Company extraction was picking taglines like "CREATIVE SOLUTIONS" instead of the actual company name "LoremDesign".

**Root Cause:** The company extraction logic prioritized ALL CAPS lines, and taglines are often ALL CAPS, so they got high confidence scores.

## Solution Implemented

Added tagline filtering to skip common tagline phrases when extracting company names.

### Changes Made

1. **Added TAGLINE_PHRASES constant** - List of common tagline patterns to filter out
2. **Added isTagline() function** - Checks if text matches a tagline pattern
3. **Added tagline check in Priority 3** - Skips taglines when extracting ALL CAPS company names

### Code Changes

**File:** `supabase/functions/scan-business-card/index.ts`

**Added:**
```typescript
// Common tagline phrases that should NOT be extracted as company names
const TAGLINE_PHRASES = [
  /^CREATIVE\s+SOLUTIONS$/i,
  /^QUALITY\s+SERVICE$/i,
  /^EXCELLENCE\s+IN\s+SERVICE$/i,
  // ... more tagline patterns
];

function isTagline(text: string): boolean {
  const cleaned = text.trim().toUpperCase();
  return TAGLINE_PHRASES.some(pattern => pattern.test(cleaned));
}
```

**Modified:**
- Added tagline check in Priority 3 (ALL CAPS company extraction)
- Skips lines that match tagline patterns

## Expected Results

After deploying this fix:
- ✅ "CREATIVE SOLUTIONS" will be filtered out as a tagline
- ✅ Actual company names will be extracted instead
- ✅ Other taglines matching the patterns will also be filtered

## Next Steps

1. **Deploy the fix:**
   ```bash
   supabase functions deploy scan-business-card
   ```

2. **Test with the same business card:**
   - Company should now be "LoremDesign" or "Lorem Design" instead of "CREATIVE SOLUTIONS"
   - Tagline will be filtered out

3. **Additional improvements needed:**
   - **Email extraction**: Email was completely missing (confidence 0) - need to debug why
   - **Name extraction**: "Alliam Loren" instead of "William Lorem" - OCR error or parsing issue?
   - **Mixed-case company names**: "LoremDesign" might need better support if it's mixed case

## Remaining Issues

### 1. Email Not Extracted (Confidence 0)
- Email "williamlorem@lorem.com" was not extracted at all
- Need to check OCR text output to see if email is present
- If email is in OCR text, fix email extraction regex/pattern
- If email is not in OCR text, improve OCR image preprocessing

### 2. Name Extraction Issues
- Name "WILLIAM LOREM" → "Alliam Loren"
- Missing "W" from William (OCR error?)
- Name order might be wrong
- Need OCR text to determine if it's OCR or parsing issue

### 3. Mixed-Case Company Names
- "LoremDesign" is mixed case, might not match ALL CAPS patterns well
- Current logic might need improvement for camelCase company names
- Could add Priority for mixed-case company names

---

**Status:** ✅ Tagline filtering implemented, ready to deploy
