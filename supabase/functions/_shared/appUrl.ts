/**
 * Canonical production app URL for Stripe redirects (success, cancel, return).
 * The app is deployed at whonow.co, not app.whonow.co.
 */
export const CANONICAL_APP_ORIGIN = "https://whonow.co";

/**
 * Returns the origin to use for Stripe redirect URLs (success_url, cancel_url, return_url).
 * - APP_URL env is used if set (e.g. https://whonow.co in prod, http://localhost:8080 in dev).
 * - Else if the request is from localhost, use that origin so local dev works.
 * - Else use CANONICAL_APP_ORIGIN so redirects always go to the deployed app (whonow.co).
 */
export function getStripeRedirectOrigin(req: Request): string {
  const envUrl = Deno.env.get("APP_URL");
  if (envUrl) return envUrl.replace(/\/$/, "");

  const origin = req.headers.get("origin") ?? "";
  try {
    const u = new URL(origin);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return origin.replace(/\/$/, "");
  } catch {
    // ignore
  }

  return CANONICAL_APP_ORIGIN;
}
