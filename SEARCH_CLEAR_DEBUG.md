# Search Clear Issue - Debugging Guide

## Problem
After typing a search query and then clearing it, no contacts are displayed. User must refresh the page to see contacts again.

## Changes Made

### 1. `src/hooks/useSmartSearch.ts`
**Problem**: State management issue where `filteredContacts` state could become out of sync with the `contacts` prop.

**Fix**:
- Renamed `filteredContacts` state to `searchResults` to make it clear it only holds search results
- Changed `effectiveContacts` to be properly memoized with explicit dependencies
- Added `hasActiveQuery` flag to make the logic clearer
- **Key change**: When query is empty, `effectiveContacts` directly returns the `contacts` prop (no state involved)

```typescript
// Before: used state that could get out of sync
const effectiveContacts = !query.trim() ? contacts : filteredContacts;

// After: properly memoized with all dependencies, no state when query is empty
const effectiveContacts = useMemo(() => {
  const result = hasActiveQuery ? searchResults : contacts;
  return result;
}, [hasActiveQuery, searchResults, contacts]);
```

### 2. `src/components/ContactGrid.tsx`
**Problem**: Virtualizer initialization timing issue when switching from small to large lists.

**Fix**:
- Added effect to force virtualizer to measure when entering virtualized mode
- This ensures rows render immediately when clearing search returns to large list

### 3. Added Debug Logging
To help identify where the issue occurs, added console logs in:
- `SearchBar.tsx`: Logs when user clears query
- `useSmartSearch.ts`: Logs what contacts it's returning
- `ContactGrid.tsx`: Logs what contacts it receives

## How to Debug

1. Open browser console
2. Type a search query
3. Clear the query (backspace all characters, or click X button, or press Escape)
4. Look for these console messages in order:

```
[SearchBar] handleClear called
[SearchBar] handleChange: 
[useSmartSearch] Computing effectiveContacts: { hasActiveQuery: false, searchResultsLength: 0, contactsLength: XXX, resultLength: XXX }
[ContactGrid] Received XXX contacts, searchQuery: 
```

## What to Check

### If you see `contactsLength: 0` in useSmartSearch:
**Problem**: The `contacts` prop passed to `useSmartSearch` is empty
**Location**: Check `Index.tsx` - the issue is in how contacts are being passed
**Look at**: 
- Line 198: `showDirectory ? filteredTeamContacts : (showClientDirectory ? clientDirectoryContacts : folderFilteredContacts)`
- These computed values might be empty

### If `contactsLength` is > 0 but `resultLength` is 0:
**Problem**: Logic error in `effectiveContacts` computation (shouldn't happen with current code)
**Action**: Report this with the exact console output

### If ContactGrid receives 0 contacts:
**Problem**: `useSmartSearch` is returning empty array
**Action**: Check the useSmartSearch logs to see what it computed

### If ContactGrid receives contacts but nothing renders:
**Problem**: ContactGrid rendering issue (possibly virtualizer)
**Action**: Check if contacts.length >= 500 (virtualization threshold)

## Expected Behavior

When you clear the search:
1. SearchBar calls `onChange("")`
2. `searchQuery` state in Index.tsx updates to ""
3. useSmartSearch receives query=""
4. `hasActiveQuery` becomes false
5. `effectiveContacts` returns the `contacts` prop directly
6. ContactGrid receives the full contacts list
7. Grid renders all contacts

## Next Steps

If the issue persists after this fix:
1. Capture the console output when reproducing the issue
2. Check which component shows 0 contacts
3. Look at the React DevTools to see the actual prop values
4. Check if `useContacts` hook is returning empty array (unlikely given refresh works)

## Test Cases

1. ✅ Load page → contacts visible
2. ✅ Type search → filtered results visible
3. ⚠️ Clear search → **should show all contacts** (this is what we're fixing)
4. ✅ Refresh page → contacts visible
