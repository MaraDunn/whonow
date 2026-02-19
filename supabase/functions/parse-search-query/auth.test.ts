/**
 * Auth tests for parse-search-query: protected endpoint returns 401 without Bearer token.
 * Run from repo root: deno test --allow-env --allow-read auth.test.ts
 * Or from this directory: deno test --allow-env --allow-read auth.test.ts
 */
import { handler } from "./index.ts";
import { assertEquals } from "https://deno.land/std@0.190.0/assert/assertEquals.ts";

Deno.test("parse-search-query returns 401 without Authorization header", async () => {
  const req = new Request("https://example.com/parse-search-query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "engineers", contacts: [] }),
  });
  const res = await handler(req);
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.error, "Missing authorization header");
});

Deno.test("parse-search-query returns 401 with invalid token", async () => {
  const req = new Request("https://example.com/parse-search-query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer invalid-token",
    },
    body: JSON.stringify({ query: "engineers", contacts: [] }),
  });
  const res = await handler(req);
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.error, "Unauthorized");
});
