/**
 * Launch mode utility for controlling application behavior
 * 
 * Environment variable: VITE_APP_LAUNCH_MODE
 * Values: "waitlist" | "live"
 * Default: "live"
 * 
 * Development mode: Set VITE_DEV_MODE=true to bypass waitlist restrictions locally
 * Or automatically detected when running on localhost
 */

export const LAUNCH_MODE = import.meta.env.VITE_APP_LAUNCH_MODE || "live";
export const IS_WAITLIST_MODE = LAUNCH_MODE === "waitlist";
export const IS_LIVE_MODE = LAUNCH_MODE === "live";

/**
 * Detect if running in development mode
 * Development mode bypasses waitlist restrictions for local testing
 */
export const isDevelopmentMode = (): boolean => {
  if (typeof window === "undefined") return false;
  
  // Check explicit dev mode flag
  if (import.meta.env.VITE_DEV_MODE === "true") {
    return true;
  }
  
  // Auto-detect localhost/127.0.0.1 for development
  const hostname = window.location.hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0") {
    return true;
  }
  
  // Check if running in Vite dev mode (import.meta.env.DEV is set by Vite)
  if (import.meta.env.DEV) {
    return true;
  }
  
  return false;
};

/**
 * Effective waitlist mode - respects development mode bypass
 * In dev mode, waitlist restrictions are bypassed even if LAUNCH_MODE is "waitlist"
 */
export const IS_WAITLIST_MODE_EFFECTIVE = IS_WAITLIST_MODE && !isDevelopmentMode();

import { devLog } from "@/lib/devLog";

// Debug: Log launch mode (remove after verification)
if (typeof window !== "undefined" && import.meta.env.DEV) {
  devLog("[LaunchMode] VITE_APP_LAUNCH_MODE:", import.meta.env.VITE_APP_LAUNCH_MODE);
  devLog("[LaunchMode] LAUNCH_MODE:", LAUNCH_MODE);
  devLog("[LaunchMode] IS_WAITLIST_MODE:", IS_WAITLIST_MODE);
  devLog("[LaunchMode] isDevelopmentMode:", isDevelopmentMode());
  devLog("[LaunchMode] IS_WAITLIST_MODE_EFFECTIVE:", IS_WAITLIST_MODE_EFFECTIVE);
}

/**
 * Detect if the app is running in a desktop/native environment
 * (Tauri desktop app or future native mobile apps)
 * This function checks multiple methods to reliably detect Tauri
 */
export const isDesktopOrNativeApp = (): boolean => {
  if (typeof window === "undefined") return false;
  
  try {
    const win = window as any;
    
    // Method 1: Check for __TAURI_INTERNALS__ which is always available in Tauri v2
    if (win.__TAURI_INTERNALS__) {
      devLog('[Tauri Detection] Found __TAURI_INTERNALS__');
      return true;
    }
    
    // Method 2: Check for __TAURI__ global (if withGlobalTauri is enabled)
    if (win.__TAURI__) {
      devLog('[Tauri Detection] Found __TAURI__');
      return true;
    }
    
    // Method 3: Check for Tauri-specific window properties
    if (win.__TAURI_METADATA__) {
      devLog('[Tauri Detection] Found __TAURI_METADATA__');
      return true;
    }
    
    // Method 4: Check if we're running in a Tauri window by checking for Tauri-specific APIs
    // Tauri injects certain APIs that aren't in regular browsers
    if (typeof win.__TAURI__ !== 'undefined' || 
        typeof win.__TAURI_INTERNALS__ !== 'undefined') {
      devLog('[Tauri Detection] Found Tauri API via typeof check');
      return true;
    }
    
    // Method 5: Check user agent (Tauri apps have a specific user agent)
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Tauri') || userAgent.includes('tauri')) {
      devLog('[Tauri Detection] Found Tauri in user agent:', userAgent);
      return true;
    }
    
    // Method 6: Check for Tauri environment variable (set during build)
    if (import.meta.env.VITE_TAURI_PLATFORM) {
      devLog('[Tauri Detection] Found VITE_TAURI_PLATFORM:', import.meta.env.VITE_TAURI_PLATFORM);
      return true;
    }
  } catch (e) {
    console.error('[Tauri Detection] Error during detection:', e);
  }
  
  // Check for React Native or other native app indicators
  // Add more checks here as needed for future mobile apps
  if ((window as any).ReactNativeWebView) {
    devLog('[Tauri Detection] Found ReactNativeWebView');
    return true;
  }
  
  devLog('[Tauri Detection] Not detected as desktop/native app. Window properties:', {
    hasTAURI: '__TAURI__' in window,
    hasTAURI_INTERNALS: '__TAURI_INTERNALS__' in window,
    hasTAURI_METADATA: '__TAURI_METADATA__' in window,
    userAgent: navigator.userAgent
  });
  return false;
};

/**
 * Origin to use for auth redirects (email verification, password reset).
 * In the desktop app, email links open in the browser, so we must use a web URL
 * (VITE_APP_URL) instead of tauri://localhost so the user lands on a real page.
 */
export const getAuthRedirectOrigin = (): string => {
  if (typeof window === "undefined") return "";
  const appUrl = (import.meta.env.VITE_APP_URL as string | undefined)?.trim();
  if (isDesktopOrNativeApp() && appUrl) {
    try {
      const u = new URL(appUrl);
      return u.origin;
    } catch {
      // fall through to window.location.origin
    }
  }
  return window.location.origin;
};
