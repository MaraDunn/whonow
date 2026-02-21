# Codebase Audit Report — WhoNow (Fresh Audit)

**Audit date:** February 19, 2025  
**Scope:** Code quality & design, API/route audit, security & error handling, performance & scalability, dependencies & testing.  
**Note:** This audit was performed independently; previous audit results were not reused.

---

## 1. CODE QUALITY & DESIGN

### 1.1 SOLID & Clean Code

| Location | Issue Type | Impact | Recommendation |
|----------|------------|--------|-----------------|
| `supabase/functions/parse-contact-pdf/index.ts` (~2000+ lines) | Code quality | Single file is very large; hard to maintain and test | Split into modules: formatting (formatName, formatPhoneNumber), regex/patterns, document detection, extraction, and a thin serve() handler |
| `supabase/functions/scan-business-card/index.ts` (~2300+ lines) | Code quality | Same as above | Same approach: extract formatting, validation, and extraction into shared or local modules |
| `parse-contact-pdf/index.ts`, `scan-business-card/index.ts` | Duplication | formatName, capitalizeWord, formatPhoneNumber duplicated across 2 Edge Functions | Use `_shared/contactFormatting.ts` (or similar) and import in both; reduces drift and bugs |
| `src/hooks/useTeamsIntegration.ts`, `src/hooks/useSlackIntegration.ts` | Duplication | Repeated patterns: supabaseUrl/anonKey from env, similar OAuth/install flows | Consider a shared `useIntegrationOAuth` or shared helpers for env and Supabase client creation |
| `src/hooks/useOrganizationIntegrations.ts` | Duplication | Same env and client pattern repeated in multiple places | Centralize “get Supabase URL/key for Edge Function” in a small util used by all integration hooks |
| `supabase/functions/bulk-insert-contacts/index.ts` (lines 9–31) | Code quality | Inline copy of checkLaunchMode/waitlistModeBlockedResponse instead of using _shared/security.ts | Use `checkLaunchMode` and `waitlistModeBlockedResponse` from `_shared/security.ts` for consistency |
| Various Edge Functions | Magic numbers | MAX_BATCH_SIZE=100, pageSize=1000, 5000 safety limit, etc. without single source of truth | Define named constants in _shared (e.g. bulkInsertConstants.ts) and import where used |
| `supabase/functions/bulk-insert-contacts/index.ts` (contactsToInsert mapping) | Naming / types | Heavy use of `any` for contact objects | Introduce a ContactInsert type and use it for mapping and mergeContactData |

### 1.2 Test Coverage & Maintainability

| Location | Issue Type | Impact | Recommendation |
|----------|------------|--------|-----------------|
| Project-wide | Test coverage | Only 3 test files found: `security.test.ts`, `parse-search-query/auth.test.ts`, `searchIntegrity.test.ts`; no vitest config in package.json | Add vitest (or existing test runner) script and config; add unit tests for hooks, utils, and critical Edge Function logic |
| `src/utils/` (contactSearchEngine, searchQueryParser, businessCardParser, etc.) | Maintainability | Complex parsing logic with limited tests | Add unit tests for edge cases (empty input, malformed input, unicode, long strings) |
| Edge Functions (bulk-insert, contact-share, help-email, etc.) | Maintainability | No automated tests for request validation, auth, or error paths | Add Deno tests for auth failure, invalid body, rate limit, and success paths where feasible |

---

## 2. ROUTE/ENDPOINT AUDIT

### 2.1 All API Endpoints (Supabase Edge Functions)

