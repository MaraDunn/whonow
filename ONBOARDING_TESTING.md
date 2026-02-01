# Testing the Onboarding Tutorial

## Quick Test Checklist

### 1. Database Migration
Before testing, ensure the migration has been applied:

```bash
# Using Supabase CLI
supabase db reset  # Development only - resets database
# OR
supabase db push   # Applies pending migrations

# Verify the column exists
supabase db query "SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name = 'has_completed_onboarding';"
```

### 2. Test New User Experience

**Steps:**
1. Create a brand new user account
2. After signup/login, you should see the company setup dialog (if enabled)
3. Complete or skip company setup
4. **Tutorial should appear after 500ms**
5. Click through all 5 steps:
   - Welcome screen
   - Search bar highlight
   - Contact card highlight (if you have contacts)
   - Add button highlight
   - Completion screen
6. Click "Done" on the final step
7. Refresh the page
8. **Verify tutorial does NOT reappear**

### 3. Test Skip Functionality

**Steps:**
1. Create another new user
2. When tutorial appears, click "Skip" on first step
3. Refresh the page
4. **Verify tutorial does NOT reappear**

### 4. Test Existing User (No Tutorial)

**Steps:**
1. Login with an existing user account
2. **Verify tutorial does NOT appear**
3. Check database: `has_completed_onboarding` should be `true`

### 5. Reset Tutorial for Testing (Development Only)

To test the tutorial multiple times with the same user:

```sql
-- Reset a specific user
UPDATE profiles 
SET has_completed_onboarding = false 
WHERE id = 'USER_ID_HERE';

-- OR reset all users (be careful!)
UPDATE profiles 
SET has_completed_onboarding = false;
```

Then refresh the app and the tutorial should appear again.

### 6. Visual & UX Tests

**Desktop (>1024px):**
- [ ] Tutorial appears centered when no target element
- [ ] Spotlight highlights correct elements
- [ ] Tooltips position correctly (not off-screen)
- [ ] Progress bar animates smoothly
- [ ] Text is readable and not cut off
- [ ] Backdrop dims background appropriately
- [ ] Clicking backdrop skips tutorial

**Tablet (768px - 1024px):**
- [ ] Tutorial adapts to smaller screen
- [ ] Buttons remain clickable
- [ ] Text wraps properly
- [ ] Tooltip doesn't overflow screen

**Mobile (<768px):**
- [ ] Tutorial is fully visible
- [ ] Touch targets are large enough
- [ ] Steps progress smoothly
- [ ] Can scroll if needed

### 7. Edge Cases

**No Contacts:**
- [ ] Contact card step shows gracefully (tooltip centers)
- [ ] Tutorial doesn't break or hang

**Multiple Tabs:**
- [ ] Complete tutorial in one tab
- [ ] Refresh second tab
- [ ] Tutorial should NOT appear in second tab

**Fast Clicks:**
- [ ] Rapidly clicking "Next" doesn't break progression
- [ ] Clicking "Skip" immediately dismisses (no delays)

**Browser Back/Forward:**
- [ ] Tutorial state persists after navigation
- [ ] No "flash" of tutorial on page load if already completed

### 8. Accessibility Tests

**Keyboard Navigation:**
- [ ] Can Tab through buttons
- [ ] Can press Enter/Space to activate buttons
- [ ] Focus indicators are visible

**Screen Readers:**
- [ ] Step titles are announced
- [ ] Button labels are clear
- [ ] Progress information is conveyed

### 9. Performance Tests

**Load Time:**
- [ ] Tutorial doesn't block initial page render
- [ ] 500ms delay feels natural (not jarring)
- [ ] Animations are smooth (60fps)

**Memory:**
- [ ] No memory leaks after completing tutorial
- [ ] Event listeners are cleaned up
- [ ] No console errors or warnings

## Common Issues & Solutions

### Issue: Tutorial doesn't appear for new users
**Solution:** 
- Check database: `SELECT has_completed_onboarding FROM profiles WHERE id = 'USER_ID';`
- Verify migration was applied
- Check browser console for errors
- Ensure `needsCompanySetup` is false (company setup must complete first)

### Issue: Tutorial appears every page load
**Solution:**
- Check if `completeOnboarding` mutation is being called
- Verify Supabase connection (check network tab)
- Check for JavaScript errors in console

### Issue: Target elements not highlighted
**Solution:**
- Verify data attributes exist on elements:
  - `data-onboarding-search`
  - `data-onboarding-add-button`
  - `data-onboarding-contact-card`
- Check if elements are rendered when tutorial runs
- For contact card: ensure at least one contact exists

### Issue: Tooltip appears off-screen
**Solution:**
- The component should handle this automatically
- If not, adjust `position` in `onboardingSteps.ts`
- Consider screen size and element placement

## Manual Database Commands

### Check onboarding status for all users:
```sql
SELECT 
  id, 
  email, 
  has_completed_onboarding, 
  created_at 
FROM profiles 
ORDER BY created_at DESC 
LIMIT 10;
```

### Force tutorial for specific user:
```sql
UPDATE profiles 
SET has_completed_onboarding = false 
WHERE email = 'user@example.com';
```

### Count users who haven't completed onboarding:
```sql
SELECT COUNT(*) 
FROM profiles 
WHERE has_completed_onboarding = false;
```

### Mark all users as completed (disable tutorial):
```sql
UPDATE profiles 
SET has_completed_onboarding = true;
```

## Browser Testing Matrix

Recommended browsers to test:

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

## Acceptance Criteria

Before deploying to production, verify:

- ✅ New users see tutorial once after signup
- ✅ Existing users never see tutorial
- ✅ Tutorial can be completed in < 30 seconds
- ✅ Skip functionality works immediately
- ✅ Tutorial never reappears after completion
- ✅ No console errors or warnings
- ✅ Works on mobile and desktop
- ✅ Accessible via keyboard
- ✅ All UI elements are correctly highlighted
- ✅ Database state persists across sessions
- ✅ No performance impact on app load

## Debug Mode (Optional Enhancement)

To test tutorial in development without modifying database, add to `Index.tsx`:

```typescript
// Add at the top of IndexContent for testing
const DEBUG_FORCE_ONBOARDING = false; // Set to true for testing

// Modify the showOnboarding condition
useEffect(() => {
  if (DEBUG_FORCE_ONBOARDING || (profile && needsOnboarding && !needsCompanySetup && !showOnboarding)) {
    const timer = setTimeout(() => {
      setShowOnboarding(true);
    }, 500);
    return () => clearTimeout(timer);
  }
}, [profile, needsOnboarding, needsCompanySetup, showOnboarding]);
```

This allows testing the tutorial without database changes.
