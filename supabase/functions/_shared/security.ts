/**
 * Shared Security Utilities for Edge Functions
 * 
 * This module provides reusable security patterns for:
 * - CORS header management
 * - Input sanitization
 * - Rate limiting helpers
 * - Secure logging (PII-safe)
 * - Error response formatting
 */

// Allowed origins for CORS. For production, set ALLOWED_ORIGINS in Supabase
// (Edge Function secrets) to your domain(s), e.g.:
//   ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
// If unset, only DEFAULT_ORIGINS (localhost) are used and requests from your
// production site will fail CORS.
const DEFAULT_ORIGINS = [
  "http://localhost:8080",  // Default dev server port
  "http://localhost:5173",  // Alternative Vite port
  "http://localhost:3000",  // Alternative port
];

const ALLOWED_ORIGINS = Deno.env.get("ALLOWED_ORIGINS")
  ? Deno.env.get("ALLOWED_ORIGINS")!.split(",").map(o => o.trim())
  : DEFAULT_ORIGINS;

/** True when the request origin is localhost/127.0.0.1 (for local dev CORS). */
function isLocalOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

/**
 * Get secure CORS headers based on request origin.
 * Localhost/127.0.0.1 origins are always reflected so local dev works even when
 * ALLOWED_ORIGINS is set to production only. Otherwise uses allowlist or first allowed origin.
 */
export function getCorsHeaders(requestOrigin?: string | null): Record<string, string> {
  let origin: string;
  if (requestOrigin && (isLocalOrigin(requestOrigin) || ALLOWED_ORIGINS.includes(requestOrigin))) {
    origin = requestOrigin;
  } else {
    origin = ALLOWED_ORIGINS[0];
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  };
}

/**
 * Handle CORS preflight requests
 */
export function handleCorsPreflightRequest(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    const origin = req.headers.get("origin");
    return new Response(null, { headers: getCorsHeaders(origin) });
  }
  return null;
}

/**
 * JSON error response with CORS headers (for consistent error handling).
 */
export function jsonErrorResponse(
  message: string,
  status: number,
  origin?: string | null
): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
  });
}

/**
 * Sanitize a string to prevent injection attacks
 * Removes/escapes potentially dangerous characters
 */
export function sanitizeString(input: string, maxLength = 1000): string {
  if (typeof input !== "string") return "";
  
  return input
    .slice(0, maxLength)
    .replace(/[<>'"]/g, (char) => {
      const escapeMap: Record<string, string> = {
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      };
      return escapeMap[char] || char;
    })
    .trim();
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Validate phone number format (basic validation)
 */
export function isValidPhone(phone: string): boolean {
  // Allow digits, spaces, dashes, parentheses, and plus sign
  const phoneRegex = /^[\d\s\-()+]{7,20}$/;
  return phoneRegex.test(phone);
}

/**
 * Create a secure log entry that excludes PII
 * Only logs safe metadata like IDs, timestamps, and operation types
 */
export function secureLog(
  prefix: string,
  step: string,
  safeDetails?: Record<string, string | number | boolean | undefined>
): void {
  const detailsStr = safeDetails 
    ? ` - ${JSON.stringify(safeDetails)}` 
    : "";
  console.log(`[${prefix}] ${step}${detailsStr}`);
}

/**
 * Format error response without exposing internal details
 * Returns generic messages to clients while logging details server-side
 */
export function formatErrorResponse(
  error: unknown,
  publicMessage = "An error occurred"
): { message: string; details?: string } {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Log full error server-side
  console.error("Error details:", errorMessage);
  
  // Return sanitized message to client
  return { message: publicMessage };
}

/**
 * Validate that a value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Validate contact data for AI processing
 * Returns only safe fields, stripping PII
 */
export function sanitizeContactForAI(contact: {
  name?: string;
  role?: string;
  company?: string;
  description?: string;
  tags?: string[];
}): {
  role: string;
  company: string;
  description: string;
  tags: string[];
} {
  return {
    // Intentionally exclude name and email for privacy
    role: sanitizeString(contact.role || "", 200),
    company: sanitizeString(contact.company || "", 200),
    description: sanitizeString(contact.description || "", 500),
    tags: (contact.tags || []).slice(0, 20).map(t => sanitizeString(t, 50)),
  };
}

/**
 * Rate limiting state type
 */
interface RateLimitState {
  count: number;
  resetTime: number;
}

/**
 * Simple in-memory rate limiter.
 * For production at scale, use a shared store (e.g. Redis, Upstash, or Supabase table)
 * so limits persist across cold starts and multiple function instances. This in-memory
 * implementation resets on cold starts and is not shared across instances.
 */
const rateLimitStore = new Map<string, RateLimitState>();

export function checkRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const state = rateLimitStore.get(identifier);
  
  if (!state || now > state.resetTime) {
    // New window
    rateLimitStore.set(identifier, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetIn: windowMs };
  }
  
  if (state.count >= maxRequests) {
    return { 
      allowed: false, 
      remaining: 0, 
      resetIn: state.resetTime - now 
    };
  }
  
  state.count++;
  return { 
    allowed: true, 
    remaining: maxRequests - state.count, 
    resetIn: state.resetTime - now 
  };
}

/**
 * Create rate limit exceeded response
 */
export function rateLimitExceededResponse(resetIn: number, origin?: string | null): Response {
  return new Response(
    JSON.stringify({ 
      error: "Rate limit exceeded. Please try again later.",
      retryAfter: Math.ceil(resetIn / 1000)
    }),
    { 
      status: 429, 
      headers: { 
        ...getCorsHeaders(origin), 
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil(resetIn / 1000))
      } 
    }
  );
}
