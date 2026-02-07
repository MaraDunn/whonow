# Search Robustness Fixes

## Problem
Search was too strict and fragile - extracting entities incorrectly and creating filters that excluded valid results. Users got 0 results for many natural language queries.

## Root Causes

1. **Over-extraction**: Random words extracted as names/locations/tags → invalid filters
2. **Too strict matching**: All filters AND-ed together → one wrong filter = 0 results  
3. **FTS as filter**: Full-text search required exact match → excluded most contacts
4. **No fallback**: When extraction failed, no broader search mechanism

## Comprehensive Fixes

### 1. FTS for Ranking Only (Migration)
**File**: `supabase/migrations/20260207000000_smart_search_fts_ranking_only.sql`

**Change**: Removed `AND (sq.q IS NULL OR c.search_vector @@ sq.q)` from WHERE clause

**Effect**: 
- FTS ranks results but doesn't exclude them
- Always returns contacts matching other filters
- Relevance-ranked when text query provided

### 2. Conservative Name Extraction
**File**: `src/utils/searchQueryParser.ts` (extractEntities)

**Change**: Only extract names when:
- Explicit indicators: "named X", "called X", "person named X"
- Clear structure: "John at Google" with capitalized words
- NOT from plain lowercase queries

**Effect**:
- "I need a logo" no longer extracts "logo" as name filter
- "this week" no longer extracts "week" as name filter
- Names only extracted when genuinely present

### 3. Always Pass semantic_hint for Ranking
**File**: `src/utils/searchQueryParser.ts` (convertToSearchQuery)

**Change**: Always set `semantic_hint = originalQuery` (except interaction-only)

**Effect**:
- Provides relevance fallback when structured extraction is wrong
- Contacts ordered by how well they match the query
- No penalty for passing it (FTS is ranking-only now)

### 4. Use Department for Responsibilities
**File**: `src/utils/searchQueryParser.ts` (convertToSearchQuery)

**Change**: Use responsibility's department (e.g. "legal") instead of first role (e.g. "lawyer")

**Effect**:
- "I need a lawyer" matches "Legal Counsel", "Attorney" (contains "legal")
- Broader matching while still relevant
- Domain-based search more robust

### 5. Clear Names for Responsibility Matches
**File**: `src/utils/searchQueryParser.ts` (parseSearchQuery)

**Change**: `entities.names = []` when responsibility matches

**Effect**:
- Prevents responsibility phrase words from being treated as name filters
- "I need a logo" won't filter by name after matching RESP_DESIGN

### 6. Removed Auto Tags Extraction
**File**: `src/utils/searchQueryParser.ts` (convertToSearchQuery)

**Change**: Removed automatic keyword→tags mapping

**Effect**:
- Fewer false positive filters
- Tags only used when explicitly part of responsibility or user intent

### 7. Skip Time Words in Name Extraction  
**File**: `src/utils/searchQueryParser.ts` (extractEntities)

**Change**: Added time words exclusion list (day, week, month, year, etc.)

**Effect**:
- "this week", "last month" etc. don't create name filters
- Temporal queries work correctly

## Testing Checklist

✅ "I need a logo" → Returns designers  
✅ "I need a lawyer" → Returns legal contacts  
✅ "who did I call this week?" → Returns contacted contacts (after marking)  
✅ "designer" → Returns designers  
✅ "contacts at Google" → Returns Google contacts  
✅ "John" → Returns contacts named John  
✅ "show me everyone" → Returns all contacts (ranked by relevance)  
✅ Plain searches → Return results ordered by relevance  

## Key Principles Going Forward

1. **Conservative extraction**: Only extract entities when confident
2. **Semantic fallback**: Always rank by text relevance as fallback
3. **Broader matching**: Use domains/departments over specific roles
4. **Fail open**: When in doubt, return results (ranked by relevance)

## Migration Required

Run: `supabase db push` to apply the FTS ranking-only migration.

All TypeScript changes take effect immediately after rebuild.
