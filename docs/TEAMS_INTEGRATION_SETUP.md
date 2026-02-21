# Step-by-Step: Enabling the Microsoft Teams Integration

This guide walks you through enabling the Teams integration for WhoNow, including everything you need to do in **Microsoft Azure** and in **WhoNow/Supabase**.

---

## Prerequisites

- **Azure / Microsoft 365 admin access** (to register the app and grant consent)
- **WhoNow organization admin** (to connect Teams in the app)
- **Work or school Microsoft account** (personal Outlook/Hotmail accounts do not work for Teams)
- Your **Supabase project ID** (e.g. `kzivlasydxnhbqduqpjb` — find it in Supabase Dashboard → Project Settings → General)

---

## Part 1: Microsoft Azure (App Registration)

All of these steps happen in the Azure Portal.

### Step 1.1: Open App registrations

1. Go to **https://portal.azure.com**
2. Sign in with a **work or school account** that has permission to register applications (e.g. Global Administrator or Application Administrator).
3. In the top search bar, type **App registrations** and open it.
4. Click **+ New registration**.

---

### Step 1.2: Create the app registration

1. **Name:** e.g. `WhoNow Contacts` (or your app name).
2. **Supported account types:**  
   Select **Accounts in any organizational directory only**  
   (This restricts sign-in to work/school accounts and is required for Teams.)
3. **Redirect URI:**  
   Leave blank for now (you’ll add it in the next section).
4. Click **Register**.

---

### Step 1.3: Add the redirect URI (Web)

1. In the left menu of your new app, click **Authentication**.
2. Click **+ Add a platform**.
3. Choose **Web**.
4. **Redirect URI:**  
   `https://YOUR-SUPABASE-PROJECT-ID.supabase.co/functions/v1/teams-integration`  
   Replace `YOUR-SUPABASE-PROJECT-ID` with your actual Supabase project ID (e.g. `kzivlasydxnhbqduqpjb`).
5. Under **Implicit grant and hybrid flows**, enable:
   - **Access tokens** (used for obtaining access tokens)
   - **ID tokens** (used for OpenID Connect)
6. Click **Configure**.

---

### Step 1.4: Add API permissions (Microsoft Graph)

1. In the left menu, click **API permissions**.
2. Click **+ Add a permission**.
3. Choose **Microsoft Graph**.
4. Choose **Delegated permissions**.
5. Add each of these (search by name, then check the box and click **Add permissions** for each or add in one go):

   | Permission | Purpose |
   |------------|--------|
   | `offline_access` | Refresh tokens so the integration stays connected |
   | `User.Read` | Signed-in user profile |
   | `User.ReadBasic.All` | Read basic profile of all users (for import) |
   | `Group.Read.All` | Read group/team membership (used by Teams APIs) |
   | `Team.ReadBasic.All` | List teams the user has joined |
   | `TeamMember.Read.All` | Read team members (for importing contacts) |
   | `Channel.ReadBasic.All` | List channels in teams |
   | `Chat.ReadWrite` | Post messages to channels (e.g. share contact) |
   | `OnlineMeetings.ReadWrite` | Create Teams meetings |

6. After adding all of them, click **Add permissions** to close the panel.

---

### Step 1.5: Grant admin consent (important)

Admin consent lets all users in your tenant use the app without each person approving.

1. Still on **API permissions**.
2. Click **Grant admin consent for [Your organization name]**.
3. Confirm with **Yes**.
4. Each permission should show a green check under **Status** (e.g. “Granted for …”).

If you don’t have admin rights, a tenant admin must do this step. Without it, users may see consent or access errors when connecting Teams.

---

### Step 1.6: Create a client secret

1. In the left menu, click **Certificates & secrets**.
2. Under **Client secrets**, click **+ New client secret**.
3. **Description:** e.g. `WhoNow Integration`.
4. **Expires:** e.g. 24 months (you’ll need to create a new secret before it expires).
5. Click **Add**.
6. **Copy the secret Value immediately.** It is shown only once. Store it somewhere safe (you’ll add it to Supabase in Part 2).

---

### Step 1.7: Copy Application (client) ID and optional Tenant ID

1. In the left menu, click **Overview**.
2. Copy and save:
   - **Application (client) ID** — required for WhoNow.
   - **Directory (tenant) ID** — optional; only needed if you want to restrict to a single tenant (see below).

**Tenant behavior:**

- Use **Tenant ID = `organizations`** (or leave unset so the code uses `common` then set to `organizations`): any work/school Azure AD tenant can connect. Recommended for SaaS.
- Use your **Directory (tenant) ID**: only that tenant can connect. Use this if WhoNow is for a single organization.

---

## Part 2: WhoNow / Supabase configuration

### Step 2.1: Ensure database and Edge Function are ready

