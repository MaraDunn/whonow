# Full Codebase Audit — Stateless (2025-02-20)

**Scope:** Entire whonow codebase. No prior analysis or memory used; all findings are evidence-based from direct code references.

---

## PHASE 1 — FULL INVENTORY (No Judgement)

### 1.1 Project structure

| Area | Path | Notes |
|------|------|--------|
| Frontend source | `src/` | React + Vite + TypeScript |
| Pages | `src/pages/` | Index, Auth, Waitlist, Privacy, Terms, NotFound, ImportContactPage, ExportSharedContactPage, HelpFAQPage |
| Components | `src/components/`, `src/components/landing/`, `src/components/ui/` | UI and feature components |
| Hooks | `src/hooks/` | useAuth, useContacts, useProfile, useSubscription, useSlackIntegration, useTeamsIntegration, etc. |
| Utils | `src/utils/` | searchQueryParser, contactSearchEngine, contactTextParser, ai/, semanticAssist/, etc. |
| Integrations | `src/integrations/supabase/` | client.ts, types.ts |
| Config | `src/config/` | features.ts |
| Types | `src/types/` | contact, subscription |
| Data | `src/data/` | responsibilityAliases |
| Lib | `src/lib/` | devLog, passwordValidation, utils |
| Edge functions | `supabase/functions/` | 17 functions (see route map) |
| Shared (functions) | `supabase/functions/_shared/` | security.ts, stripeConfig.ts, appUrl.ts, contactFormatting.ts, oauthState.ts |
| Migrations | `supabase/migrations/` | 46 SQL files |
| Tauri | `src-tauri/` | Desktop app config and source |
| Scripts | `scripts/` | generate-latest-json.js, download-models.js, set-version-from-tag.js, etc. |
| Config root | `vite.config.ts`, `eslint.config.js`, `netlify.toml`, `vitest.config.ts` | Build and deploy |

### 1.2 API routes / endpoints (Supabase Edge Functions)

All are invoked as `POST` or `GET` to `https://<project>.supabase.co/functions/v1/<function-name>` unless noted.

| # | Function | HTTP | Path (logical) | File | Gateway JWT | Auth in function | Rate limit | Input validation |
|---|----------|------|----------------|------|--------------|------------------|-----------|------------------|
| 1 | waitlist | POST | /functions/v1/waitlist | supabase/functions/waitlist/index.ts | No | None (public write) | IP: 10/60s | Email required, format validated |
| 2 | stripe-webhook | POST | /functions/v1/stripe-webhook | supabase/functions/stripe-webhook/index.ts | No | Stripe signature | N/A | Signature + body verified |
| 3 | contact-share | GET | /functions/v1/contact-share?token=&format= | supabase/functions/contact-share/index.ts | No | None (token-based) | IP: 60/60s | token required |
| 4 | parse-search-query | POST | /functions/v1/parse-search-query | supabase/functions/parse-search-query/index.ts | No | Bearer JWT | No | query string + contacts array (cap 2000) |
| 5 | check-subscription | POST | /functions/v1/check-subscription | supabase/functions/check-subscription/index.ts | No | Bearer JWT | No | None (read-only) |
| 6 | create-checkout | POST | /functions/v1/create-checkout | supabase/functions/create-checkout/index.ts | No | Bearer JWT | No | tier (validated via getTierPriceId) |
| 7 | customer-portal | POST | /functions/v1/customer-portal | supabase/functions/customer-portal/index.ts | No | Bearer JWT | No | None |
| 8 | bulk-insert-contacts | POST | /functions/v1/bulk-insert-contacts | supabase/functions/bulk-insert-contacts/index.ts | Yes | Bearer JWT | No | contacts array, sanitizeContactForInsert |
| 9 | generate-test-contacts | POST | /functions/v1/generate-test-contacts | supabase/functions/generate-test-contacts/index.ts | Yes | Bearer JWT + ALLOW_GENERATE_TEST_CONTACTS | No | None |
| 10 | slack-integration | GET/POST | /functions/v1/slack-integration | supabase/functions/slack-integration/index.ts | No | JWT for API; OAuth callback no JWT | No | action, state/code on callback |
| 11 | teams-integration | GET/POST | /functions/v1/teams-integration | supabase/functions/teams-integration/index.ts | No | Same as Slack | No | Same pattern |
| 12 | scan-business-card | POST | /functions/v1/scan-business-card | supabase/functions/scan-business-card/index.ts | No | Bearer JWT | 20/min per user | OCR text/structured input |
| 13 | scan-business-card-ai | POST | /functions/v1/scan-business-card-ai | supabase/functions/scan-business-card-ai/index.ts | No | Bearer JWT | 20/min per user | image base64 |
| 14 | ocr-google-vision | POST | /functions/v1/ocr-google-vision | supabase/functions/ocr-google-vision/index.ts | No | Bearer JWT | 20/min per user | imageBase64, size cap |
| 15 | ocr-fallback | POST | /functions/v1/ocr-fallback | supabase/functions/ocr-fallback/index.ts | No | Bearer JWT | 20/min per user | imageBase64, size cap |
| 16 | parse-contact-pdf | POST | /functions/v1/parse-contact-pdf | supabase/functions/parse-contact-pdf/index.ts | No | Bearer JWT | 20/min per user | text/extracted content |
| 17 | help-email | POST | /functions/v1/help-email | supabase/functions/help-email/index.ts | No | Bearer JWT | 5/hour per user | type, body, optional attachment |

