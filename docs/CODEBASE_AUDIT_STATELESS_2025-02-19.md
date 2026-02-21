# Full Codebase Audit (Stateless) — 2025-02-19

**Scope:** Entire whonow codebase. No reliance on prior audits or memory. All findings validated with direct code references.

---

## PHASE 1 — FULL INVENTORY (No Judgement)

### 1.1 Project structure

| Category | Path / Contents |
|----------|------------------|
| **Frontend source** | `src/` — React (Vite), TypeScript, React Router |
| **Pages** | `src/pages/` — Index, Auth, Waitlist, Privacy, Terms, NotFound, ImportContactPage, ExportSharedContactPage, HelpFAQPage, Landing |
| **Components** | `src/components/` — UI (shadcn), landing, dialogs, ContactCard, FolderSidebar, etc. |
| **Hooks** | `src/hooks/` — useAuth, useContacts, useSubscription, useTeamsIntegration, useSlackIntegration, useSmartSearch, useProfile, useFolders, etc. |
| **Utils** | `src/utils/` — ai/, semanticAssist/, contactSearchEngine, searchQueryParser, pdfContactParser, ocrMerger, contactEmbeddings, etc. |
| **Config / types** | `src/config/`, `src/types/`, `src/data/` |
| **Integrations** | `src/integrations/supabase/` — client, types |
| **Backend (API)** | `supabase/functions/` — 18 Edge Functions (Deno) |
| **Shared backend** | `supabase/functions/_shared/` — security.ts, contactFormatting.ts, stripeConfig.ts, appUrl.ts |
| **Database** | `supabase/migrations/` — 46 SQL migrations |
| **Desktop** | `src-tauri/` — Tauri 2 app (Rust) |
| **Scripts** | `scripts/` — download-models, set-version-from-tag, generate-latest-json, etc. |
| **Root config** | `package.json`, `vite.config.ts`, `vitest.config.ts`, `eslint.config.js`, `netlify.toml`, `.env.example` |
| **Supabase config** | `supabase/config.toml` |

### 1.2 API routes / endpoints

All are **Supabase Edge Functions**; base path: `https://<project>.supabase.co/functions/v1/<function-name>`.

| # | Function | HTTP | Path (logical) | File | Gateway verify_jwt | Auth in handler | Rate limit |
|---|----------|------|----------------|------|-------------------|-----------------|------------|
| 1 | check-subscription | POST | /functions/v1/check-subscription | supabase/functions/check-subscription/index.ts | false | Yes (Bearer) | No |
| 2 | customer-portal | POST | /functions/v1/customer-portal | supabase/functions/customer-portal/index.ts | false | Yes (Bearer) | No |
| 3 | create-checkout | POST | /functions/v1/create-checkout | supabase/functions/create-checkout/index.ts | false | Yes (Bearer) | No |
| 4 | waitlist | POST | /functions/v1/waitlist | supabase/functions/waitlist/index.ts | false | No | Yes (10/min by IP) |
| 5 | teams-integration | GET/POST | /functions/v1/teams-integration | supabase/functions/teams-integration/index.ts | false | GET: no (OAuth callback); POST: JWT in body | No |
| 6 | slack-integration | GET/POST | /functions/v1/slack-integration | supabase/functions/slack-integration/index.ts | false | GET: no (OAuth callback); POST: JWT in body | No |
| 7 | llm-proxy | GET | /functions/v1/llm-proxy | supabase/functions/llm-proxy/index.ts | false | No | Yes (120/min by IP) |
| 8 | ocr-google-vision | POST | /functions/v1/ocr-google-vision | supabase/functions/ocr-google-vision/index.ts | (not in config) | Yes (Bearer) | No |
| 9 | ocr-fallback | POST | /functions/v1/ocr-fallback | supabase/functions/ocr-fallback/index.ts | (not in config) | Yes (Bearer) | No |
| 10 | bulk-insert-contacts | POST | /functions/v1/bulk-insert-contacts | supabase/functions/bulk-insert-contacts/index.ts | true | Yes (Bearer) | No |
| 11 | generate-test-contacts | POST | /functions/v1/generate-test-contacts | supabase/functions/generate-test-contacts/index.ts | true | Yes (Bearer) + ALLOW_GENERATE_TEST_CONTACTS | No |
| 12 | scan-business-card | POST | /functions/v1/scan-business-card | supabase/functions/scan-business-card/index.ts | **false** | **No** | No |
| 13 | scan-business-card-ai | POST | /functions/v1/scan-business-card-ai | supabase/functions/scan-business-card-ai/index.ts | (not in config) | Yes (Bearer) | No |
| 14 | parse-contact-pdf | POST | /functions/v1/parse-contact-pdf | supabase/functions/parse-contact-pdf/index.ts | false | Yes (Bearer) | No |
| 15 | stripe-webhook | POST | /functions/v1/stripe-webhook | supabase/functions/stripe-webhook/index.ts | false | Signature (Stripe) | N/A |
| 16 | contact-share | GET | /functions/v1/contact-share | supabase/functions/contact-share/index.ts | false | No (token in query) | Yes (60/hour by IP) |
| 17 | parse-search-query | POST | /functions/v1/parse-search-query | supabase/functions/parse-search-query/index.ts | false | Yes (Bearer) | No |
| 18 | help-email | POST | /functions/v1/help-email | supabase/functions/help-email/index.ts | false | Yes (Bearer) | Yes (5/hour by userId) |

