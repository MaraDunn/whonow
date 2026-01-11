# OCR Accuracy Issues - Analysis and Recommendations

## Current Issues (from Business Card Example)

**Card Data:**
- Name: "WILLIAM LOREM"
- Email: "williamlorem@lorem.com"
- Phone: "777.777.7777"
- Company: "LoremDesign" / "Lorem Design"
- Role: "MANAGER"
- Tagline: "CREATIVE SOLUTIONS"

**Extracted Data:**
- Name: "Alliam Loren" ❌ (Missing "W", wrong order)
- Email: "email@example.com" ❌ (Not extracted - placeholder)
- Phone: "+1 (777) 777-7777" ✅ (Correct, formatted)
- Company: "CREATIVE SOLUTIONS" ❌ (Extracted tagline instead)
- Role: "Manager" ✅ (Correct)

---

## Issues Identified

### 1. Email Not Extracted ❌

**Problem:** The email "williamlorem@lorem.com" was not extracted at all, showing a placeholder instead.

**Possible Causes:**
1. **OCR text doesn't contain the email** - PaddleOCR might not have captured it
2. **Email regex not matching** - Unlikely, as the regex should match this format
3. **Email extraction function failing** - Need to check logs

**Debug Steps:**
- Check OCR service logs to see if email is in the extracted text
- Check edge function logs for email extraction
- Verify email regex is matching correctly

**Fix:** 
- Verify OCR text includes email
- If missing, improve OCR image preprocessing
- If present, debug email extraction function

### 2. Name Incorrect ❌

**Problem:** "WILLIAM LOREM" → "Alliam Loren"
- Missing "W" from William (OCR error)
- Name order might be wrong

**Possible Causes:**
1. **OCR missed the "W"** - "W" is sometimes misread, especially at start of word
2. **Name extraction logic** - Might be picking wrong line or wrong order
3. **OCR artifact cleaning** - Might be removing "W" incorrectly

**Recommended Fixes:**
1. Improve OCR text cleaning to preserve leading letters
2. Add logic to handle common "W" OCR errors
3. Improve name order detection (first/last name)
4. Consider name patterns better (2-word ALL CAPS = likely name)

### 3. Company Extraction Wrong ❌

**Problem:** Extracted "CREATIVE SOLUTIONS" (tagline) instead of "LoremDesign" (company)

**Root Cause:**
- Company extraction prioritizes ALL CAPS lines
- "CREATIVE SOLUTIONS" is ALL CAPS, so gets high priority
- "LoremDesign" is mixed case, might not match patterns as well
- Taglines are often ALL CAPS and get mistaken for company names

**Recommended Fixes:**
1. **Better tagline detection:**
   - Common tagline words: "CREATIVE", "SOLUTIONS", "SERVICES", "INNOVATION", etc.
   - Taglines are usually 2-3 words, company names can be 1-4 words
   - Taglines often appear below company names

2. **Prioritize company names:**
   - Company names often appear near logos/top of card
   - Company names often match email domains
   - Company names might have suffixes (Design, Inc, LLC, etc.)

3. **Use email domain:**
   - If email is "williamlorem@lorem.com", domain is "lorem"
   - Look for "LoremDesign" or "Lorem Design" that matches domain
   - Cross-validate company with email domain

4. **Exclude common tagline patterns:**
   - Filter out common tagline words/phrases
   - Prefer words that match email domain

---

## Recommended Code Changes

### 1. Improve Company Extraction

Add tagline filtering and domain-based matching:

```typescript
// Add tagline words to filter out
const TAGLINE_WORDS = [
  "CREATIVE", "SOLUTIONS", "SERVICES", "INNOVATION",
  "EXCELLENCE", "QUALITY", "VALUE", "EXPERIENCE",
  "DEDICATED", "TRUSTED", "LEADING", "PREMIER"
];

// In extractCompany function:
// 1. First try to match email domain
// 2. Filter out tagline patterns
// 3. Prefer company names over taglines
```

### 2. Improve Name Extraction

Add "W" OCR error handling and better name order:

```typescript
// Fix common "W" OCR errors
// "Alliam" might be "William" with missing W
// Check if name starts with "A" + common first names
const commonFirstNames = ["William", "Wendy", "Walter", "Wade"];
```

### 3. Improve Email Extraction

Add better debugging and ensure emails are extracted:

```typescript
// Add more logging to email extraction
// Ensure email regex is applied correctly
// Check if OCR text contains emails
```

---

## Next Steps

1. **Check OCR Text Output:**
   - Look at the actual OCR text extracted from the card
   - Verify if email is present in OCR text
   - Check if name is correctly extracted by OCR

2. **Check Edge Function Logs:**
   - Review Supabase edge function logs
   - See what text was sent to parsing function
   - Check email extraction logs

3. **Make Code Improvements:**
   - Add tagline filtering to company extraction
   - Improve name extraction with "W" handling
   - Add better email extraction debugging

4. **Test with Real Cards:**
   - Test with various business card layouts
   - Verify improvements work correctly
   - Iterate based on results

---

## Questions to Answer

1. **Does the OCR text contain the email?**
   - If yes: Fix email extraction function
   - If no: Improve OCR image preprocessing

2. **What does the OCR text say for the name?**
   - Is it "WILLIAM LOREM" or "ALLIAM LOREM"?
   - This tells us if it's an OCR error or parsing error

3. **What does the OCR text contain for company?**
   - Is "LoremDesign" present?
   - Is "CREATIVE SOLUTIONS" present?
   - What order are they in?

---

## Immediate Action Items

1. ✅ Document current issues
2. ⏳ Check OCR text output (requires logs/debugging)
3. ⏳ Implement tagline filtering for company extraction
4. ⏳ Improve name extraction with "W" error handling
5. ⏳ Add better email extraction debugging
6. ⏳ Test improvements with real cards

---

**Status:** Analysis complete, ready for debugging and code improvements.
