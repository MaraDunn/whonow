#!/usr/bin/env node
/**
 * Sets app version from a git tag (or VERSION env var) before building in CI.
 *
 * Updates:
 * - package.json
 * - src-tauri/tauri.conf.json
 * - src-tauri/Cargo.toml (authoritative for bundling/version metadata)
 *
 * Intended usage:
 * - Tag builds: GITHUB_REF_NAME="v1.2.3"
 * - Manual builds: VERSION="1.2.3"
 */
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

function parseVersionFromEnv() {
  const tag = process.env.GITHUB_REF_NAME || "";
  const tagMatch = tag.match(/^v(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)$/);
  if (tagMatch) return { version: tagMatch[1], source: `tag ${tag}` };

  const manual = process.env.VERSION || "";
  const manualMatch = manual.match(/^(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)$/);
  if (manualMatch) return { version: manualMatch[1], source: `VERSION=${manual}` };

  return { version: null, source: tag ? `ref ${tag}` : "no ref" };
}

const parsed = parseVersionFromEnv();
if (!parsed.version) {
  console.log(
    `Skipping version set (no semver tag / VERSION). Found ${parsed.source}.`,
  );
  process.exit(0);
}

const version = parsed.version;

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

// Update Cargo.toml (Tauri bundling uses Cargo package version)
const cargoTomlPath = join(root, "src-tauri", "Cargo.toml");
const cargoToml = readFileSync(cargoTomlPath, "utf8");
const pkgIdx = cargoToml.indexOf("[package]");
if (pkgIdx === -1) {
  throw new Error("Could not find [package] section in src-tauri/Cargo.toml");
}
const nextSectionIdx = cargoToml.indexOf("\n[", pkgIdx + "[package]".length);
const head = cargoToml.slice(0, pkgIdx);
const section =
  nextSectionIdx === -1
    ? cargoToml.slice(pkgIdx)
    : cargoToml.slice(pkgIdx, nextSectionIdx + 1);
const tail = nextSectionIdx === -1 ? "" : cargoToml.slice(nextSectionIdx + 1);

const updatedSection = section.replace(
  /^version\s*=\s*"[^"]*"\s*$/m,
  `version = "${version}"`,
);

if (updatedSection === section) {
  throw new Error(
    'Could not update version in [package] section of src-tauri/Cargo.toml (no matching "version =").',
  );
}

const updatedCargoToml =
  nextSectionIdx === -1 ? head + updatedSection : head + updatedSection + tail;
writeFileSync(cargoTomlPath, updatedCargoToml);

console.log(`Set version to ${version} (from ${parsed.source})`);
