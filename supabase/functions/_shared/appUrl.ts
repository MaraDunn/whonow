/**
 * Canonical production app URL for Stripe redirects (success, cancel, return).
 * The app is deployed at whonow.co, not app.whonow.co.
 */
export const CANONICAL_APP_ORIGIN = "https://whonow.co";

/**
 * Returns the origin (protocol + host, no path) for Stripe redirect URLs.
 * Callers append paths like /app or / so we never get double /app (e.g. /app/app).
 * - APP_URL env is used if set; any path is stripped so we return origin only.
 * - Else if the request is from localhost, use that origin so local dev works.
 * - Else use CANONICAL_APP_ORIGIN so redirects always go to the deployed app (whonow.co).
 */
export function getStripeRedirectOrigin(req: Request): string {
  const envUrl = Deno.env.get("APP_URL");
  if (envUrl) {
    try {
      const u = new URL(envUrl.replace(/\/$/, ""));
      return u.origin;
    } catch {
      return envUrl.replace(/\/$/, "");
    }
  }

  const origin = req.headers.get("origin") ?? "";
  try {
    const u = new URL(origin);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return u.origin;
  } catch {
    // ignore
  }

  return CANONICAL_APP_ORIGIN;
}
