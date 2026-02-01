# Universal Smart Search - Testing Guide

## Setup: Apply Migrations

Before testing, you need to apply the new migrations to your Supabase database.

### Option 1: Via Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run each migration file in order:
   - `20260128000002_smart_search_contacts.sql` - Creates the new smart search RPC
   - `20260128000003_search_responsibility_index.sql` - Adds performance indexes
   - `20260128000004_deprecate_old_search.sql` - Removes old search function

### Option 2: Via Supabase CLI

```bash
# Login first
npx supabase login

# Push migrations
npx supabase db push
```

---

## Test Scenarios

### 1. Responsibility Queries (NLP)

Test that natural language queries correctly identify job roles:

**Query:** "Who can make me a logo?"
- **Expected:** Returns contacts with role/company containing "design" or tags including design-related terms
- **Check:** Designers, graphic designers, creative directors should appear

**Query:** "Who can start an ad campaign?"
- **Expected:** Returns marketing professionals
- **Check:** Marketing managers, growth marketers, marketing specialists

**Query:** "Who can write me a contract?"
- **Expected:** Returns legal professionals
- **Check:** Lawyers, attorneys, legal counsel, contract specialists

**Query:** "Who can build me a website?"
- **Expected:** Returns developers/engineers
- **Check:** Web developers, software engineers, fullstack developers

---

### 2. Time-Based Queries

Test that date range filters work correctly:

**Query:** "Who did I meet last week?"
- **Expected:** Returns contacts created in the last 7 days
- **Check:** Only recent contacts appear, sorted by creation date

**Query:** "Contacts added this month"
- **Expected:** Returns contacts created in the current month
- **Check:** Contacts from current month only

**Query:** "People I met in December"
- **Expected:** Returns contacts from December 2025
- **Check:** Date range is correctly interpreted

---

### 3. Text Queries (Name/Company)

Test basic text search:

**Query:** "john"
- **Expected:** Returns contacts with "john" in name (John, Johnny, Johnson, etc.)
- **Check:** Name matching works with partial strings

**Query:** "acme corp"
- **Expected:** Returns contacts from Acme Corporation
- **Check:** Company name matching with variations

**Query:** "maria garcia"
- **Expected:** Returns contacts named Maria Garcia or similar
- **Check:** Full name search works

---

### 4. Combined Queries (Multiple Filters)

Test that multiple filters work together:

**Query:** "marketing managers in california"
- **Expected:** Returns marketing professionals located in California
- **Check:** Both job_title AND location filters apply

**Query:** "designers I met last week"
- **Expected:** Returns design professionals added in the last 7 days
- **Check:** Both job_title AND date_range filters apply

**Query:** "developers at google"
- **Expected:** Returns developers who work at Google
- **Check:** Both job_title AND company filters apply

---

### 5. Performance Testing

Test that search is fast at different scales:

**Small (< 100 contacts):**
- Expected: < 100ms response time
- Test: Any query type should feel instant

**Medium (100-1000 contacts):**
- Expected: < 200ms response time
- Test: No noticeable delay, no browser freezing

**Large (1000+ contacts):**
- Expected: < 300ms response time
- Test: Still fast, no UI blocking, no threshold behavior change

---

### 6. Edge Cases

Test unusual scenarios:

**Empty Query:**
- **Query:** "" (empty string)
- **Expected:** Shows all contacts (no search applied)
- **Check:** Returns to normal list view

**No Results:**
- **Query:** "zzzzznonexistent999"
- **Expected:** Empty results (not first 10 contacts)
- **Check:** Shows "No contacts found" or empty state

**Special Characters:**
- **Query:** "O'Brien & Associates"
- **Expected:** Handles apostrophes and ampersands correctly
- **Check:** Company name matching works with special chars

**Offline:**
- **Action:** Disconnect internet, try to search
- **Expected:** Shows "No connection" or similar error message
- **Check:** Graceful handling (no crash, clear feedback)

---

## Success Criteria

✅ **Consistency:** All features work the same for 10 contacts or 10,000 contacts
✅ **Speed:** All searches complete in < 300ms
✅ **No Freezing:** Browser never freezes during search
✅ **NLP Works:** Natural language queries return relevant results
✅ **Time Filters Work:** Date-based searches work for all users
✅ **Accuracy:** Results are relevant to the query (not just first 10 contacts)

---

## Troubleshooting

### Search returns no results
- Check that migrations were applied successfully
- Verify user is authenticated (`user?.id` exists)
- Check browser console for RPC errors

### Search is slow (> 500ms)
- Verify indexes were created (check migration 3)
- Check Supabase dashboard for query performance
- Look for missing `pg_trgm` extension

### "Function does not exist" error
- Migration 2 didn't apply correctly
- Re-run the smart_search_contacts migration
- Check for SQL syntax errors in migration file

### Old behavior still happening (threshold split)
- Clear browser cache and reload
- Check that `useSmartSearch.ts` changes were saved
- Verify no `SERVER_SEARCH_THRESHOLD` constant remains

---

## Reporting Issues

If tests fail, please provide:
1. The specific query that failed
2. Expected vs actual results
3. Your approximate contact count
4. Browser console errors (if any)
5. Response time (if slow)
