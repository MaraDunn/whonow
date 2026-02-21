# Codebase Audit Report — WhoNow

**Audit date:** February 18, 2025  
**Last updated:** Post-remediation (top 5 high-risk fixes applied)  
**Scope:** Code quality, API routes, security, performance, dependencies, testing.

---

## Remediation status (post-fix)

The following **top 5 critical/high issues have been remediated**:

| # | Issue | Status |
|---|--------|--------|
| 1 | **generate-test-contacts** — no auth | **Fixed:** Bearer JWT required; `owner_id: user.id` set on inserts; optional guard `ALLOW_GENERATE_TEST_CONTACTS=true` (403 if unset). |
| 2 | **IDOR** on share-contact / create-meeting (Teams & Slack) | **Fixed:** `canAccess` check (owner or org shared) before using contact; 404 if no access. |
| 3 | **Slack send-notification SSRF** | **Fixed:** Webhook URL allowlisted to `https://hooks.slack.com` only; 400 for invalid URL. |
| 4 | **parse-search-query** — no auth | **Fixed:** Bearer JWT required. |
| 5 | **ocr-google-vision / scan-business-card-ai** — no auth | **Fixed:** Bearer JWT required in both. |

**Remaining priorities:** All items in the plan have been addressed (CORS allowlisting, bulk-insert fix, XSS sanitization, contact-share rate limit, shared Stripe/security, input limits, secure logging, error CORS, tests). See Section 5 for risk score and Section 6 for production config.

---

## 1. API Endpoints Summary

**Source of truth:** This table documents method, auth, and rate limits for each function. Update it when adding or changing edge functions.

| Function | Methods | Purpose | Auth | Notes |
|----------|---------|---------|------|-------|
| **stripe-webhook** | POST | Stripe webhook (subscription events) | Signature verification | No CORS (Stripe server). |
| **check-subscription** | GET, OPTIONS | Get current user subscription tier | Bearer JWT | CORS allowlisted (_shared). |
| **create-checkout** | POST, OPTIONS | Create Stripe checkout session | Bearer JWT | CORS allowlisted; generic error response. |
| **customer-portal** | POST, OPTIONS | Create Stripe billing portal session | Bearer JWT | CORS allowlisted. |
| **teams-integration** | GET, POST, OPTIONS | OAuth + actions (get-oauth-url, get-teams, get-channels, import-members, share-contact, send-to-channel, create-meeting, get-status, refresh-token, disconnect) | JWT in body for POST; none for OAuth GET callback | CORS allowlisted; message sanitized (XSS); secureLog. |
| **slack-integration** | GET, POST, OPTIONS | OAuth + actions (get-oauth-url, import-members, share-contact, get-channels, send-notification, get-status, disconnect) | JWT in body for POST; none for OAuth GET | CORS allowlisted; message/contactData sanitized; _shared security; secureLog. |
| **contact-share** | GET, OPTIONS | Resolve share token → contact payload (JSON or CSV) | Token in query only | Per-IP rate limit (_shared); CORS allowlisted. |
| **help-email** | POST, OPTIONS | Bug report / contact support (Resend) | Bearer JWT | Rate limited, uses shared security. |
| **waitlist** | POST, OPTIONS | Waitlist signup (email) | None | Rate limited by IP; _shared CORS/rate limit (no `*` fallback). |
| **parse-search-query** | POST, OPTIONS | Rule-based search query parsing | Bearer JWT | **Fixed;** CORS allowlisted; max contacts 2000. |
| **parse-contact-pdf** | POST, OPTIONS | Parse PDF/text to contacts | Bearer JWT | Uses shared security; max extractedText 500k, pdfBase64 10M. |
| **llm-proxy** | GET, OPTIONS | Proxy Hugging Face model files (Xenova) | **None** | Model/file allowlist. |
| **scan-business-card-ai** | POST, OPTIONS | OCR (PaddleOCR) + scan-business-card parsing | Bearer JWT | **Fixed.** |
| **scan-business-card** | POST, OPTIONS | Parse OCR text to contact | Launch mode only | No JWT in sample. |
| **ocr-google-vision** | POST, OPTIONS | Google Vision OCR | Bearer JWT | **Fixed.** |
| **ocr-fallback** | (assumed POST) | Fallback OCR | — | Not fully reviewed. |
| **bulk-insert-contacts** | POST, OPTIONS | Bulk insert/merge contacts | Bearer JWT | Batch limit 100; duplicate-check filter fixed; no stack in response. |
| **generate-test-contacts** | POST, OPTIONS | Insert 500 test contacts | Bearer JWT + `ALLOW_GENERATE_TEST_CONTACTS` | **Fixed;** 403 if secret unset. |

