# Step-by-step: Google Contact Sync & Calendar Integration

This guide covers **your side** of the setup: Google Cloud Console configuration and environment variables so that Contact Sync and Calendar Integration work in WhoNow.

---

## Part A: Google Cloud Console (one-time)

### 1. Create or select a project

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing one (e.g. "WhoNow").
3. Note your **Project ID**; you’ll use it in the Supabase redirect URI.

### 2. Enable APIs

1. In the left menu: **APIs & Services** → **Library**.
2. Search and **enable**:
   - **Google People API** (for contact import and sync to Google).
   - **Google Calendar API** (for adding follow-up events to the user’s calendar).

### 3. Configure OAuth consent screen

1. **APIs & Services** → **OAuth consent screen**.
2. Choose **External** (or Internal if only for your org) → **Create**.
3. Fill in:
   - **App name**: e.g. WhoNow
   - **User support email**: your email
   - **Developer contact**: your email
4. Click **Save and Continue**.
5. **Scopes**:
   - **Add or Remove Scopes**.
   - Add:
     - `https://www.googleapis.com/auth/contacts` — “See and manage your contacts” (for contact import + sync to Google).
     - `https://www.googleapis.com/auth/calendar.events` — “View and edit events on all your calendars” (for follow-up events).
   - **Save and Continue**.
6. **Test users** (if app is in “Testing”): add the Google accounts you’ll use to test.
7. **Save and Continue** through the summary.

### 4. Create OAuth 2.0 credentials

1. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**.
2. **Application type**: **Web application**.
3. **Name**: e.g. “WhoNow Web”.
4. **Authorized JavaScript origins** (for Contact Sync in the browser):
   - `http://localhost:5173` (Vite dev)
   - `http://localhost:8080` (if you use it)
   - Your production URL, e.g. `https://whonow.co`
   - `https://www.whonow.co` if you use www
5. **Authorized redirect URIs**:
   - For **Calendar** (server-side flow), the callback must be your Supabase Edge Function:
     - `https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/functions/v1/google-calendar-integration`
     - Example: `https://abcdefghij.supabase.co/functions/v1/google-calendar-integration`
   - For **Contacts** (client-side token flow), add your app URLs so the consent screen can return to your app:
     - `http://localhost:5173`
     - `http://localhost:5173/`
     - `https://whonow.co`
     - `https://whonow.co/`
     - (and www if you use it)
6. Click **Create**.
7. Copy the **Client ID** and **Client secret** and store them somewhere safe (you’ll use them below).

---

## Part B: Contact sync (WhoNow ↔ Google Contacts)

Contact sync uses **client-side** Google sign-in (no server-side redirect). You only need the **Client ID** in the frontend.

### 1. Frontend env (Contact Sync)

In your app’s env (e.g. `.env` or `.env.local` in the repo root, or your host’s env for production):

```bash
# Contact import FROM Google + Sync TO Google (Settings → Export & backup)
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

- **Development**: same Client ID as above; ensure `http://localhost:5173` is in **Authorized JavaScript origins** (and redirect URIs if required).
- **Production**: same Client ID; ensure your production origin (e.g. `https://whonow.co`) is in **Authorized JavaScript origins** and redirect URIs.

No client secret is used in the browser for contacts.

### 2. Verify in the app

- **Import**: Contacts → Add → Google → sign in and import.
- **Sync to Google**: Settings → Export & backup → “Sync to Google Contacts” → connect Google (if needed) → sync. Existing Google contacts (by email/phone) are updated; others are created; addresses and notes are synced.

---

## Part C: Calendar integration (follow-up events → Google Calendar)

Calendar uses **server-side** OAuth: the Supabase Edge Function redirects users to Google and receives the callback. You need **Client ID** and **Client secret** (and other secrets) in **Supabase**, not in the frontend.

### 1. Supabase Edge Function secrets

In [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Edge Functions** → **Secrets** (or **Project Settings** → **Edge Functions** → **Secrets**), set:

| Secret                  | Value                                                                 | Required |
|-------------------------|-----------------------------------------------------------------------|----------|
| `GOOGLE_CLIENT_ID`      | Same OAuth Client ID from Part A (e.g. `xxx.apps.googleusercontent.com`) | Yes      |
| `GOOGLE_CLIENT_SECRET`  | OAuth Client secret from Part A                                      | Yes      |
| `APP_URL`               | URL where users land after connecting Calendar (e.g. `https://whonow.co` or `http://localhost:8080`) | Yes      |
| `OAUTH_STATE_SECRET`    | Random string **at least 16 characters** (e.g. generate with `openssl rand -hex 16`) | Yes      |

- **Local dev**: use your dev URL for `APP_URL` (e.g. `http://localhost:8080`) and the **same** redirect URI in Google (see below for local Supabase URL if you run functions locally).
- **Production**: use production `APP_URL` and the **production** Supabase function URL in Google redirect URIs.

### 2. Redirect URI in Google (must match exactly)

In Google Cloud Console → **Credentials** → your OAuth client → **Authorized redirect URIs**, you must have **exactly**:

- **Production**:  
  `https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/functions/v1/google-calendar-integration`  
  (Find your project ref in Supabase Dashboard → Project Settings → General → Reference ID.)

- **Local** (only if you run Edge Functions locally and test Calendar locally):  
  `http://localhost:54321/functions/v1/google-calendar-integration`  
  (or whatever your local Supabase functions URL is.)

No trailing slash. One typo or wrong project ref will cause “redirect_uri_mismatch”.

### 3. Verify in the app

- **Settings** → **Calendar** → **Connect Google Calendar**.
- After connecting, set a follow-up date on a contact (e.g. from the contact card or Follow-up queue); if “Add follow-ups to my calendar” is on, an all-day event should appear on the user’s primary Google Calendar.

---

## Checklist

- [ ] Google Cloud: People API and Calendar API enabled.
- [ ] OAuth consent screen: scopes added for `contacts` and `calendar.events`.
- [ ] OAuth client: **Web application** with correct **Authorized JavaScript origins** and **Authorized redirect URIs** (including Supabase function URL for Calendar).
- [ ] **Contact sync**: `VITE_GOOGLE_CLIENT_ID` set in app env (dev and prod).
- [ ] **Calendar**: Supabase secrets set: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL`, `OAUTH_STATE_SECRET`.
- [ ] Calendar redirect URI in Google exactly matches your Supabase function URL.

---

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| “redirect_uri_mismatch” (Calendar) | Redirect URI in Google **exactly** matches `https://<ref>.supabase.co/functions/v1/google-calendar-integration` (no trailing slash). |
| “OAuth is not configured” (Contacts) | `VITE_GOOGLE_CLIENT_ID` is set and the app was built/restarted so the env is loaded. |
| “Google Calendar integration is not configured” | Supabase Edge Function secrets: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set. |
| “OAuth state secret is not configured” | Supabase secret `OAUTH_STATE_SECRET` is set and at least 16 characters. |
| Consent screen shows wrong scopes | In OAuth consent screen, ensure both Contacts and Calendar scopes are added and the app is saved. |