### 1.3 Middleware

- **Backend:** No framework middleware. Each Edge Function handles CORS via `_shared/security.ts`: `handleCorsPreflightRequest`, `getCorsHeaders`. Some use `checkLaunchMode`, `waitlistModeBlockedResponse`, and/or `checkRateLimit` from the same module.
- **Frontend:** Route-level guards only (no HTTP middleware):
  - `ProtectedRoute` (App.tsx): requires `useAuth().user`, else redirect to `/auth` or `/`.
  - `WaitlistRouteGuard`: in waitlist mode, only public routes allowed; else redirect to `/`.
  - `AuthRouteInWaitlistMode`: renders Auth at `/auth` in waitlist mode.
  - `DesktopAppRootRedirect`: redirects `/` to `/app` when in desktop app.

### 1.4 Services / utilities

| Area | Location | Purpose |
|------|----------|---------|
| Security (CORS, sanitization, rate limit) | supabase/functions/_shared/security.ts | getCorsHeaders, handleCorsPreflightRequest, sanitizeString, isValidEmail, isValidPhone, checkRateLimit, secureLog, formatErrorResponse, checkLaunchMode |
| Stripe | supabase/functions/_shared/stripeConfig.ts | priceToTier, getTierPriceId, SEAT_LIMITS |
| App URL | supabase/functions/_shared/appUrl.ts | getStripeRedirectOrigin, CANONICAL_APP_ORIGIN |
| Contact formatting | supabase/functions/_shared/contactFormatting.ts | Shared contact shape/formatting |
| Supabase client | src/integrations/supabase/client.ts | Browser Supabase client, env validation |
| Dev logging | src/lib/devLog.ts | DEV-only console logging |
| Launch mode | src/utils/launchMode.ts | VITE_APP_LAUNCH_MODE, isDesktopOrNativeApp, etc. |
| AI/config | src/utils/ai/aiConfig.ts, modelLoader.ts, aiLayer.ts | Model loading, feature flags from env |

### 1.5 Database models (from migrations)

- **profiles** — id (FK auth.users), company_id, email, full_name, role, avatar_url, is_visible_in_directory, etc.
- **companies** — id, name, invite_code, created_at, updated_at
- **user_roles** — user_id, role (app_role: admin, member)
- **contacts** — id, owner_id, company_id, is_shared, name, email, phone, company, role, description, tags, folder_id, address, city, state, zip_code, country, business_name, business_type, avatar, deleted_at, etc.
- **folders** — owner_id, company_id, etc.
- **subscriptions** — user_id, tier, stripe_customer_id, stripe_subscription_id, status, current_period_start/end, employee_seats_limit
- **waitlist** — email (unique)
- **integrations** — user_id, provider (teams/slack), access_token, refresh_token, scope, company_id, etc.
- **contact_share_tokens** — token, contact_payload (jsonb), expires_at
- **RLS:** Enabled on main tables; policies and SECURITY DEFINER functions (e.g. `has_role`, `get_user_company_id`) in migrations.

