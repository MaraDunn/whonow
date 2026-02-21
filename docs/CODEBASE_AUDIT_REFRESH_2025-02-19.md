# Codebase Audit — Refreshed Run (Unbiased)

**Audit date:** February 19, 2025  
**Type:** Fresh re-audit of current codebase state (post-remediation).  
**Scope:** Security, routes, code quality, performance, dependencies, testing.  
**Score:** Based only on current findings; no carryover from prior audits.

---

## 1. Current State: What Was Verified

### 1.1 CORS

- **Finding:** All Supabase Edge Functions that return browser-facing responses use `getCorsHeaders(origin)` from `_shared/security.ts`. No remaining `Access-Control-Allow-Origin: *` in production handlers.
- **Files checked:** bulk-insert-contacts, contact-share, create-checkout, check-subscription, customer-portal, generate-test-contacts, help-email, llm-proxy, ocr-fallback, ocr-google-vision, parse-contact-pdf, parse-search-query, scan-business-card, scan-business-card-ai, slack-integration, teams-integration, waitlist.
- **Result:** CORS is allowlist/origin-based; production should set `ALLOWED_ORIGINS` in Supabase secrets.

### 1.2 Hardcoded Secrets

- **Finding:** No hardcoded Supabase URL or API key found in the repo. `add-test-contacts-browser.js` (previously containing hardcoded credentials) is removed. `add-test-contacts.js` reads from `.env`. `check-contact-browser.js` uses `import.meta.env` or `window.__SUPABASE_URL__` / `window.__SUPABASE_KEY__` (no literal secrets).
- **Caveat:** `diagnose-signup.js` (line 74) and `TROUBLESHOOTING_SIGNUP.md` (line 111) contain a test password `Test1234!`. These are dev/troubleshooting assets; risk is low but worth cleaning for consistency.

### 1.3 Sensitive Endpoints

- **bulk-insert-contacts:** JWT required; uses `getCorsHeaders`, `checkLaunchMode`, `waitlistModeBlockedResponse` from `_shared/security.ts`. Per-contact validation and sanitization via `sanitizeContactForInsert` (sanitizeString, isValidEmail, isValidPhone, max lengths). Duplicate check scoped to `owner_id` and `company_id` only (no global `is_shared`). On total failure returns generic message; details logged server-side only.
- **stripe-webhook:** Returns generic `"Webhook verification failed"` (400) on signature failure; internal error is only logged.
- **Other authenticated functions:** create-checkout, check-subscription, customer-portal, help-email, ocr-google-vision, parse-search-query, scan-business-card-ai, slack-integration, teams-integration (non-callback paths) require and validate JWT.

### 1.4 Unauthenticated Endpoints (By Design)

- **contact-share:** Token in query; rate-limited by IP; no JWT.
- **waitlist:** Email signup; rate-limited by IP; no JWT.
- **llm-proxy:** Model/file allowlisted and path traversal guarded; no JWT.
- **ocr-fallback:** Waitlist-mode blocked; no JWT (intended for unauthenticated parsing).

---

## 2. Remaining Findings (Current State Only)

### 2.1 Security & Secrets

| Location | Issue Type | Severity | Impact | Recommendation |
|----------|------------|----------|--------|----------------|
| `diagnose-signup.js` line 74, `TROUBLESHOOTING_SIGNUP.md` line 111 | Hardcoded test password | Low | Dev-only; could be copied into production configs by mistake | Use env var in script (e.g. `process.env.TEST_PASSWORD`) and placeholder in docs (e.g. `YOUR_TEST_PASSWORD`) |
| `src/components/ui/chart.tsx` lines 70–85 | `dangerouslySetInnerHTML` with theme/config-driven CSS | Low | XSS only if `ChartConfig` is ever derived from user input | Ensure chart config is always app-defined; document; if any config becomes user-influenced, sanitize (e.g. allow only safe color/selector values) |

### 2.2 Dependencies