- The org-level integrations migration must be applied (e.g. `supabase/migrations/20260107000001_org_level_integrations.sql`).
- The **teams-integration** Edge Function must be deployed (code in `supabase/functions/teams-integration/index.ts`).

If you use the Supabase Dashboard: run the migration in the SQL Editor and deploy the `teams-integration` function from the Edge Functions section.

---

### Step 2.2: Add Edge Function secrets

1. Open your **Supabase** project.
2. Go to **Project Settings** (gear) → **Edge Functions** → **Secrets**.
3. Add these secrets:

   | Name | Value |
   |------|--------|
   | `MICROSOFT_CLIENT_ID` | Application (client) ID from Azure Overview |
   | `MICROSOFT_CLIENT_SECRET` | The client secret Value you copied from Certificates & secrets |

4. **Optional — restrict to work/school accounts only:**  
   Add:

   | Name | Value |
   |------|--------|
   | `MICROSOFT_TENANT_ID` | `organizations` |

   With `organizations`, only work/school accounts can sign in (recommended for Teams). Omit or use your specific **Directory (tenant) ID** if you want single-tenant behavior.

5. **Required in production — OAuth state secret:**  
   Add a secret used to sign OAuth `state` so callbacks cannot be tampered with (prevents binding a token to the wrong user):

   | Name | Value |
   |------|--------|
   | `OAUTH_STATE_SECRET` | A random string at least 16 characters (e.g. from `openssl rand -hex 32`) |

   The same secret is used by both Teams and Slack integrations. **In production** (when `APP_LAUNCH_MODE` is not `waitlist`), `OAUTH_STATE_SECRET` **must** be set; otherwise the OAuth callback will fail with a misconfiguration error. In waitlist or local dev, callbacks can run without it (less secure).

---

## Part 3: Connect Teams in WhoNow (as org admin)

1. Log in to WhoNow with a user that is an **organization admin**.
2. Go to **Settings** → **Organization** tab.
3. Find **Organization Integrations**.
4. Click **Connect Organization Teams**.
5. You’ll be sent to Microsoft sign-in. Use a **work or school account** (not a personal Microsoft account).
6. Approve the requested permissions (if you didn’t grant admin consent, you’ll see the consent screen here).
7. You’re redirected back to WhoNow; the integration should show as connected.
8. Use **Import Members** to pull in people from your Teams as shared contacts.

---

## Checklist summary

**Azure:**

- [ ] App registration created (work/school accounts only).
- [ ] Web redirect URI set to `https://YOUR-PROJECT-ID.supabase.co/functions/v1/teams-integration`.
- [ ] Access tokens and ID tokens enabled under Authentication.
- [ ] All required Microsoft Graph delegated permissions added.
- [ ] Admin consent granted for your tenant.
- [ ] Client secret created and value copied.
- [ ] Application (client) ID copied.

**Supabase:**

- [ ] Migration applied; `teams-integration` Edge Function deployed.
- [ ] `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET` set in Edge Function secrets.
- [ ] Optionally `MICROSOFT_TENANT_ID` set to `organizations` (or your tenant ID).

**WhoNow:**

- [ ] User is organization admin.
- [ ] Connect Teams using a work/school account; then Import Members if desired.

---

## Troubleshooting

| Issue | What to do |
|-------|------------|
| **“Personal account not supported”** | Sign in with a work or school account (e.g. `you@company.com`), not `@outlook.com` / `@hotmail.com`. Set `MICROSOFT_TENANT_ID=organizations` to restrict to work/school. |
| **“Only organization admins can setup organization integrations”** | The connecting user must have the `admin` role in WhoNow (e.g. in `user_roles`). |
| **“Microsoft Teams access denied” or 401/403 on import** | Grant **admin consent** in Azure (API permissions → Grant admin consent). Ensure all required Graph permissions are added and consented. |
| **Redirect URI mismatch** | Redirect URI in Azure must match exactly: `https://YOUR-PROJECT-ID.supabase.co/functions/v1/teams-integration` (no trailing slash, correct project ID). |
| **Import shows 0 members** | Confirm the signed-in user is in at least one Team and that admin consent was granted. Check Edge Function logs for Graph errors. |
| **Teams not connected after OAuth** | Check Edge Function logs and Supabase secrets (`MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`). Ensure the user’s profile has a `company_id` (org-level integration requires it). |

---

## Reference: redirect URI and permissions

- **Redirect URI (Web):**  
  `https://YOUR-SUPABASE-PROJECT-ID.supabase.co/functions/v1/teams-integration`

- **Graph delegated permissions:**  
  `offline_access`, `User.Read`, `User.ReadBasic.All`, `Group.Read.All`, `Team.ReadBasic.All`, `TeamMember.Read.All`, `Channel.ReadBasic.All`, `Chat.ReadWrite`, `OnlineMeetings.ReadWrite`

---

*Last updated: February 2026*
