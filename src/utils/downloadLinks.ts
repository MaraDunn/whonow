/**
 * Download links utility for native app downloads
 *
 * Desktop (Windows/macOS/Linux): The landing page prefers runtime URLs from the latest
 * GitHub release when VITE_GITHUB_REPO is set (see useReleaseDownloads). These env vars
 * are used as fallback or when no GitHub repo is configured.
 *
 * Environment variables:
 * - VITE_GITHUB_REPO (optional) — "owner/repo" for runtime release fetch
 * - VITE_DOWNLOAD_URL_WINDOWS, VITE_DOWNLOAD_URL_MAC, VITE_DOWNLOAD_URL_LINUX
 * - VITE_DOWNLOAD_URL_IOS (App Store link)
 * - VITE_DOWNLOAD_URL_ANDROID (Play Store link)
 */

export type Platform = "windows" | "mac" | "linux" | "ios" | "android" | "unknown";

/**
 * Detect the user's current platform
 */
export const detectPlatform = (): Platform => {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return "unknown";
  }

  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform.toLowerCase();

  // iOS detection
  if (/iphone|ipad|ipod/.test(userAgent)) {
    return "ios";
  }

  // Android detection
  if (/android/.test(userAgent)) {
    return "android";
  }

  // Windows detection
  if (/win/.test(platform) || /windows/.test(userAgent)) {
    return "windows";
  }

  // Mac detection
  if (/mac/.test(platform) || /macintosh/.test(userAgent)) {
    return "mac";
  }

  // Linux detection
  if (/linux/.test(platform) || /x11/.test(userAgent)) {
    return "linux";
  }

  return "unknown";
};

/**
 * Get download URL for a specific platform
 */
export const getDownloadUrl = (platform: Platform): string | null => {
  const envVarMap: Record<Platform, string> = {
    windows: "VITE_DOWNLOAD_URL_WINDOWS",
    mac: "VITE_DOWNLOAD_URL_MAC",
    linux: "VITE_DOWNLOAD_URL_LINUX",
    ios: "VITE_DOWNLOAD_URL_IOS",
    android: "VITE_DOWNLOAD_URL_ANDROID",
    unknown: "",
  };

  const envVar = envVarMap[platform];
  if (!envVar) return null;

  const url = import.meta.env[envVar];
  return url && url.trim() !== "" ? url : null;
};

/**
 * Check if a download URL is available for a platform
 */
export const hasDownloadUrl = (platform: Platform): boolean => {
  return getDownloadUrl(platform) !== null;
};

/**
 * Get all available download platforms with their URLs
 */
export const getAvailableDownloads = (): Array<{ platform: Platform; url: string }> => {
  const platforms: Platform[] = ["windows", "mac", "linux", "ios", "android"];
  
  return platforms
    .map((platform) => ({
      platform,
      url: getDownloadUrl(platform),
    }))
    .filter((item): item is { platform: Platform; url: string } => item.url !== null);
};

/**
 * Get platform display name
 */
export const getPlatformName = (platform: Platform): string => {
  const names: Record<Platform, string> = {
    windows: "Windows",
    mac: "macOS",
    linux: "Linux",
    ios: "iOS",
    android: "Android",
    unknown: "Unknown",
  };
  return names[platform];
};
