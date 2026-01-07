# Time-Based Search Feature Fix Plan

## Overview
The codebase has infrastructure for time-based searches (saving `createdAt` timestamps and parsing time ranges), but there are several issues preventing it from working correctly.

## Issues Identified

### 1. "last friday night" Pattern Not Handled
**Problem**: The parser handles day names and time-of-day separately, but doesn't combine them. When it finds "friday", it sets the whole day (0:00-23:59), ignoring "night" modifier.

**Current Behavior**: 
- "last friday" → entire day (0:00-23:59)
- "last friday night" → still entire day (should be 21:00-05:00 next day)

**Fix**: Add pattern matching for "last [day] [time-of-day]" before checking individual patterns.

### 2. "earlier this week" Pattern Not Handled
**Problem**: "earlier" is not recognized as a modifier for "this week". The parser handles "this week" but doesn't understand "earlier this week" means from start of week to now.

**Current Behavior**:
- "this week" → start of week to now ✓
- "earlier this week" → might not match or incorrectly parsed

**Fix**: Add pattern for "earlier this week" that explicitly means from start of current week to now.

### 3. "add"/"added" Keywords Filtered Out
**Problem**: "add" and "added" are in STOP_WORDS, so they're filtered out. We need these to detect creation date searches vs interaction date searches.

**Current Behavior**:
- "who did I add last friday?" → "add" is filtered out, might not trigger time-based search correctly

**Fix**: Remove "add" and "added" from STOP_WORDS, and detect them as creation date indicators.

### 4. Time Range Extraction Order
**Problem**: The extraction checks patterns in order, but combined patterns (day + time-of-day) should be checked before individual patterns.

**Fix**: Reorder extraction logic to check combined patterns first.

### 5. Verification Needed
**Problem**: Need to verify that:
- Contacts loaded from database have `createdAt` populated
- The mapping from `db.created_at` to `contact.createdAt` works correctly
- Existing contacts without `createdAt` are handled gracefully

## Implementation Plan

### Step 1: Fix Time Range Extraction
1. Add pattern for "last [day] [time-of-day]" (e.g., "last friday night")
2. Add pattern for "earlier this week"
3. Reorder extraction to check combined patterns first

### Step 2: Fix Keyword Detection
1. Remove "add" and "added" from STOP_WORDS
2. Add detection for "add"/"added" to trigger creation date searches

### Step 3: Verify Data Flow
1. Verify `mapDbToContact` correctly maps `created_at` to `createdAt`
2. Verify database default `now()` is working
3. Test with existing contacts

### Step 4: Testing
1. Test "who did I meet earlier this week?"
2. Test "who did I add last friday night?"
3. Test "who did I add last week?"
4. Test various time patterns

## Files to Modify

1. `src/utils/searchQueryParser.ts`
   - Fix `extractTimeRange()` function
   - Remove "add"/"added" from STOP_WORDS
   - Add combined pattern matching

2. `src/utils/contactSearchEngine.ts`
   - Verify time range filtering logic (should already be correct)

3. `src/hooks/useContacts.ts`
   - Verify `mapDbToContact` mapping (should already be correct)

## Expected Behavior After Fix

- "who did I add earlier this week?" → contacts created from start of current week to now
- "who did I add last friday night?" → contacts created Friday night (21:00-05:00 next day)
- "who did I add last week?" → contacts created in the previous week
- "who did I meet earlier this week?" → should still work (interaction-based, not creation-based)





