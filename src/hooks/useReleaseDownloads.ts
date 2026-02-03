import { useState, useEffect } from "react";
import type { Platform } from "@/utils/downloadLinks";

type ReleaseUrls = Partial<Record<Platform, string>>;

const GITHUB_REPO = import.meta.env.VITE_GITHUB_REPO as string | undefined;
const GITHUB_API = "https://api.github.com";

function mapAssetToPlatform(name: string): Platform | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".msi") || lower.endsWith(".exe")) return "windows";
  if (lower.endsWith(".dmg")) return "mac";
  if (lower.endsWith(".deb") || lower.endsWith(".appimage")) return "linux";
  return null;
}

function pickAssetUrl(assets: { name: string; browser_download_url: string }[], platform: Platform): string | null {
  const preferMsi = platform === "windows";
  const candidates = assets.filter((a) => mapAssetToPlatform(a.name) === platform);
  if (candidates.length === 0) return null;
  if (platform === "windows" && preferMsi) {
    const msi = candidates.find((a) => a.name.toLowerCase().endsWith(".msi"));
    if (msi) return msi.browser_download_url;
  }
  return candidates[0].browser_download_url;
}

/**
 * Fetches the latest GitHub release and maps assets to Windows/macOS/Linux download URLs.
 * Uses VITE_GITHUB_REPO (e.g. "owner/repo"). If unset, returns empty and does not fetch.
 * Env vars (VITE_DOWNLOAD_URL_*) are used as fallback by the consumer.
 */
export function useReleaseDownloads(): {
  releaseUrls: ReleaseUrls;
  loading: boolean;
  error: string | null;
} {
  const [releaseUrls, setReleaseUrls] = useState<ReleaseUrls>({});
  const [loading, setLoading] = useState(!!GITHUB_REPO?.trim());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const repo = typeof GITHUB_REPO === "string" ? GITHUB_REPO.trim() : "";
    if (!repo) {
      setLoading(false);
      return;
    }

    const url = `${GITHUB_API}/repos/${encodeURIComponent(repo)}/releases/latest`;
    fetch(url, { headers: { Accept: "application/vnd.github+json" } })
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) return null;
          throw new Error(`GitHub API ${res.status}`);
        }
        return res.json();
      })
      .then((data: { assets?: { name: string; browser_download_url: string }[] } | null) => {
        if (!data?.assets?.length) {
          setReleaseUrls({});
          return;
        }
        const urls: ReleaseUrls = {};
        const windows = pickAssetUrl(data.assets, "windows");
        const mac = pickAssetUrl(data.assets, "mac");
        const linux = pickAssetUrl(data.assets, "linux");
        if (windows) urls.windows = windows;
        if (mac) urls.mac = mac;
        if (linux) urls.linux = linux;
        setReleaseUrls(urls);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load releases");
        setReleaseUrls({});
      })
      .finally(() => setLoading(false));
  }, []);

  return { releaseUrls, loading, error };
}