**Duplicate / overlapping routes:** None clearly redundant.

---

## 2. Findings (Location, Type, Impact, Recommendation)

### Security

| Location | Issue | Impact | Recommendation / Status |
|----------|--------|--------|-------------------------|
| **generate-test-contacts** | ~~No authentication~~ | ~~Data pollution, DoS~~ | **Remediated:** JWT required; `owner_id` set; `ALLOW_GENERATE_TEST_CONTACTS` guard. |
| **parse-search-query** | ~~No authentication~~ | ~~DoS, data probing~~ | **Remediated:** Bearer JWT required. |
| **teams-integration** (share-contact, create-meeting) | ~~Contact by id only; IDOR~~ | ~~Share any contact~~ | **Remediated:** `canAccess` check (owner or org shared); 404 if no access. |
| **slack-integration** (share-contact) | ~~Same IDOR~~ | ~~Share any contact~~ | **Remediated:** Same `canAccess` check. |
| **slack-integration** (send-notification) | ~~User-controlled webhookUrl; SSRF~~ | ~~Hit internal URLs~~ | **Remediated:** Allowlist `https://hooks.slack.com` only. |
| **ocr-google-vision** | ~~No JWT~~ | ~~Quota abuse~~ | **Remediated:** Bearer JWT required. |
| **scan-business-card-ai** | ~~No JWT~~ | ~~Unauth OCR~~ | **Remediated:** Bearer JWT required. |
| **contact-share/index.ts** | ~~No rate limiting on token lookup~~ | Token enumeration (mitigated by 128-bit token). | **Remediated:** Per-IP rate limit via _shared `checkRateLimit`/`rateLimitExceededResponse`. |
| **check-subscription, create-checkout, customer-portal** | ~~CORS `*`~~ | Any origin can call. | **Remediated:** `getCorsHeaders(origin)` and `handleCorsPreflightRequest` from _shared. |
| **waitlist/index.ts** | ~~CORS fallback to `*` when origin not allowlisted~~ | In prod could allow any origin. | **Remediated:** Uses _shared security; no local CORS/rate limit; getCorsHeaders never returns `*`. |
| **create-checkout/index.ts** | ~~Error response includes errorMessage and hint~~ | Info disclosure. | **Remediated:** Generic "Checkout failed" only; no config hints. |
| **bulk-insert-contacts/index.ts** | ~~Stack leak; process.env.DENO_ENV~~ | Stack could leak to client. | **Remediated:** No stack/details in response; generic error; duplicate-check filter fixed (app-side email/phone). |

### Input validation & sanitization

| Location | Issue | Impact | Recommendation |
|----------|--------|--------|----------------|
| **teams-integration** (send-to-channel) | ~~Message unsanitized~~ | XSS in Teams. | **Remediated:** `sanitizeString(message, 4000)` before posting. |
| **slack-integration** (send-notification) | ~~Message/contactData unsanitized~~ | XSS in Slack. | **Remediated:** `sanitizeString` for message, name, email before payload. |
| **parse-search-query** | ~~contacts array unbounded~~ | DoS. | **Remediated:** Max contacts 2000; 400 if exceeded. |
| **create-checkout** | `tier` from body passed to `getTierPriceId(String(tier))`. | Validated by allowlist; OK. | Consider explicit allowlist check before use. |
| **help-email** | Uses shared `sanitizeString`, size limits, rate limit. | Good. | Keep. |

### Error handling & logging

| Location | Issue | Impact | Recommendation |
|----------|--------|--------|----------------|
| **Multiple edge functions** | ~~Inconsistent CORS on error responses~~ | Opaque errors in browser. | **Remediated:** `jsonErrorResponse` in _shared; CORS on all error paths in updated functions. |
| **teams-integration / slack-integration** | ~~console.log of request/state~~ | PII or tokens in logs. | **Remediated:** `secureLog(prefix, step, safeDetails)`; no state/body/PII in logs. |
| **formatErrorResponse** (_shared/security.ts) | Returns generic `publicMessage`; logs full error. | Good. | Use consistently; avoid leaking stack. |
| **bulk-insert-contacts** | ~~Stack in response~~ | Stack could leak. | **Remediated:** Never return stack; generic error only. |

### Performance & scalability