### 1.6 Config files

- `supabase/config.toml` — project_id, auth email template, per-function `verify_jwt`
- `vite.config.ts` — Vite + React, env (VITE_APP_LAUNCH_MODE, TAURI_PLATFORM)
- `vitest.config.ts` — Vitest
- `package.json` — deps, scripts
- `.env.example` — VITE_SUPABASE_*, VITE_ENABLE_AI, VITE_LLM_MODEL, VITE_APP_URL, VITE_GITHUB_REPO, etc.
- `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`
- `netlify.toml` — Netlify deploy
- `eslint.config.js` — ESLint

### 1.7 Environment variable usages

**Frontend (import.meta.env):**  
VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_APP_LAUNCH_MODE, VITE_APP_URL, VITE_DEV_MODE, VITE_ENABLE_AI, VITE_ENABLE_SEMANTIC_PARSING, VITE_ENABLE_SEMANTIC_RANKING, VITE_AI_DEBUG_MODE, VITE_LLM_MODEL, VITE_EMBEDDING_MODEL, VITE_MODEL_STORAGE_URL, VITE_AI_TIMEOUT_MS, VITE_LLM_MODEL, VITE_EMBEDDING_MODEL, VITE_GITHUB_REPO, VITE_DOWNLOAD_URL_*, VITE_TAURI_PLATFORM.

**Edge Functions (Deno.env.get):**  
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID_*, APP_URL, APP_LAUNCH_MODE, ALLOWED_ORIGINS, GOOGLE_CLOUD_VISION_API_KEY, OCR_SPACE_API_KEY, OCR_SERVICE_URL, RESEND_API_KEY, RESEND_FROM_EMAIL, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID, SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, INTEGRATION_TEST_ORIGINS, INTEGRATION_SKIP_WAITLIST, ALLOW_GENERATE_TEST_CONTACTS.

### 1.8 External integrations

- **Supabase** — Auth, DB, Storage, Edge Functions
- **Stripe** — Checkout, customer portal, webhooks (subscription lifecycle)
- **Slack** — OAuth, user/org import, share to Slack
- **Microsoft Graph (Teams)** — OAuth, teams/members, org import
- **Google Cloud Vision** — OCR (ocr-google-vision)
- **OCR.space** — OCR fallback (ocr-fallback)
- **Resend** — help-email (bug report, contact support)
- **Hugging Face CDN** — llm-proxy (model files)
- **External OCR service** — scan-business-card-ai (OCR_SERVICE_URL, e.g. PaddleOCR)

---

## PHASE 2 — CODE QUALITY & ARCHITECTURE

### 2.1 SOLID & architecture

- **SRP:** Several Edge Functions do multiple things (e.g. teams-integration: OAuth, import, share, disconnect). Parsing logic is embedded in scan-business-card and parse-contact-pdf instead of separate modules.
- **Coupling:** teams-integration and slack-integration duplicate large blocks of logic (OAuth flow, import-members, share, disconnect). Shared types and helpers exist but patterns are duplicated.
- **Business logic in “controllers”:** Heavy parsing and extraction logic lives inside serve() handlers (scan-business-card, parse-contact-pdf) rather than in pure functions in _shared or a dedicated package.
- **God files:** scan-business-card/index.ts ~2303 lines, parse-contact-pdf/index.ts ~2023 lines, teams-integration/index.ts ~1068, slack-integration/index.ts ~776, src/pages/Index.tsx ~1205, src/hooks/useContacts.ts ~1082. Single-file size and responsibility are excessive.
- **Circular dependencies:** Not verified exhaustively; no obvious cycles from the files read.

### 2.2 Code smells