| Function | Methods | Purpose | Auth | Input validation |
|----------|---------|---------|------|------------------|
| bulk-insert-contacts | OPTIONS, POST | Bulk insert/merge contacts | JWT | Array required, max 100; no per-field schema |
| contact-share | GET | Share contact via token (JSON/CSV) | None (token in query) | token required; rate limit by IP |
| create-checkout | OPTIONS, POST | Stripe Checkout session | JWT | tier validated via getTierPriceId |
| check-subscription | OPTIONS, GET | Subscription state | JWT | — |
| customer-portal | OPTIONS, GET | Stripe Billing Portal URL | JWT | — |
| generate-test-contacts | OPTIONS, POST | Generate 500 test contacts | JWT + env guard | — |
| help-email | POST | Bug report / contact support (Resend) | JWT | type, body sanitized; attachment size/name |
| llm-proxy | GET | Proxy Hugging Face CDN for LLM files | None | model + file validated (path traversal, allowlist) |
| ocr-fallback | OPTIONS, POST | OCR via OCR.space | None | waitlist block; imageBase64 |
| ocr-google-vision | OPTIONS, POST | Business card OCR (Google Vision) | JWT | imageBase64 |
| parse-contact-pdf | OPTIONS, POST | Parse PDF for contact data | JWT | Pre-extracted text expected |
| parse-search-query | OPTIONS, POST | Rule-based search query parsing | JWT | query ≤500 chars; contacts ≤2000 |
| scan-business-card | OPTIONS, POST | Rule-based business card from OCR text | JWT (implied) | ocrText required; waitlist block |
| scan-business-card-ai | OPTIONS, POST | AI business card scan | JWT | Body/content checks |
| slack-integration | GET (OAuth), POST | Slack OAuth + app actions | JWT (non-callback) | Various |
| stripe-webhook | POST | Stripe webhook | stripe-signature | — |
| teams-integration | GET (OAuth), POST | Teams OAuth + app actions | JWT (non-callback) | Various |
| waitlist | POST | Join waitlist | None | email required, validated; rate limit by IP |

### 2.2 Duplicate / Redundant Routes

| Location | Issue Type | Impact | Recommendation |
|----------|------------|--------|-----------------|
| `supabase/functions/llm-proxy/index-standalone.ts` | Redundant | Standalone variant of llm-proxy; not the deployed entry | Document as dev/standalone only or remove if unused to avoid confusion |

No other duplicate or redundant route definitions were found.

### 2.3 Authentication & Authorization

| Location | Issue Type | Impact | Recommendation |
|----------|------------|--------|-----------------|
| ocr-fallback | Security | No JWT; only waitlist-mode block | Acceptable if intentional for unauthenticated parsing; document and ensure no PII/sensitive data returned |
| llm-proxy | Security | No JWT; model/file allowlisted | Acceptable for public CDN proxy; ensure allowlist and path validation remain strict |
| contact-share | Security | Token in query only; rate-limited by IP | By design for share links; ensure token entropy and expiry are sufficient |
| bulk-insert-contacts, create-checkout, check-subscription, customer-portal, help-email, ocr-google-vision, parse-search-query, scan-business-card-ai, slack/teams (non-callback) | — | JWT required and validated | Good |

### 2.4 Input Validation

| Location | Issue Type | Impact | Recommendation |
|----------|------------|--------|-----------------|
| bulk-insert-contacts | Security / data quality | No per-contact field validation (name length, email format, phone format, XSS in strings) | Add schema (e.g. Zod) or shared sanitizers: max lengths, isValidEmail/isValidPhone, sanitizeString for text fields before insert |
| parse-contact-pdf | Code quality | Expects “pre-extracted text”; no explicit max length for body | Document max request body size; consider capping text length to avoid DoS |
| scan-business-card, scan-business-card-ai | Code quality | Same as above where raw body is accepted | Cap input size and document limits |

---

## 3. SECURITY & ERROR HANDLING

### 3.1 Vulnerabilities & Hardcoded Secrets

| Location | Issue Type | Impact | Recommendation |
|----------|------------|--------|-----------------|
| `add-test-contacts-browser.js` (lines 20–21, 27–30) | **Security (critical)** | Hardcoded Supabase URL and publishable key in fallback path | Remove hardcoded credentials; use only env or window.supabase; if script is for dev, add a prominent comment and .gitignore or use env-only |
| `diagnose-signup.js` (line 74), `TROUBLESHOOTING_SIGNUP.md` | Security / code quality | Test password in plain text in repo | Use env var for test password in script; in docs use placeholder “YOUR_TEST_PASSWORD” |
| `src/components/ui/chart.tsx` (lines 70–85) | Security | dangerouslySetInnerHTML with theme/config-driven CSS | Ensure ChartConfig is never derived from unsanitized user input; document that config must be app-defined only; if any config can be user-influenced, sanitize (e.g. allow only hex/rgb and known keys) |
| help-email (HTML construction) | Security | body and errorLogs used in HTML | body sanitized with sanitizeString; errorLogs escaped with .replace(/</g, "&lt;") — OK. Keep all user content escaped/sanitized |
| contact-share, waitlist, help-email, parse-search-query | Security | Rate limiting present | Good; note rate limiter is in-memory (resets on cold start) — see Performance section |

