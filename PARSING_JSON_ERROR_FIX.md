# Parsing Function JSON Error Fix

## Issue

**Error Message:**
```
Parsing function failed with status 500: {"success":false,"error":"Failed to process business card","details":"Unexpected end of JSON input"}
```

**Root Cause:**
The `scan-business-card` function was failing to parse the request body JSON, resulting in "Unexpected end of JSON input" errors. This was happening because:

1. **JSON parsing error**: The request body was being parsed with `req.json()` which doesn't provide detailed error information when JSON is malformed or truncated
2. **Large payload**: The structure object being sent included a full `words` array which could be very large, potentially causing size issues or truncation

## Fix Applied

### 1. Improved Error Handling in `scan-business-card/index.ts`

**Location:** `supabase/functions/scan-business-card/index.ts` (line ~1810)

**Change:**
- Changed from `await req.json()` to `await req.text()` followed by `JSON.parse()`
- Added specific error handling for JSON parsing errors
- Provides more informative error messages, especially for "Unexpected end of JSON input" errors

**Benefits:**
- Better error messages when JSON parsing fails
- Can detect if request body is empty or truncated
- More detailed error information for debugging

### 2. Simplified Structure Object in `scan-business-card-ai/index.ts`

**Location:** `supabase/functions/scan-business-card-ai/index.ts` (line ~425)

**Change:**
- Removed the full `words` array from the structure object
- Removed `rawText` from structure (already sent as `ocrText`)
- Now only sends `lines` array and `blocks` (empty)

**Benefits:**
- Significantly reduces payload size (words array can be very large)
- Less chance of hitting request size limits
- Faster request processing
- The parsing function primarily uses `lines` anyway, so words array wasn't needed

## Files Changed

1. **`supabase/functions/scan-business-card/index.ts`**
   - Added better error handling for JSON parsing
   - Provides detailed error messages

2. **`supabase/functions/scan-business-card-ai/index.ts`**
   - Simplified structure object to reduce payload size
   - Removed unnecessary `words` array and `rawText`

## Next Steps

### 1. Deploy the Fix

Deploy the updated edge functions to Supabase:

```bash
# Deploy the parsing function (scan-business-card)
supabase functions deploy scan-business-card

# Deploy the AI scanning function (scan-business-card-ai)
supabase functions deploy scan-business-card-ai
```

### 2. Test

Test with the same OCR text that was failing:
- OCR text: `Anna Marchesi AM DESIGNER +123-456-7890 123 Anywhere St.,Any City,ST 12345 hello@reallygreatsite.com`
- Should now parse successfully without JSON errors

### 3. Verify

Check Supabase Edge Function logs to ensure:
- No more "Unexpected end of JSON input" errors
- Parsing function receives requests successfully
- Contact information is extracted correctly

## Expected Behavior After Fix

**Before Fix:**
- ❌ JSON parsing errors
- ❌ "Unexpected end of JSON input" errors
- ❌ Request body truncation issues

**After Fix:**
- ✅ Better error messages if JSON is malformed
- ✅ Smaller payload size (less chance of truncation)
- ✅ More reliable parsing function calls
- ✅ Clearer error messages for debugging

## Troubleshooting

### If errors persist:

1. **Check Edge Function Logs**
   - Go to Supabase Dashboard → Edge Functions → Logs
   - Look for specific error messages
   - Check if request body is being received

2. **Check Request Size**
   - Verify OCR text is not extremely long
   - Check if structure object is still too large

3. **Verify Deployment**
   - Ensure both functions are deployed
   - Check function versions match the code

4. **Test with Simple Input**
   - Try with a simple OCR text first
   - Gradually increase complexity

## Additional Notes

- The parsing function (`scan-business-card`) primarily uses the `lines` array from the structure object
- The `words` array was included but not actually needed for parsing
- This change maintains full functionality while reducing payload size
- Error handling is now more robust and informative

---

**Status:** ✅ Fixed - Ready for deployment
