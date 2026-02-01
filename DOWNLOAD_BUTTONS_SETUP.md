# Landing Page Download Buttons (Windows & Mac Tauri Builds)

How to make the live landing page download buttons start a download of the Tauri builds on Windows and Mac.

---

## Completed in repo

- **`.env.example`** — Desktop download URL variables are documented (`VITE_DOWNLOAD_URL_WINDOWS`, `VITE_DOWNLOAD_URL_MAC`, `VITE_DOWNLOAD_URL_LINUX`).
- **`netlify.toml`** — Comment added reminding you to set `VITE_DOWNLOAD_URL_WINDOWS` and `VITE_DOWNLOAD_URL_MAC` in Netlify UI.
- **Code** — No code change needed; `DownloadSection` already uses these env vars and will start a download when the URLs point to installer files.

---

## Your step-by-step (remainder)

Do these in order. Steps 1–2 produce the installer files; step 3 gives them public URLs; steps 4–5 wire the live site to those URLs.

### Step 1: Build the Windows installer

- **From a Mac (no Windows machine):** From the project root run:
  ```bash
  npm run build:windows
  ```
  This triggers the GitHub Actions “Build Windows” workflow, waits for it to finish, and downloads the installer into `dist-windows/`. Requires the [GitHub CLI](https://cli.github.com/) (`gh`) installed and logged in.
- **On a Windows machine:** Run `npm run tauri:build:win`; output is under `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/`.
- Note the `.msi` (and optionally `.exe`) filename(s) — you’ll upload these in step 3.

### Step 2: Build the Mac installer

- On a Mac (or a Mac CI runner, e.g. GitHub Actions with `macos-latest`), from the project root run:
  ```bash
  npm run tauri:build:mac
  ```
- This builds for your Mac’s **native** architecture: on Apple Silicon (M1/M2/M3) you get an `aarch64-apple-darwin` build; on an Intel Mac you get `x86_64-apple-darwin`. Output is under `src-tauri/target/<target>/release/bundle/` (or `.../bundle/dmg/`). Note the `.dmg` filename.
- To build for **Intel** from an Apple Silicon Mac (e.g. to ship both), run `rustup target add x86_64-apple-darwin` once, then use `npm run tauri:build:mac:intel`. You can host both `.dmg` files and use one “Mac” link (e.g. to the Apple Silicon build) or offer two.
- If `bundle_dmg.sh` fails (e.g. AppleScript/Finder permission errors), the Mac build script sets `CI=true` so the DMG step skips Finder customization and still produces a valid `.dmg` in `bundle/macos/`.

### Step 3: Host the installers and get stable URLs

Choose one approach:

- **Option A — GitHub Releases (recommended)**  
  1. Create a new release (e.g. tag `v1.0.0`).  
  2. Upload the Windows `.msi` (and optionally `.exe`) and the Mac `.dmg` as release assets.  
  3. Copy the “direct” download URL for each asset (e.g. `https://github.com/OWNER/REPO/releases/download/v1.0.0/WhoNow_1.0.0_x64_en-US.msi`).

- **Option B — Netlify / site assets**  
  1. Put the installers in something like `public/downloads/` (e.g. `public/downloads/WhoNow_1.0.0_x64_en-US.msi` and `.../WhoNow_1.0.0_x64.dmg`).  
  2. Commit, push, and deploy so the site is served from the same origin.  
  3. Use URLs like `https://yoursite.com/downloads/WhoNow_1.0.0_x64_en-US.msi` and `.../WhoNow_1.0.0_x64.dmg`.

- **Option C — Any CDN or static host**  
  Upload the files, then use the resulting public URLs.

### Step 4: Set build env vars for the live site

- In **Netlify**: Site → **Site configuration** → **Environment variables** (or **Build & deploy** → **Environment**).
- Add **Build** (not “Deploy”) variables:
  - `VITE_DOWNLOAD_URL_WINDOWS` = the full URL to the Windows installer from step 3.
  - `VITE_DOWNLOAD_URL_MAC` = the full URL to the Mac installer from step 3.
- Save. Do **not** put secrets in `netlify.toml`; use the Netlify UI (or Netlify’s env var API) so the live site build sees these values.

### Step 5: Redeploy the site

- Trigger a new deploy so the front-end is built with the new env vars (e.g. “Trigger deploy” → “Clear cache and deploy site” in Netlify).
- After deploy, open the live landing page, go to the Download section, and click the Windows and Mac buttons — each should start a download of the corresponding Tauri build.

---

## Reference: how it works

- The landing page uses `src/utils/downloadLinks.ts`, which reads `VITE_DOWNLOAD_URL_WINDOWS` and `VITE_DOWNLOAD_URL_MAC`.
- If those are missing or empty, the buttons show “Coming Soon” and are disabled.
- Vite inlines `import.meta.env.VITE_*` at **build time**, so the URLs must be set in the **build** environment of the deployed site (e.g. Netlify build env), not only in local `.env`.
