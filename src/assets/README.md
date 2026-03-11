# Logo assets

Two logo files are used so we can show **icon only** in some places and **icon + wordmark** in others.

| File | Use |
|------|-----|
| **`whonow-logo-icon.png`** | Icon only (square). Favicon, Tauri bundle, Slack/email (`public/logo-icon.png`), and compact UI (e.g. Auth, Footer) when `WhoNowLogo` uses `variant="icon"`. |
| **`whonow-logo.png`** | Full logo (icon + “Whonow” wordmark). App/landing headers and OG image when `WhoNowLogo` uses `variant="full"`. |

## Updating branding

1. Replace **`whonow-logo-icon.png`** with your final icon (square, no text).
2. Replace **`whonow-logo.png`** with your final full logo (icon + wordmark).
3. Run:

   ```bash
   npm run generate:icons    # favicons, public/logo-icon.png, Tauri icons
   npm run generate:og-image  # public/og-image.png and twitter-image.png (1200×630)
   ```

Optional env for OG background: `OG_BACKGROUND_HEX` (default `#0f172a`).

## Where each is used in the app

- **Icon only:** Favicon, Tauri app icon, Slack unfurl, Supabase signup email, Auth screens, AuthModal, Footer, ProductDemo mock sidebar.
- **Full logo (icon + words):** Main app header, landing nav, app sidebar, Import/Export page headers, ProductDemo header, and the OG/Twitter social card image.
