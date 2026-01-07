# Organization Creation & Subscription Feature Gating

## Overview

This document describes the implementation of proper feature gating for organization creation and admin dashboard functionality. These features ensure that only users with appropriate subscription tiers (Team or Business) can create and manage organizations.

## What Was Fixed

### 1. **Missing Feature Gate for Organization Creation**
   - **Problem**: Any user could create an organization regardless of subscription tier
   - **Solution**: Added `organization_creation` feature that requires Team or Business tier
   - **Implementation**: 
     - Updated `src/types/subscription.ts` with new feature
     - Added feature to `FEATURE_ACCESS` mapping
     - Updated tier feature lists to show "Create organization"

### 2. **No Clear UI for Organization Creation**
   - **Problem**: Users with business tier couldn't find where to create an organization
   - **Solution**: Added multiple entry points for organization creation:
     - Updated `CompanySetupDialog` with subscription checking and upgrade prompts
     - Added organization creation in Settings → Account tab
     - Created dedicated Organization Management dashboard

### 3. **Missing Admin Dashboard**
   - **Problem**: No centralized place to manage organization and subscription
   - **Solution**: Created comprehensive `OrganizationManagement` component with:
     - Organization details and invite code management
     - Subscription plan information and upgrade options
     - Team member list and management
     - Admin controls section

### 4. **Database-Level Security**
   - **Problem**: No server-side validation of subscription tier for organization creation
   - **Solution**: Added database function to check subscription tier before allowing organization creation

## Features Added

### Organization Creation Feature Gate

```typescript
// src/types/subscription.ts
export type FeatureName = 
  | "basic_contacts"
  | "client_management"
  | "advanced_search"
  | "organization_creation"  // NEW
  | "team_features"
  | "integrations"
  | "advanced_analytics"
  | "api_access"
  | "sso"
  | "custom_integrations";

export const FEATURE_ACCESS: Record<FeatureName, SubscriptionTier[]> = {
  // ...
  organization_creation: ["team", "business"],  // NEW
  // ...
};
```

### Organization Management Component

New component at `src/components/OrganizationManagement.tsx` provides:

1. **Organization Details Card**
   - Organization name
   - Invite code with copy button
   - Instructions for inviting team members

2. **Subscription Information Card**
   - Current plan and pricing
   - Team member usage (e.g., "3 / 25")
   - Visual progress bar
   - Feature list for current tier
   - Upgrade button (if not on Business tier)
   - Manage billing button (for subscribed users)

3. **Team Members Card**
   - List of all organization members
   - Member names, emails, and roles
   - Visual indicators for current user
   - Empty state with instructions

4. **Admin Controls Card**
   - Advanced organization management
   - Future features: regenerate invite code, delete organization
   - Safety warnings

### Updated Settings Dialog

The Settings dialog now includes an "Organization" tab for Team/Business tier users:

- Automatically shown when user has `organization_creation` feature access
- Shows full `OrganizationManagement` component
- Separate from Admin tab (which requires admin role)

### Account Tab Enhancements

The Account tab in Settings now includes:

- **For users without organization:**
  - Inline organization creation form
  - Upgrade prompt if on Starter/Pro tier
  - Create button if on Team/Business tier

- **For users with organization:**
  - Organization name
  - User's role (Admin/Member)

### Company Setup Dialog Updates

The initial company setup dialog now:

- Checks subscription tier before allowing creation
- Shows warning message if user lacks required tier
- Provides upgrade button instead of create button for ineligible users
- Displays current tier in warning message

### Database-Level Protection

New migration: `supabase/migrations/20250107200000_add_organization_creation_check.sql`

```sql
-- Function to check if user can create organization
CREATE OR REPLACE FUNCTION public.can_create_organization(_user_id uuid)
RETURNS boolean
-- Returns true only if user has team/business/enterprise tier

-- Updated create_company function
CREATE OR REPLACE FUNCTION public.create_company(p_name text)
RETURNS uuid
-- Now checks subscription tier before creating organization
-- Raises exception: 'organization_creation_requires_team_or_business_tier'
```

## User Flows

### For Business Tier Users Without Organization

1. **On First Login:**
   - See `CompanySetupDialog`
   - Can create organization immediately (have required tier)
   - Or join existing organization with invite code
   - Or skip and create later

2. **From Settings → Account Tab:**
   - See "You're using the app as an individual"
   - Click "Create Organization" button
   - Enter organization name inline
   - Click "Create" to finalize

3. **From Settings → Organization Tab:**
   - See full organization management dashboard
   - If no organization, see create prompt with all details

### For Business Tier Users With Organization

1. **Settings → Organization Tab:**
   - View organization details
   - See subscription information
   - View team members
   - Access admin controls (if admin)
   - Manage billing
   - Copy invite code to invite members