- **Duplication:** isValidEmail reimplemented in waitlist/index.ts (security.ts already has it). OAuth + import/share logic largely duplicated between Teams and Slack.
- **Long methods:** parseBusinessCard and extraction passes in scan-business-card and parse-contact-pdf are very long (hundreds of lines).
- **Large files:** See God files above (>500 and >1000 lines).
- **Magic numbers:** Present in many places (e.g. MAX_CONTACTS = 2000, MAX_FILE_SIZE 100MB, rate limit 10/60_000). Some centralized (security.ts, bulk-insert), others ad hoc.
- **Dead/commented code:** Not fully inventoried; scripts like add-2000-test-contacts.js, add-200-test-contacts.js, check-contact-*.js exist and may be dev-only.
- **Naming:** Generally clear; some abbreviations (e.g. `c` for contact) in loops.

### 2.3 Maintainability

- **Test coverage:** Vitest present; `supabase/functions/_shared/security.test.ts`, `supabase/functions/parse-search-query/auth.test.ts`, `src/utils/__tests__/searchIntegrity.test.ts`. No evidence of broad route or integration tests for Edge Functions.
- **Documentation:** Inline comments and README-style docs exist; many Edge Functions lack a short “contract” (method, body, response, auth).
- **Inconsistent patterns:** Some functions use service-role + manual JWT check, others rely on gateway verify_jwt; CORS and error response format are consistent via _shared.

---

## PHASE 3 — API & ROUTE SECURITY AUDIT

Per-route summary (auth, authorization, input validation/sanitization, rate limit, CSRF, sensitive data, status codes).

- **check-subscription:** Auth required (Bearer). Ownership implied (user’s subscription). No body. No rate limit. No CSRF (API). Returns tier/subscription data. 200/500. **OK.**
- **customer-portal:** Auth required. No body. No rate limit. Returns portal URL. **OK.**
- **create-checkout:** Auth required. Body: `tier`; validated via getTierPriceId (pro/team/business only). No rate limit. Returns checkout URL. **OK.**
- **waitlist:** No auth. Body: `email`; validated and trimmed. Rate limited 10/min by IP. Public write; acceptable for waitlist. **OK.**
- **teams-integration:** GET OAuth callback: no auth; state (userId, origin, scope) from query — **state is client-controlled**, see Phase 4. POST: JWT in body; user and org scope checked; has_role / is_super_admin for admin actions. Inputs (action, scope, params) not fully schema-validated. **State tampering risk.**
- **slack-integration:** Same OAuth state pattern as Teams. POST: JWT in body; scope and admin checks. **State tampering risk.** Logs full request body on error (slack-integration/index.ts ~201).
- **llm-proxy:** No auth. GET; model and file validated (allowlist, path traversal checks). Rate limited 120/min by IP. No sensitive data in response (model files). **OK.**
- **ocr-google-vision:** Auth required. Body: `imageBase64`; **no size limit** (DoS risk). **Issue.**
- **ocr-fallback:** Auth required. Body: `imageBase64`; **no size limit**. **Issue.**
- **bulk-insert-contacts:** Auth required. Body: contacts array; sanitized and limited; company_id from profile. Ownership/company enforced in DB and duplicate check. **OK.**
- **generate-test-contacts:** Auth required; **ALLOW_GENERATE_TEST_CONTACTS=true** required. Not enabled by default. **OK.**
- **scan-business-card:** **verify_jwt = false and no auth check in handler.** Anyone can POST ocrText/structure and get parsed contact. **Public write/processing.** **Issue.**
- **scan-business-card-ai:** Auth required. Body: `image`; no hard size limit (external OCR). Error responses include **verbose details** (body preview, stack, OCR_SERVICE_URL). **Issue.**
- **parse-contact-pdf:** Auth required. Body: extractedText/pdfBase64; MAX_EXTRACTED_TEXT and MAX_PDF_BASE64 enforced. **OK.**
- **stripe-webhook:** No auth header; **Stripe signature verified**. No CORS. **OK.**
- **contact-share:** No auth; access by token in query. Token looked up; expiry checked. Rate limited. Returns contact payload (by design). **OK.**
- **parse-search-query:** Auth required. Body: query (trimmed/sliced 500), contacts (array, max 2000). **OK.**
- **help-email:** Auth required. Body sanitized; type validated; rate limited by userId. **OK.**