### 1.3 Frontend route map (React Router)

| Path | Component | Guard | Auth required |
|------|-----------|--------|----------------|
| / | Waitlist (waitlist mode) or DesktopAppRootRedirect → Landing /app | WaitlistRouteGuard | No (redirect to /app on native) |
| /waitlist | Waitlist | WaitlistRouteGuard | No |
| /privacy | Privacy | — | No |
| /terms | Terms | — | No |
| /import-contact | ImportContactPage | — | No |
| /export-shared-contact | ExportSharedContactPage | — | No |
| /auth | Auth | — | No |
| /app | Index | ProtectedRoute | Yes |
| /help/faq | HelpFAQPage | ProtectedRoute | Yes |
| * | NotFound or Navigate to / | — | — |

**Middleware / guards:**  
- `ProtectedRoute`: uses `useAuth()`; redirects to `/auth` (native) or `/` (web) if no user.  
- `WaitlistRouteGuard`: in waitlist mode, only allows public paths above; else no-op.  
- No server-side middleware; Supabase gateway `verify_jwt` per function (see config.toml).

### 1.4 Middleware

- **Client:** React Router only; no Express/Node middleware.  
- **Supabase:** No custom middleware; Edge Functions use shared `_shared/security.ts` (CORS, rate limit helpers, sanitization, error formatting).  
- **Auth:** Enforced inside each function via `Authorization: Bearer` + `supabase.auth.getUser(token)` where required; gateway `verify_jwt` is disabled for several functions so they can return custom 401 or handle webhooks/callbacks.

### 1.5 Services / utilities

- **Frontend:** `src/utils/` (searchQueryParser, contactSearchEngine, contactTextParser, duplicateDetection, pdfContactParser, ai/, semanticAssist/), `src/lib/devLog.ts`, `src/lib/passwordValidation.ts`, `src/utils/launchMode.ts`, `src/utils/helpEmail.ts`, `src/utils/downloadLinks.ts`, `src/utils/errorLogBuffer.ts`.  
- **Edge:** `supabase/functions/_shared/security.ts` (CORS, sanitizeString, isValidEmail, isValidPhone, checkRateLimit, waitlistModeBlockedResponse, etc.), `_shared/stripeConfig.ts`, `_shared/appUrl.ts`, `_shared/contactFormatting.ts`, `_shared/oauthState.ts`.

### 1.6 Database models (from migrations)

- **Core:** profiles, companies, contacts, folders, contact_folders (junction), subscriptions, waitlist.  
- **Integrations:** integrations (OAuth tokens per provider/scope).  
- **Sharing:** contact_share_tokens (token, contact_payload, expires_at).  
- **Storage:** avatars bucket.  
- **RLS:** Enabled on relevant tables; policies in migrations (e.g. 20260118000000_waitlist_enable_rls.sql, 20260128100000_contact_share_tokens.sql). contact_share_tokens has policy that denies all direct anon/user access (service role only).

### 1.7 Config files

