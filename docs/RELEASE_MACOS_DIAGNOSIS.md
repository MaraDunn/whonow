# macOS Release Build: Diagnosis & Solution

## What the error means

**"Artifact not found for name: macos-installer"** means the **release** job tried to download the `macos-installer` artifact, but it doesn’t exist in that workflow run. That happens when:

1. **build-macos never uploaded it** – The **build-macos** job either failed before the upload step, or didn’t run at all (e.g. you used “Re-run failed jobs” and only the release job ran again).
2. **Wrong run** – The release job is looking in the same run; if build-macos failed in that run, no artifact was ever uploaded.

So the underlying issue is: **build-macos is not successfully producing and uploading the macOS installer** in the same run where release runs.

---

## Step 1: Confirm what failed

1. Open the workflow run on GitHub: **Actions → Release → [the run]**.
2. Check job status:
   - **build-windows** – green or red?
   - **build-macos** – green or red?
   - **release** – red (with “Artifact not found: macos-installer”).

If **build-macos** is red, the fix is to make build-macos succeed (Step 2).  
If **build-macos** is green** but release still can’t find the artifact, you may have re-run only the release job; use **“Re-run all jobs”** so build-macos runs again and uploads the artifact.

---

## Step 2: Diagnose the build-macos job

Open the **build-macos** job and look at these steps in order:

### 1. “Build Tauri (macOS)”

- **If this step is red:** The Tauri build failed (Rust, Node, or DMG).
- In the step log, look for:
  - **Rust/compile errors** – fix code or dependencies.
  - **npm/vite errors** – e.g. missing `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`; set them in repo **Settings → Secrets and variables → Actions**.
  - **DMG / bundle_dmg errors** – In CI, the DMG script can fail (e.g. AppleScript/Finder). The workflow uses `CI=true tauri build`; the app bundle may still be built even if the DMG step fails. If the next step (“List Tauri target”) shows a `.app` but no `.dmg`, you can try building only the app and creating a simple DMG, or use the official **tauri-action** which handles CI paths and optional DMG.

### 2. “List Tauri target (diagnostic)”

- This step lists `src-tauri/target` and any `bundle` dirs and `*.dmg` files.
- Check the log:
  - **No `bundle` dirs / no `*.dmg`** → Build didn’t produce a bundle or DMG; fix “Build Tauri (macOS)” (or DMG step) first.
  - **`*.dmg` exists** → Path detection should work; the next step should find it.

### 3. “Locate macOS bundle”

- **If this step is red:** The workflow couldn’t find any `.dmg` under `src-tauri/target`.
- The run script now:
  - Finds any `*.dmg` under `src-tauri/target`.
  - Infers the `bundle` directory (parent dir named `bundle` that contains the `.dmg`, or the `.dmg`’s directory).
  - Fails with a clear `::error::` and a dump of `src-tauri/target` if no `.dmg` is found.
- So if “Locate macOS bundle” fails, the real problem is **no DMG was produced**; go back to “Build Tauri (macOS)” and fix the build or DMG step.

### 4. “Upload macOS installer”

- Uses the path from “Locate macOS bundle” and uploads the `macos-installer` artifact.
- If this step is green, the release job (when run in the same full run) should see the artifact.

---

## Step 3: What we changed in the workflow

1. **Locate step** – Instead of hardcoding paths, we now:
   - Run `find src-tauri/target -name "*.dmg"` and take the first match.
   - Walk up to the directory named `bundle` (so we upload the whole bundle, e.g. `bundle/macos/WhoNow.dmg`).
   - If no `.dmg` is found, we fail with an explicit error and show the contents of `src-tauri/target`.
2. **Release job** – Restored to require both **build-windows** and **build-macos**; no “optional macOS” so that release only runs when both build jobs succeed and both artifacts exist.

So:
- **Path issues** should be covered by the new “find .dmg then bundle dir” logic.
- **Artifact not found** in a full run means build-macos either didn’t run or failed before uploading; use the steps above to fix the macOS build and always use **“Re-run all jobs”** (or a new tag) so build-macos runs and uploads again.

---

## Step 4: If the Tauri build still fails in CI

- **Secrets:** Ensure **VITE_SUPABASE_URL** and **VITE_SUPABASE_PUBLISHABLE_KEY** are set in the repo’s Actions secrets.
- **DMG in CI:** If “Build Tauri (macOS)” succeeds but no `.dmg` is produced (only `.app`), the DMG step may be failing in the runner environment. Options:
  - Rely on the official **[tauri-apps/tauri-action](https://github.com/tauri-apps/tauri-action)** for the macOS job; it knows the correct paths and CI behavior.
  - Or build with `--bundles app` and add a small script to create a DMG from the `.app` if you need a DMG for the release.
- **Logs:** Always check the **build-macos** job logs for the first red step; that’s the place to fix (build, path, or upload).

---

## Quick checklist

- [ ] **Actions** → open the failing **Release** run.
- [ ] **build-macos** red? → Open it and find the first failing step (“Build Tauri (macOS)” or “Locate macOS bundle”).
- [ ] In that step’s log: Rust/Node/DMG error or “No .dmg found”?
- [ ] Fix the cause (secrets, code, or DMG/CI), then run a **full** workflow again (**Re-run all jobs** or push a new tag).
- [ ] Don’t use “Re-run failed jobs” alone if build-macos didn’t run in that run; that won’t create the macos-installer artifact.