2. **Settings → Admin Tab** (Admins only):
   - Invite Members section with code
   - Company Keywords management
   - Bulk PDF Import
   - Integrations (Slack, Teams)

### For Starter/Pro Tier Users

1. **Attempting Organization Creation:**
   - See warning message about tier requirement
   - Current tier displayed in badge
   - "Upgrade to Create Organization" button shown
   - Clicking button redirects to checkout for Team tier

2. **Settings Tabs:**
   - No Organization tab (feature locked)
   - Account tab shows upgrade prompt
   - Admin tab not visible (no organization)

## Subscription Tier Features

### Starter (Free)
- Basic contact management
- Contact import/export
- Email support
- ❌ Cannot create organization

### Pro ($6.99/month)
- Everything in Starter
- Client management
- Advanced search & filters
- Priority email support
- ❌ Cannot create organization

### Team ($49.99/month)
- Everything in Pro
- ✅ **Create organization**
- Up to 25 team members
- Shared contact folders
- Role-based permissions
- Slack & Teams integration

### Business ($119.99/month)
- Everything in Team
- ✅ **Create organization**
- Up to 100 team members
- Custom branding
- API access
- Dedicated support

## Technical Implementation Details

### Feature Checking

```typescript
// Check if user can create organization
const { canAccessFeature } = useSubscription();
const canCreate = canAccessFeature("organization_creation");

if (!canCreate) {
  // Show upgrade prompt or disable feature
}
```

### Organization Creation

```typescript
// From useProfile hook
const { createCompany } = useProfile(user?.id);

// Create organization
createCompany("My Organization");
```

### Database Validation

The database automatically validates subscription tier when `create_company` is called:

```typescript
// This will fail if user doesn't have Team/Business tier
const { data, error } = await supabase.rpc("create_company", {
  p_name: "My Organization",
});

// Error message: "organization_creation_requires_team_or_business_tier"
// Hint: "Upgrade to Team or Business tier to create an organization"
```

## Files Modified

### Frontend Components
- `src/types/subscription.ts` - Added organization_creation feature
- `src/components/CompanySetupDialog.tsx` - Added subscription checking
- `src/components/SettingsDialog.tsx` - Added Organization tab and account enhancements
- `src/components/OrganizationManagement.tsx` - NEW comprehensive dashboard

### Database Migrations
- `supabase/migrations/20250107200000_add_organization_creation_check.sql` - NEW
- `combined-migrations.sql` - Updated with new migration

## Testing Checklist

### As Business Tier User Without Organization
- [ ] Can see "Create Organization" option in CompanySetupDialog
- [ ] Can create organization from Settings → Account tab
- [ ] Can see Organization tab in Settings
- [ ] Organization Management dashboard displays correctly
- [ ] Can copy invite code
- [ ] Can see subscription information

### As Business Tier User With Organization (Admin)
- [ ] Can see Organization tab in Settings
- [ ] Can see Admin tab in Settings
- [ ] Can access all organization management features
- [ ] Can view team members
- [ ] Can manage company keywords
- [ ] Can access integrations

### As Starter/Pro Tier User
- [ ] Cannot see Organization tab in Settings
- [ ] See upgrade prompt in CompanySetupDialog
- [ ] See upgrade prompt in Account tab
- [ ] Clicking upgrade redirects to checkout
- [ ] Cannot create organization via any method

### Database Level
- [ ] Organization creation fails for Starter/Pro tier users
- [ ] Organization creation succeeds for Team/Business tier users
- [ ] Error message is clear and helpful

## Future Enhancements

1. **Invite Code Regeneration**: Allow admins to regenerate invite codes
2. **Organization Deletion**: Allow admins to delete organization (with safeguards)
3. **Member Management**: Remove members, change roles
4. **Organization Settings**: Custom branding, profile pictures
5. **Audit Logs**: Track organization changes
6. **Billing History**: View past invoices and payments
7. **Usage Analytics**: Track organization usage and metrics

## Support

For issues or questions about organization management:
- Check subscription tier in Settings → Organization
- Verify invite code is copied correctly
- Contact support if upgrade issues occur
- Check database logs for error messages

## Migration Instructions

To apply these changes to an existing deployment:

1. **Deploy Frontend Changes:**
   ```bash
   # Deploy updated frontend code
   npm run build
   # Deploy to hosting
   ```

2. **Apply Database Migration:**
   - Go to Supabase Dashboard → SQL Editor
   - Copy contents of `supabase/migrations/20250107200000_add_organization_creation_check.sql`
   - Paste and run
   - Or use the full `combined-migrations.sql` for fresh deployment

3. **Verify:**
   - Test organization creation with different tiers
   - Check error messages
   - Verify UI displays correctly

## Conclusion

These changes ensure that organization creation is properly gated behind Team and Business tier subscriptions, providing clear upgrade paths for users who want to collaborate with teams. The new Organization Management dashboard gives admins a centralized place to manage their organization, subscription, and team members.

