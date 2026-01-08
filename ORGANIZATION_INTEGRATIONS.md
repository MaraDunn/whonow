# Organization-Level Integrations

This document explains how organization-level Slack and Microsoft Teams integrations work in WhoNow.

## Overview

Organization-level integrations allow org admins to connect Slack and Microsoft Teams **once for the entire organization**, making it easy for all members to benefit from these integrations without individual setup.

## Key Features

### 🎯 Single-Click Setup for Admins
- **Organization admins** can connect Slack or Teams with a single OAuth flow
- The integration is shared across the entire organization
- No need for individual users to connect their own accounts

### 👥 Shared Access
- All organization members can use org-level integrations
- Imported contacts are automatically shared with the organization
- Members see integration status but cannot disconnect (admin-only)

### 🔒 Admin-Only Management
- Only users with the `admin` role can:
  - Connect organization integrations
  - Disconnect organization integrations
  - Import contacts at the organization level

## Architecture

### Database Schema

The `integrations` table has been enhanced with:

```sql
-- Scope column determines if integration is user-level or org-level
scope TEXT NOT NULL DEFAULT 'user' CHECK (scope IN ('user', 'organization'))

-- Company ID for org-level integrations
company_id UUID REFERENCES public.companies(id)
```

### Row-Level Security (RLS)

- **View**: Users can view their own integrations AND org-level integrations for their company
- **Insert/Update/Delete**: Only admins can manage org-level integrations
- **User-level**: Individual users can still create personal integrations

### Integration Scopes

| Scope | Who Can Manage | Access | Imported Contacts |
|-------|---------------|--------|-------------------|
| `user` | Individual user | Personal only | Owner's personal contacts |
| `organization` | Organization admins | All org members | Shared with organization |

## How It Works

### 1. Admin Connects Integration

```typescript
// Admin clicks "Connect Organization Slack"
const { connectSlack } = useOrganizationIntegrations();
connectSlack(); // Triggers OAuth with scope='organization'
```

The OAuth flow:
1. Edge function verifies user is admin
2. Generates OAuth URL with `scope: 'organization'` in state
3. User authorizes with Slack/Teams
4. Callback stores integration with `company_id` and `scope='organization'`

### 2. Members Use Integration

All organization members can:
- See that Slack/Teams is connected
- View which workspace/tenant is connected
- Use integration features (if implemented)

Members **cannot**:
- Disconnect the organization integration
- Modify settings
- Override with personal integration (org-level takes precedence)

### 3. Importing Contacts

When admin imports contacts:

```typescript
// Import members from Slack
const { importSlackMembers } = useOrganizationIntegrations();
await importSlackMembers();
```

Imported contacts are:
- Marked with `is_shared: true`
- Assigned to organization's `company_id`
- Visible to all organization members
- Tagged with integration source (e.g., "slack-import")

## Components

### `OrganizationIntegrationsPanel`

Main UI component for managing organization integrations.

**For Admins:**
- Connect/disconnect buttons
- Import members button
- View integration status
- See workspace/tenant details

**For Members:**
- View-only mode
- See which integrations are active
- Prompt to contact admin for changes

### `useOrganizationIntegrations` Hook

Core hook for org-level integration management.

```typescript
const {
  isAdmin,              // Whether current user is admin
  slackStatus,          // Slack integration status
  teamsStatus,          // Teams integration status
  connectSlack,         // Connect Slack (admin-only)
  connectTeams,         // Connect Teams (admin-only)
  disconnectSlack,      // Disconnect Slack (admin-only)
  disconnectTeams,      // Disconnect Teams (admin-only)
  importSlackMembers,   // Import from Slack
  importTeamsMembers,   // Import from Teams
  getAllStatus,         // Refresh all statuses
} = useOrganizationIntegrations();
```

## Edge Functions

Both `slack-integration` and `teams-integration` edge functions have been enhanced to support:

### Scope Parameter

All actions now accept an optional `scope` parameter:

```typescript
{
  action: "get-oauth-url",
  scope: "organization", // or "user" (default)
  origin: window.location.origin
}
```

### Admin Verification

For org-level operations, functions verify admin role:

```typescript
const { data: isAdminData } = await supabase.rpc('has_role', {
  user_id: user.id,
  role_to_check: 'admin'
});
```

### Smart Integration Lookup

Functions check for org-level integration first, then fall back to user-level:

```sql
-- Check org-level
SELECT * FROM integrations 
WHERE company_id = $1 
  AND provider = 'slack' 
  AND scope = 'organization' 
  AND is_active = true;

-- Fallback to user-level
SELECT * FROM integrations 
WHERE user_id = $1 
  AND provider = 'slack' 
  AND scope = 'user';
```

## Setup Instructions

### For Application Setup

1. **Run Migration:**
   ```bash
   # Apply the organization integrations migration
   supabase db push
   ```

2. **Configure Secrets:**
   ```bash
   # Slack
   supabase secrets set SLACK_CLIENT_ID=your_client_id
   supabase secrets set SLACK_CLIENT_SECRET=your_client_secret
   
   # Microsoft Teams
   supabase secrets set MICROSOFT_CLIENT_ID=your_client_id
   supabase secrets set MICROSOFT_CLIENT_SECRET=your_client_secret
   supabase secrets set MICROSOFT_TENANT_ID=organizations # or your tenant ID
   ```

3. **Deploy Edge Functions:**
   ```bash
   supabase functions deploy slack-integration
   supabase functions deploy teams-integration
   ```

### For Slack App Configuration

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Create a new app or select existing
3. **OAuth & Permissions** → Add scopes:
   - `users:read`
   - `users:read.email`
   - `chat:write`
   - `channels:read`
   - `groups:read`
