# Full Codebase Audit — 19 Feb 2025

**Scope:** Stateless, full-codebase audit. No prior analysis relied upon. All findings validated with direct code references.

---

## PHASE 1 — FULL INVENTORY

### 1.1 Project structure

- **Root:** Vite + React + TypeScript SPA; Supabase backend (Edge Functions + Postgres).
- **Source directories:**
  - `src/` — App UI: `components/`, `pages/`, `hooks/`, `utils/`, `config/`, `data/`, `types/`, `lib/`, `integrations/supabase/`
  - `supabase/functions/` — Edge Functions (Deno)
  - `supabase/functions/_shared/` — Shared security, Stripe, contact formatting
  - `supabase/migrations/` — SQL migrations (46 files)
  - `src-tauri/` — Tauri desktop app
  - `scripts/`, `public/`, `docs/`

### 1.2 API routes / endpoints

All are **Supabase Edge Functions**; base path: `https://<project>.supabase.co/functions/v1/<name>`.

| # | Function name           | HTTP method(s) | File location                              |
|---|-------------------------|----------------|--------------------------------------------|
| 1 | bulk-insert-contacts    | POST           | `supabase/functions/bulk-insert-contacts/index.ts` |
| 2 | teams-integration       | GET, POST      | `supabase/functions/teams-integration/index.ts` |
| 3 | slack-integration       | GET, POST      | `supabase/functions/slack-integration/index.ts` |
| 4 | generate-test-contacts  | POST           | `supabase/functions/generate-test-contacts/index.ts` |
| 5 | scan-business-card     | POST           | `supabase/functions/scan-business-card/index.ts` |
| 6 | scan-business-card-ai   | POST           | `supabase/functions/scan-business-card-ai/index.ts` |
| 7 | ocr-google-vision      | POST           | `supabase/functions/ocr-google-vision/index.ts` |
| 8 | ocr-fallback           | POST           | `supabase/functions/ocr-fallback/index.ts` |
| 9 | parse-contact-pdf      | POST           | `supabase/functions/parse-contact-pdf/index.ts` |
|10 | stripe-webhook         | POST           | `supabase/functions/stripe-webhook/index.ts` |
|11 | contact-share          | GET            | `supabase/functions/contact-share/index.ts` |
|12 | parse-search-query     | POST (handler) | `supabase/functions/parse-search-query/index.ts` |
|13 | create-checkout        | POST           | `supabase/functions/create-checkout/index.ts` |
|14 | waitlist               | POST           | `supabase/functions/waitlist/index.ts` |
|15 | check-subscription     | GET/POST       | `supabase/functions/check-subscription/index.ts` |
|17 | customer-portal        | GET/POST       | `supabase/functions/customer-portal/index.ts` |
|18 | help-email             | POST           | `supabase/functions/help-email/index.ts` |
|19 | llm-proxy              | GET            | `supabase/functions/llm-proxy/index.ts` |

### 1.3 Middleware

- **Client:** React Router in `src/App.tsx`. Route-level guards:
  - `ProtectedRoute` — requires `useAuth()` user; else redirect to `/auth` (native) or `/`
  - `WaitlistRouteGuard` — in waitlist mode restricts to public paths only
  - `AuthRouteInWaitlistMode` — `/auth` in waitlist for email verification/password reset
- **Edge Functions:** No framework middleware. Each function implements:
  - CORS: `handleCorsPreflightRequest`, `getCorsHeaders` from `_shared/security.ts`
  - Launch mode: `checkLaunchMode()` / `waitlistModeBlockedResponse` where applicable
  - Auth: per-handler (JWT, webhook signature, or none)

### 1.4 Services / utilities

- **Shared (Edge):** `_shared/security.ts` (CORS, sanitize, rate limit, launch mode), `_shared/contactFormatting.ts`, `_shared/stripeConfig.ts`, `_shared/appUrl.ts`
- **Client:** `integrations/supabase/client.ts` (Supabase client), `utils/` (search, OCR, AI, contact parsing, formatting, sanitize, etc.), `lib/devLog.ts`, `lib/utils.ts`

### 1.5 Database models (from migrations)

