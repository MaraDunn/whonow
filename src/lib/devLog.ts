/**
 * Development-only logging. No-op in production builds.
 * Use for diagnostic logs; keep console.error for actual errors (wired to pushErrorLog).
 */
export function devLog(...args: unknown[]): void {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
}

export function devDebug(...args: unknown[]): void {
  if (import.meta.env.DEV) {
    console.debug(...args);
  }
}

export function devInfo(...args: unknown[]): void {
  if (import.meta.env.DEV) {
    console.info(...args);
  }
}
