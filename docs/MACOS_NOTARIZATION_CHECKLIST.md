# macOS Notarization Checklist

Use this checklist when the Release workflow fails at "Notarizing ..." or with "The operation was canceled." It helps confirm your secrets and Apple Developer setup are correct.

---

## 1. Apple Developer Account Requirements

Notarization **requires** a **paid** Apple Developer Program membership ($99/year).

- [ ] **Paid membership**: Go to [developer.apple.com/account](https://developer.apple.com/account) → **Membership**. You must see "Apple Developer Program" with an active membership. **Free accounts cannot notarize**; the app will never be accepted.
- [ ] **Agreements**: Go to [developer.apple.com/account](https://developer.apple.com/account) → **Agreements, Tax, and Banking**. Accept any pending agreements. Unaccepted terms can block notarization.
- [ ] **Team ID**: On the same Membership page, note your **Team ID** (10 characters, e.g. `4TSFTN7743`). This must match `APPLE_TEAM_ID` in GitHub Secrets.

---

## 2. Certificate

You must use a **Developer ID Application** certificate (for distribution outside the App Store), not "Apple Development" or "Distribution."

- [ ] In [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/certificates/list), you have a **Developer ID Application** certificate. Only the **Account Holder** can create this; other roles may not see the option.
- [ ] The certificate is **valid** (not expired, not revoked). Download and install it on your Mac if needed, then run:  
  `security find-identity -v -p codesigning`  
  You should see a line like: `Developer ID Application: Your Name (TEAM_ID)`.

---

## 3. GitHub Actions Secrets

In your repo: **Settings → Secrets and variables → Actions**. Confirm each of these.

### Required for signing (certificate import)

| Secret | What it should be | Common mistakes |
|--------|-------------------|------------------|
| `APPLE_CERTIFICATE` | Base64 of your `.p12` file (one line, no line breaks). See **Section 4** for the exact command. | Pasting the raw .p12 or adding newlines. |
| `APPLE_CERTIFICATE_PASSWORD` | The password you set when **exporting** the .p12 from Keychain. | Using your Mac login or Apple ID password. |
| `KEYCHAIN_PASSWORD` | A password used only by the workflow to create a temporary keychain. Can be any strong password. | Leaving empty or reusing another secret. |

### Required for notarization (Apple ID method)

| Secret | What it should be | Common mistakes |
|--------|-------------------|------------------|
| `APPLE_ID` | Your Apple ID **email** (the one tied to the Developer account). | Using a different Apple ID than the certificate. |
| `APPLE_PASSWORD` | An **app-specific password**, not your normal Apple ID password. | Using your regular Apple ID password (will fail). |
| `APPLE_TEAM_ID` | Your 10-character **Team ID** from developer.apple.com → Membership. | Extra spaces, wrong team if you have several. |

### Creating an app-specific password

1. Go to [appleid.apple.com](https://appleid.apple.com) and sign in.
2. **Sign-In and Security** → **App-Specific Passwords**.
3. Click **Generate** (you may need 2FA enabled). Name it e.g. "GitHub Actions WhoNow".
4. Copy the generated password **once** (e.g. `xxxx-xxxx-xxxx-xxxx`) and paste it as the `APPLE_PASSWORD` secret. No spaces before/after.

---

## 4. Verify Secrets Have No Hidden Characters

- [ ] When you created each secret, you pasted **without** an extra Enter at the end (no trailing newline).
- [ ] For `APPLE_CERTIFICATE`: the value must be one long line of base64 with no line breaks. Use one of these:

  **Option A – copy to clipboard (then paste into GitHub Secret):**
  ```bash
  base64 -i /path/to/your-certificate.p12 | tr -d '\n' | pbcopy
  ```

  **Option B – write to a file (then paste the file contents into GitHub Secret):**
  ```bash
  base64 -i /path/to/your-certificate.p12 | tr -d '\n' > certificate-base64.txt
  ```
  Replace `/path/to/your-certificate.p12` with the real path to your exported .p12 file (e.g. `~/Downloads/WhoNow.p12` or wherever you saved it when you exported from Keychain). Then paste into the GitHub secret; do not add any newlines.

---

## 5. Test Notarization Locally (Strongest Check)

If notarization works on your Mac with the same Apple ID and app-specific password, the account and credentials are fine; the issue is likely CI-specific (timeout, network, or how the action runs).

1. **Build and sign the app locally** (with your Developer ID cert installed in Keychain):
   ```bash
   npm run tauri build -- --target aarch64-apple-darwin
   ```
2. **Set notarization env vars** (use the same Apple ID and app-specific password as in GitHub):
   ```bash
   export APPLE_ID="your-apple-id@email.com"
   export APPLE_PASSWORD="your-app-specific-password"
   export APPLE_TEAM_ID="4TSFTN7743"
   ```
3. **Run notarization** (Tauri usually does this as part of the build if the vars are set; if your build already produced a signed .app, you can test with Apple’s tool directly):
   ```bash
   cd src-tauri/target/aarch64-apple-darwin/release/bundle/macos
   ditto -c -k --keepParent WhoNow.app WhoNow.zip
   xcrun notarytool submit WhoNow.zip --apple-id "$APPLE_ID" --password "$APPLE_PASSWORD" --team-id "$APPLE_TEAM_ID" --wait
   ```
4. **Interpret the result**:
   - **Success**: Account and credentials are valid. The problem is likely CI (timeout, runner, or action). We can focus on workflow/runner or try App Store Connect API key in CI.
   - **Invalid credentials / Authentication failed**: Fix `APPLE_ID`, `APPLE_PASSWORD` (must be app-specific), or `APPLE_TEAM_ID` in GitHub Secrets.
   - **Rejection (e.g. "The signature of the binary is invalid")**: Signing or bundle issue, not account.

---

## 6. Check Apple’s Notarization History

See whether submissions from CI are reaching Apple and what status they have.

1. Go to [App Store Connect](https://appstoreconnect.apple.com) → **Apps** (or [developer.apple.com/account](https://developer.apple.com/account) and find notarization / history if your account shows it).
2. Alternatively, from your Mac (with same Apple ID), run:
   ```bash
   xcrun notarytool history --apple-id "$APPLE_ID" --password "$APPLE_PASSWORD" --team-id "$APPLE_TEAM_ID"
   ```
3. Look for recent submissions:
   - **Accepted**: Notarization succeeded; the failure might be in stapling or the workflow (e.g. timeout after submit).
   - **Invalid / Rejected**: Note the reason; fix the app or signing accordingly.
   - **No recent submissions**: Submissions may be failing before upload (e.g. auth failure or timeout); double-check secrets and try local test (section 5).

---

## 7. Optional: Use App Store Connect API Key in CI

Some teams see more reliable CI notarization with an **API key** instead of Apple ID + app-specific password.

1. [App Store Connect](https://appstoreconnect.apple.com) → **Users and Access** → **Integrations** (or **Keys**) → create a key with **Developer** access.
2. Download the `.p8` private key **once** (it’s only shown once).
3. Add these **secrets** (and remove or leave unused `APPLE_ID` / `APPLE_PASSWORD` for notarization):
   - `APPLE_API_ISSUER`: Issuer ID from the Keys page.
   - `APPLE_API_KEY`: Key ID.
   - `APPLE_API_KEY_PATH`: In CI you must provide the key file; tauri-action may support this via a secret that writes the key to a temp file and sets this path. Check [Tauri’s macOS signing docs](https://tauri.app/v1/guides/distribution/sign-macos/) for the exact env var names and how to pass the key in GitHub Actions.

If you confirm your **account and credentials** with sections 1–5 and 6, we can then either fix the workflow (e.g. longer timeout, retries) or switch to API key for CI.

---

## Verifying Gatekeeper acceptance

Notarization and stapling alone do not guarantee Gatekeeper will accept the app. **Copy the app to Applications** (or another folder) before first launch; do not run it directly from the mounted DMG.

To check whether the app would pass Gatekeeper and whether the stapled ticket is present, run (use the path to your installed app, e.g. `/Applications/WhoNow.app`):

```bash
xcrun stapler validate /Applications/WhoNow.app
spctl -a -t execute -v -- /Applications/WhoNow.app
xattr -l /Applications/WhoNow.app
```

You want: stapler prints "The validate action worked!"; spctl shows `accepted` and `source=Notarized Developer ID`; xattr lists `com.apple.security.cms` (the notarization ticket). If you see `rejected` or `Unnotarized Developer ID`, or the staple is missing from xattr, the ticket was lost (e.g. during copy from DMG)—try copying again from a fresh download.

---

## Quick Reference: Secret Summary

| Secret | Used for |
|--------|----------|
| `APPLE_CERTIFICATE` | Importing signing cert in CI |
| `APPLE_CERTIFICATE_PASSWORD` | .p12 export password |
| `KEYCHAIN_PASSWORD` | Temporary keychain in CI |
| `APPLE_ID` | Notarization (Apple ID email) |
| `APPLE_PASSWORD` | Notarization (app-specific password only) |
| `APPLE_TEAM_ID` | Notarization (10-char Team ID) |