**Flags:**

- **Public write/processing:** waitlist (intended), **scan-business-card** (unintended — no auth).
- **Duplicate routes:** None.
- **Unused routes:** Unable to verify from code alone.
- **Debug/test:** generate-test-contacts is gated by env; no other debug routes found.
- **Internal IDs:** contact-share returns contact_payload (snapshot); if payload includes internal contact UUIDs, consider omitting for shared links.

---

## PHASE 4 — SECURITY REVIEW (OWASP-ALIGNED)

### Issue ID: SEC-001  
**Location:** supabase/functions/scan-business-card/index.ts (serve handler); supabase/config.toml [functions.scan-business-card] verify_jwt = false  
**Type:** Security  
**Severity:** High  
**Impact:** Unauthenticated callers can POST arbitrary OCR text/structure and receive parsed contact data. Abuse for free parsing, resource consumption, and possible PII leakage in logs.  
**Evidence:** config.toml sets verify_jwt = false. Handler (lines 2184–2290) has no Authorization check or getUser(); only waitlist and body validation.  
**Exploitation scenario:** Attacker sends POST /functions/v1/scan-business-card with { ocrText: "..." } and receives { success: true, contact: { ... } }.  
**Recommendation:** Require JWT (gateway verify_jwt = true or manual Bearer check and getUser()) for scan-business-card.

---

### Issue ID: SEC-002  
**Location:** supabase/functions/teams-integration/index.ts (OAuth callback, state parsing); supabase/functions/slack-integration/index.ts (OAuth callback, state parsing)  
**Type:** Security  
**Severity:** High  
**Impact:** OAuth state carries userId (and origin/scope). If an attacker tricks a victim into starting OAuth with state = { userId: attackerId, ... }, the victim’s OAuth token can be associated with the attacker’s account.  
**Evidence:** teams-integration lines 79–107: state from URL parsed as JSON, userId = String(stateObj.userId || ""); token then stored for that userId. slack-integration lines 92–98: stateParam parsed, userId = parsedState.userId. State is set server-side when generating the OAuth URL but is sent to the IdP and back in the URL; it is not signed or bound to a server-side session.  
**Exploitation scenario:** Attacker gets victim to open a link that redirects to Microsoft/Slack OAuth with state={"userId":"attacker-uuid",...}. Victim signs in; callback stores token for attacker.  
**Recommendation:** Bind state to the initiating session (e.g. server-side nonce/session id that maps to userId) or sign/encrypt state and verify on callback; do not trust userId from URL alone.

---

### Issue ID: SEC-003  
**Location:** supabase/functions/ocr-google-vision/index.ts (body handling); supabase/functions/ocr-fallback/index.ts (body handling)  
**Type:** Security (DoS / resource)  
**Severity:** Medium  
**Impact:** No limit on imageBase64 length. Very large payloads can cause memory/CPU pressure and cost (Google/OCR.space usage).  
**Evidence:** ocr-google-vision/index.ts lines 45–65: `const { imageBase64 } = await req.json();` then used directly. ocr-fallback/index.ts lines 49–69: same. No size check.  
**Exploitation scenario:** Attacker POSTs a 50MB base64 body repeatedly; function may OOM or hit provider limits.  
**Recommendation:** Enforce a maximum base64 length (e.g. 5–10MB decoded equivalent) and reject with 413 before calling external APIs.

---

