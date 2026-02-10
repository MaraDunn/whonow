#!/usr/bin/env node
/**
 * Build both macOS targets locally (Apple Silicon + Intel).
 * Run on a Mac. Outputs are in src-tauri/target/{aarch64-apple-darwin,x86_64-apple-darwin}/release/bundle/macos/
 *
 * Prerequisites:
 *   rustup target add x86_64-apple-darwin   # if building on Apple Silicon
 *   Signing identity and notarization configured (see docs/MACOS_NOTARIZATION_CHECKLIST.md)
 *
 * Usage:
 *   npm run tauri:build:mac:all
 *   # Optional: set version first, e.g. VERSION=1.2.3 npm run tauri:build:mac:all
 */
import { execSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = { ...process.env, CI: "true" };

const targets = [
  "aarch64-apple-darwin",
  "x86_64-apple-darwin",
];

for (const target of targets) {
  console.log(`\n--- Building ${target} ---\n`);
  execSync(`npx tauri build --target ${target}`, {
    cwd: root,
    env,
    stdio: "inherit",
  });
}

console.log("\n--- Done. Bundles are in src-tauri/target/<target>/release/bundle/macos/ ---");
console.log("  - WhoNow.app and WhoNow.dmg per target. Notarize, then upload to the GitHub release.\n");
