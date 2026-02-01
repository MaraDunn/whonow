import { useMemo } from "react";
import { detectPlatform } from "@/utils/downloadLinks";

export type AddToHomeScreenPlatform = "ios" | "android" | "desktop";

export interface AddToHomeScreenState {
  /** User is already running the app from home screen (PWA/standalone) */
  isStandalone: boolean;
  /** Platform for showing the right instructions */
  platform: AddToHomeScreenPlatform;
  /** Human-readable instruction text for the current platform */
  instructions: string;
}

/**
 * Detects if the app is running in standalone mode (added to home screen).
 */
function getIsStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

/**
 * Maps download platform to add-to-home-screen platform (ios | android | desktop).
 */
function toAddToHomePlatform(
  platform: ReturnType<typeof detectPlatform>
): AddToHomeScreenPlatform {
  if (platform === "ios") return "ios";
  if (platform === "android") return "android";
  return "desktop";
}

const INSTRUCTIONS: Record<AddToHomeScreenPlatform, string> = {
  ios: "Tap the Share button at the bottom of Safari, then tap **Add to Home Screen**. WhoNow will appear as an icon on your home screen.",
  android:
    "Open the browser menu (⋮), then tap **Add to Home screen** or **Install app**. WhoNow will appear as an icon on your home screen.",
  desktop:
    "Bookmark this page: **Ctrl+D** (Windows/Linux) or **Cmd+D** (Mac), or use your browser's bookmark menu. You can then open WhoNow from your bookmarks bar or home page.",
};

/**
 * Hook for "Add to Home Screen" / bookmark flow.
 * Returns platform, standalone state, and instruction copy for the current device.
 */
export function useAddToHomeScreen(): AddToHomeScreenState {
  return useMemo(() => {
    const platform = detectPlatform();
    const addToHomePlatform = toAddToHomePlatform(platform);
    const isStandalone = getIsStandalone();
    const instructions = INSTRUCTIONS[addToHomePlatform];

    return {
      isStandalone,
      platform: addToHomePlatform,
      instructions,
    };
  }, []);
}