### Issue ID: SEC-004  
**Location:** supabase/functions/scan-business-card-ai/index.ts (error responses and logging)  
**Type:** Security (information disclosure)  
**Severity:** Medium  
**Impact:** Error responses and logs expose request body previews, stack traces, and OCR_SERVICE_URL, aiding reconnaissance and debugging for attackers.  
**Evidence:** Lines 59–60, 88–89, 102–103, 117–118, 135–136, 143–144, 151–152, 259–264, 333–334, 375–376, 429–430, etc. — details/include help text with OCR_SERVICE_URL; stack in errorDetails.  
**Exploitation scenario:** Attacker triggers errors and reads response body or log output to learn internal URLs and implementation details.  
**Recommendation:** Return generic error messages to the client; log full details server-side only. Remove internal URLs and stack from client-facing messages.

---

### Issue ID: SEC-005  
**Location:** supabase/functions/slack-integration/index.ts line 201  
**Type:** Security (sensitive data in logs)  
**Severity:** Low  
**Impact:** On missing JWT, full request body is logged (JSON.stringify(body)), which may contain PII or tokens.  
**Evidence:** `console.error("[slack-integration] No JWT in request body. Full body:", JSON.stringify(body));`  
**Exploitation scenario:** Client accidentally sends user data in body; logs stored in Supabase or elsewhere expose it.  
**Recommendation:** Log only safe metadata (e.g. presence of keys, body length); never log full body.

---

### Issue ID: SEC-006  
**Location:** supabase/functions/scan-business-card/index.ts (multiple console.log with OCR text)  
**Type:** Security (PII in logs)  
**Severity:** Low  
**Impact:** Full OCR text and extracted emails/names are logged (e.g. lines 2260–2265, 855, 921, 957, 967, 1976, 2015, etc.). Logs may be retained and expose PII.  
**Evidence:** console.log(ocrText), console.log("Parsed contact:", { name, email, ... }), and similar.  
**Exploitation scenario:** Log aggregation or support access exposes business card content.  
**Recommendation:** Use secureLog-style logging (no PII); remove or redact OCR text and contact fields in production logs.

---

### Issue ID: SEC-007  
**Location:** src/components/ui/chart.tsx lines 94–109  
**Type:** Security (XSS)  
**Severity:** Low  
**Impact:** dangerouslySetInnerHTML is used for chart theme styles. If config ever came from user input, XSS would be possible.  
**Evidence:** sanitizeChartId and sanitizeCssColor restrict charset; comment states “do not pass user-supplied config.”  
**Exploitation scenario:** Only if app passes user-controlled config into ChartContainer — currently not observed.  
**Recommendation:** Keep config app-controlled only; consider a small CSP or tests that ensure chart config is never user-supplied.

---

### Other checks

- **Injection:** No raw SQL/NoSQL/command construction from user input; Supabase client used with parameterized patterns. No `.raw()` or `execute(sql)` found.
- **CSRF:** Edge Functions are called with fetch from the same-origin or CORS; Stripe webhook uses signature, not cookies. No cookie-based auth on API. CSRF risk for state-changing browser requests is low but CORS allowlist (ALLOWED_ORIGINS) should be strict in production.
- **Access control:** Subscription/checkout/portal use authenticated user; bulk-insert and integrations enforce owner/company; RLS on DB. contact-share is token-based by design.
- **Secrets:** No hardcoded secrets in repo; Stripe price IDs in stripeConfig are defaults, overridable by env.
- **CORS:** getCorsHeaders uses ALLOWED_ORIGINS or DEFAULT_ORIGINS (localhost). If ALLOWED_ORIGINS is unset in prod, only localhost is allowed — production frontend must set it.
- **File upload:** help-email accepts base64 attachment with MAX_ATTACHMENT_BYTES (5MB); filename sanitized. No path traversal or execution.
- **Deserialization:** JSON only; no unsafe deserialization of binary or untrusted formats.
- **Error detail:** scan-business-card-ai and some other functions return detailed messages; see SEC-004.

---

## PHASE 5 — PERFORMANCE & SCALABILITY

