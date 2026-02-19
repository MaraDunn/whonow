/**
 * Unit tests for _shared/security.ts
 * Run with: deno test --allow-env security.test.ts
 */
import {
  sanitizeString,
  getCorsHeaders,
  checkRateLimit,
  rateLimitExceededResponse,
  isNonEmptyString,
  isValidEmail,
  isValidPhone,
  jsonErrorResponse,
} from "./security.ts";
import { assertEquals } from "https://deno.land/std@0.190.0/assert/assertEquals.ts";

Deno.test("sanitizeString escapes dangerous chars", () => {
  assertEquals(sanitizeString("<script>alert(1)</script>"), "&lt;script&gt;alert(1)&lt;/script&gt;");
  assertEquals(sanitizeString("hello"), "hello");
  assertEquals(sanitizeString('"quoted"'), "&quot;quoted&quot;");
  assertEquals(sanitizeString("'single'"), "&#39;single&#39;");
});

Deno.test("sanitizeString enforces max length", () => {
  const long = "a".repeat(2000);
  assertEquals(sanitizeString(long, 100).length, 100);
  assertEquals(sanitizeString("hi", 10), "hi");
});

Deno.test("sanitizeString returns empty for non-string", () => {
  assertEquals(sanitizeString(undefined as unknown as string), "");
  assertEquals(sanitizeString(123 as unknown as string), "");
});

Deno.test("getCorsHeaders returns object with required keys", () => {
  const h = getCorsHeaders("http://localhost:5173");
  assertEquals(typeof h["Access-Control-Allow-Origin"], "string");
  assertEquals(h["Access-Control-Allow-Headers"], "authorization, x-client-info, apikey, content-type");
  assertEquals(h["Access-Control-Allow-Methods"], "GET, POST, PUT, DELETE, OPTIONS");
});

Deno.test("getCorsHeaders reflects localhost origin", () => {
  const origin = "http://localhost:3000";
  const h = getCorsHeaders(origin);
  assertEquals(h["Access-Control-Allow-Origin"], origin);
});

Deno.test("getCorsHeaders returns first allowed for unknown origin", () => {
  const h = getCorsHeaders("https://evil.com");
  assertEquals(h["Access-Control-Allow-Origin"], "http://localhost:8080");
});

Deno.test("checkRateLimit allows first request", () => {
  const key = `test-allow-${Date.now()}`;
  const r = checkRateLimit(key, 2, 60000);
  assertEquals(r.allowed, true);
  assertEquals(r.remaining, 1);
});

Deno.test("checkRateLimit denies over limit", () => {
  const key = `test-deny-${Date.now()}`;
  checkRateLimit(key, 2, 60000);
  checkRateLimit(key, 2, 60000);
  const r = checkRateLimit(key, 2, 60000);
  assertEquals(r.allowed, false);
  assertEquals(r.remaining, 0);
});

Deno.test("rateLimitExceededResponse returns 429 with CORS", () => {
  const res = rateLimitExceededResponse(5000, "http://localhost:5173");
  assertEquals(res.status, 429);
  assertEquals(res.headers.get("Content-Type"), "application/json");
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "http://localhost:5173");
  assertEquals(res.headers.get("Retry-After"), "5");
});

Deno.test("isNonEmptyString", () => {
  assertEquals(isNonEmptyString("hi"), true);
  assertEquals(isNonEmptyString("  "), false);
  assertEquals(isNonEmptyString(""), false);
  assertEquals(isNonEmptyString(null), false);
  assertEquals(isNonEmptyString(123), false);
});

Deno.test("isValidEmail", () => {
  assertEquals(isValidEmail("a@b.co"), true);
  assertEquals(isValidEmail("user@example.com"), true);
  assertEquals(isValidEmail("invalid"), false);
  assertEquals(isValidEmail("a@"), false);
  assertEquals(isValidEmail("@b.com"), false);
});

Deno.test("isValidPhone", () => {
  assertEquals(isValidPhone("+1 234 567 8900"), true);
  assertEquals(isValidPhone("123-456-7890"), true);
  assertEquals(isValidPhone("123"), false);
  assertEquals(isValidPhone("abcdef"), false);
});

Deno.test("jsonErrorResponse returns JSON with CORS", async () => {
  const res = jsonErrorResponse("Bad request", 400, "http://localhost:5173");
  assertEquals(res.status, 400);
  assertEquals(res.headers.get("Content-Type"), "application/json");
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "http://localhost:5173");
  const body = await res.json();
  assertEquals(body, { error: "Bad request" });
});