- `vite.config.ts` — Vite, envPrefix VITE_/TAURI_, aliases, build.  
- `supabase/config.toml` — project_id, auth email template, per-function verify_jwt.  
- `eslint.config.js`, `vitest.config.ts`, `netlify.toml`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `package.json`.

### 1.8 Environment variable usages

**Client (import.meta.env):**  
VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_APP_LAUNCH_MODE, VITE_DEV_MODE, VITE_APP_URL, VITE_GITHUB_REPO, VITE_ENABLE_AI, VITE_ENABLE_SEMANTIC_PARSING, VITE_ENABLE_SEMANTIC_RANKING, VITE_AI_DEBUG_MODE, VITE_LLM_MODEL, VITE_EMBEDDING_MODEL, VITE_MODEL_STORAGE_URL, VITE_AI_TIMEOUT_MS, VITE_TAURI_PLATFORM, VITE_SUPABASE_*, VITE_ENABLE_LLM_PARSING.

**Edge (Deno.env.get):**  
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ALLOWED_ORIGINS, APP_LAUNCH_MODE, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID_*, APP_URL, OAUTH_STATE_SECRET, SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, SLACK_BOT_TOKEN, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID, GOOGLE_CLOUD_VISION_API_KEY, OCR_SPACE_API_KEY, OCR_SERVICE_URL, RESEND_API_KEY, RESEND_FROM_EMAIL, INTEGRATION_TEST_ORIGINS, INTEGRATION_SKIP_WAITLIST, ALLOW_GENERATE_TEST_CONTACTS.

### 1.9 External integrations

- **Supabase:** Auth, DB, Storage, Edge Functions.  
- **Stripe:** Checkout, Customer Portal, Webhooks (subscription lifecycle).  
- **Slack:** OAuth2, users.list, chat.postMessage, etc.  
- **Microsoft Graph (Teams):** OAuth2, /me, teams, members.  
- **Google Cloud Vision:** images:annotate (OCR).  
- **OCR.space:** parse/image (fallback OCR).  
- **Resend:** Email (help-email: bug_report, contact_support).  
- **Optional:** OCR_SERVICE_URL (scan-business-card-ai fallback).

---

## PHASE 2 — CODE QUALITY & ARCHITECTURE

### 2.1 SOLID & architecture

- **SRP:** Some edge functions do multiple things (e.g. slack-integration: OAuth, get-oauth-url, import-members, share-contact, etc.) in one handler; could be split by action.  
- **God files:**  
  - `supabase/functions/scan-business-card/index.ts` (~2300 lines) — extraction, validation, formatting, HTTP in one file.  
  - `supabase/functions/parse-contact-pdf/index.ts` (~2040 lines) — same pattern.  
  - `src/utils/searchQueryParser.ts` (~2722 lines) — large single module.  
- **Duplication:** `isValidEmail` duplicated in waitlist/index.ts and scan-business-card/index.ts; shared security has `isValidEmail` but waitlist/scan-business-card define their own.  
- **Dependency direction:** Largely correct (shared security used by functions; no circular imports observed).  
- **Business logic in “controllers”:** Edge handlers contain validation, rate limit, auth, and business logic together; no separate service layer.

### 2.2 Code smells

- **Long methods/files:** scan-business-card (~2300), parse-contact-pdf (~2040), searchQueryParser (~2722), ContactDetailsDialog (~1312), SettingsDialog (~1488), ContactCard (~1161), contactSearchEngine (~1934).  
- **Magic numbers:** Rate limits (10, 20, 60, 100, 2000, 5000, 60000, etc.) and MAX_* constants scattered; some centralized in _shared/security, others in each function.  
- **Dead/commented code:** Not fully inventoried; diagnose-signup.js, add-2000-test-contacts.js, add-200-test-contacts.js, check-contact-browser.js in root are scripts (some may be dev-only).  
- **Naming:** Generally clear; some abbreviations (e.g. `c`, `sc`) in small scopes.

### 2.3 Maintainability

- **Tests:** vitest; `supabase/functions/_shared/security.test.ts`, `supabase/functions/parse-search-query/auth.test.ts`, `src/utils/__tests__/searchIntegrity.test.ts`. Many areas (edge functions, hooks, pages) have no tests.  
- **Documentation:** Inline comments in security.ts and key functions; no central API doc.  
- **Patterns:** CORS and error responses consistent across functions; auth pattern repeated (get header → getUser); rate limiting inconsistent (some routes have it, parse-search-query and checkout/portal do not).

