# Quick Start: Organization Integrations

## 🎯 Goal
Enable organization admins to connect Slack/Teams with a single button click, making integrations available to all organization members.

## 📍 Before You Start

**What you'll need:**
- Access to your Supabase project dashboard
- Admin access to a Slack workspace (for Slack integration)
- Admin access to Azure AD / Microsoft 365 (for Teams integration)
- 15-20 minutes of time

**Where to go:**
- Supabase Dashboard: https://supabase.com/dashboard/project/kzivlasydxnhbqduqpjb
- Slack API: https://api.slack.com/apps
- Azure Portal: https://portal.azure.com

---

## ⚡ 3-Step Setup (Using Supabase Dashboard)

### Step 1: Deploy Database Migration (3 minutes)

**Option A: Using Supabase Dashboard (Recommended)**

1. Go to your Supabase project at https://supabase.com/dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **"New Query"**
4. Copy the entire contents of `supabase/migrations/20260107000001_org_level_integrations.sql`
5. Paste into the SQL Editor
6. Click **"Run"** or press `Cmd+Enter` (Mac) / `Ctrl+Enter` (Windows)
7. You should see "Success. No rows returned" message

**What this does:**
- Adds `scope` column to `integrations` table
- Updates RLS policies for admin-only management
- Creates indexes for performance

**Verify it worked:**
- Go to **Table Editor** → **integrations** table
- You should see a new `scope` column with default value 'user'

---

### Step 2: Deploy Edge Functions (5 minutes)

**Using Supabase Dashboard:**

#### Deploy Slack Integration Function

