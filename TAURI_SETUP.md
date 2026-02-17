# Tauri Desktop App Setup

This document describes the Tauri desktop app setup for WhoNow.

## Prerequisites

1. **Rust Toolchain**: Tauri requires Rust. Install it using:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```
   Or visit https://rustup.rs/

2. **System Dependencies**:
   - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
   - **Windows**: Microsoft Visual Studio C++ Build Tools
   - **Linux**: `libwebkit2gtk-4.0-dev`, `build-essential`, `curl`, `wget`, `libssl-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`

## Installation

1. Install npm dependencies:
   ```bash
   npm install
   ```

2. The Tauri CLI will be installed as part of npm dependencies. If Rust is not installed, Tauri will guide you through the installation.

## Development

### Web Development (unchanged)
```bash
npm run dev
```

### Desktop Development
```bash
npm run tauri:dev
```

This will:
- Start the Vite dev server on port 8080
- Launch the Tauri desktop app window
- Enable hot-reload for both frontend and Rust code

## Building

### Build for Current Platform
```bash
npm run tauri:build
```

### Platform-Specific Builds
```bash
# Windows
npm run tauri:build:win

# macOS
npm run tauri:build:mac

# Linux
npm run tauri:build:linux
```

## Build Output

Built applications will be in:
- `src-tauri/target/release/bundle/`

Platform-specific outputs:
- **Windows**: `.msi` installer and `.exe` executable
- **macOS**: `.dmg` disk image and `.app` bundle
- **Linux**: `.deb`, `.AppImage`, or `.rpm` depending on target

## Environment Variables

The desktop app uses the same environment variables as the web app:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_APP_LAUNCH_MODE`

These are loaded from `.env` file, just like the web version.

## Features

### Current Capabilities
- ✅ Full web app functionality in desktop window
- ✅ Supabase authentication
- ✅ File upload/download (using browser APIs)
- ✅ Camera access for business card scanning
- ✅ All integrations (Slack, Teams, Google Contacts)
- ✅ Stripe payment processing

### Desktop-Specific Features (Available for Future)
- File system access via Tauri APIs
- System tray integration
- Native notifications
- Auto-update functionality
- Custom protocol handlers
- Native menus and dialogs

## Configuration

### Window Settings
Edit `src-tauri/tauri.conf.json` to customize:
- Window size and dimensions
- App title and icons
- Security policies (CSP)
- File system permissions

### Icons
Icons are located in `src-tauri/icons/`:
- `32x32.png` - Small icon
- `128x128.png` - Standard icon
- `128x128@2x.png` - High DPI icon (256x256)
- `icon.ico` - Windows icon
- `icon.icns` - macOS icon

To update icons, replace these files with your own (maintaining the same names and formats).

## Security

The app uses Content Security Policy (CSP) to restrict resource loading. Allowed domains include:
- Supabase endpoints (`*.supabase.co`, `*.supabase.in`)
- Stripe (`api.stripe.com`, `hooks.stripe.com`)
- Google APIs (`accounts.google.com`, `people.googleapis.com`)
- Slack (`slack.com`, `*.slack.com`)
- Microsoft (`login.microsoftonline.com`, `graph.microsoft.com`)

## Troubleshooting

### Rust Not Found
If you see "rustc not found", install Rust using rustup (see Prerequisites).

### Build Fails on macOS
Ensure Xcode Command Line Tools are installed:
```bash
xcode-select --install
```

### Icons Not Showing
Verify all required icon files exist in `src-tauri/icons/`. The `.icns` file may need to be regenerated using macOS's `iconutil` command.

### OAuth Redirects Not Working
OAuth redirects should work automatically through Supabase. If issues occur, check:
1. CSP allows the OAuth provider domains
2. Supabase redirect URLs are configured correctly
3. The app is using the correct Supabase project URL

### macOS: "WhoNow is damaged and can't be opened"
macOS Gatekeeper can show this when the app is **quarantined** (e.g. downloaded from the web) and either not notarized or the notarization ticket wasn’t stapled. **Copying the app from the DMG by dragging it to Applications in Finder can break the seal** and cause this message. If CI notarization keeps failing, follow **[docs/MACOS_NOTARIZATION_CHECKLIST.md](docs/MACOS_NOTARIZATION_CHECKLIST.md)** to verify your Apple account and secrets. Fixes:

1. **Use a notarized build from the latest release**  
   New releases are signed and notarized when `APPLE_ID`, `APPLE_PASSWORD`, and `APPLE_TEAM_ID` are set in repo secrets. Use the app from the latest GitHub release. **Do not drag WhoNow.app to Applications.** Instead: open the DMG, then **double-click "Install WhoNow"** (the installer in the DMG). It installs the app to Applications and preserves the notarization. If Gatekeeper blocks the script, **right-click it → Open**. Then open WhoNow from Applications. The first time you may need **right-click → Open** to allow Gatekeeper. **Power-user option:** In Terminal, run `ditto /Volumes/WhoNow/WhoNow.app /Applications/WhoNow.app` then eject the DMG and open from Applications. In the Release workflow run, confirm the macOS job completes and that the build step runs notarization (check the Actions log).

2. **If Gatekeeper still blocks**  
   Run these on the installed app (e.g. `/Applications/WhoNow.app`) to see if the staple is present and what Gatekeeper reports:
   ```bash
   xcrun stapler validate /Applications/WhoNow.app
   spctl -a -t execute -v -- /Applications/WhoNow.app
   xattr -l /Applications/WhoNow.app
   ```
   You want stapler to print "The validate action worked!", spctl to show `accepted` and `source=Notarized Developer ID`, and xattr to include `com.apple.security.cms` (the notarization ticket). If the staple is missing, the app was not copied correctly from the DMG; install again using **Install WhoNow** or the `ditto` command; do not copy by dragging in Finder.

3. **If you must remove quarantine only**  
   Remove only the quarantine attribute (do **not** use `xattr -cr`, which removes the stapled notarization ticket and can cause "damaged" or "Unnotarized"):
   ```bash
   xattr -d com.apple.quarantine /Applications/WhoNow.app
   ```
   Or if the app is still on the DMG volume:
   ```bash
   xattr -d com.apple.quarantine /Volumes/WhoNow/WhoNow.app
   ```
   Then move `WhoNow.app` to `/Applications` if needed and open it. Do **not** use `xattr -cr` (it removes the notarization ticket).

## Releasing

The Release workflow runs on tag push (e.g. `v1.0.0`). **Version is set automatically from the tag**—no manual bump needed.

1. Create and push a tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
2. The workflow sets `package.json` and `tauri.conf.json` version from the tag (v1.0.0 → 1.0.0), builds Windows and macOS installers, and creates a GitHub Release with the assets.
3. **macOS**: Ensure repo secrets include `APPLE_ID`, `APPLE_PASSWORD`, and `APPLE_TEAM_ID` so the app is notarized. Without notarization, users may see "app is damaged." Check the Release workflow log for the macOS job to confirm notarization runs and succeeds.

## Notes

- The web build (`npm run build`) continues to work independently
- Development supports both web and desktop modes
- Initial Rust compilation may take several minutes, but subsequent builds are faster
- The desktop app bundle size is significantly smaller than Electron (~3-10MB vs ~100MB+)