---

## PHASE 3 — API & ROUTE SECURITY AUDIT

Per-route summary:

| Route | Auth required | Authorization | Input validated | Input sanitized | Rate limit | CSRF | Sensitive data | Status codes |
|-------|----------------|---------------|-----------------|-----------------|------------|------|----------------|--------------|
| waitlist | No | N/A | Yes (email) | Trim, length | Yes (IP) | N/A | No | 200/400/405/500 |
| stripe-webhook | No (signature) | N/A | Signature + body | N/A | N/A | N/A | No | 200/400/405/500 |
| contact-share | No | Token = possession | token param | N/A | Yes (IP) | N/A | Contact payload by design | 200/400/404/410/429/500 |
| parse-search-query | Yes (JWT) | User identity | query + contacts cap | query slice 500 | No | N/A | Result includes contact names | 200/400/401/500 |
| check-subscription | Yes | User identity | N/A | N/A | No | N/A | tier, product_id (Stripe price ID) | 200/500 |
| create-checkout | Yes | User identity | tier → priceId | getTierPriceId | No | N/A | No | 200/500 |
| customer-portal | Yes | User identity | N/A | N/A | No | N/A | No | 200/400/500 |
| bulk-insert-contacts | Yes | User + profile company | contacts array | sanitizeContactForInsert | No | N/A | No | 200/400/401/500 |
| generate-test-contacts | Yes | User + env flag | N/A | N/A | No | N/A | No | 200/401/403/500 |
| slack-integration | Mixed | JWT or OAuth state | action, state/code | parseOAuthState | No | State signed | No | 200/302/400/403 |
| teams-integration | Mixed | Same | Same | Same | No | Same | No | Same |
| scan-business-card | Yes | User | Body | Validation helpers | Yes | N/A | No | 200/400/401/429/500 |
| scan-business-card-ai | Yes | User | image base64 | Size/content checks | Yes | N/A | No | 200/400/401/429/500 |
| ocr-google-vision | Yes | User | imageBase64 | Length cap | Yes | N/A | No | 200/400/401/413/429/500 |
| ocr-fallback | Yes | User | imageBase64 | Length cap | Yes | N/A | No | Same |
| parse-contact-pdf | Yes | User | Body | N/A (text) | Yes | N/A | No | 200/400/401/429/500 |
| help-email | Yes | User | type, body, attachment | sanitizeString, size | Yes (user) | N/A | No | 200/400/401/429/500/503 |

**Flags:**  
- **Public write:** waitlist (intentional).  
- **Duplicate routes:** None; each function name is unique.  
- **Debug/test routes:** generate-test-contacts is gated by ALLOW_GENERATE_TEST_CONTACTS and JWT; suitable for dev/staging only.  
- **Internal IDs:** contact-share returns contact payload (by design for shared link); check-subscription returns Stripe price ID (not secret).  
- **CSRF:** Edge functions are called with JSON or GET; OAuth callbacks use signed state. No classic form POST from browser to functions; Supabase anon key is public so CSRF is mitigated by Same-Origin + CORS and/or token in Authorization header for mutations.

---

## PHASE 4 — SECURITY REVIEW (OWASP-ALIGNED)

### 4.1 Injection

- **SQL:** Supabase client used with parameterized queries (e.g. .eq(), .insert()); no raw SQL concatenation found. **No SQL injection evidence.**  
- **NoSQL:** N/A (Postgres).  
- **Command:** No exec/spawn of user input.  
- **Evidence:** bulk-insert-contacts uses .or(accessConditions.join(',')) where accessConditions are `owner_id.eq.${user.id}` and `company_id.eq.${companyId}` — values are from authenticated user and profile, not user input; safe.

### 4.2 XSS

- **Chart:** `src/components/ui/chart.tsx` uses `dangerouslySetInnerHTML` for theme CSS; id and color are sanitized via `sanitizeChartId` and `sanitizeCssColor`; comment states config must be app-controlled. **Controlled risk if config is never user-supplied.**  
- **Help-email:** Body and errorLogs are sanitized and escaped in HTML (e.g. `errorLogs.replace(/</g, "&lt;")`).  
- **contact-share:** Returns JSON or CSV; CSV cells escaped (escapeCsvCell).  
- No other raw innerHTML/document.write found in scanned code.