- **N+1:** bulk-insert-contacts fetches existing contacts in pages (1000) and caps duplicate check at 5000; acceptable. teams/slack import members in batches. No obvious N+1 in single-request flows.
- **Indexes:** Migrations add indexes (e.g. contacts deleted_at, list_contacts, search, contact_share_tokens token/expires_at). Full index review not done; list_contacts and search RPCs have dedicated migrations.
- **Blocking/sync:** Edge Functions are async; no deliberate blocking sync I/O found.
- **Heavy endpoints:** parse-contact-pdf and scan-business-card do large in-memory parsing; scan-business-card-ai calls external OCR then scan-business-card. Likely high latency and memory under load.
- **Large payloads:** parse-search-query accepts up to 2000 contacts in body; parse-contact-pdf has MAX_EXTRACTED_TEXT (500k) and MAX_PDF_BASE64 (10M). Reasonable caps but large payloads can still stress memory.
- **Pagination:** contact list and similar flows use range/limit; RPCs and hooks support pagination.
- **Caching:** llm-proxy sets Cache-Control for model files. No caching for contact or subscription data in functions.
- **Loops/transformations:** Large contact arrays (e.g. 2000) processed in parse-search-query and bulk-insert; acceptable with current caps.

**Severity:** Mostly Low–Medium (cost and latency under abuse or scale); no Critical performance bug identified from code alone.

---

## PHASE 6 — DEPENDENCY AUDIT

