/**
 * Meta (Facebook) Pixel for tracking conversions.
 * Set VITE_META_PIXEL_ID in your environment to enable.
 * @see https://developers.facebook.com/docs/meta-pixel
 */

const PIXEL_ID = (import.meta.env.VITE_META_PIXEL_ID as string | undefined)?.trim() || null;

declare global {
  interface Window {
    fbq?: (
      action: "track" | "trackCustom" | "init",
      eventName: string,
      params?: Record<string, unknown>
    ) => void;
    _fbq?: typeof window.fbq;
  }
}

let scriptLoaded = false;

function loadPixel(): void {
  if (typeof document === "undefined" || !PIXEL_ID || scriptLoaded) return;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  script.onload = () => {
    if (typeof window.fbq === "function") {
      window.fbq("init", PIXEL_ID!);
      window.fbq("track", "PageView");
    }
    scriptLoaded = true;
  };
  document.head.appendChild(script);
}

/**
 * Track a free trial sign-up (e.g. when user completes registration).
 * Fires Meta's standard "StartTrial" event for optimization and reporting.
 */
export function trackStartTrial(): void {
  if (!PIXEL_ID) return;
  loadPixel();
  if (typeof window.fbq === "function") {
    window.fbq("track", "StartTrial");
  } else {
    const queue = (window._fbq = window._fbq || []);
    queue.push(["track", "StartTrial"]);
  }
}
