# Organization Folders Feature

## Overview

This feature implements **shared organization folders** that are accessible to all members of an organization. Only organization admins can create, edit, and delete organization folders, while all members can view them and add contacts to them.

## Key Features

### 1. **Folder Types**
- **Personal Folders**: Created by individual users, visible only to the creator
- **Organization Folders**: Created by admins, visible to all organization members

### 2. **Role-Based Permissions**
- **Organization Admins**:
  - Can create, edit, and delete organization folders
  - Can create personal folders
  - Full access to manage both types
  
- **Organization Members**:
  - Can view all organization folders
  - Can add/move contacts to organization folders
  - Can only manage their own personal folders
  - Cannot create, edit, or delete organization folders

### 3. **Visual Indicators**
- Organization folders are clearly labeled in the sidebar
- A "Building" icon distinguishes organization folder sections
- Tooltips indicate folder ownership in collapsed sidebar mode

## Implementation Details

### Database Schema

The migration adds an `is_organization_folder` boolean column to the `folders` table:

```sql
ALTER TABLE public.folders 
ADD COLUMN IF NOT EXISTS is_organization_folder BOOLEAN DEFAULT false;
```

### Row-Level Security (RLS) Policies

Updated policies ensure:
- All company members can **view** organization folders
- Only admins can **create**, **update**, or **delete** organization folders
- Users maintain full control over their personal folders

### Frontend Components

#### Updated Components:
1. **FolderSidebar**: Displays organization folders in separate sections
2. **FolderFormDialog**: Shows organization folder toggle for admins
3. **useFolders Hook**: Separates personal and organization folders
4. **Folder Type**: Extended with `isOrganizationFolder` property

## Usage

### For Admins

1. **Create Organization Folder**:
   - Click the "+" button in the folder sidebar
   - Check the "Organization Folder" checkbox
   - Name and color the folder
   - Click "Create"

2. **Edit Organization Folder**:
   - Hover over an organization folder
   - Click the three dots menu
   - Select "Rename"
   - Make changes and save

3. **Delete Organization Folder**:
   - Hover over an organization folder
   - Click the three dots menu
   - Select "Delete"
   - Confirm the action

### For Members

1. **View Organization Folders**:
   - Organization folders appear in a separate section labeled "Organization"
   - They're accessible to all team members

2. **Add Contacts to Organization Folders**:
   - Drag and drop contacts into organization folders
   - Or edit a contact and select an organization folder

3. **Cannot Modify**:
   - Members cannot edit or delete organization folders
   - The three-dot menu is hidden for organization folders for non-admins

## Directory Types

Organization folders work across all three directory types:
- **Contacts Directory**: General contact organization
- **Client Directory**: Client-specific folders (Pro tier+)
- **Team Directory**: Internal team member organization (Team tier+)

## Migration Instructions

### Local Development

To apply the migration locally:

```bash
# If using Supabase CLI locally
supabase db reset

# Or apply the specific migration
supabase migration up
```

### Production Deployment

The migration file is located at:
```
supabase/migrations/20250107000000_add_organization_folders.sql
```

To deploy to production:

1. **Using Supabase Dashboard**:
   - Go to your Supabase project dashboard
   - Navigate to SQL Editor
   - Copy and paste the migration SQL
   - Execute the query

2. **Using Supabase CLI**:
   ```bash
   supabase db push
   ```

3. **Using CI/CD**:
   - The migration will be automatically applied when deploying
   - Ensure your deployment pipeline includes database migrations

## Testing

### Test Scenarios

1. **Admin User**:
   - ✅ Can create organization folders
   - ✅ Can edit organization folders
   - ✅ Can delete organization folders
   - ✅ Sees organization folder checkbox in form dialog

2. **Member User**:
   - ✅ Can view organization folders
   - ✅ Can add contacts to organization folders
   - ❌ Cannot create organization folders
   - ❌ Cannot edit organization folders
   - ❌ Cannot delete organization folders
   - ❌ Does not see organization folder checkbox

3. **Non-Company User**:
   - ✅ Can create personal folders
   - ❌ Does not see organization folder options

## Technical Architecture

### Type Definitions

```typescript
export interface Folder {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  directoryType: DirectoryType;
  isOrganizationFolder?: boolean;
  ownerId?: string | null;
  companyId?: string | null;
}
```

### Database Structure

```
folders table:
├── id (uuid, PK)
├── name (text)
├── color (text)
├── directory_type (text)
├── owner_id (uuid, FK to auth.users)
├── company_id (uuid, FK to companies)
├── is_organization_folder (boolean)  ← NEW
├── created_at (timestamptz)
└── updated_at (timestamptz)
```

### Permission Flow

```
User Action
    ↓
Frontend Check (useProfile.isAdmin)
    ↓
Backend RLS Policy (has_role('admin'))
    ↓
Database Operation
```

## Benefits

1. **Centralized Organization**: Admins can create a standardized folder structure for the entire team
2. **Consistency**: All team members see the same organizational structure
3. **Collaboration**: Team-wide folders make it easy to share and organize contacts
4. **Security**: Role-based access ensures only authorized users can modify folder structure
5. **Flexibility**: Users can still maintain personal folders alongside organization folders

## Future Enhancements

Potential improvements:
- [ ] Custom folder permissions (specific users/roles)
- [ ] Folder templates for new organizations
- [ ] Bulk folder operations
- [ ] Folder access audit logs
- [ ] Nested organization folders (subfolders)

## Troubleshooting

### Issue: Organization folders not visible
**Solution**: Ensure the user is part of a company and the migration has been applied.

### Issue: Cannot create organization folder as admin
**Solution**: 
1. Verify the user has the 'admin' role in the `user_roles` table
2. Check that the company_id is properly set in the user's profile
3. Ensure RLS policies have been updated

### Issue: Migration fails
**Solution**: 
1. Check if the column already exists: `SELECT * FROM information_schema.columns WHERE table_name = 'folders' AND column_name = 'is_organization_folder';`
2. If it exists, the migration can be safely skipped
3. Manually apply the RLS policies if needed

## Support

For issues or questions about organization folders:
1. Check this documentation
2. Review the migration file for SQL details
3. Check component implementations in `src/components/`
4. Consult Supabase RLS documentation for policy troubleshooting

