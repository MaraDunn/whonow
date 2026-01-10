# Debug Guide - OCR Failures

## Current Status

✅ **Anna Marchesi** - Working perfectly
✅ **Chris Green NAME** - Now correct! (was "Lidia Tt )")
⚠️ **Chris Green OTHER FIELDS** - Email/Phone/Company wrong
❌ **Estelle Darcy** - Completely garbled ("Owner I I Lor A Tel")

---

## What I Need to Debug Further

### 1. Console Logs

Open browser console (F12) and scan the Estelle Darcy card again.

**Look for these sections:**

```
=== Starting Multi-Pass Offline OCR ===
Created 9 preprocessing variants

Processing variant: scaled-original (Original scaled 2x)
✓ scaled-original: XX chars, confidence: XX%
  Preview: "..."

Processing variant: high-contrast (High contrast binarization)
✓ high-contrast: XX chars, confidence: XX%
  Preview: "..."

... (7 more variants) ...

=== Merging 9 OCR attempts ===
Merged result: XX chars, confidence: XX%
Sources used: ...
```

**Please share:**
- The preview text from each variant (first 100 chars)
- Which variants had the highest confidence
- The final merged text
- Which sources were used in the merge

### 2. Card Images (if possible)

If you can share the actual business card images (or describe them), that would help:

**For Chris Green card:**
- Is the email really "email@example.com" on the card?
- Or is it supposed to be "chris.green@evergreenseniorsuites.com"?
- What does the company text actually say?
- Is it a printed card or photo? Color scheme?

**For Estelle Darcy card:**
- What font style is used? (standard, script, decorative?)
- Is it a photo or physical card scan?
- Any background patterns or colors?
- How is the text laid out?

### 3. Backend Parsing Logs

Check console for these sections:

```
=== Starting parseBusinessCard ===
Cleaned text length: XX
Split into XX blocks: [...]
Text regions: {...}

Email extraction result: {...}
Phone extraction result: {...}
Company extraction result: {...}
Role extraction result: {...}
Name extraction result: {...}

=== FINAL EXTRACTION RESULTS ===
```

---

## Possible Issues & Solutions

### Issue 1: OCR Text is Garbage (Estelle Darcy)

**Symptoms**: "Owner I I Lor A Tel" instead of "Estelle Darcy"

**Possible causes:**
1. Very stylized/decorative font
2. OCR reading background elements as text
3. Card has unusual layout (vertical, curved, etc.)
4. Poor image quality (blur, glare, shadows)

**Solutions to try:**
- Share console logs showing what each variant extracted
- Try taking photo with better lighting
- Try holding card flat/straight
- If font is too decorative, may need manual entry

### Issue 2: Backend Parsing Wrong (Chris Green company)

**Symptoms**: Name is correct, but company is "16001 Tire"

**Possible causes:**
1. OCR text might actually contain "16001" (address?)
2. Backend parser is picking wrong line as company
3. Company name is being misread by all variants

**Solutions:**
- Check OCR text in console - does it contain "Evergreen"?
- If OCR is correct but parsing is wrong, we can fix the parser
- If OCR is wrong, we need better preprocessing for that card

### Issue 3: Placeholder Data (Chris Green email/phone)

**Symptoms**: "email@example.com" and "+1 555-1234"

**Possible causes:**
1. This might actually be on the card (example/template card?)
2. OCR is failing to read the real email/phone
3. Backend is returning defaults when nothing found

**Check:** Is this a real business card or a template/example?

---

## Quick Diagnostic Commands

### Check if OCR text contains expected words:

For Estelle Darcy card, after scanning, in console run:
```javascript
// This will be in the logs - search for "Merged result"
// Does it contain "Estelle" or "Darcy" anywhere?
```

### Check which variant worked best:

```
// Look for "Sources used: ..." in console
// If only 1-2 sources used, those variants worked
// If 8-9 sources used, all variants agreed (good sign)
```

---

## Next Steps

1. **Scan Estelle Darcy card** with console open
2. **Copy/paste console logs** here (or screenshot)
3. **Describe the cards:**
   - Estelle Darcy: What font? What layout? Photo or scan?
   - Chris Green: Is email really "email@example.com" on card?

With this info, I can:
- Adjust preprocessing for specific card characteristics
- Fix backend parsing if OCR is correct but extraction is wrong
- Add targeted fixes for the specific issues
- Determine if a card is fundamentally unreadable by OCR

---

## Expected Console Output Format

Here's what good logs look like:

```
=== Starting Multi-Pass Offline OCR ===
Creating preprocessing variants...
Created 9 preprocessing variants

Processing variant: scaled-original (Original scaled 2x)
✓ scaled-original: 145 chars, confidence: 72.3%
  Preview: "Estelle Darcy\nSenior Designer\nAcme Corp\nestelle@acmecorp.com\n555-123-4567"

Processing variant: high-contrast (High contrast binarization)
✓ high-contrast: 138 chars, confidence: 68.1%
  Preview: "Estelle Darcy\nSenior Designer\nAcme Corp\nestelle@acmecorp.com\n555-123-4567"

... (more variants) ...

=== Merging 9 OCR attempts ===
Grouped into 8 line positions
Merged result: 142 chars, confidence: 71.5%
Sources used: scaled-original, high-contrast, adaptive-threshold
```

If your logs show very different text in each variant, or garbled text in all variants, that tells us OCR is fundamentally struggling.

---

## Emergency Fallback

If we can't get OCR working for certain cards, we can:

1. **Add manual correction UI**
   - Show extracted fields with confidence scores
   - Let user quickly correct wrong fields
   - Still faster than typing everything

2. **Skip OCR for known-difficult cards**
   - Detect low confidence across all variants
   - Suggest manual entry for those cards
   - "This card appears difficult to scan. Enter manually?"

3. **Progressive enhancement**
   - Show first OCR result immediately
   - Continue processing in background
   - Update fields as better variants complete
   - User can start correcting while OCR continues