| Location | Issue Type | Severity | Impact | Recommendation |
|----------|------------|----------|--------|----------------|
| `npm audit` | High-severity advisories in devDependencies (e.g. @eslint/config-array, @eslint/eslintrc via minimatch/ajv; @typescript-eslint/*) | Medium | Dev/build tooling only; no runtime impact in production bundle | Run `npm audit` and apply fixes where possible; plan upgrade path for eslint 10 / typescript-eslint 8 if needed |
| `package.json` | No `test` or `audit` script | Low | Harder to run tests and security audit from npm | Add `"test": "vitest"` (or current runner) and `"audit": "npm audit"` |

### 2.3 Test Coverage & Maintainability

| Location | Issue Type | Severity | Impact | Recommendation |
|----------|------------|----------|--------|----------------|
| Project-wide | Only 3 test files: `_shared/security.test.ts`, `parse-search-query/auth.test.ts`, `src/utils/__tests__/searchIntegrity.test.ts` | Medium | Critical paths (auth, contact CRUD, Edge Function validation) largely untested | Add vitest (or existing runner) config and `test` script; add unit tests for hooks, utils, and key Edge Function logic |
| `package.json` | No vitest (or test runner) config / script | Low | Tests not runnable via npm | Add vitest config and `npm run test` |
| `supabase/functions/parse-contact-pdf/index.ts`, `scan-business-card/index.ts` | Single file ~2000+ and ~2300+ lines | Low | Harder to maintain and test | Split into modules (formatting, detection, extraction, thin serve handler) |
| parse-contact-pdf, scan-business-card | Duplicated `formatName`, `capitalizeWord`, `formatPhoneNumber` | Low | Drift and duplication | Use `_shared/contactFormatting.ts` and reuse |

### 2.4 Performance & Scalability

| Location | Issue Type | Severity | Impact | Recommendation |
|----------|------------|----------|--------|----------------|
| `_shared/security.ts` | Rate limiting is in-memory (`rateLimitStore` Map); resets on function cold start | Low | Under scale or many instances, limits may be bypassed after cold starts | For production at scale, consider Redis or DB-backed rate limiting |
| `useContacts.ts` (trashed list) | `.limit(1000)` for trashed contacts | Low | Large trash lists may be heavy in one request | Consider pagination or lower cap with “load more” |

---

## 3. Endpoint Summary (Current State)

| Function | Methods | Auth | CORS | Input validation / notes |
|----------|---------|------|------|---------------------------|
| bulk-insert-contacts | OPTIONS, POST | JWT | getCorsHeaders(origin) | Per-contact sanitize + validate; duplicate scope owner/company |
| contact-share | GET | Token (query) | getCorsHeaders(origin) | Rate limit IP; token required |
| create-checkout | OPTIONS, POST | JWT | getCorsHeaders(origin) | tier validated |
| check-subscription | OPTIONS, GET | JWT | getCorsHeaders(origin) | — |
| customer-portal | OPTIONS, GET | JWT | getCorsHeaders(origin) | — |
| generate-test-contacts | OPTIONS, POST | JWT + env guard | getCorsHeaders(origin) | — |
| help-email | POST | JWT | getCorsHeaders(origin) | type, body sanitized; rate limit user |
| llm-proxy | GET | None | getCorsHeaders(origin) | model/file allowlist + path traversal check |
| ocr-fallback | OPTIONS, POST | None | getCorsHeaders(origin) | Waitlist block; imageBase64 |
| ocr-google-vision | OPTIONS, POST | JWT | getCorsHeaders(origin) | imageBase64 |
| parse-contact-pdf | OPTIONS, POST | JWT | getCorsHeaders(origin) | Size limits on text/base64 |
| parse-search-query | OPTIONS, POST | JWT | getCorsHeaders(origin) | query/contacts length caps |
| scan-business-card | OPTIONS, POST | JWT (flow) | getCorsHeaders(origin) | ocrText required; waitlist block |
| scan-business-card-ai | OPTIONS, POST | JWT | getCorsHeaders(origin) | Body checks |
| slack-integration | GET, POST | JWT (non-callback) | getCorsHeaders(origin) | OAuth + app actions |
| stripe-webhook | POST | stripe-signature | No CORS (server-to-server) | Generic error on verify failure |
| teams-integration | GET, POST | JWT (non-callback) | getCorsHeaders(origin) | OAuth + app actions |
| waitlist | POST | None | getCorsHeaders(origin) | email validated; rate limit IP |

---

## 4. Risk Score (Unbiased, From This Run Only)

**Overall risk score: 4.5 / 10**

- **Rationale**
  - **Positive:** No hardcoded production secrets; CORS allowlist in use; JWT on sensitive Edge Functions; bulk-insert validated and scoped; Stripe webhook error message generic; RLS and shared security helpers in place.
  - **Negative:** High-severity devDependency advisories; limited test coverage; in-memory rate limiting; test password in dev/docs; chart `dangerouslySetInnerHTML` caveat; some duplication and very long files.

- **Breakdown (current state)**
  - **Secrets / auth:** Low risk (no exposed credentials; auth enforced where intended).
  - **Injection / XSS:** Low risk (sanitization in bulk-insert and help-email; chart config should stay app-defined).
  - **Dependencies:** Medium risk (dev-only high-severity; no runtime exposure).
  - **Testing / maintainability:** Medium risk (few tests; large, duplicated files).
  - **Performance / scalability:** Low risk (rate limit and trash list limits are acceptable for current scale).

---

## 5. Recommended Next Steps (Prioritized)

1. **High:** Run `npm audit` and apply fixes; add `audit` (and optionally `audit:fix`) script.
2. **Medium:** Add test runner and `test` script; add tests for critical paths (e.g. contact validation, auth, one or two Edge Functions).
3. **Low:** Replace test password in `diagnose-signup.js` and docs with env/placeholder; document that chart config must remain app-defined; consider shared contact-formatting module and splitting very large Edge Function files; plan for external rate limiting if scaling.

---

*This report reflects only the state of the codebase at the time of this run. The risk score is independent of previous audits and is based solely on the findings listed above.*
