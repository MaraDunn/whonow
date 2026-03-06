/**
 * Development-only logging. No-op in production builds.
 * Use for diagnostic logs; keep console.error for actual errors (wired to pushErrorLog).
 */
export function devLog(...args: unknown[]): void {
  if (typeof process !== "undefined" && process.env?.SUPPRESS_DEV_LOGS === "1") {
    return;
  }
  if (import.meta.env.DEV) {
    console.log(...args);
  }
}
