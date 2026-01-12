# Bulk Contact Import Duplicate Cleanup Implementation

## Overview

This document describes the duplicate contact cleanup implementation for bulk contact imports. The system now automatically detects and merges duplicate contacts during bulk import operations.

## Implementation Status

### ✅ Completed Features

1. **Duplicate Detection**
   - Checks for duplicates by normalized email OR phone number
   - Email normalization: lowercase, trimmed
   - Phone normalization: digits only (removes formatting)
   - Checks against all contacts user has access to (owned, company shared, globally shared)

2. **Contact Merging**
   - Automatically merges duplicate contacts instead of skipping
   - Preserves existing contact data
   - Fills missing fields from new contact
   - Combines tags (deduplicates)
   - Combines descriptions (if different)

3. **Field Coverage**
   - All contact fields are checked and merged:
     - Basic: name, email, phone, company, role
     - Tags: combined and deduplicated
     - Description: combined if different
     - Address: address, city, state, zip_code, country
     - Location: latitude, longitude
     - Business: business_name, business_type
     - Other: avatar, folder_id

4. **Response Format**
   - Edge function returns: `inserted`, `merged`, `skipped` counts
   - Client displays detailed success messages

## Implementation Details

### Edge Function: `bulk-insert-contacts`

**Location:** `supabase/functions/bulk-insert-contacts/index.ts`

**Key Functions:**
- `normalizeEmail()`: Normalizes email for comparison (lowercase, trimmed)
- `normalizePhone()`: Normalizes phone for comparison (digits only)
- `areDuplicates()`: Checks if two contacts are duplicates (email OR phone match)
- `mergeContactData()`: Merges new contact data into existing contact

**Process Flow:**
1. Map incoming contacts to database format
2. Fetch all existing contacts user has access to
3. Filter to find duplicates using normalized comparison
4. Separate contacts into: new contacts (insert) and duplicates (merge)
5. Insert new contacts in batches
6. Update existing contacts with merged data
7. Return counts: inserted, merged, skipped

**Query Logic:**
- Fetches contacts where: `(owner_id = user.id) OR (company_id = companyId) OR (is_shared = true)`
- Filters to contacts with email or phone (potential duplicates)
- Client-side filtering using normalized comparison

### Client-Side: `Index.tsx`

**Location:** `src/pages/Index.tsx`

**Changes:**
- Tracks `totalMerged` and `totalSkipped` counts
- Displays detailed success message with merge/skip information
- Example: "Imported 150 of 200 contacts (30 merged, 20 skipped duplicates)"

## Known Issues / Limitations

### ⚠️ Current Limitations

1. **Query Performance**
   - Fetches all accessible contacts with email/phone (could be large dataset)
   - Client-side filtering may be slow for very large contact lists
   - **Future Improvement:** Add database-level normalization/indexing for faster queries

2. **Duplicate Detection Scope**
   - Only checks email OR phone (not both required)
   - Does not check name similarity for fuzzy matching
   - Does not check company/role combinations
   - **Future Improvement:** Add fuzzy name matching, multi-field scoring

3. **Merge Strategy**
   - Always merges new data into existing (may overwrite user-edited data)
   - No user confirmation before merging
   - **Future Improvement:** Add merge preview/confirmation, smarter merge priority

4. **Field Merging Logic**
   - Simple "prefer new if exists" strategy
   - May lose data if new contact has empty field but existing has data
   - **Future Improvement:** Smarter merge logic (prefer non-empty, prefer more complete)

5. **Batch Processing**
   - Duplicate check happens once before all batches
   - If duplicates are created within the same import batch, they won't be caught
   - **Future Improvement:** Check duplicates within batch as well

6. **Error Handling**
   - If merge fails, contact is skipped (not inserted as new)
   - No retry logic
   - **Future Improvement:** Better error handling, retry logic, partial success reporting

## Testing Recommendations

### Test Cases to Verify

1. **Email Duplicate Detection**
   - Import contact with email that already exists
   - Verify: Contact is merged, not inserted as new

2. **Phone Duplicate Detection**
   - Import contact with phone that already exists (different email)
   - Verify: Contact is merged based on phone match

