# Debug Company Extraction Issues

## Current Status

**Problem:** After deploying tagline filtering fix, company extraction is still incorrect but "in a different way".

**Expected:** Company should be "LoremDesign" or "Lorem Design"
**Actual:** Still incorrect (need to check logs)

## What We Need to Debug

To fix this properly, we need to see:

1. **The actual OCR text** - What text was extracted from the card?
2. **Company extraction candidates** - What candidates were found?
3. **Which candidate was selected** - Why was it selected?

## How to Get Debug Information

### Step 1: Check Supabase Edge Function Logs

1. Go to: https://supabase.com/dashboard
2. Navigate to: **Edge Functions** → **scan-business-card** → **Logs**
3. Look for these log entries:
   - `"=== FULL OCR TEXT FOR DEBUGGING ==="` - This shows the full OCR text
   - `"Company extraction candidates:"` - This shows all candidates found
   - `"Extracted company:"` - This shows which candidate was selected

### Step 2: Share the Log Output

Copy and share:
- The full OCR text
- The company extraction candidates list
- The selected company with confidence

## What the Logs Will Tell Us

1. **If OCR text contains "LoremDesign"**:
   - If yes: Parsing issue - need to improve extraction logic
   - If no: OCR issue - PaddleOCR didn't capture it correctly

2. **What candidates were found**:
   - Which priorities found candidates
   - What confidence scores they have
   - Why "LoremDesign" wasn't selected

3. **Why the wrong candidate was selected**:
   - Confidence score comparison
   - Position-based selection
   - Tagline filtering effectiveness

## Recent Fixes Applied

1. ✅ Tagline filtering added to Priority 2
2. ✅ Tagline filtering added to Priority 3
3. ✅ Tagline filtering added to Priority 4 and 5
4. ✅ Mixed-case company name detection (Priority 4)
5. ✅ Better logging for debugging

## Next Steps

1. Deploy the updated function with better logging
2. Test with the same business card
3. Check Supabase logs for:
   - Full OCR text
   - Company extraction candidates
   - Selected company and confidence
4. Share the log output so we can debug further

---

**Status:** Waiting for Supabase logs to debug the issue properly