**Production dependencies (package.json):**  
@hookform/resolvers, @radix-ui/* (many), @supabase/supabase-js ^2.89.0, @tanstack/react-query ^5.83.0, @tanstack/react-virtual, @tauri-apps/api 2.9.1, @tauri-apps/plugin-*, class-variance-authority, clsx, cmdk, date-fns, embla-carousel-react, input-otp, lucide-react, next-themes, onnxruntime-web, react 18.3.1, react-day-picker, react-dom, react-hook-form, react-resizable-panels, react-router-dom, recharts, sonner, tailwind-merge, tailwindcss-animate, tesseract.js, vaul, zod.

**Flags:**

- **Outdated:** Not verified against latest versions; recommend `npm outdated` and review.
- **Known vulnerabilities:** Run `npm audit`; not run in this audit.
- **Unnecessary/duplicate:** Radix set is large but intentional (shadcn). No obvious duplicates.
- **Bundle size:** onnxruntime-web and tesseract.js are large; AI and OCR features can be lazy-loaded (partially done). recharts and Radix add to bundle.

Edge Functions use Deno imports (esm.sh, deno.land); versions pinned in URLs (e.g. stripe@18.5.0, @supabase/supabase-js@2.57.2). Different Supabase JS versions between functions and frontend (2.57.2 vs 2.89.0) may cause subtle differences.

---

## PHASE 7 — VALIDATION PASS

- SEC-001: Confirmed — scan-business-card has no auth in handler and verify_jwt = false.
- SEC-002: Confirmed — state parsed from URL and used as userId for storing OAuth token.
- SEC-003: Confirmed — no size check on imageBase64 in ocr-google-vision or ocr-fallback.
- SEC-004: Confirmed — detailed error messages and logs in scan-business-card-ai.
- SEC-005: Confirmed — full body logged in slack-integration on missing JWT.
- SEC-006: Confirmed — OCR text and contact fields logged in scan-business-card.
- SEC-007: Mitigated by current use; config is app-controlled and sanitized.

Speculative or unverified items were omitted or stated as “Unable to verify from code.”

---

## REQUIRED OUTPUT FORMAT — ISSUES SUMMARY

| Issue ID | Location | Type | Severity | Impact | Evidence | Recommendation |
|----------|----------|------|----------|--------|----------|----------------|
| SEC-001 | scan-business-card/index.ts, config.toml | Security | High | Unauthenticated parsing endpoint | verify_jwt=false, no getUser() in handler | Require JWT for scan-business-card |
| SEC-002 | teams-integration, slack-integration OAuth callback | Security | High | OAuth token bound to attacker if state tampered | state = JSON with userId from URL | Bind state to server session or sign state |
| SEC-003 | ocr-google-vision, ocr-fallback | Security | Medium | DoS / cost via large image payload | No size check on imageBase64 | Enforce max base64/image size (e.g. 5–10MB) |
| SEC-004 | scan-business-card-ai/index.ts | Security | Medium | Information disclosure in errors | details/help with URL and stack in responses | Generic client errors; detailed logs server-side only |
| SEC-005 | slack-integration/index.ts:201 | Security | Low | PII/tokens in logs | console.error with JSON.stringify(body) | Log only safe metadata |
| SEC-006 | scan-business-card/index.ts | Security | Low | PII in logs | console.log of OCR text and contact fields | Use PII-safe logging only |
| SEC-007 | src/components/ui/chart.tsx | Security | Low | XSS if config user-supplied | dangerouslySetInnerHTML with sanitized config | Keep config app-controlled; document/tests |
| CQ-001 | scan-business-card, parse-contact-pdf, teams, slack, Index, useContacts | Code Quality | Medium | Hard to maintain, test, refactor | Files 776–2303 lines | Split into smaller modules and shared libs |
| CQ-002 | waitlist/index.ts, security.ts | Code Quality | Low | Duplicate validation logic | isValidEmail in both | Use security.isValidEmail only |
| PERF-001 | ocr-google-vision, ocr-fallback | Performance | Medium | Memory/cost from unbounded image size | No size limit on base64 | Same as SEC-003 (size limit) |

---

## EXECUTIVE SUMMARY

**Total issues found:** 10 (7 security, 2 code quality, 1 performance; some overlap)

**By severity:**  
- **Critical:** 0  
- **High:** 2 (SEC-001, SEC-002)  
- **Medium:** 3 (SEC-003, SEC-004, CQ-001, PERF-001)  
- **Low:** 3 (SEC-005, SEC-006, SEC-007, CQ-002)

**Top 5 critical/high-priority fixes**

1. **Require auth for scan-business-card** — Add Bearer JWT check (or set verify_jwt = true) so only authenticated users can call the parser.
2. **Harden OAuth state (Teams & Slack)** — Store server-side session/nonce for the initiator and bind state to it, or sign/encrypt state and verify on callback; do not trust userId from the redirect URL.
3. **Limit image payload size (ocr-google-vision, ocr-fallback)** — Reject request when imageBase64 length (or decoded size) exceeds a safe limit (e.g. 5–10MB) before calling external APIs.
4. **Reduce error detail in scan-business-card-ai** — Return generic error messages to the client; log full details and internal URLs only server-side.
5. **Stop logging full body in slack-integration** — On missing JWT, log only that body was present/length; never log full request body.

**Overall risk score: 6/10**

- **Justification:** Two high-severity issues (unauthenticated parsing endpoint and OAuth state tampering) and several medium (DoS via large images, info disclosure, god files). No critical RCE or SQL injection; Stripe webhook and auth flows are generally sound. Rate limiting and sanitization exist but are inconsistent. Score reflects meaningful but manageable risk if the top fixes are applied.

**Recommended action plan**

- **Immediate (this week):**  
  - Enforce auth for scan-business-card (SEC-001).  
  - Add image size limits to ocr-google-vision and ocr-fallback (SEC-003 / PERF-001).  
  - Remove full-body logging in slack-integration (SEC-005).  
  - Harden OAuth state for teams-integration and slack-integration (SEC-002).

- **Short-term (this sprint):**  
  - Restrict client-facing error content in scan-business-card-ai (SEC-004).  
  - Replace PII-heavy logging in scan-business-card with PII-safe logs (SEC-006).  
  - Confirm ALLOWED_ORIGINS and Stripe/webhook secrets in production.

- **Long-term (refactor roadmap):**  
  - Split god files (scan-business-card, parse-contact-pdf, teams-integration, slack-integration, Index.tsx, useContacts) into smaller modules and shared libraries.  
  - Add rate limiting to subscription/checkout/portal and OCR endpoints where appropriate.  
  - Document each Edge Function’s contract (method, auth, body, response) and add targeted tests.  
  - Run npm audit and npm outdated; align Supabase client versions between frontend and functions where possible.

---

*Audit completed from a stateless, full-codebase pass with direct code references. No prior audit conclusions were reused.*
