# macOS Release: Local Build and Upload

macOS builds are **not** built in CI (Apple notarization can take hours and would time out). Build both Apple bundles on your Mac, notarize, then upload to the GitHub release.

## 1. Build both macOS targets locally

From the project root on a Mac:

```bash
# Optional: set version from tag (e.g. after git checkout v1.2.3)
GITHUB_REF_NAME=v1.2.3 node scripts/set-version-from-tag.js
# Or: VERSION=1.2.3 node scripts/set-version-from-tag.js

# If on Apple Silicon and you haven’t already, add Intel target:
rustup target add x86_64-apple-darwin

# Build Apple Silicon (aarch64) and Intel (x86_64)
npm run tauri:build:mac:all
```

Artifacts:

- **Apple Silicon:** `src-tauri/target/aarch64-apple-darwin/release/bundle/macos/WhoNow.app` and `WhoNow.dmg`
- **Intel:** `src-tauri/target/x86_64-apple-darwin/release/bundle/macos/WhoNow.app` and `WhoNow.dmg`

## 2. Notarize

If the build did not complete notarization (or you want to notarize after the fact), use Apple’s notary tool. See **docs/MACOS_NOTARIZATION_CHECKLIST.md** for credentials and commands.

Example (zip the .app, submit, wait, staple):

```bash
# For each target, from project root:
cd src-tauri/target/aarch64-apple-darwin/release/bundle/macos
ditto -c -k --keepParent WhoNow.app WhoNow.zip
xcrun notarytool submit WhoNow.zip --keychain-profile "AC_PASSWORD" --wait
xcrun stapler staple WhoNow.app
# Repeat for x86_64 path if needed
```

## 3. Upload to the GitHub release

After notarization (and stapling):

1. Open the release on GitHub (e.g. **Releases → WhoNow v1.2.3**).
2. Upload the two macOS assets, for example:
   - `WhoNow_aarch64.app.dmg` (or the DMG you produced for aarch64)
   - `WhoNow_x86_64.app.dmg` (Intel)

You can drag the `.dmg` files from the `bundle/macos/` directories onto the release’s “Attach binaries” area. Naming (e.g. with `_aarch64` / `_x86_64`) helps users choose the right build.

## Summary

| Step        | Command / action                                      |
|------------|--------------------------------------------------------|
| Set version| `GITHUB_REF_NAME=v1.2.3 node scripts/set-version-from-tag.js` |
| Build both | `npm run tauri:build:mac:all`                          |
| Notarize   | See docs/MACOS_NOTARIZATION_CHECKLIST.md               |
| Upload     | Add the notarized DMGs to the GitHub release           |

Windows builds are still produced by the **Release** workflow on tag push; only macOS is built and uploaded manually.
