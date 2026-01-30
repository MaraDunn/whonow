# Landing Page Download Buttons (Windows & Mac Tauri Builds)

How to make the live landing page download buttons start a download of the Tauri builds on Windows and Mac.

---

## 1. Set the download URL env vars for the live build

The landing page uses `src/utils/downloadLinks.ts`, which reads:

- **Windows:** `VITE_DOWNLOAD_URL_WINDOWS`
- **Mac:** `VITE_DOWNLOAD_URL_MAC`

If those are missing or empty, the buttons show "Coming Soon" and are disabled. They are not set in `.env`, `.env.example`, or `netlify.toml`.

**Do this:**

- In your **live** hosting (e.g. Netlify), set **build** environment variables:
  - `VITE_DOWNLOAD_URL_WINDOWS` = full URL to the Windows installer (e.g. `.msi` or `.exe`)
  - `VITE_DOWNLOAD_URL_MAC` = full URL to the Mac installer (e.g. `.dmg`)

Because Vite inlines `import.meta.env.VITE_*` at **build time**, these must be set when the deployed site is built (e.g. Netlify "Build environment variables" or under `[build.environment]` in `netlify.toml`), not only locally.

---

## 2. Build the Tauri installers and host them

The buttons only work if those URLs point to real files.

**Build:**

- **Windows:** e.g. `npm run tauri:build:win` (or `tauri build --target x86_64-pc-windows-msvc`). Output is under `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/` (e.g. `.msi`, `.exe`).
- **Mac:** e.g. `npm run tauri:build:mac` on a Mac (or a Mac CI runner). Output is under `src-tauri/target/.../release/bundle/` (e.g. `.dmg`). For Apple Silicon you may also build `aarch64-apple-darwin` and host a second file or a universal build if you want one "Mac" button for both architectures.

**Host the files** so you have stable, public URLs. Common options:

- **GitHub Releases:** Create a release, upload the Windows and Mac installers as assets, then use the asset URLs (e.g. `https://github.com/OWNER/REPO/releases/download/v1.0.0/WhoNow_1.0.0_x64_en-US.msi`). These typically trigger a download.
- **Netlify:** Put installers in something like `public/downloads/` and deploy; use `https://yoursite.com/downloads/filename.msi` and `.../filename.dmg`.
- Any other CDN or static host that gives you a direct link to the file.

---

## 3. No code change required for "start a download"

`DownloadSection` uses `window.open(url, "_blank", "noopener,noreferrer")`. If the URL is a direct link to an installer (e.g. GitHub release asset or a static `.msi`/`.dmg`), the browser will usually start a download. So you don't need to change the click handler for "download" behavior.

---

## 4. Optional: document in `.env.example`

Add to `.env.example` so others know what to set:

```env
# Desktop app download URLs (for landing page)
# VITE_DOWNLOAD_URL_WINDOWS=https://...
# VITE_DOWNLOAD_URL_MAC=https://...
# VITE_DOWNLOAD_URL_LINUX=https://...
```

---

## Summary

Build the Windows and Mac Tauri installers, host them at stable URLs, set `VITE_DOWNLOAD_URL_WINDOWS` and `VITE_DOWNLOAD_URL_MAC` in the **build** environment of your live site (e.g. Netlify), and redeploy. The existing download buttons will then start a download of the Tauri builds on Windows and Mac.
