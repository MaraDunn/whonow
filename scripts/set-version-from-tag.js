#!/usr/bin/env node
/**
 * Sets version in package.json and src-tauri/tauri.conf.json from the git tag.
 * Run in CI before building. Expects GITHUB_REF_NAME (e.g. v1.0.0) in env.
 */
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const tag = process.env.GITHUB_REF_NAME || "";
const version = tag.replace(/^v/, "") || "0.0.0";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Update package.json
const pkgPath = join(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.version = version;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

// Update tauri.conf.json
const tauriPath = join(root, "src-tauri", "tauri.conf.json");
const tauri = JSON.parse(readFileSync(tauriPath, "utf8"));
tauri.version = version;
writeFileSync(tauriPath, JSON.stringify(tauri, null, 2) + "\n");

console.log(`Set version to ${version} (from tag ${tag})`);