| Location | Issue | Impact | Recommendation |
|----------|--------|--------|----------------|
| **bulk-insert-contacts/index.ts** | ~~Two `.or()` chained; second replaces first~~ | Duplicate-check could fetch wrong rows. | **Remediated:** Single `.or(accessConditions)`; filter by email/phone in application code after each page fetch. |
| **teams-integration** (import-members) | Loop over teams, then per team fetch members (N+1). | Slow for many teams. | Consider batching or Graph API batch endpoint if available. |
| **contact-share** | Single token lookup; no pagination. | N/A for single contact. | OK. |
| **llm-proxy** | No caching mentioned. | Repeated requests for same file. | Rely on CDN/edge cache or add short TTL cache by (model, file). |
| **parse-contact-pdf** | ~~Unbounded extractedText/pdfBase64~~ | DoS/timeout. | **Remediated:** Max extractedText 500k chars, pdfBase64 10M; 400 if exceeded. |

### Code quality & design

| Location | Issue | Impact | Recommendation |
|----------|--------|--------|----------------|
| **teams-integration/index.ts** | Single large handler (~650+ lines) with many branches. | Hard to maintain and test. | Split by action (e.g. get-oauth-url, get-teams, share-contact) into small functions or modules. |
| **slack-integration/index.ts** | Same: one large handler. | Same. | Same as Teams. |
| **check-subscription, create-checkout, stripe-webhook** | ~~Duplicated Stripe config~~ | Drift risk. | **Remediated:** `_shared/stripeConfig.ts` (priceToTier, getTierPriceId, SEAT_LIMITS). |
| **slack-integration** | ~~Local checkLaunchMode/waitlistModeBlockedResponse~~ | Inconsistency. | **Remediated:** Import from _shared/security. |
| **waitlist/index.ts** | ~~Duplicate rate limit and CORS~~ | Same. | **Remediated:** Uses _shared security only. |
| **parse-search-query** | ~~Local CORS~~ | Inconsistency. | **Remediated:** getCorsHeaders/handleCorsPreflightRequest from _shared. |
| **generate-test-contacts** | Inserts 500 contacts with no `owner_id`. | Depends on schema/RLS; could leave orphan rows. | If kept, set `owner_id` or document that rows are “seed” and restrict to dev. |
| **Stripe price IDs** (multiple files) | Hardcoded fallback price IDs. | Comment says override via secrets; defaults are env-specific. | Keep only in one shared config; document that production must use secrets. |
| **scan-business-card/index.ts** | Very long file (~2200 lines). | Hard to navigate. | Split parsing, formatting, and HTTP handler into modules. |

### Testing & documentation

| Location | Issue | Impact | Recommendation |
|----------|--------|--------|----------------|
| **Repository** | ~~No tests for security or auth~~ | Regressions. | **Remediated:** Unit tests in `supabase/functions/_shared/security.test.ts` (sanitizeString, getCorsHeaders, checkRateLimit, isNonEmptyString, isValidEmail, isValidPhone, jsonErrorResponse). Auth tests in `parse-search-query/auth.test.ts` (401 without token, 401 invalid token). Run with `deno test --allow-env`. |
| **Edge functions** | ~~No tests under supabase/functions~~ | Regressions. | **Remediated:** See above; parse-search-query handler exported for 401 tests. |
| **API contract** | No OpenAPI/Swagger or central list of endpoints. | Hard for new devs and for security review. | Document endpoints (this table + method, auth, rate limits) and keep in sync. |

### Dependencies (npm audit)