### 3.2 CORS & Access Control

| Location | Issue Type | Impact | Recommendation |
|----------|------------|--------|-----------------|
| parse-contact-pdf, scan-business-card, scan-business-card-ai, ocr-fallback, bulk-insert-contacts, generate-test-contacts, ocr-google-vision, teams-integration, slack-integration | Security | `Access-Control-Allow-Origin: *` used instead of getCorsHeaders(origin) | Use getCorsHeaders(origin) from _shared/security.ts so production uses ALLOWED_ORIGINS allowlist and avoids reflecting arbitrary origins |
| contact-share, waitlist, create-checkout, check-subscription, customer-portal, help-email, parse-search-query, llm-proxy | — | Use getCorsHeaders(origin) | Good |

### 3.3 Error Handling & Logging

| Location | Issue Type | Impact | Recommendation |
|----------|------------|--------|-----------------|
| stripe-webhook (line 50) | Error handling | On signature failure returns 400 with message including err.message | Avoid leaking internal details; return generic “Webhook verification failed” and log full error server-side only |
| Multiple Edge Functions | Logging | console.log/error with request or user data | Audit for PII (email, IDs, tokens); use secureLog or structured logs without PII where possible |
| bulk-insert-contacts (lines 394–396) | Error handling | On total failure returns `details: errors` (batch/merge messages) to client | Consider returning only a generic message and error code; log details server-side to avoid information disclosure |
| General | Code quality | Mixed use of jsonErrorResponse vs ad-hoc Response construction | Standardize on _shared jsonErrorResponse (and CORS) for consistency and correct status codes |

---

## 4. PERFORMANCE & SCALABILITY

### 4.1 Bottlenecks & N+1

| Location | Issue Type | Impact | Recommendation |
|----------|------------|--------|-----------------|
| bulk-insert-contacts (lines 283–316) | Performance | Duplicate check fetches up to 5000 contacts in pages of 1000 with .or(owner_id, company_id, is_shared); may pull many rows across org/shared | Restrict duplicate check to user’s company and owner_id; consider RPC that returns only id/email/phone for matching to reduce payload and time |
| bulk-insert-contacts (lines 374–387) | Performance | Merges executed one-by-one (update per contact) | Consider batch updates if Supabase supports or group by id and minimal round-trips |
| useContacts.ts (trashed contacts) | Performance | .limit(1000) for trashed list; count from separate RPC | Paginate trashed list or cap at lower limit with “load more” to avoid heavy single query |
| _shared/security.ts rate limiting | Scalability | In-memory Map; resets on function cold start | For production at scale, use external store (e.g. Redis or DB-backed) for rate limits |

### 4.2 Pagination & Caching

| Location | Issue Type | Impact | Recommendation |
|----------|------------|--------|-----------------|
| useContacts.ts (list_contacts_slim) | — | Cursor-based pagination and CONTACTS_INITIAL_PAGE_SIZE / CONTACTS_PAGE_SIZE | Good |
| useContacts prefetch (useEffect fetchNextPage) | Performance | Prefetches next page when data and hasNextPage available | Good for perceived performance |
| Edge Functions (contact-share, parse-search-query, etc.) | — | No caching headers on static or semi-static responses | For llm-proxy, consider Cache-Control for model files; for contact-share by token, short no-store or private is appropriate |

---

## 5. DEPENDENCIES & TESTING

### 5.1 Third-Party Vulnerabilities

