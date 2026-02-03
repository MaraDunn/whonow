#!/usr/bin/env node
/**
 * Generates latest.json for Tauri updater.
 * Run in GitHub Actions release job after downloading windows-installer and macos-installer artifacts.
 *
 * Expects:
 * - GITHUB_REF_NAME: the tag (e.g. v1.0.0)
 * - GITHUB_REPOSITORY: owner/repo
 * - windows-installer/ and macos-installer/ in cwd (from download-artifact)
 *
 * Writes latest.json to cwd.
 */

import { readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";

const tag = process.env.GITHUB_REF_NAME || "v0.0.0";
const repo = process.env.GITHUB_REPOSITORY || "MaraDunn/whonow";
const baseUrl = `https://github.com/${repo}/releases/download/${tag}`;

const platforms = {};

function findFiles(dir, predicate) {
  const found = [];
  if (!dir) return found;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        found.push(...findFiles(full, predicate));
      } else if (predicate(e.name)) {
        found.push(full);
      }
    }
  } catch {
    // dir may not exist
  }
  return found;
}

// Windows: look for .msi.sig (updater uses .msi directly per Tauri v2 default)
const winDir = "windows-installer";
const msiSig = findFiles(winDir, (n) => n.endsWith(".msi.sig"))[0];
if (msiSig) {
  const base = msiSig.replace(/\.sig$/, "");
  const basename = base.split(/[/\\]/).pop();
  const sigContent = readFileSync(msiSig, "utf8").trim();
  platforms["windows-x86_64"] = {
    signature: sigContent,
    url: `${baseUrl}/${basename}`,
  };
}

// macOS: look for .tar.gz.sig (updater uses .app.tar.gz)
const macDir = "macos-installer";
const macSigs = findFiles(macDir, (n) => n.endsWith(".tar.gz.sig"));
for (const sigPath of macSigs) {
  const base = sigPath.replace(/\.sig$/, "");
  const basename = base.split(/[/\\]/).pop();
  const sigContent = readFileSync(sigPath, "utf8").trim();
  const platform = sigPath.includes("aarch64") || basename.includes("aarch64")
    ? "darwin-aarch64"
    : "darwin-x86_64";
  platforms[platform] = {
    signature: sigContent,
    url: `${baseUrl}/${basename}`,
  };
}

const version = tag.replace(/^v/, "");
const latest = {
  version,
  notes: "",
  pub_date: new Date().toISOString(),
  platforms,
};

writeFileSync("latest.json", JSON.stringify(latest, null, 2));
console.log("Generated latest.json:", JSON.stringify(latest, null, 2));