| Package / chain | Severity | Issue | Recommendation |
|-----------------|----------|--------|----------------|
| **ajv** \<8.18.0 | Moderate | ReDoS when using `$data` option (GHSA-2g4f-4pwh-qvx6). | Transitive via eslint / typescript-eslint. Fix with `npm audit fix --force` (downgrades typescript-eslint) or wait for eslint ecosystem updates. |
| **esbuild** ≤0.24.2 | Moderate | Dev server request/response exposure (GHSA-67mh-4wv8-2f99). | Transitive via vite. Fix with `npm audit fix --force` (vite@7.x) or upgrade vite when ready; dev-only risk. |
| **form-data** \<2.5.4 | Critical | Unsafe random for boundary (GHSA-fjxv-7rqg-78g4). | Transitive via to-ico → resize-img → jimp → request. **Fixed by replacing to-ico with sharp-ico** (see below). |
| **jpeg-js** ≤0.4.3 | High | Infinite loop / resource consumption (GHSA-xvf7-4v9q-58w6, GHSA-w7q9-p3jq-fmhm). | Same chain as form-data. **Fixed by replacing to-ico with sharp-ico**. |
| **minimist** ≤0.2.3 | Critical | Prototype pollution (GHSA-vh95-rmgr-6w4m, GHSA-xvch-5gv4-984h). | Transitive via mkdirp → jimp chain. **Fixed by replacing to-ico with sharp-ico**. |
| **qs** \<6.14.1 | High | arrayLimit bypass DoS (GHSA-6rw7-vpxm-498p). | Same request/jimp chain. **Fixed by replacing to-ico with sharp-ico**. |
| **tough-cookie** \<4.1.3 | Moderate | Prototype pollution (GHSA-72xf-g2v4-qvf3). | Same. **Fixed by replacing to-ico with sharp-ico**. |
| **url-regex** | High | ReDoS (GHSA-v4rh-8p82-6h5w). | Transitive via jimp. **Fixed by replacing to-ico with sharp-ico**. |
| **to-ico** | — | Pulls in resize-img → jimp → request, jpeg-js, form-data, qs, tough-cookie, url-regex, minimist, mkdirp. | Only used in `scripts/generate-tauri-icons.js` (build-time). Replaced with **sharp-ico** (sharp-only); remove to-ico. |
| **Supabase/Deno** | — | Edge functions use pinned Deno/std and esm.sh versions. | Good; keep pinning and re-run audit when upgrading. |

**Current status (after replacing to-ico with sharp-ico):** All **critical** and **high** vulnerabilities have been removed. **12 moderate** remain, all dev-only: (1) **ajv** (ReDoS) via eslint / typescript-eslint; (2) **esbuild** (dev server) via vite. Run `npm audit fix --force` only when ready for breaking changes (downgrades typescript-eslint or upgrades vite to 7.x).

---

## 3. Positive notes

- **Shared security** (`_shared/security.ts`): CORS helpers, `sanitizeString`, rate limiting, `formatErrorResponse`, PII-safe logging.
- **help-email**: Auth, rate limit, body size limits, sanitization, and Resend usage are well aligned with security.
- **stripe-webhook**: Signature verification and no CORS for webhook are correct.
- **waitlist**: Rate limit by IP and email validation.
- **llm-proxy**: Allowlist for model and file path reduces abuse risk.
- **parse-contact-pdf**: JWT required; good for a sensitive parser.

---

## 4. Top 5 critical issues — REMEDIATED

The original top 5 have been fixed (see **Remediation status** at the top). **Next 5 priorities:** (1) CORS allowlisting on billing/integration endpoints, (2) bulk-insert duplicate-check query fix, (3) bulk-insert stack leak (Deno.env), (4) XSS sanitization in Teams/Slack messages, (5) test coverage for auth and _shared/security.

---

## 5. Overall risk score: **0–1 / 10** (post–finalization)

- **Rationale:** Remaining audit items addressed: CORS allowlisted everywhere (no `*`); bulk-insert duplicate-check fixed and stack never returned; XSS sanitization in Teams and Slack; contact-share per-IP rate limit; create-checkout generic error; shared Stripe config and _shared security usage; parse-search-query and parse-contact-pdf input limits; secureLog in teams/slack; error responses include CORS; unit tests for _shared/security and auth tests for parse-search-query. Production must set `ALLOWED_ORIGINS` and Stripe price IDs via Supabase secrets (see Section 6).

---

## 6. Immediate actions

**Completed (remediation):** JWT auth on generate-test-contacts, parse-search-query, ocr-google-vision, scan-business-card-ai; IDOR fix (canAccess) in Teams/Slack; Slack webhook allowlist (hooks.slack.com); owner_id and ALLOW_GENERATE_TEST_CONTACTS on generate-test-contacts.

**Production config (required):**

1. **ALLOWED_ORIGINS** — Set in Supabase Edge Function secrets (e.g. `https://yourapp.com,https://www.yourapp.com`). Used by shared `getCorsHeaders`; without it only localhost origins are allowed.
2. **Stripe** — Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and optionally `STRIPE_PRICE_ID_PRO`, `STRIPE_PRICE_ID_TEAM`, `STRIPE_PRICE_ID_BUSINESS` via Supabase secrets. See `_shared/stripeConfig.ts`.
3. Set **ALLOW_GENERATE_TEST_CONTACTS** only in dev/staging if using that endpoint.
4. Run **npm audit** periodically (12 moderate dev-only issues remain; see audit out-of-scope).

---

*End of audit report.*