- **Tables (representative):** `contacts`, `folders`, `profiles`, `companies`, `user_roles`, `subscriptions`, `integrations`, `integration_logs`, `waitlist`, `contact_share_tokens`, `audit_logs`, `company_keywords`, `employee_access_keys`, `avatars` storage, etc.
- **RPCs:** `list_contacts_slim`, `smart_search_contacts`, etc. (see migrations under `supabase/migrations/`).

### 1.6 Config files

- `vite.config.ts`, `package.json`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`, `eslint.config.js`, `vitest.config.ts`
- `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`
- `src/config/features.ts`, `src/config/onboardingSteps.ts`

### 1.7 Environment variable usages

- **Client (Vite):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_APP_LAUNCH_MODE`, `VITE_APP_URL`, `VITE_GITHUB_REPO`, `VITE_DOWNLOAD_URL_*`, `VITE_ENABLE_AI`, `VITE_ENABLE_SEMANTIC_*`, `VITE_AI_DEBUG_MODE`, `VITE_AI_TIMEOUT_MS`, `VITE_LLM_MODEL`, `VITE_EMBEDDING_MODEL`, `VITE_MODEL_STORAGE_URL`, `VITE_GOOGLE_CLIENT_ID`, `TAURI_*`
- **Edge:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_ORIGINS`, `APP_LAUNCH_MODE`, `APP_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_*`, `GOOGLE_CLOUD_VISION_API_KEY`, `OCR_SPACE_API_KEY`, `OCR_SERVICE_URL`, `MICROSOFT_*`, `SLACK_*`, `INTEGRATION_TEST_ORIGINS`, `INTEGRATION_SKIP_WAITLIST`, `ALLOW_GENERATE_TEST_CONTACTS`, `RESEND_*`, `HUGGINGFACE_API_TOKEN` (llm-proxy standalone)

### 1.8 External integrations

- Supabase (Auth, DB, Storage, Edge)
- Stripe (payments, webhooks, customer portal)
- Slack (OAuth, users list, post message)
- Microsoft Graph / Teams (OAuth, teams, channels, members, post message, meetings)
- Google Cloud Vision (OCR)
- OCR.space (fallback OCR)
- Resend (help/support email)
- Hugging Face CDN (llm-proxy; model files)

### 1.9 Route map (method, path, file, middleware, auth)

| Method | Path (logical) | File (handler) | Middleware / behavior | Auth |
|--------|----------------|----------------|------------------------|------|
| POST | `/functions/v1/bulk-insert-contacts` | `bulk-insert-contacts/index.ts` | CORS, launch mode | JWT required |
| GET/POST | `/functions/v1/teams-integration` | `teams-integration/index.ts` | CORS, launch mode (skip for OAuth/test) | JWT for API; none for OAuth callback |
| GET/POST | `/functions/v1/slack-integration` | `slack-integration/index.ts` | CORS, launch mode (skip for OAuth/test) | JWT for API; none for OAuth callback |
| POST | `/functions/v1/generate-test-contacts` | `generate-test-contacts/index.ts` | CORS, launch mode | JWT + `ALLOW_GENERATE_TEST_CONTACTS=true` |
| POST | `/functions/v1/scan-business-card` | `scan-business-card/index.ts` | CORS, launch mode | JWT required |
| POST | `/functions/v1/scan-business-card-ai` | `scan-business-card-ai/index.ts` | CORS, launch mode | JWT required |
| POST | `/functions/v1/ocr-google-vision` | `ocr-google-vision/index.ts` | CORS, launch mode | JWT required |
| POST | `/functions/v1/ocr-fallback` | `ocr-fallback/index.ts` | CORS, launch mode | **None** |
| POST | `/functions/v1/parse-contact-pdf` | `parse-contact-pdf/index.ts` | CORS, launch mode | JWT required |
| POST | `/functions/v1/stripe-webhook` | `stripe-webhook/index.ts` | None (no CORS) | Stripe signature |
| GET | `/functions/v1/contact-share` | `contact-share/index.ts` | CORS, rate limit | Token in query (share token) |
| POST | `/functions/v1/parse-search-query` | `parse-search-query/index.ts` | CORS, launch mode | JWT required |
| POST | `/functions/v1/create-checkout` | `create-checkout/index.ts` | CORS | JWT required |
| POST | `/functions/v1/waitlist` | `waitlist/index.ts` | CORS, rate limit (IP) | None |
| GET/POST | `/functions/v1/check-subscription` | `check-subscription/index.ts` | CORS | JWT required |
| GET/POST | `/functions/v1/customer-portal` | `customer-portal/index.ts` | CORS | JWT required |
| POST | `/functions/v1/help-email` | `help-email/index.ts` | CORS, rate limit (user) | JWT required |
| GET | `/functions/v1/llm-proxy` | `llm-proxy/index.ts` | CORS | **None** |

**Client-side routes (React Router):** `/`, `/waitlist`, `/privacy`, `/terms`, `/import-contact`, `/export-shared-contact`, `/auth`, `/app`, `/help/faq`, `*` (NotFound). Protection: `ProtectedRoute` for `/app`, `/help/faq`; `WaitlistRouteGuard` in waitlist mode.

---

## PHASE 2 — CODE QUALITY & ARCHITECTURE

### 2.1 SOLID & architecture

- **God files:** `scan-business-card/index.ts` (~2303 lines), `parse-contact-pdf/index.ts` (~2023 lines), `src/utils/searchQueryParser.ts` (~2843 lines), `src/pages/Index.tsx` (~1205 lines), `src/components/SettingsDialog.tsx` (~1485 lines). Single-file responsibility is stretched; parsing and UI are mixed with large inline logic.
- **Business logic in “controllers”:** Edge handlers contain parsing, validation, and DB logic in one place; no clear service layer. Acceptable for small functions; less so for 2k+ line handlers.
- **Duplication:** `useSlackIntegration` and `useTeamsIntegration` repeat similar patterns (env URL/key, refresh session, fetch with `Authorization`/`jwt`/`apikey`). Same for multiple Edge Functions repeating JWT check + CORS + launch mode.
- **Dependency direction:** Client → Supabase and Edge; Edge → _shared. No circular dependency observed at module level.

### 2.2 Code smells

- **Long methods / large files:** See line counts above; `searchQueryParser.ts` and the two largest Edge Functions exceed 500 lines by a large margin.
- **Duplication:** JWT validation and CORS/preflight repeated in every function; integration hooks duplicate fetch/header logic.
- **Magic numbers:** Present in many places (e.g. `MAX_CONTACTS = 2000`, `MAX_FILE_SIZE`, batch sizes). Some centralized (e.g. `_shared/security` max lengths), others inline.
- **Commented-out / dead code:** Not fully scanned; `diagnose-signup.js` and `add-2000-test-contacts.js` in root are operational scripts (not dead).
- **Naming:** Generally clear; “parse-contact-pdf” vs “parse-search-query” is consistent.

### 2.3 Maintainability

- **Test coverage:** `vitest.config.ts` and tests under `src/utils/__tests__/`, `supabase/functions/parse-search-query/auth.test.ts`, `supabase/functions/_shared/security.test.ts`. Many Edge Functions and hooks have no tests.
- **Documentation:** README and docs in `docs/`; inline comments vary; no central API doc for Edge Functions.
- **Inconsistent patterns:** Some functions return `{ error: string }`, others `{ success: false, error }`; error response shapes differ.

---

## PHASE 3 — API & ROUTE SECURITY AUDIT

Per-route summary:

| Route | Auth required? | Role/ownership | Input validated? | Input sanitized? | Rate limit? | CSRF | Sensitive data returned? | Status codes |
|-------|----------------|-----------------|------------------|------------------|------------|------|---------------------------|--------------|
| bulk-insert-contacts | Yes (JWT) | Ownership via JWT | Yes (body shape, batch size) | Yes (`sanitizeString`, etc.) | No | N/A | No | 401, 400, 500 |
| teams-integration | Yes for API; no for OAuth | User/org | Varies | Yes (sanitizeString) | No | State param | Possible (error details) | 400, 401, etc. |
| slack-integration | Yes for API; no for OAuth | User/org | Varies | Yes | No | State param | Possible (error details) | 302, 401, etc. |
| generate-test-contacts | Yes + env flag | User | Body (count, etc.) | N/A | No | N/A | No | 401, 403, 500 |
| scan-business-card | Yes | User | Yes (body) | Partial | No | N/A | No | 400, 401, 500 |
| scan-business-card-ai | Yes | User | Yes | Partial | No | N/A | Error details to client | 400, 401, 500 |
| ocr-google-vision | Yes | User | Yes (imageBase64) | No | No | N/A | **Yes (API errorText)** | 400, 401, 500 |
| ocr-fallback | **No** | N/A | Yes (imageBase64) | No | No | N/A | **Yes (errorText)** | 400, 500 |
| parse-contact-pdf | Yes | User | Yes (size limits) | Partial | No | N/A | No | 400, 401, 500 |
| stripe-webhook | Signature | N/A | N/A | N/A | No | N/A | No | 400, 405, 500 |
| contact-share | Token (query) | Token | Token, format | Filename sanitized | Yes (IP) | N/A | Contact payload (by design) | 400, 404, 410, 429 |
| parse-search-query | Yes | User | Yes (query/contacts cap) | Query sliced 500 | No | N/A | No | 400, 401, 500 |
| create-checkout | Yes | User | Yes (tier) | No | No | N/A | No | 500 |
| waitlist | No | N/A | Yes (email) | Trimmed/lowercase | Yes (IP) | N/A | No | 400, 500 |
| check-subscription | Yes | User | N/A | N/A | No | N/A | product_id, tier, etc. | 500 |
| customer-portal | Yes | User | N/A | N/A | No | N/A | No | 400, 500 |
| help-email | Yes | User | Yes (body size, type) | Yes (sanitizeString) | Yes (user) | N/A | No | 401, 400, 429, 500 |
| llm-proxy | **No** | N/A | Model/file allowlist | Path/model validated | No | N/A | No (model files) | 400, 405, 413, 500 |

**Flags:**

- **Public write routes:** `waitlist` (intended).
- **No auth:** `ocr-fallback`, `llm-proxy` (read-only proxy).
- **Debug/test:** `generate-test-contacts` gated by `ALLOW_GENERATE_TEST_CONTACTS`; ensure not enabled in prod.
- **Sensitive/error detail:** `ocr-google-vision`, `ocr-fallback` return upstream `errorText`; `teams-integration`/`slack-integration` return `details: authError?.message` or API error messages; `llm-proxy` returns `details: errorMessage` on 500.
- **Internal IDs:** Contact and folder UUIDs are used in client/API; acceptable for ownership checks behind RLS/JWT.

---

## PHASE 4 — SECURITY REVIEW (OWASP-ALIGNED)

Findings below are tied to specific code references.

---

### Issue AUDIT-001 (obsolete)

- **Status:** Resolved by removal. The `parse-contact-input` Edge Function has been removed from the codebase; the app uses client-side parsing (`contactTextParser.ts`) instead.

---

### Issue AUDIT-002

- **Location:** `supabase/functions/ocr-fallback/index.ts` (lines 20–28, 56–66)
- **Type:** Security
- **Severity:** Medium
- **Impact:** No authentication; anyone can send base64 images and consume OCR.space quota. Error responses expose upstream `errorText` to client.
- **Evidence:** No auth check; response includes `details: errorText` (lines 61–65).
- **Exploitation scenario:** Attacker POSTs many requests to burn API quota; or triggers API errors and sees internal messages in `details`.
- **Recommendation:** Require JWT (align with ocr-google-vision and scan-business-card-ai). Return generic “OCR service error” in client response; log `errorText` server-side only.

---

### Issue AUDIT-003

- **Location:** `supabase/functions/ocr-google-vision/index.ts` (lines 84–94)
- **Type:** Security
- **Severity:** Low
- **Impact:** Google Vision API error body is returned to client in `details`, potentially exposing API structure or messages.
- **Evidence:** `details: errorText` in JSON response (line 92).
- **Exploitation scenario:** Client receives Vision API error text; information disclosure.
- **Recommendation:** Return generic message (e.g. “OCR service error”); log full `errorText` server-side.

---

### Issue AUDIT-004

- **Location:** `supabase/functions/teams-integration/index.ts` (e.g. 221, 401, 449, 519, 739, 815, 905)
- **Type:** Security
- **Severity:** Low
- **Impact:** API and auth error messages are returned in `error` or `details`, which can leak internal or third-party info.
- **Evidence:** `details: authError?.message`, `error: teamsData.error.message`, etc.
- **Exploitation scenario:** Attacker triggers errors and infers auth or Graph API behavior from messages.
- **Recommendation:** Log full errors server-side; return generic user-facing messages (e.g. “Authorization failed”, “Request failed”).

---

### Issue AUDIT-005

- **Location:** `supabase/functions/slack-integration/index.ts` (e.g. 190, 212)
- **Type:** Security
- **Severity:** Low
- **Impact:** Request body parse errors and auth errors returned with `details: String(e)` or `details: authError?.message`.
- **Evidence:** Lines 190, 212.
- **Exploitation scenario:** Similar to AUDIT-004; information disclosure via error messages.
- **Recommendation:** Same as AUDIT-004; generic client messages, detailed logs server-side.

---

### Issue AUDIT-006

- **Location:** `supabase/functions/llm-proxy/index.ts` (lines 262–270)
- **Type:** Security
- **Severity:** Low
- **Impact:** Unauthenticated GET proxy for model files; 500 responses include `details: errorMessage` (server/exception text).
- **Evidence:** No auth; catch block returns `details: errorMessage`.
- **Exploitation scenario:** Abuse bandwidth or trigger errors to see server-side error text.
- **Recommendation:** Consider rate limiting by IP; return generic “Failed to fetch model file” without `details` in production.

---

### Issue AUDIT-007

- **Location:** `supabase/functions/waitlist/index.ts` (lines 112–121)
- **Type:** Security
- **Severity:** Low
- **Impact:** On insert failure, full `insertError` (message, code, details, hint) is logged but only generic “Failed to register email” returned to client. No direct client leak; logs may contain DB hints.
- **Evidence:** Response is generic (line 117); console.error includes insertError.details/hint.
- **Exploitation scenario:** If logs are exposed, DB structure/hints could be inferred.
- **Recommendation:** Keep client response generic; ensure logs are access-controlled; avoid logging full row data or PII.

---

### Issue AUDIT-008 (obsolete)

- **Status:** Resolved by removal. The `parse-contact-input` Edge Function has been removed; no longer applicable.

---

### Issue AUDIT-009

- **Location:** `src/components/ui/chart.tsx` (lines 9–12, 79–99)
- **Type:** Security (XSS)
- **Severity:** Low
- **Impact:** `dangerouslySetInnerHTML` is used for chart CSS; IDs and colors are sanitized (`sanitizeChartId`, `sanitizeCssColor`). Risk is low if only app-controlled config is passed.
- **Evidence:** sanitizeChartId restricts to `[a-zA-Z0-9-_]`; sanitizeCssColor allows only safe color formats.
- **Exploitation scenario:** If config were ever user-controlled, unsanitized values could lead to XSS; currently config is from app code.
- **Recommendation:** Keep config source trusted; consider a small CSP for style if needed; document that chart config must not be user-supplied.

---

### Issue AUDIT-010

- **Location:** `supabase/functions/create-checkout/index.ts` (line 66), `supabase/functions/customer-portal/index.ts` (line 57)
- **Type:** Code Quality
- **Severity:** Low
- **Impact:** Variable shadowing: `const origin = getStripeRedirectOrigin(req)` reuses name `origin` already used for request header. CORS headers still use the first `origin`; redirect URL correctly uses redirect origin. Logic is correct but confusing.
- **Evidence:** create-checkout line 66; customer-portal line 57.
- **Recommendation:** Rename to e.g. `redirectOrigin` to avoid shadowing and clarify intent.

---

### Issue AUDIT-011

- **Location:** Multiple Edge Functions
- **Type:** Security
- **Severity:** Low
- **Impact:** In-memory rate limiting in `_shared/security.ts` resets on cold starts; multi-instance deployments do not share state.
- **Evidence:** `security.ts` lines 192–223, comment on lines 186–189.
- **Exploitation scenario:** Distributed or sustained traffic can exceed intended rate limits.
- **Recommendation:** For production, use a shared store (e.g. Redis/Upstash or Supabase) for rate limit state.

---

### Issue AUDIT-012

- **Location:** `src/integrations/supabase/client.ts` (lines 98–101)
- **Type:** Security
- **Severity:** Low
- **Impact:** On misconfiguration, client logs URL/key preview and key length; in shared environments this could aid reconnaissance.
- **Evidence:** `safePreview(RAW_SUPABASE_URL, 32)`, key preview and length in console.error.
- **Recommendation:** In production builds, avoid logging key length or URL; or gate detailed logs to development only.

---

**Not found / verified as mitigated:**

- **SQL/NoSQL injection:** Queries use Supabase client (parameterized); no raw SQL or string interpolation in query building observed in scanned code.
- **Hardcoded secrets:** None; credentials from env.
- **CSRF:** Edge Functions are called with fetch + CORS; state used in OAuth flows. No form-based CSRF audit for SPA; Supabase anon key is public by design; mutations require JWT or webhook signature where applicable.
- **Overly permissive CORS:** `getCorsHeaders` uses an allowlist and reflects only allowed or localhost origins; no wildcard `*` in production when `ALLOWED_ORIGINS` is set.
- **Unsafe file uploads:** PDF/image data is size-limited and processed server-side; no direct file system write from client input observed.
- **Deserialization:** JSON only; no unsafe deserialization of untrusted formats.

---

## PHASE 5 — PERFORMANCE & SCALABILITY

- **N+1:** Possible in places where contacts or related data are fetched in loops; e.g. bulk-insert merges and lookups. Not fully traced; recommend profiling on bulk operations.
- **Missing DB indexes:** Migrations add indexes for contacts list, search, keyset (e.g. `20260125000001_contacts_search.sql`, `20260128000000_contacts_list_covering_indexes.sql`, `20260128000003_search_responsibility_index.sql`). Full index audit not done; assume indexes exist for hot paths.
- **Blocking/sync:** Edge handlers are async; client uses React Query and async hooks. No obvious synchronous blocking in critical path.
- **Heavy endpoints:** `parse-contact-pdf` and `scan-business-card` handle large payloads (PDF/base64, image); size limits exist (e.g. MAX_PDF_BASE64, MAX_EXTRACTED_TEXT). Severity: Medium for large documents.
- **Large payloads:** `parse-search-query` accepts up to 2000 contacts in body; could be large. Severity: Low–Medium.
- **Pagination:** Contacts list uses RPC and keyset/cursor patterns (migrations); client pagination present. No finding of missing pagination on main list.
- **Caching:** llm-proxy sets long cache headers for model files; no caching for contact or subscription APIs (acceptable for freshness).
- **Inefficient loops/transformations:** Large single-file parsers (e.g. searchQueryParser, scan-business-card) may have hot loops; no measurement. Severity: Low without profiling.

---

## PHASE 6 — DEPENDENCY AUDIT

- **Production dependencies (from package.json):** React 18, Supabase JS, TanStack Query, Radix UI set, Tauri plugins, Recharts, Zod, date-fns, cmdk, lucide-react, onnxruntime-web, tesseract.js, etc. (see package.json).
- **npm audit:** Multiple high/moderate findings in **dev** dependency tree (e.g. eslint, typescript-eslint, minimatch, ajv, @vitest/mocker, esbuild). These are tooling; not runtime. No production runtime CVEs explicitly listed in the truncated audit output.
- **Outdated packages:** Audit suggests upgrades (e.g. eslint 10, typescript-eslint 8.x) — may be semver-major.
- **Unnecessary/duplicate:** Not analyzed in depth; no obvious duplicates.
- **Large dependencies:** onnxruntime-web, tesseract.js, recharts, and Tauri stack can affect bundle size; consider lazy loading where already in use.

---

## PHASE 7 — VALIDATION PASS

- Findings AUDIT-001 through AUDIT-012 were re-checked against the cited files; all are supported by the referenced code.
- Speculative items (e.g. “possible N+1”) are stated as such and not listed as confirmed issues.
- RLS: Permissive “public” policies on `contacts` and `folders` were dropped in later migrations (e.g. 20251220201301); current state uses role/ownership-based policies.

---

## ISSUE LIST (SUMMARY)

| ID | Location | Type | Severity | Impact |
|----|----------|------|----------|--------|
| AUDIT-001 | (obsolete) parse-contact-input removed | — | — | N/A |
| AUDIT-002 | ocr-fallback (no auth + error leak) | Security | Medium | Quota abuse, error detail leak |
| AUDIT-003 | ocr-google-vision (details: errorText) | Security | Low | API error disclosure |
| AUDIT-004 | teams-integration (error details) | Security | Low | Error message disclosure |
| AUDIT-005 | slack-integration (error details) | Security | Low | Error message disclosure |
| AUDIT-006 | llm-proxy (no auth + 500 details) | Security | Low | Abuse, error leak |
| AUDIT-007 | waitlist (log content) | Security | Low | Log exposure risk |
| AUDIT-008 | (obsolete) parse-contact-input removed | — | — | N/A |
| AUDIT-009 | chart.tsx dangerouslySetInnerHTML | Security | Low | XSS if config untrusted |
| AUDIT-010 | create-checkout, customer-portal (shadowing) | Code Quality | Low | Confusing naming |
| AUDIT-011 | security.ts rate limit (in-memory) | Security | Low | Ineffective at scale |
| AUDIT-012 | client.ts (config logging) | Security | Low | Config reconnaissance |

**Code quality / architecture (no single “issue” ID):** God files and long methods (scan-business-card, parse-contact-pdf, searchQueryParser, Index.tsx, SettingsDialog); duplicated JWT/CORS and integration fetch logic; test coverage gaps; inconsistent error response shapes.

---

## EXECUTIVE SUMMARY

- **Total issues found:** 12 (all with code-backed evidence); 2 obsolete (AUDIT-001, AUDIT-008 — parse-contact-input removed).
- **Critical:** 0  
- **High:** 0  
- **Medium:** 1 (AUDIT-002)  
- **Low:** 9 (AUDIT-003–007, AUDIT-009–012)

**Top 5 fixes (immediate):**

1. **AUDIT-002:** Add JWT to `ocr-fallback` and stop returning upstream `errorText` in client response.
2. **AUDIT-003:** Stop returning Google Vision `errorText` in client response in `ocr-google-vision`.
3. **AUDIT-004 / AUDIT-005:** Replace raw `authError?.message` and third-party error messages with generic user-facing messages in Teams and Slack integration handlers.
4. **AUDIT-006:** Harden `llm-proxy` (auth or rate limit; generic 500 details).
5. **AUDIT-007:** Restrict or sanitize waitlist log content.

**Overall risk score: 4/10**

- No critical/high vulnerabilities; DB access is behind RLS and JWT/service role; Stripe webhook is signature-verified; most writes are authenticated. Risk is raised by unauthenticated or weakly protected endpoints (ocr-fallback, llm-proxy), error detail leakage, and logging. Score reflects “moderate” exposure and good baseline (RLS, CORS, sanitization in critical paths) but need for targeted hardening.

**Recommended action plan**

- **Immediate (this week):**  
  - Add JWT to `ocr-fallback`; remove or generalize error details in `ocr-google-vision`, `ocr-fallback`, and integration handlers.

- **Short-term (this sprint):**  
  - Harden error responses (generic messages, no stack/details to client) across all Edge Functions; fix variable shadowing in create-checkout and customer-portal; review and limit client-side config logging; document that chart config must remain app-controlled.

- **Long-term (refactor roadmap):**  
  - Split god files (scan-business-card, parse-contact-pdf, searchQueryParser) into smaller modules; extract shared “auth + CORS + launch mode” middleware for Edge Functions; add shared rate limiting with persistent store; increase test coverage for Edge Functions and hooks; standardize API error response shape.

---

*End of audit. All findings are tied to the codebase state as of the audit date.*
