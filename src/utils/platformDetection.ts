/**
 * Platform Detection Utility
 * Detects current platform to route to appropriate semantic assist layer
 */

export type Platform = "desktop" | "mobile" | "browser" | "pwa";

/**
 * Detect the current platform
 */
export function detectPlatform(): Platform {
  if (typeof window === "undefined") {
    return "browser"; // SSR fallback
  }

  // Check for Tauri (desktop native app)
  // Tauri v2 uses __TAURI_INTERNALS__, v1 used __TAURI__
  if ((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__) {
    return "desktop";
  }

  // Check for PWA (service worker + standalone mode)
  if (
    "serviceWorker" in navigator &&
    window.matchMedia("(display-mode: standalone)").matches
  ) {
    return "pwa";
  }

  // Check for mobile (touch device + small screen)
  const isTouch = window.matchMedia("(any-pointer: coarse)").matches;
  const isSmallScreen = window.innerWidth < 768;
  if (isTouch && isSmallScreen) {
    return "mobile";
  }

  // Default to browser
  return "browser";
}
