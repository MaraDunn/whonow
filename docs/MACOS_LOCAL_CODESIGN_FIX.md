# Local codesign: "unable to build chain" / errSecInternalComponent

If `npm run tauri build -- --target aarch64-apple-darwin` fails with **"unable to build chain to self-signed root"** and **errSecInternalComponent**, work through these in order.

---

## A. Cert and private key must be paired

The certificate you download from Apple (`.cer`) is only the **public** half. Codesign needs the **private key** that was created when you made the CSR (Certificate Signing Request).

1. Open **Keychain Access** → **login** (in the left sidebar) → **My Certificates** (category at bottom).
2. Find **"Developer ID Application: Mara Dunn (4TSFTN7743)"**.
3. Click the **disclosure triangle** (►) next to it. You should see a **key** icon (private key) nested underneath.

- **If you see the key**: the pair is present. Go to **B**.
- **If there is no key**, or the cert doesn't expand: the cert in Keychain is **not** paired with a private key. That often happens if you only installed a re-downloaded `.cer` from Apple (the .cer file doesn't contain the private key).

  **Fix:** Import your **.p12** file (the one you exported from Keychain, e.g. `WhoNow-new.p12`). The .p12 contains both the certificate and the private key.
  - In Keychain Access: **File → Import Items…** → select your `.p12` file → enter the .p12 password.
  - After import, the Developer ID certificate should expand to show the private key underneath.

  If you **don't have a .p12 on this Mac** (e.g. the cert was created on another machine and you only have the .cer), then you must either:
  - Copy the .p12 from the Mac that created the cert and import it here, or
  - Create a **new CSR on this Mac**, submit it to Apple, get a new Developer ID certificate, and use that (this Mac will then have both cert and key).

---

## B. Allow Terminal / codesign to use the key

macOS may block Terminal from using the key unless you allow it.

1. In Keychain Access, expand **Developer ID Application: Mara Dunn** and **double-click the private key** (the key icon).
2. In the window that opens, open the **Access Control** tab.
3. Select **"Allow all applications to access this item"** (or add **Terminal** and **codesign** to the list).
4. Click **Save Changes** and enter your Mac login password if prompted.

---

## C. Install Apple’s Developer ID intermediate certificates

Your Developer ID certificate is signed by an **Apple intermediate CA**. If that intermediate (and its root) aren’t in your keychain, you get "unable to build chain to self-signed root." Install them into your **login** keychain:

1. **Download** (from [Apple’s Certificate Authority](https://www.apple.com/certificateauthority/)):
   - **Apple Root CA - G3**: https://www.apple.com/certificateauthority/AppleRootCA-G3.cer  
   - **Developer ID - G1**: https://www.apple.com/certificateauthority/DeveloperIDCA.cer  
   - **Developer ID - G2**: https://www.apple.com/certificateauthority/DeveloperIDG2CA.cer  

2. **Install into login keychain** (run in Terminal; use the path where you saved the files, e.g. `~/Downloads/`):

   ```bash
   security add-trusted-cert -d -r unspecified -k ~/Library/Keychains/login.keychain-db ~/Downloads/AppleRootCA-G3.cer
   security add-trusted-cert -d -r unspecified -k ~/Library/Keychains/login.keychain-db ~/Downloads/DeveloperIDCA.cer
   security add-trusted-cert -d -r unspecified -k ~/Library/Keychains/login.keychain-db ~/Downloads/DeveloperIDG2CA.cer
   ```

   Enter your Mac login password when prompted. The `-r unspecified` is important (don’t mark them as “always trust” for code signing).

3. **Try the build again** (and run step D first if the keychain was locked).

---

## D. Unlock the keychain before building

Sometimes the login keychain is locked when you run the build from Terminal. Unlock it first:

```bash
security unlock-keychain ~/Library/Keychains/login.keychain-db
```

(Enter your Mac login password when prompted.) Then run the build:

```bash
cd ~/whonow
npm run tauri build -- --target aarch64-apple-darwin
```

---

## E. Remove duplicate certificate (the one without a key)

If you re-downloaded the `.cer` from Apple and double-clicked it to install, you may now have **two** entries named "Developer ID Application: Mara Dunn (4TSFTN7743)":

- One that **expands** to show a private key (this is the correct one).
- One that **does not** expand (this is the .cer-only copy; it has no key and can cause codesign to fail).

**Delete the entry that does not expand:** right-click it → **Delete "Developer ID Application: Mara Dunn (4TSFTN7743)"** → confirm. Keep the entry that has the key.

---

## F. Use the same .p12 you use in CI

To avoid chain or trust mismatches, use the **same** .p12 on your Mac that you use for GitHub Actions (the one you base64 for the `APPLE_CERTIFICATE` secret). Import that .p12 into your login keychain (File → Import Items). Then repeat **B** and **D** and try the build again.

---

## Summary

Most often the failure is because:

1. The certificate in Keychain has **no private key** (only the .cer was installed). → Import the .p12.
2. **Terminal isn’t allowed** to use the key. → Access Control: allow all applications (or add Terminal/codesign).
3. **Duplicate cert**: one with key, one without. → Delete the one without the key.

After fixing, run:

```bash
security unlock-keychain ~/Library/Keychains/login.keychain-db
cd ~/whonow
npm run tauri build -- --target aarch64-apple-darwin
```