### 4.3 CSRF

- Mutations use Authorization: Bearer (or Stripe signature / OAuth state). OAuth state is signed when OAUTH_STATE_SECRET is set (oauthState.ts). **CSRF risk low for API usage.**

### 4.4 Access control

- **contact-share:** No auth; access by token only. Token is UUID, expiry checked; table has RLS denying anon/user. **Acceptable for “share link” design.**  
- **bulk-insert-contacts:** Merge updates use existing contact id from a query scoped by `owner_id.eq.user.id` or `company_id.eq.companyId`; no IDOR.  
- **Stripe webhook:** Signature verification required; no user context.  
- **OAuth callbacks:** State verified (signed or legacy); userId from state, not from query.  
- **RLS:** contact_share_tokens and other tables use RLS; service role used in Edge Functions bypasses RLS by design.

### 4.5 Hardcoded secrets / env

- **stripeConfig.ts:** DEFAULT_PRICE_TO_TIER and DEFAULT_TIER_PRICES contain Stripe price IDs (e.g. price_1RifXq...). These are project-specific identifiers, not API keys; env overrides documented. **Low risk; prefer env-only in production.**  
- No API keys or passwords hardcoded in repo (grep for secret/password/token = "…" only found script comments).

### 4.6 CORS

- **security.ts:** ALLOWED_ORIGINS from env or DEFAULT_ORIGINS (localhost variants). Localhost/127.0.0.1 reflected when in allowlist or local. **Overly permissive if ALLOWED_ORIGINS unset in prod** (only localhost then); docs say to set ALLOWED_ORIGINS in production.

### 4.7 File upload / deserialization

- **help-email:** attachmentBase64 decoded, length capped (MAX_ATTACHMENT_BYTES 5MB); filename sanitized.  
- **scan-business-card-ai / ocr-*:** base64 image size capped. No unsafe deserialization of arbitrary objects.

### 4.8 Error disclosure

- **security.ts:** formatErrorResponse returns generic message to client; logs details server-side. Many functions return generic “An error occurred” or “Subscription check failed”.  
- **create-checkout/customer-portal:** Throw messages (e.g. “Invalid tier”) returned in 500 body — could be refined to avoid leaking validation details in production.

### 4.9 PII in logs

- **parse-search-query/index.ts:** `console.log('Deterministic search for:', sanitizedQuery)` and `console.log('Search result:', result)` — result includes `matchingContactNames` (contact names). **PII in logs.**

**Evidence:**  
```213:218:supabase/functions/parse-search-query/index.ts
    console.log('Deterministic search for:', sanitizedQuery);
    const result = parseSearchQuery(sanitizedQuery, contactsList);
    console.log('Search result:', result);
```

---

## PHASE 5 — PERFORMANCE & SCALABILITY

- **N+1:** bulk-insert-contacts fetches existing contacts in pages (1000 per page) then filters duplicates; merge loop does one update per duplicate. Acceptable for batch size 100; could be heavy if many users run large batches.  
- **Missing pagination:** contact-share returns one contact; list endpoints (e.g. useContacts) use range/pagination.  
- **Heavy endpoints:** scan-business-card, parse-contact-pdf, scan-business-card-ai, ocr-* are CPU/external-API heavy; rate limited per user.  
- **Large payloads:** parse-search-query accepts up to 2000 contacts in body; could use more bandwidth/memory.  
- **Rate limiting:** In-memory in security.ts; resets on cold start and not shared across instances. Comment in code recommends Redis/Upstash for production at scale.  
- **DB indexes:** Migrations add indexes (e.g. contacts_list, list_contacts_slim, contact_share_tokens token/expires_at). No missing-index audit performed.  
- **Severity:** N+1/merge in bulk-insert — Medium for large batches. In-memory rate limit — Medium at scale. PII logging — Low (operational risk).

---

## PHASE 6 — DEPENDENCY AUDIT

