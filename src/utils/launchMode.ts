/**
 * Launch mode utility for controlling application behavior
 * 
 * Environment variable: VITE_APP_LAUNCH_MODE
 * Values: "waitlist" | "live"
 * Default: "live"
 */

export const LAUNCH_MODE = import.meta.env.VITE_APP_LAUNCH_MODE || "live";
export const IS_WAITLIST_MODE = LAUNCH_MODE === "waitlist";
export const IS_LIVE_MODE = LAUNCH_MODE === "live";