| Location | Issue Type | Impact | Recommendation |
|----------|------------|--------|-----------------|
| npm audit | Security | High-severity issues in eslint tree: @eslint/config-array, @eslint/eslintrc (via minimatch, ajv); @typescript-eslint/* (via typescript-estree, minimatch) | Run `npm audit fix` where possible; for major upgrades (e.g. eslint 10, typescript-eslint 8.x), plan a dedicated upgrade and regression pass |
| package.json | Security | No audit or fix script mentioned | Add `"audit": "npm audit"` and optionally `"audit:fix": "npm audit fix"` |

### 5.2 Test Coverage & Edge Cases

| Location | Issue Type | Impact | Recommendation |
|----------|------------|--------|-----------------|
| Project | Test coverage | Only 3 test files; no vitest config in package.json | Add vitest (or current runner) config and `test` script; aim for critical paths: auth, contact CRUD, search, and Edge Function handlers |
| searchIntegrity.test.ts | — | Covers search/merge and deterministic behavior | Good; extend with more edge cases (empty query, very long query, special chars) |
| _shared/security.test.ts | — | CORS and security helpers | Good; add tests for rate limit and sanitizeString edge cases |
| parse-search-query/auth.test.ts | — | Auth behavior | Good |
| Edge Functions | Missing tests | No tests for bulk-insert validation, contact-share token expiry, help-email sanitization, stripe webhook signature | Add Deno or integration tests for validation and auth paths |

---

## 6. OUTPUT FORMAT — ISSUES BY CATEGORY

Each issue above is already given with:

- **Location** (file/line/route)
- **Issue Type** (security, performance, code quality, etc.)
- **Impact**
- **Recommendation**

Below is a concise recap and the requested summary.

---

## 7. SUMMARY

### Top 5 Critical Issues to Fix Immediately

1. **Hardcoded Supabase credentials** (`add-test-contacts-browser.js`)  
   - **Risk:** Exposed publishable key and project URL in repo.  
   - **Action:** Remove all hardcoded URL/key; use only `import.meta.env` or `window.supabase`; add warning in comments if script is dev-only.

2. **CORS wildcard on sensitive Edge Functions**  
   - **Risk:** Any origin can call bulk-insert, parse-contact-pdf, ocr-google-vision, slack/teams, etc., increasing CSRF/abuse surface.  
   - **Action:** Replace `Access-Control-Allow-Origin: *` with `getCorsHeaders(origin)` from `_shared/security.ts` in all functions that currently use a static corsHeaders object.

3. **bulk-insert-contacts: no per-contact validation**  
   - **Risk:** Stored XSS, oversized or malformed data, or DB errors from invalid email/phone.  
   - **Action:** Add validation/sanitization (e.g. Zod + sanitizeString, max lengths, isValidEmail/isValidPhone) for each contact before insert/merge.

4. **Stripe webhook error message**  
   - **Risk:** Signature verification failure may leak internal error message to Stripe.  
   - **Action:** Return a generic “Webhook verification failed” and log the real error server-side only.

5. **Duplicate-check scope and performance in bulk-insert-contacts**  
   - **Risk:** .or(owner_id, company_id, is_shared.eq.true) can pull a very large set; 5000-contact cap and per-merge updates can be slow.  
   - **Action:** Narrow duplicate check to user + company scope; consider RPC returning only id/email/phone; batch or reduce merge round-trips where possible.

### Overall Risk Score: **6.5 / 10**

- **Rationale:** Strong baseline (auth on most endpoints, RLS, shared security helpers, Stripe signature verification, rate limiting) is offset by: hardcoded credentials in one script, CORS wildcards on several functions, missing input validation on bulk-insert, and limited test coverage. No evidence of SQL injection or raw eval; XSS surface is limited and mostly mitigated where seen.

### Immediate Actions

**Code**

- Remove or fix hardcoded credentials in `add-test-contacts-browser.js`.
- Replace CORS `*` with `getCorsHeaders(origin)` in all Edge Functions that still use static corsHeaders.
- Add contact-level validation/sanitization in bulk-insert-contacts.
- Sanitize Stripe webhook error response and keep detailed errors in logs only.
- Use `_shared/security.ts` for launch mode in bulk-insert-contacts; extract shared formatting/validation for parse-contact-pdf, scan-business-card to reduce duplication.

**Routes / API**

- Document which endpoints are unauthenticated by design (contact-share, waitlist, ocr-fallback, llm-proxy) and ensure they have appropriate rate limits and input limits.
- Add explicit request body/size limits and document them for parse-contact-pdf, scan-business-card, and parse-search-query.
- Consider adding Cache-Control for llm-proxy responses where appropriate.

**Testing & Dependencies**

- Run `npm audit` and apply fixes; add `audit` (and optionally `audit:fix`) scripts.
- Add vitest (or current test runner) config and `test` script; add tests for contact validation, auth flows, and critical Edge Function branches.
- Add tests for rate limit and sanitization edge cases in _shared/security.

---

*End of audit. All findings are from a fresh review of the codebase and are not based on previous audit results.*