- **Production deps (package.json):** React 18, Supabase JS 2.89, TanStack Query 5.83, Tauri plugins, Recharts, Zod, date-fns, tesseract.js, onnxruntime-web, etc.  
- **npm audit:** Exit code 1 (vulnerabilities). High severity in transitive deps: @eslint/config-array, @eslint/eslintrc (minimatch, ajv), @typescript-eslint/* (typescript-estree). Fix available via eslint 10.0.1 and typescript-eslint 8.36.0 (major upgrades).  
- **Large deps:** onnxruntime-web, tesseract.js, recharts, canvas (dev) can affect bundle size and install time.  
- **Duplicate libs:** No obvious duplicate alternatives for same concern.

---

## PHASE 7 — VALIDATION PASS & ISSUES LIST

Findings below are limited to those with direct code evidence; speculative items omitted.

---

### Issue 1

- **Issue ID:** SEC-PII-LOGS-1  
- **Location:** `supabase/functions/parse-search-query/index.ts` (lines 213, 217)  
- **Type:** Security  
- **Severity:** Medium  
- **Impact:** Contact names (PII) and search query logged in plaintext; log aggregation or compromise could expose user data.  
- **Evidence:** `console.log('Deterministic search for:', sanitizedQuery);` and `console.log('Search result:', result);` where `result` includes `matchingContactNames`.  
- **Exploitation scenario:** Attacker with log access (or misconfigured logging) reads who searched for whom.  
- **Recommendation:** Remove or redact PII from logs; use secureLog(prefix, step, { count: result.matchingContactNames.length }) or similar.

---

### Issue 2

- **Issue ID:** SEC-CORS-1  
- **Location:** `supabase/functions/_shared/security.ts` (ALLOWED_ORIGINS)  
- **Type:** Security  
- **Severity:** Low  
- **Impact:** If ALLOWED_ORIGINS is unset in production, only DEFAULT_ORIGINS (localhost) are used; production site may get CORS errors. If set too broad, other origins could call functions with user’s credentials.  
- **Evidence:** `const ALLOWED_ORIGINS = Deno.env.get("ALLOWED_ORIGINS") ? Deno.env.get("ALLOWED_ORIGINS")!.split(",")... : DEFAULT_ORIGINS;`  
- **Recommendation:** Document required ALLOWED_ORIGINS for production; consider failing deploy or startup if in production and ALLOWED_ORIGINS unset.

---

### Issue 3

- **Issue ID:** SEC-STRIPE-CONFIG-1  
- **Location:** `supabase/functions/_shared/stripeConfig.ts` (DEFAULT_PRICE_TO_TIER, DEFAULT_TIER_PRICES)  
- **Type:** Security / Config  
- **Severity:** Low  
- **Impact:** Hardcoded Stripe price IDs used when env not set; wrong project could map to wrong tier if env missing.  
- **Evidence:** Lines 7–10, 30–34; price IDs like `price_1RifXqDXpGeDw1xnkNvKgEzI`.  
- **Recommendation:** In production, require STRIPE_PRICE_ID_* env vars and do not fall back to defaults; or keep defaults but document project binding.

---

### Issue 4

- **Issue ID:** PERF-RATELIMIT-1  
- **Location:** `supabase/functions/_shared/security.ts` (rateLimitStore Map)  
- **Type:** Performance / Scalability  
- **Severity:** Medium  
- **Impact:** In-memory rate limit resets on cold start and is not shared across instances; limits can be bypassed or inconsistent under load.  
- **Evidence:** Comment lines 186–189: “For production at scale, use a shared store (e.g. Redis…).”  
- **Recommendation:** Use a shared store (e.g. Upstash Redis) for rate limit state when scaling.

---

### Issue 5

- **Issue ID:** QUALITY-GOD-FILE-1  
- **Location:** `supabase/functions/scan-business-card/index.ts` (~2300 lines)  
- **Type:** Code Quality / Architecture  
- **Severity:** Low  
- **Impact:** Hard to maintain, test, and reason about; single file does HTTP, validation, extraction, formatting.  
- **Evidence:** Line count and single handler with many helpers.  
- **Recommendation:** Split into modules: extraction engine, validation, formatting, and a thin HTTP handler.

---

### Issue 6

- **Issue ID:** QUALITY-GOD-FILE-2  
- **Location:** `supabase/functions/parse-contact-pdf/index.ts` (~2040 lines)  
- **Type:** Code Quality / Architecture  
- **Severity:** Low  
- **Impact:** Same as Issue 5.  
- **Recommendation:** Same as Issue 5 (extract parsing, validation, formatting).

---

### Issue 7

- **Issue ID:** QUALITY-DUPLICATE-1  
- **Location:** `supabase/functions/waitlist/index.ts` (isValidEmail), `supabase/functions/scan-business-card/index.ts` (validateEmail)  
- **Type:** Code Quality  
- **Severity:** Low  
- **Impact:** Duplicate email validation logic; drift risk.  
- **Evidence:** waitlist lines 10–13; scan-business-card lines 68–72; _shared/security.ts has isValidEmail.  
- **Recommendation:** Use `isValidEmail` from `_shared/security.ts` in both; remove local copies.

---

### Issue 8

- **Issue ID:** DEP-VULN-1  
- **Location:** package.json / npm audit  
- **Type:** Dependency  
- **Severity:** High (in dev deps)  
- **Impact:** ESLint and typescript-eslint transitive deps have known vulnerabilities (minimatch, ajv, typescript-estree).  
- **Evidence:** npm audit reports high severity; fix available via major version bumps.  
- **Recommendation:** Plan upgrade to eslint 10.x and typescript-eslint 8.x; run tests and fix breaking changes.

---

### Issue 9

- **Issue ID:** API-RATE-1  
- **Location:** check-subscription, create-checkout, customer-portal, parse-search-query  
- **Type:** Security / Performance  
- **Severity:** Low  
- **Impact:** No rate limiting on these endpoints; abuse could increase load or cost (Stripe, DB).  
- **Evidence:** No checkRateLimit call in those handlers.  
- **Recommendation:** Add per-user or per-IP rate limits for subscription/checkout/portal and parse-search-query.

---

### Issue 10

- **Issue ID:** QUALITY-LARGE-FILE-1  
- **Location:** `src/utils/searchQueryParser.ts` (~2722 lines)  
- **Type:** Code Quality  
- **Severity:** Low  
- **Impact:** Large single module; harder to maintain and test.  
- **Evidence:** Line count from wc -l.  
- **Recommendation:** Split by domain (e.g. time parsing, filters, keyword handling) into smaller modules.

---

## EXECUTIVE SUMMARY

**Total issues found:** 10  

| Severity | Count |
|----------|--------|
| Critical | 0 |
| High | 1 (dependency vulnerabilities in dev tooling) |
| Medium | 2 (PII in logs, in-memory rate limit at scale) |
| Low | 7 |

**Top 5 fixes (immediate / short-term)**

1. **Remove or redact PII in parse-search-query logs** (SEC-PII-LOGS-1) — stop logging `result` and user search query in plaintext.  
2. **Address npm audit** — upgrade eslint and typescript-eslint to versions that fix high-severity transitive vulns (DEP-VULN-1).  
3. **Document and enforce CORS** — set ALLOWED_ORIGINS in production and optionally fail if unset (SEC-CORS-1).  
4. **Add rate limiting** to check-subscription, create-checkout, customer-portal, parse-search-query (API-RATE-1).  
5. **Plan shared rate limit store** for production (e.g. Redis) (PERF-RATELIMIT-1).

**Overall risk score: 4/10**

- **Justification:** No critical vulnerabilities found. Auth and authorization are applied on sensitive routes; Stripe webhook and OAuth use signature/state verification; input sanitization and validation exist on write paths. Main risks: PII in logs (contained if logs are protected), dev-dependency vulns (no direct RCE in production app), and rate limiting consistency at scale. Hardcoded Stripe price IDs and CORS are configuration hygiene.

**Recommended action plan**

- **Immediate (this week):** Fix PII logging in parse-search-query; run npm audit and apply safe dependency updates; confirm ALLOWED_ORIGINS in production.  
- **Short-term (this sprint):** Add rate limiting to subscription/checkout/portal and parse-search-query; deduplicate email validation (use shared isValidEmail); consider requiring Stripe price IDs from env in production.  
- **Long-term:** Refactor scan-business-card and parse-contact-pdf into smaller modules; introduce shared rate limit store for Edge Functions; split searchQueryParser; expand test coverage for critical paths and edge functions.

---

*Audit completed from a stateless, full-codebase pass with evidence-based findings only.*