3. **Both Email and Phone Match**
   - Import contact where both email and phone match existing
   - Verify: Contact is merged (not counted twice)

4. **Field Merging**
   - Existing contact has: name="John", email="john@example.com", company="Old Co"
   - Import contact has: name="John", email="john@example.com", company="New Co", role="Manager"
   - Verify: Existing contact updated with role="Manager", company stays "Old Co" (or merges based on logic)

5. **Tag Merging**
   - Existing contact has tags: ["client", "important"]
   - Import contact has tags: ["client", "new-tag"]
   - Verify: Merged contact has: ["client", "important", "new-tag"] (deduplicated)

6. **Description Merging**
   - Existing: "Original description"
   - Import: "New description"
   - Verify: Merged: "Original description\n\nNew description"

7. **Large Batch Import**
   - Import 200+ contacts with some duplicates
   - Verify: Performance is acceptable, all duplicates detected

## Future Enhancements

### Priority 1: Performance
- [ ] Add database indexes on normalized email/phone columns
- [ ] Implement database-level duplicate detection (triggers/functions)
- [ ] Optimize query to only fetch potential matches

### Priority 2: Detection Accuracy
- [ ] Add fuzzy name matching (Levenshtein distance)
- [ ] Multi-field scoring system (email + phone + name)
- [ ] Company/role combination matching

### Priority 3: User Experience
- [ ] Merge preview before applying
- [ ] User confirmation for merges
- [ ] Merge conflict resolution UI
- [ ] Undo merge functionality

### Priority 4: Data Quality
- [ ] Smarter merge priority (prefer more complete data)
- [ ] Field-level merge rules (e.g., always prefer newer phone number)
- [ ] Validation of merged data

## Deployment Notes

### Edge Function Deployment

```bash
supabase functions deploy bulk-insert-contacts
```

Or via Supabase Dashboard:
1. Go to Edge Functions
2. Find `bulk-insert-contacts`
3. Click "Edit" or "Update"
4. Copy code from `supabase/functions/bulk-insert-contacts/index.ts`
5. Deploy

### Testing After Deployment

1. Test with small batch (5-10 contacts) first
2. Verify duplicate detection works
3. Check merge results in database
4. Test with larger batches
5. Monitor edge function logs for errors

## Related Files

- `supabase/functions/bulk-insert-contacts/index.ts` - Main implementation
- `src/pages/Index.tsx` - Client-side import handler
- `src/utils/duplicateDetection.ts` - Duplicate detection utilities
- `src/utils/contactMerge.ts` - Contact merging utilities

## Debugging

### Enable Debug Logging

The edge function includes console.log statements for:
- Number of existing contacts found
- Number of duplicates detected
- Merge operations
- Batch insert progress

### Check Logs

1. Go to Supabase Dashboard → Edge Functions → Logs
2. Filter by `bulk-insert-contacts`
3. Look for:
   - `[bulk-insert-contacts] Found X existing duplicate contacts`
   - `[bulk-insert-contacts] Processing: X new, Y to merge`
   - `[bulk-insert-contacts] Merged contact {id}`

### Common Issues

1. **No duplicates detected when they exist**
   - Check normalization: emails should be lowercase, phones digits-only
   - Verify query is fetching correct contacts (check owner_id, company_id, is_shared)

2. **Merges not happening**
   - Check edge function logs for merge errors
   - Verify contact IDs are correct
   - Check database permissions

3. **Performance issues**
   - Large contact lists may be slow
   - Consider batching duplicate checks
   - Add database indexes

## Code References

### Duplicate Detection Logic
- Email match: `normalizeEmail(c1.email) === normalizeEmail(c2.email)`
- Phone match: `normalizePhone(c1.phone) === normalizePhone(c2.phone)`
- Match if: email matches OR phone matches (both must have the field)

### Merge Logic
- Tags: Combine arrays, deduplicate by lowercase
- Description: Combine with `\n\n` separator if different
- Other fields: `newData.field || existing.field || null`

### Query Access Control
- User-owned: `owner_id = user.id`
- Company shared: `company_id = companyId`
- Globally shared: `is_shared = true`
