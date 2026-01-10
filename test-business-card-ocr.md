# Business Card OCR Testing Guide

## Test Cases

### Basic Functionality
1. **Standard Business Card**
   - Clear, well-lit photo
   - Standard layout (name at top, company/role in middle, contact info at bottom)
   - Expected: All fields extracted accurately

2. **Name Variations**
   - Single first name
   - First + Last name
   - First + Middle + Last name
   - Hyphenated names (e.g., "Mary-Jane")
   - Names with prefixes (Dr., Mr., etc.)
   - Names with suffixes (Jr., III, etc.)

3. **Phone Number Formats**
   - US format: (555) 123-4567
   - US format: 555-123-4567
   - International: +1 555 123 4567
   - With extension: 555-123-4567 ext 123
   - Mobile labeled: Mobile: 555-123-4567

4. **Email Variations**
   - Standard: name@company.com
   - With subdomain: name@mail.company.com
   - With dots/underscores: first.last@company.com

5. **Company Names**
   - With suffix: "Acme Inc."
   - All caps: "ACME CORPORATION"
   - Multi-word: "Acme Technologies LLC"

6. **Role/Title Variations**
   - Simple: "Manager"
   - Multi-word: "Vice President of Sales"
   - With prefix: "Senior Software Engineer"
   - Abbreviations: "CEO", "VP", "CTO"

### Edge Cases
1. **Low Quality Images**
   - Blurry photos
   - Poor lighting
   - Glare or shadows
   - Expected: Better error handling, retry logic

2. **Unusual Layouts**
   - Vertical cards
   - Creative/designer cards
   - Cards with images/logos
   - Expected: Layout-aware parsing handles this

3. **International Formats**
   - Non-US phone numbers
   - International company names
   - Non-English names (if supported)

## Testing Steps

1. Take/upload a photo of a business card
2. Review extracted fields
3. Check confidence scores (if visible in UI)
4. Verify:
   - Name is correctly formatted
   - Email is valid
   - Phone number is properly formatted
   - Company name is extracted
   - Role/title is captured

## Expected Improvements

- **OCR Accuracy**: Better text extraction with preprocessing
- **Field Extraction**: More accurate with layout awareness
- **Name Formatting**: Proper capitalization, handles prefixes/suffixes
- **Phone Formatting**: Consistent format, handles extensions
- **Error Handling**: Better messages, retry on low confidence

## Validation Checklist

- [ ] Image preprocessing improves OCR quality
- [ ] Name extraction uses top region priority
- [ ] Company extraction prefers middle region
- [ ] Phone numbers handle various formats
- [ ] Email validation catches invalid formats
- [ ] Low confidence scans show appropriate errors
- [ ] Retry logic works when preprocessing fails
- [ ] Confidence scores are reasonable (< 50 = low, > 80 = high)

