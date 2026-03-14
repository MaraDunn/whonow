/**
 * Shared auth token helper to avoid 429 (Too Many Requests) on Supabase token refresh.
 * Throttles refreshSession() and prefers getSession() when the token is still valid.
 */

import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** Minimum seconds the token must be valid for to use it without refreshing. */
const VALIDITY_BUFFER_SEC = 60;
/** Do not call refreshSession more than once per this many ms. */
const REFRESH_THROTTLE_MS = 55_000;

let lastRefreshAt = 0;
let lastRefreshedSession: Session | null = null;

function getJwtExp(accessToken: string): number | null {
  try {
    const parts = accessToken.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

/** Returns true if the session's access token is still valid for at least VALIDITY_BUFFER_SEC. */
export function isTokenValid(session: Session | null): boolean {
  if (!session?.access_token) return false;
  const exp = getJwtExp(session.access_token);
  if (exp == null) return true;
  return exp > Date.now() / 1000 + VALIDITY_BUFFER_SEC;
}

/**
 * Returns a valid access token for Edge Function / API calls.
 * Uses getSession() first; only calls refreshSession() when token is missing, expired, or expiring soon,
 * and throttles refresh to at most once per REFRESH_THROTTLE_MS to avoid 429.
 */
export async function getValidAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token && isTokenValid(session)) {
    return session.access_token;
  }
  const now = Date.now();
  if (now - lastRefreshAt < REFRESH_THROTTLE_MS && lastRefreshedSession?.access_token) {
    return lastRefreshedSession.access_token;
  }
  const { data: { session: refreshed }, error } = await supabase.auth.refreshSession();
  lastRefreshAt = now;
  lastRefreshedSession = refreshed ?? null;
  if (error || !lastRefreshedSession?.access_token) return null;
  return lastRefreshedSession.access_token;
}

/**
 * Returns a valid session for Edge Function / API calls.
 * Same throttling as getValidAccessToken; use when callers need the full session.
 */
export async function getValidSession(): Promise<Session | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session && isTokenValid(session)) return session;
  const now = Date.now();
  if (now - lastRefreshAt < REFRESH_THROTTLE_MS && lastRefreshedSession) {
    return lastRefreshedSession;
  }
  const { data: { session: refreshed }, error } = await supabase.auth.refreshSession();
  lastRefreshAt = now;
  lastRefreshedSession = refreshed ?? null;
  if (error) return session && isTokenValid(session) ? session : null;
  return lastRefreshedSession;
}