4. **Redirect URLs** → Add:
   ```
   https://[YOUR-PROJECT-ID].supabase.co/functions/v1/slack-integration
   ```
5. Copy **Client ID** and **Client Secret** to Supabase secrets

### For Microsoft Teams App Configuration

1. Go to [Azure AD Portal](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Register a new application
3. **API permissions** → Add:
   - `User.Read`
   - `User.ReadBasic.All`
   - `Team.ReadBasic.All`
   - `TeamMember.Read.All`
   - `Channel.ReadBasic.All`
   - `Chat.ReadWrite`
   - `OnlineMeetings.ReadWrite`
4. **Redirect URIs** → Add (Web):
   ```
   https://[YOUR-PROJECT-ID].supabase.co/functions/v1/teams-integration
   ```
5. **Certificates & secrets** → Create new client secret
6. Copy **Application (client) ID** and **Client secret** to Supabase secrets

## Usage Flow

### Admin Perspective

1. **Navigate to Organization Settings**
   - Go to Settings → Organization tab
   - Scroll to "Organization Integrations" section

2. **Connect Integration**
   - Click "Connect Organization Slack" or "Connect Organization Teams"
   - Authorize with OAuth
   - Redirected back with success message

3. **Import Members**
   - Click "Import Members"
   - Contacts are imported and shared with organization
   - All members can now see these contacts

4. **Manage Integration**
   - Disconnect if needed
   - Re-import to sync new members
   - View integration status and details

### Member Perspective

1. **View Integration Status**
   - Navigate to Settings → Organization tab
   - See which integrations are active
   - View workspace/tenant details

2. **Use Shared Contacts**
   - Imported contacts appear in main contact list
   - Tagged with integration source
   - Marked as shared organization contacts

3. **Request Changes**
   - UI prompts to contact admin
   - Cannot disconnect or modify settings

## Security Considerations

### Admin-Only Actions

The following are restricted to admins:

1. Connecting organization integrations
2. Disconnecting organization integrations
3. Modifying integration settings
4. Importing contacts at org level

### Token Storage

- Access tokens stored encrypted in database
- Refresh tokens used to maintain access
- Tokens scoped to organization, not individual users
- RLS ensures tokens only accessible to authorized users

### Permission Scopes

Integrations request minimal permissions:

**Slack:**
- Read user info and emails
- Post messages (for sharing)
- List channels

**Teams:**
- Read basic user and team info
- Create meetings
- Read/write messages

## Troubleshooting

### "Only organization admins can manage integrations"

**Cause:** User doesn't have admin role

**Solution:** 
1. Verify user has admin role in `user_roles` table
2. Check RLS policies are applied correctly
3. Ensure `has_role` function is working

### "Slack not connected" after successful OAuth

**Cause:** Integration storage failed

**Solution:**
1. Check edge function logs
2. Verify user has company_id set
3. Check RLS policies allow insert
4. Verify secrets are configured

### Import shows 0 members

**Cause:** OAuth token lacks permissions or team is empty

**Solution:**
1. Reconnect integration
2. Verify OAuth scopes in app config
3. Check Slack/Teams workspace has members
4. Review edge function logs for API errors

### Teams says "personal account not supported"

**Cause:** User connected with personal Microsoft account

**Solution:**
1. Disconnect integration
2. Reconnect using work/school account
3. Ensure `MICROSOFT_TENANT_ID` is not set to "common"
4. Admin may need to grant tenant consent

## Migration Path

### From User-Level to Organization-Level

If you have existing user-level integrations and want to migrate:

1. **Admins disconnect personal integrations:**
   ```sql
   DELETE FROM integrations 
   WHERE user_id = 'admin-user-id' 
     AND scope = 'user';
   ```

2. **Connect org-level integration** through UI

3. **Import contacts** at org level

4. **Optional:** Delete user-level integrations
   ```sql
   DELETE FROM integrations 
   WHERE company_id = 'company-id' 
     AND scope = 'user';
   ```

## Future Enhancements

Potential improvements:

1. **Sync Schedules:** Auto-import new members periodically
2. **Selective Sync:** Choose which Slack channels or Teams to sync
3. **Bi-directional Sync:** Update Slack/Teams when contacts change
4. **Integration Analytics:** Track usage and sync history
5. **Multiple Workspaces:** Support multiple Slack workspaces per org
6. **Permission Templates:** Pre-configured scopes for different use cases

## API Reference

### Edge Function Actions

#### `get-oauth-url`
```typescript
POST /slack-integration or /teams-integration
{
  action: "get-oauth-url",
  scope: "organization",
  origin: "https://app.whonow.com"
}
→ { url: "https://slack.com/oauth/..." }
```

#### `import-members`
```typescript
POST /slack-integration or /teams-integration
{
  action: "import-members",
  scope: "organization"
}
→ { 
  success: true, 
  imported: 42,
  skipped: 3,
  contacts: [...] 
}
```

#### `get-status`
```typescript
POST /slack-integration or /teams-integration
{
  action: "get-status",
  scope: "organization"
}
→ { 
  connected: true,
  scope: "organization",
  settings: { team_name: "Acme Corp" }
}
```

#### `disconnect`
```typescript
POST /slack-integration or /teams-integration
{
  action: "disconnect",
  scope: "organization"
}
→ { success: true }
```

## Support

For issues or questions:

1. Check edge function logs: `supabase functions logs slack-integration`
2. Verify database state: Check `integrations` table
3. Review RLS policies: Ensure admin role is set correctly
4. Test OAuth flow: Try connecting in incognito mode
5. Contact support with logs and error messages

---

**Last Updated:** January 7, 2026
**Version:** 1.0.0