1. In your Supabase Dashboard, go to **Edge Functions** in the left sidebar
2. Find `slack-integration` in the list (or create it if it doesn't exist)
3. Click on it to edit
4. Copy the entire contents of `supabase/functions/slack-integration/index.ts`
5. Paste it into the editor
6. Click **"Deploy"** button
7. Wait for deployment to complete

#### Deploy Teams Integration Function

1. In **Edge Functions**, find `teams-integration` (or create it)
2. Click on it to edit
3. Copy the entire contents of `supabase/functions/teams-integration/index.ts`
4. Paste it into the editor
5. Click **"Deploy"** button
6. Wait for deployment to complete

**What this does:**
- Updates Slack integration to support org-level scope
- Updates Teams integration to support org-level scope
- Adds admin verification for org operations

**Verify it worked:**
- Both functions should show "Deployed" status
- Check the "Invocations" tab to ensure no errors

---

### Step 3: Configure OAuth Apps & Secrets (10 minutes)

#### Slack App Setup

1. **Create Slack App:**
   - Go to https://api.slack.com/apps
   - Click **"Create New App"** → **"From scratch"**
   - Give it a name (e.g., "WhoNow Contacts")
   - Select your workspace

2. **Configure OAuth & Permissions:**
   - In left sidebar, click **"OAuth & Permissions"**
   - Scroll to **"Redirect URLs"** section
   - Click **"Add New Redirect URL"**
   - Enter: `https://kzivlasydxnhbqduqpjb.supabase.co/functions/v1/slack-integration`
   - Click **"Add"** then **"Save URLs"**

3. **Add Bot Token Scopes:**
   - Scroll down to **"Scopes"** section
   - Under **"Bot Token Scopes"**, click **"Add an OAuth Scope"**
   - Add these scopes one by one:
     - ✅ `users:read`
     - ✅ `users:read.email`
     - ✅ `chat:write`
     - ✅ `channels:read`
     - ✅ `groups:read`

4. **Get Credentials:**
   - Go to **"Basic Information"** in left sidebar
   - Scroll to **"App Credentials"** section
   - Copy the **Client ID** and **Client Secret**

5. **Add to Supabase:**
   - In Supabase Dashboard, go to **Project Settings** (gear icon)
   - Click **"Edge Functions"** → **"Secrets"**
   - Click **"Add secret"**
   - Name: `SLACK_CLIENT_ID`, Value: (paste your Client ID)
   - Click **"Add secret"** again
   - Name: `SLACK_CLIENT_SECRET`, Value: (paste your Client Secret)

---

#### Microsoft Teams App Setup

1. **Register App in Azure:**
   - Go to https://portal.azure.com
   - Search for **"App registrations"** and select it
   - Click **"New registration"**
   - Name: "WhoNow Contacts"
   - Supported account types: **"Accounts in any organizational directory"**
   - Click **"Register"**

2. **Configure Redirect URI:**
   - In your new app, go to **"Authentication"** in left menu
   - Click **"Add a platform"** → **"Web"**
   - Redirect URI: `https://kzivlasydxnhbqduqpjb.supabase.co/functions/v1/teams-integration`
   - Under **"Implicit grant and hybrid flows"**, check:
     - ✅ **Access tokens**
     - ✅ **ID tokens**
   - Click **"Configure"**

3. **Add API Permissions:**
   - Go to **"API permissions"** in left menu
   - Click **"Add a permission"** → **"Microsoft Graph"** → **"Delegated permissions"**
   - Search and add each of these:
     - ✅ `offline_access`
     - ✅ `User.Read`
     - ✅ `User.ReadBasic.All`
     - ✅ `Team.ReadBasic.All`
     - ✅ `TeamMember.Read.All`
     - ✅ `Channel.ReadBasic.All`
     - ✅ `Chat.ReadWrite`
     - ✅ `OnlineMeetings.ReadWrite`
   - Click **"Add permissions"**
   - If you're a tenant admin, click **"Grant admin consent for [Your Org]"**

4. **Create Client Secret:**
   - Go to **"Certificates & secrets"** in left menu
   - Click **"New client secret"**
   - Description: "WhoNow Integration"
   - Expires: Choose duration (24 months recommended)
   - Click **"Add"**
   - **IMPORTANT:** Copy the **Value** immediately (you can't see it again!)

5. **Get Credentials:**
   - Go to **"Overview"** in left menu
   - Copy the **Application (client) ID**

6. **Add to Supabase:**
   - In Supabase Dashboard, go to **Project Settings** → **"Edge Functions"** → **"Secrets"**
   - Click **"Add secret"**
   - Name: `MICROSOFT_CLIENT_ID`, Value: (paste your Application ID)
   - Click **"Add secret"** again
   - Name: `MICROSOFT_CLIENT_SECRET`, Value: (paste your Client Secret value)
   - (Optional) Add secret:
   - Name: `MICROSOFT_TENANT_ID`, Value: `organizations` (or your specific tenant ID)

## ✅ Done! Now Test It

### As Organization Admin:

1. **Login to app** → **Settings** → **Organization tab**

2. **Scroll to "Organization Integrations"**

3. **Click "Connect Organization Slack"**
   - Redirects to Slack OAuth
   - Authorize workspace access
   - Redirects back with success

4. **Click "Import Members"**
   - Imports all workspace members
   - Creates shared contacts for organization

5. **Repeat for Teams** if needed

### As Organization Member:

1. **Login to app** → **Settings** → **Organization tab**

2. **View integration status** (read-only)
   - See Slack is connected
   - See Teams is connected
   - Cannot disconnect (admin only)

3. **Check contacts** in main app
   - See imported contacts
   - Marked as "shared"
   - Tagged with integration source

## 🎨 What Users See

### Admin View

```
┌──────────────────────────────────────────┐
│  Organization Integrations               │
├──────────────────────────────────────────┤
│  Connect integrations once for your      │
│  entire organization. All members can    │
│  use these connections.                  │
├──────────────────────────────────────────┤
│                                          │
│  ┌─────────────┐  ┌─────────────┐      │
│  │ Slack       │  │ Teams       │      │
│  │             │  │             │      │
│  │ [Connect]   │  │ [Connect]   │      │
│  └─────────────┘  └─────────────┘      │
└──────────────────────────────────────────┘
```

After connecting:

```
┌──────────────────────────────────────────┐
│  Slack                    ✅ Connected    │
├──────────────────────────────────────────┤
│  Connected to Acme Corp Workspace        │
│  Organization-wide                       │
│                                          │
│  [Import Members]  [Disconnect]          │
└──────────────────────────────────────────┘
```

### Member View

```
┌──────────────────────────────────────────┐
│  Organization Integrations               │
├──────────────────────────────────────────┤
│  ℹ️ Only organization admins can          │
│  manage integrations. Contact your       │
│  admin to connect Slack or Teams.        │
├──────────────────────────────────────────┤
│                                          │
│  ✅ Slack: Connected to Acme Corp         │
│  ✅ Teams: Connected as admin@acme.com    │
└──────────────────────────────────────────┘
```

## 🔐 Security Built-In

✅ **Admin-Only Actions:**
- Connecting integrations
- Disconnecting integrations
- Importing contacts

✅ **Database Level:**
- RLS policies enforce permissions
- Admin role required for org scope

✅ **API Level:**
- Edge functions verify admin role
- Returns 403 for unauthorized attempts

✅ **Token Security:**
- Encrypted storage
- Refresh tokens for long-lived access
- Scoped per organization

## 📊 Key Files Modified

| File | Changes |
|------|---------|
| `supabase/migrations/20260107000001_org_level_integrations.sql` | ⭐ New migration |
| `supabase/functions/slack-integration/index.ts` | ✏️ Added scope support |
| `supabase/functions/teams-integration/index.ts` | ✏️ Added scope support |
| `src/hooks/useOrganizationIntegrations.ts` | ⭐ New hook |
| `src/components/OrganizationIntegrationsPanel.tsx` | ⭐ New component |
| `src/components/OrganizationManagement.tsx` | ✏️ Added panel |

## 🧪 Quick Test & Verification

### Verify Database Migration

1. In Supabase Dashboard, go to **Table Editor**
2. Select **integrations** table
3. Check that you see a **scope** column
4. Click on any row and verify scope shows 'user' or 'organization'

### Verify Edge Functions

1. In Supabase Dashboard, go to **Edge Functions**
2. Both `slack-integration` and `teams-integration` should show:
   - ✅ **Status:** Deployed
   - ✅ **Last deployed:** Recent timestamp
3. Click on each function to see deployment details

### Verify Secrets

1. In Supabase Dashboard, go to **Project Settings** → **Edge Functions** → **Secrets**
2. You should see:
   - ✅ `SLACK_CLIENT_ID`
   - ✅ `SLACK_CLIENT_SECRET`
   - ✅ `MICROSOFT_CLIENT_ID`
   - ✅ `MICROSOFT_CLIENT_SECRET`
   - (Optional) `MICROSOFT_TENANT_ID`

### View Function Logs (Real-time)

1. In Supabase Dashboard, go to **Edge Functions**
2. Click on `slack-integration` or `teams-integration`
3. Click the **"Logs"** tab
4. You'll see real-time logs of function calls

### Check Database Data

1. In Supabase Dashboard, go to **SQL Editor**
2. Run this query to check integrations:
   ```sql
   SELECT provider, scope, is_active, created_at 
   FROM integrations 
   ORDER BY created_at DESC;
   ```

## 🐛 Troubleshooting Quick Fixes

### "Only admins can manage integrations"

**Fix:** Make the user an admin

1. Go to **SQL Editor** in Supabase Dashboard
2. Run this query (replace `user-uuid-here` with actual user ID):
   ```sql
   INSERT INTO user_roles (user_id, role)
   VALUES ('user-uuid-here', 'admin')
   ON CONFLICT (user_id, role) DO NOTHING;
   ```

**How to find user ID:**
- Go to **Authentication** → **Users**
- Find the user and copy their UUID

---

### "Slack not connected" after OAuth

**Check edge function logs:**
1. Go to **Edge Functions** → **slack-integration**
2. Click **"Logs"** tab
3. Look for recent errors
4. Common issues:
   - Missing secrets
   - Wrong redirect URL
   - Invalid OAuth scopes

**Verify secrets:**
1. Go to **Project Settings** → **Edge Functions** → **Secrets**
2. Confirm `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET` exist
3. Values should match your Slack app credentials

---

### Teams "Personal account not supported"

**Fix:** User must use **work/school account**, not personal Microsoft account.

**Steps:**
1. Disconnect current integration (if any)
2. Click "Connect Organization Teams" again
3. When Microsoft login appears, make sure to:
   - Use your work email (e.g., `you@company.com`)
   - NOT use personal account (e.g., `you@outlook.com` or `you@hotmail.com`)

---

### Import shows 0 contacts

**Check function logs:**
1. Go to **Edge Functions** → **slack-integration** or **teams-integration**
2. Click **"Logs"** tab
3. Look for "import-members" action
4. Check for errors

**Common causes:**
- Workspace/tenant has no members
- OAuth token expired (disconnect and reconnect)
- Missing permissions (check OAuth scopes)
- API rate limiting

**Verify data:**
1. Go to **SQL Editor**
2. Run:
   ```sql
   SELECT * FROM integration_logs 
   WHERE action = 'import-members' 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```

## 📚 Full Documentation

For detailed information:

- **Architecture & Design:** `ORGANIZATION_INTEGRATIONS.md`
- **Complete Setup:** `INTEGRATION_SETUP_SUMMARY.md`
- **Security Details:** `SECURITY.md`

## 🎉 Success Indicators

You'll know it's working when:

**In Supabase Dashboard:**
- ✅ Migration ran without errors in SQL Editor
- ✅ `integrations` table has `scope` column
- ✅ Edge functions show "Deployed" status
- ✅ All secrets are configured

**In Your App (as Admin):**
- ✅ Navigate to Settings → Organization → Integrations
- ✅ See "Connect Organization Slack" button
- ✅ Click and OAuth redirects to Slack/Teams
- ✅ After authorization, redirects back with success
- ✅ Integration shows "✅ Connected" badge
- ✅ "Import Members" button appears
- ✅ Click import and see count of imported contacts
- ✅ Check contacts list - new contacts have "slack-import" tag

**In Your App (as Member):**
- ✅ Navigate to Settings → Organization
- ✅ See "Only admins can manage integrations" message
- ✅ See which integrations are active (read-only)
- ✅ Cannot see connect/disconnect buttons
- ✅ Can see imported contacts in main contacts list

---

## 💡 Pro Tips

1. **Deploy in Order:**
   - ✅ First: Database migration (Step 1)
   - ✅ Second: Edge functions (Step 2)
   - ✅ Third: OAuth apps & secrets (Step 3)
   - ✅ Fourth: Test as admin
   - ✅ Fifth: Test as member

2. **Use Incognito/Private Browsing:**
   - Test OAuth flows in incognito mode
   - Avoids cached authentication state
   - Makes testing with different accounts easier

3. **Check Logs First:**
   - Edge function logs in Dashboard show exact errors
   - Much faster than trial and error
   - Look for red error messages

4. **Start with Slack:**
   - Simpler OAuth setup than Teams
   - No Azure AD complexity
   - Good for testing the flow first

5. **Teams Admin Consent:**
   - If you're a tenant admin, grant consent for all users
   - In Azure AD, click "Grant admin consent for [Org]"
   - Prevents each user from needing to approve

6. **Keep Secrets Safe:**
   - Never commit client secrets to git
   - Only store in Supabase Dashboard
   - Rotate secrets if compromised

7. **Test with Real Data:**
   - Use a real Slack workspace with members
   - Use a Teams tenant with actual teams
   - Import will show 0 if workspace is empty

## 📸 Visual Walkthrough

### Dashboard Navigation Quick Reference

```
Supabase Dashboard
├── 📊 SQL Editor (Step 1 - Run migration)
├── ⚡ Edge Functions (Step 2 - Deploy functions)
│   ├── slack-integration
│   ├── teams-integration
│   └── View Logs here
├── 🗄️ Table Editor (Verify migration)
│   └── integrations table
├── 🔐 Authentication (Find user IDs)
│   └── Users list
└── ⚙️ Project Settings
    └── Edge Functions → Secrets (Step 3 - Add OAuth credentials)
```

### Where Everything Goes

| What | Where in Dashboard | File Source |
|------|-------------------|-------------|
| Database Migration | SQL Editor | `supabase/migrations/20260107000001_org_level_integrations.sql` |
| Slack Function | Edge Functions → slack-integration | `supabase/functions/slack-integration/index.ts` |
| Teams Function | Edge Functions → teams-integration | `supabase/functions/teams-integration/index.ts` |
| Slack Secrets | Project Settings → Secrets | From Slack App Credentials |
| Teams Secrets | Project Settings → Secrets | From Azure App Registration |

---

## 🚀 That's It!

Your organization-level integrations are now ready to use!

**Time to deploy:** ~20 minutes (using Dashboard)  
**Admin effort:** 1 button click to connect  
**Member benefit:** Instant access to shared contacts

**Next Steps:**
1. Make yourself an admin (if not already)
2. Login to your app
3. Go to Settings → Organization → Integrations
4. Click "Connect Organization Slack" or "Connect Organization Teams"
5. Import members
6. Share with your team!

---

## 📚 Additional Resources

- **Detailed Architecture:** `ORGANIZATION_INTEGRATIONS.md`
- **Complete Setup Guide:** `INTEGRATION_SETUP_SUMMARY.md`
- **Troubleshooting:** Check function logs in Dashboard

Questions? Check the full documentation or contact support.

---

**Quick Start Guide (Dashboard Edition)**  
**Last Updated:** January 7, 2026  
**Version:** 2.0 - No CLI Required

