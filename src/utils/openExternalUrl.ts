import { detectPlatform } from "@/utils/platformDetection";

/**
 * Open a URL in the user's default browser.
 *
 * - Web/PWA: opens a new tab/window via `window.open`
 * - Tauri desktop: uses the native shell opener (default browser)
 */
export async function openExternalUrl(url: string): Promise<void> {
  // Basic validation to avoid accidentally trying to open garbage / relative paths.
  let target: string;
  try {
    target = new URL(url).toString();
  } catch {
    // If it's not a valid absolute URL, fall back to a no-op.
    // (Callers should only pass Stripe/https URLs here.)
    return;
  }

  const platform = detectPlatform();

  if (platform === "desktop") {
    // Tauri v2: open in OS default browser.
    const { open } = await import("@tauri-apps/plugin-shell");
    await open(target);
    return;
  }

  window.open(target, "_blank", "noopener,noreferrer");
}

