# PDF Import Debugging Guide

When the PDF import fails, follow these steps to diagnose the issue:

## Step 1: Check Browser Console

1. Open your browser's Developer Tools (F12 or Cmd+Option+I)
2. Go to the **Console** tab
3. Look for logs starting with `[AdminPdfImport]`

### What to Look For:

**If text extraction worked:**
- `[AdminPdfImport] PDF loaded: X page(s)`
- `[AdminPdfImport] Page 1 text items: X`
- `[AdminPdfImport] Page 1: extracted X characters, X lines`
- `[AdminPdfImport] Found X emails and X phones in extracted text`

**If text extraction failed:**
- `[AdminPdfImport] PDF text extraction error: ...`
- Error message about PDF being image-based

## Step 2: Check the UI

After a failed import, look for:
- **Error message** at the top
- **Debug text box** below the error (if shown)
  - This shows the actual text that was extracted
  - Check if it looks correct or garbled

## Step 3: Identify the Problem

### Problem Type A: No Text Extracted
**Symptoms:**
- Console shows: `Page 1 text items: 0`
- Error: "No text could be extracted from the PDF"
- Debug box is empty or shows very little text

**Cause:** PDF is image-based (scanned) or corrupted
**Solution:** Use PaddleOCR (requires server-side OCR service)

### Problem Type B: Text Extracted But No Contacts Found
**Symptoms:**
- Console shows text was extracted (e.g., "extracted 5000 characters")
- Error: "No contacts found in the document"
- Debug box shows text but it's garbled or doesn't look like contacts

**Cause:** Text extraction is working but format/structure is wrong
**Solution:** Check the debug text - might need to improve extraction or parsing

### Problem Type C: Contacts Found But Wrong Data
**Symptoms:**
- Contacts are found but names are wrong (e.g., "Tf" instead of real names)
- Emails/phones are correct but other fields are wrong

**Cause:** Parsing logic needs improvement
**Solution:** Share the debug text so we can improve the parser

## Step 4: Share Information

When reporting an issue, please share:

1. **Console logs** - Copy all `[AdminPdfImport]` logs
2. **Debug text** - Copy the text from the debug box (first 1000 characters)
3. **Error message** - The exact error shown
4. **What you expected** - What should have been extracted

This will help identify the exact problem and fix it.
