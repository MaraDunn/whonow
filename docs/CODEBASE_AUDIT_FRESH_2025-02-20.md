# Full Codebase Audit — Fresh, Stateless (2025-02-20)

This audit was conducted from scratch with no reliance on prior analyses. All findings are backed by direct code references.

---

## PHASE 1 — FULL INVENTORY (No Judgement)

### Project structure

- **Root:** Vite + React (TypeScript), Supabase backend (Edge Functions), Tauri desktop, Netlify deploy.
- **Source directories:**
  - `src/` — React app: `components/`, `components/ui/`, `components/landing/`, `pages/`, `hooks/`, `utils/`, `utils/ai/`, `utils/semanticAssist/`, `integrations/supabase/`, `lib/`, `config/`, `data/`, `types/`, `assets/`
  - `supabase/functions/` — Edge Functions: per-function `index.ts`; `_shared/` (security, contactFormatting, oauthState, appUrl, stripeConfig)
  - `supabase/migrations/` — 46 SQL migrations
  - `src-tauri/` — Tauri desktop app
  - `scripts/`, `public/`, `docs/`

### API routes / endpoints (Supabase Edge Functions)

All are invoked as `POST` or `GET` to `https://<project>.supabase.co/functions/v1/<name>` unless noted.

| # | Function name           | HTTP   | Path (logical)                    | File location                                      |
|---|-------------------------|--------|-----------------------------------|----------------------------------------------------|
| 1 | waitlist                | POST   | /functions/v1/waitlist            | supabase/functions/waitlist/index.ts                |
| 2 | stripe-webhook          | POST   | /functions/v1/stripe-webhook      | supabase/functions/stripe-webhook/index.ts          |
| 3 | llm-proxy               | GET    | /functions/v1/llm-proxy          | supabase/functions/llm-proxy/index.ts               |
| 4 | contact-share           | GET    | /functions/v1/contact-share      | supabase/functions/contact-share/index.ts           |
| 5 | parse-contact-pdf       | POST   | /functions/v1/parse-contact-pdf  | supabase/functions/parse-contact-pdf/index.ts       |
| 6 | ocr-google-vision       | POST   | /functions/v1/ocr-google-vision  | supabase/functions/ocr-google-vision/index.ts       |
| 7 | scan-business-card-ai   | POST   | /functions/v1/scan-business-card-ai | supabase/functions/scan-business-card-ai/index.ts |
| 8 | check-subscription      | POST   | /functions/v1/check-subscription | supabase/functions/check-subscription/index.ts     |
| 9 | create-checkout         | POST   | /functions/v1/create-checkout    | supabase/functions/create-checkout/index.ts         |
|10 | scan-business-card      | POST   | /functions/v1/scan-business-card| supabase/functions/scan-business-card/index.ts     |
|11 | teams-integration       | GET/POST | /functions/v1/teams-integration | supabase/functions/teams-integration/index.ts       |
|12 | bulk-insert-contacts    | POST   | /functions/v1/bulk-insert-contacts| supabase/functions/bulk-insert-contacts/index.ts   |
|13 | parse-search-query      | POST   | /functions/v1/parse-search-query | supabase/functions/parse-search-query/index.ts     |
|14 | customer-portal         | POST   | /functions/v1/customer-portal   | supabase/functions/customer-portal/index.ts         |
|15 | ocr-fallback           | POST   | /functions/v1/ocr-fallback      | supabase/functions/ocr-fallback/index.ts           |
|16 | generate-test-contacts  | POST   | /functions/v1/generate-test-contacts | supabase/functions/generate-test-contacts/index.ts |
|17 | slack-integration       | GET/POST | /functions/v1/slack-integration | supabase/functions/slack-integration/index.ts       |
|18 | help-email              | POST   | /functions/v1/help-email         | supabase/functions/help-email/index.ts              |

### Frontend routes (React Router)

| Path | Auth | Guard | File (component) |
|------|------|--------|------------------|
| / | Public (waitlist) or Landing/Redirect | WaitlistRouteGuard | Waitlist or DesktopAppRootRedirect → Landing |
| /waitlist | Public | WaitlistRouteGuard | Waitlist |
| /privacy, /terms | Public | — | Privacy, Terms |
| /import-contact, /export-shared-contact | Public | — | ImportContactPage, ExportSharedContactPage |
| /auth | Public | — | Auth |
| /app | Protected | ProtectedRoute | Index |
| /help/faq | Protected | ProtectedRoute | HelpFAQPage |
| * | NotFound (non-waitlist) or redirect (waitlist) | — | NotFound / Navigate to / |

**Middleware / guards:** `ProtectedRoute` (useAuth, redirect if !user), `WaitlistRouteGuard` (redirect non-public in waitlist mode), `WaitlistRouteGuard` wraps all routes. No HTTP middleware; Supabase Edge uses `verify_jwt` per function in `supabase/config.toml`.

### Services / utilities

- **Supabase client:** `src/integrations/supabase/client.ts`, `src/integrations/supabase/types.ts`
- **Shared Edge:** `supabase/functions/_shared/security.ts` (CORS, rate limit, sanitize, jsonErrorResponse), `_shared/contactFormatting.ts`, `_shared/oauthState.ts`, `_shared/appUrl.ts`, `_shared/stripeConfig.ts`
- **Frontend:** `src/utils/` (contactSearchEngine, searchQueryParser, contactMerge, formatContact, sanitize, helpEmail, launchMode, etc.), `src/hooks/` (useAuth, useContacts, useProfile, useSubscription, useSlackIntegration, useTeamsIntegration, etc.)

### Database models (from migrations)

- **Tables:** `contacts`, `folders`, `profiles`, `companies`, `user_roles`, `subscriptions`, `employee_access_keys`, `integrations`, `integration_logs`, `waitlist`, `contact_share_tokens`, `avatars` storage; FTS/search vectors on contacts.
- **RPCs:** `list_contacts`, `list_contacts_slim`, `smart_search_contacts`, `count_active_contacts`, `count_personal_contacts`, `count_shared_contacts`, `count_client_contacts`, `count_trashed_contacts`, `count_contacts_by_folder`, etc.
- **RLS:** Contacts, folders, profiles, companies, subscriptions, integrations, etc. use role/ownership-based policies (see migration 20251220201301 and later). No remaining `USING (true)` public policies on contacts/folders in final migration state.

### Config files

- `package.json`, `vite.config.ts`, `eslint.config.js`, `vitest.config.ts`, `tailwind.config.*`, `postcss.config.*`
- `supabase/config.toml` (project_id, auth template, per-function `verify_jwt`)
- `netlify.toml` (build, env, redirects for SPA and exploit paths)
- `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`
- `.env.example` (documented vars; no secrets)

### Environment variable usages

- **Frontend (Vite):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_APP_LAUNCH_MODE`, `VITE_APP_URL`, `VITE_DEV_MODE`, `VITE_ENABLE_AI`, `VITE_ENABLE_SEMANTIC_PARSING`, `VITE_ENABLE_SEMANTIC_RANKING`, `VITE_AI_DEBUG_MODE`, `VITE_LLM_MODEL`, `VITE_EMBEDDING_MODEL`, `VITE_MODEL_STORAGE_URL`, `VITE_AI_TIMEOUT_MS`, `VITE_GITHUB_REPO`, `VITE_DOWNLOAD_URL_*`, `VITE_GOOGLE_CLIENT_ID`, `VITE_TAURI_PLATFORM`
- **Edge:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_ORIGINS`, `APP_LAUNCH_MODE`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `GOOGLE_CLOUD_VISION_API_KEY`, `OCR_SPACE_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `OAUTH_STATE_SECRET`, `ALLOW_GENERATE_TEST_CONTACTS`

### External integrations

- **Supabase** (auth, DB, storage, Edge)
- **Stripe** (checkout, customer portal, webhooks)
- **Resend** (help-email)
- **Google Cloud Vision** (ocr-google-vision)
- **OCR.space** (ocr-fallback)
- **Hugging Face CDN** (llm-proxy)
- **Slack OAuth & API** (slack-integration)
- **Microsoft OAuth & Graph** (teams-integration)
- **OpenStreetMap** (address geocoding, referenced in frontend)

### Route map (Edge Functions) — auth & middleware

| Method | Path (function) | File | verify_jwt (config) | Auth in code | Rate limit | Input validation |
|--------|------------------|------|---------------------|---------------|------------|------------------|
| POST | waitlist | waitlist/index.ts | false | None | IP, 10/60s | Email format, body |
| POST | stripe-webhook | stripe-webhook/index.ts | false | Stripe signature | No | Body + signature |
| GET | llm-proxy | llm-proxy/index.ts | false | None | IP, 120/min | model, file allowlist |
| GET | contact-share | contact-share/index.ts | false | Token in query | IP, 60/min | token required |
| POST | parse-contact-pdf | parse-contact-pdf/index.ts | false | Bearer | No | Size, body |
| POST | ocr-google-vision | (not in config → default true) | — | Bearer | No | Base64 size |
| POST | scan-business-card-ai | false | Bearer | No | Body |
| POST | check-subscription | false | Bearer | No | — |
| POST | create-checkout | false | Bearer | No | — |
| POST | scan-business-card | false | Bearer | No | Body |
| GET/POST | teams-integration | false | Bearer (or body JWT) | No | state, code |
| POST | bulk-insert-contacts | true | Bearer | No | Body, batch size |
| POST | parse-search-query | false | Bearer | No | query length, contacts count |
| POST | customer-portal | false | Bearer | No | — |
| POST | ocr-fallback | (not in config → default true) | Bearer | No | Base64 size |
| POST | generate-test-contacts | true | Bearer + ALLOW_GENERATE_TEST_CONTACTS | No | — |
| GET/POST | slack-integration | false | Bearer (or body JWT) | No | state, code |
| POST | help-email | false | Bearer | User, 5/hour | type, body, attachment size |

---

## PHASE 2 — CODE QUALITY & ARCHITECTURE

### SOLID & architecture

- **SRP:** Some edge functions (e.g. `scan-business-card`, `parse-contact-pdf`, `teams-integration`, `slack-integration`) mix HTTP handling, auth, parsing, and external API calls in one file — acceptable for small teams but could be split for clarity.
- **Coupling:** Frontend hooks (e.g. `useSlackIntegration`, `useTeamsIntegration`) repeatedly read `import.meta.env.VITE_SUPABASE_*`; could be centralized in client or a small env module.
- **Dependency direction:** App → Supabase client → Edge/DB; no circular imports observed.
- **Business logic in controllers:** Edge handlers contain validation and business logic inline; no separate “service” layer — common for Edge and acceptable at current size.
- **God files:** Several very large files (see below under “Large files”).

### Code smells

- **Duplication:** Change-password UI and validation duplicated between `SettingsDialog.tsx` and `AccountManagementDialog.tsx` (different min length: 6 vs 8).
- **Long methods / large files:** See issues AUDIT-002, AUDIT-003, AUDIT-004 below.
- **Magic numbers:** Many MAX_* and limits are named constants in Edge (good); some numeric literals remain in UI (e.g. page sizes in useContacts).
- **Dead/commented code:** Scripts `diagnose-signup.js`, `add-2000-test-contacts.js` in repo; not part of production build but add noise.
- **Naming:** Generally clear; `RAW_SUPABASE_URL` vs `SUPABASE_URL` in client is clear.

### Maintainability

- **Test coverage:** Only `parse-search-query/auth.test.ts`, `_shared/security.test.ts`, and `src/utils/__tests__/searchIntegrity.test.ts` found; most of app and Edge logic untested.
- **Documentation:** README/QUICK_START/MIGRATION docs exist; many modules lack JSDoc.
- **Patterns:** CORS and auth patterns consistent across Edge (getCorsHeaders, handleCorsPreflight, Bearer + getUser).

---

## PHASE 3 — API & ROUTE SECURITY AUDIT

Per-route summary:

- **waitlist:** Auth not required (by design). Rate limited (IP). Input: email validated. Sanitization: email trimmed/lowercased. No CSRF for JSON API. Sensitive: only success/error. Status codes: 200, 400, 405, 500. **Public write:** yes (intended).
- **stripe-webhook:** Auth: Stripe signature only. No rate limit (Stripe-originated). Input: raw body + signature. CSRF not applicable. **Critical:** signature verification present (constructEventAsync).
- **llm-proxy:** Auth not required. Rate limited by IP. Input: model/file allowlist, path traversal checks. No sensitive data returned (proxy file). **Public read:** yes (intended).
- **contact-share:** Auth: token in query only. Rate limited. Token validated against DB; expiry checked. Returns contact PII for share link — by design. **Public read with token:** yes.
- **parse-contact-pdf, ocr-google-vision, ocr-fallback, scan-business-card, scan-business-card-ai:** Auth: Bearer, user verified. Input/size limits applied. No rate limit on most (potential DoS concern — medium).
- **check-subscription, create-checkout, customer-portal:** Auth: Bearer. Stripe keys from env. No rate limit.
- **teams-integration, slack-integration:** Auth: Bearer or JWT in body (verify_jwt=false). OAuth state verified when OAUTH_STATE_SECRET set. No rate limit on OAuth callback path.
- **bulk-insert-contacts:** Auth: Bearer. Launch mode check. Sanitization and batch limit (100). Ownership/company from profile.
- **parse-search-query:** Auth: Bearer. Query length and contacts array size capped. No DB write; reads only client-supplied contacts.
- **generate-test-contacts:** Auth: Bearer + `ALLOW_GENERATE_TEST_CONTACTS=true`. Not enabled by default — **OK**.
- **help-email:** Auth: Bearer. Rate limit by user. Body/attachment size and sanitization. Resend API key from env.

**Duplicate routes:** None. **Unused routes:** None identified. **Debug/test routes:** generate-test-contacts gated by env. **Internal IDs:** Contact/folder IDs exposed in UI/API where needed for ownership; RLS enforces access.

---

## PHASE 4 — SECURITY REVIEW (OWASP-ALIGNED)

- **Injection:** Supabase client uses parameterized queries; no raw SQL in app. Edge functions use Supabase client or RPCs. No SQL/NoSQL/command injection observed. **Sanitization:** _shared/security.ts `sanitizeString` and helpers used in waitlist, help-email, bulk-insert; ocr-google-vision validates base64 length and type.
- **XSS:** `dangerouslySetInnerHTML` only in `src/components/ui/chart.tsx` with `sanitizeChartId` and `sanitizeCssColor`; config is app-controlled (see comment in code). **Low risk** if chart config is never user-supplied.
- **CSRF:** JSON APIs with Bearer auth are not browser-form CSRF targets; state-changing public endpoints (waitlist, contact-share GET) are POST/GET with no cookie-based session — acceptable. Stripe webhook uses signature, not cookies.
- **Access control:** RLS on contacts, folders, profiles, companies, subscriptions, integrations. Edge functions that mutate data verify user via `getUser(token)` and use service role only server-side. **IDOR:** contact-share uses token, not user id; token is unguessable and scoped to one payload.
- **Secrets:** No hardcoded secrets; Stripe keys, Supabase keys, OAuth secrets, Resend key from env.
- **CORS:** `getCorsHeaders(origin)` allowlists origins (ALLOWED_ORIGINS or localhost). No wildcard `*` in production when ALLOWED_ORIGINS is set.
- **File upload:** help-email accepts base64 attachment with size limit (5 MB) and type check; Edge functions that accept images (scan-business-card*, ocr-*, parse-contact-pdf) enforce size limits.
- **Error detail:** Edge generally return generic messages to client; server logs details (e.g. formatErrorResponse, secureLog). Some Edge logs include step names; no raw DB errors or stack traces in responses.
- **OAuth state:** When `OAUTH_STATE_SECRET` is set, state is signed/verified (_shared/oauthState.ts); used in Slack and Teams integrations.

---

## PHASE 5 — PERFORMANCE & SCALABILITY

- **N+1:** useContacts uses RPCs (`list_contacts_slim`, `smart_search_contacts`) and count RPCs; no per-row fetch found. Indexes exist for contacts (owner, company, folder, FTS, etc.) and list/smart_search.
- **Missing indexes:** Not identified beyond existing migrations (contacts, folders, search vectors, trigram).
- **Blocking:** Edge functions are async; no synchronous file or network blocking in hot path. Frontend uses React Query and lazy routes.
- **Heavy endpoints:** parse-contact-pdf, scan-business-card (and scan-business-card-ai) are CPU/image heavy; no pagination (single-request). bulk-insert limited to 100 per request.
- **Large payloads:** parse-search-query accepts up to 2000 contacts in body; could be large for slow networks — acceptable with documented limit.
- **Pagination:** Contacts list uses keyset/cursor via RPC; useContacts has CONTACTS_PAGE_SIZE and “load more”.
- **Caching:** React Query stale/cache times set; no server-side caching on Edge (e.g. llm-proxy could cache model files).
- **Inefficient loops:** No obvious O(n²) or redundant work in reviewed code; searchQueryParser and contactSearchEngine are large but algorithmic.

---

## PHASE 6 — DEPENDENCY AUDIT

- **Production deps (package.json):** React 18, Supabase JS, TanStack Query, Radix UI set, Tauri plugins, Recharts, Zod, date-fns, tesseract.js, onnxruntime-web, etc. No duplicate overlapping libraries for same concern.
- **Outdated / vulnerabilities:** `npm audit` reports:
  - **High:** eslint (and @eslint/*, typescript-eslint) via minimatch, ajv, typescript-estree — **dev-only**, not production runtime.
  - **Moderate:** ajv (ReDoS with `$data`), esbuild, @vitest/mocker (vite) — dev/build only.
- **Large deps:** onnxruntime-web, tesseract.js, recharts are large; acceptable for feature set. Tauri and canvas are dev/build.
- **Recommendation:** Upgrade eslint/typescript-eslint when feasible; ensure production bundle does not ship dev dependencies.

---

## PHASE 7 — VALIDATED FINDINGS (Issues with Evidence)

Only issues with direct code evidence are listed below.

---

### Issue AUDIT-001

- **Location:** `src/components/SettingsDialog.tsx` (line 144) vs `src/components/landing/AccountManagementDialog.tsx` (line 352).
- **Type:** Code Quality
- **Severity:** Low
- **Impact:** Inconsistent password policy (6 vs 8 chars and complexity) between two change-password flows; user confusion and weaker security in one path.
- **Evidence:**  
  - SettingsDialog: `if (newPassword.length < 6)`  
  - AccountManagementDialog: `if (newPassword.length < 8)` and checks for uppercase, lowercase, number, special character.
- **Recommendation:** Unify password rules in one shared helper (e.g. `validatePassword`) and use it in both dialogs; align on min length and complexity.

---

### Issue AUDIT-002

- **Location:** `src/utils/searchQueryParser.ts` (2,843 lines).
- **Type:** Code Quality / Architecture
- **Severity:** Medium
- **Impact:** Single very large file; hard to maintain, test, and refactor; higher risk of merge conflicts and regression.
- **Evidence:** Line count from `wc -l` and file read.
- **Recommendation:** Split by domain: e.g. time range parsing, action/responsibility parsing, keyword extraction, into separate modules with clear interfaces; keep a thin facade in searchQueryParser.ts.

---

### Issue AUDIT-003

- **Location:** `supabase/functions/scan-business-card/index.ts` (2,312 lines).
- **Type:** Code Quality / Architecture
- **Severity:** Medium
- **Impact:** God file mixing OCR, parsing, formatting, and HTTP; difficult to test and reuse.
- **Evidence:** Line count and structure (serve() at end, large parsing/formatting blocks).
- **Recommendation:** Extract parsing and formatting into _shared or a dedicated module; keep index.ts to HTTP, auth, and orchestration.

---

### Issue AUDIT-004

- **Location:** `supabase/functions/parse-contact-pdf/index.ts` (2,023 lines), `src/utils/contactSearchEngine.ts` (1,934 lines), `src/components/SettingsDialog.tsx` (1,485 lines), `src/components/ContactDetailsDialog.tsx` (1,312 lines).
- **Type:** Code Quality
- **Severity:** Low–Medium
- **Impact:** Files over 500 lines increase cognitive load and testing cost; some over 1,000 lines are refactor candidates.
- **Evidence:** Line counts from project scan.
- **Recommendation:** Prioritize extracting sub-components or pure logic (e.g. SettingsDialog sections, ContactDetailsDialog panels, contactSearchEngine search steps) into smaller files.

---

### Issue AUDIT-005

- **Location:** `supabase/functions/teams-integration/index.ts`, `supabase/functions/slack-integration/index.ts`.
- **Type:** Security
- **Severity:** Low
- **Impact:** OAuth callback endpoints accept GET with `code` and `state`; if `OAUTH_STATE_SECRET` is unset, state is not cryptographically verified and could be tampered with (binding attack).
- **Evidence:** `parseOAuthState(stateSecret, rawState)` in both; when `stateSecret` is missing or short, signing is skipped (_shared/oauthState.ts).
- **Exploitation scenario:** Attacker could craft a callback URL with a victim’s state and try to bind token to attacker’s account if state were not validated. Mitigated when OAUTH_STATE_SECRET is set (signature verified).
- **Recommendation:** Document that `OAUTH_STATE_SECRET` must be set in production; consider refusing OAuth callback when secret is unset in production.

---

### Issue AUDIT-006

- **Location:** `supabase/functions/llm-proxy/index.ts` (no authentication).
- **Type:** Security
- **Severity:** Low
- **Impact:** Anyone can request model files through the proxy (bandwidth/cost); no per-user quota.
- **Evidence:** No Authorization check; only GET, rate limit by IP (120/min), and model/file allowlist.
- **Exploitation scenario:** Scripts could request allowed model files repeatedly; rate limit and allowlist limit impact.
- **Recommendation:** Accept current design (public read, rate limited) or add optional Bearer auth and per-user limits for higher-cost environments.

---

### Issue AUDIT-007

- **Location:** `supabase/functions/waitlist/index.ts`.
- **Type:** Security
- **Severity:** Low
- **Impact:** Public POST endpoint; rate limited by IP only; no CAPTCHA or proof-of-work, so bots could submit valid emails up to limit.
- **Evidence:** `checkRateLimit(\`waitlist:${ip}\`, 10, 60_000)`; email format validated; no auth.
- **Exploitation scenario:** Distributed bot could add many emails within per-IP limit; impact is limited to waitlist table growth and possible email abuse if list is used for marketing.
- **Recommendation:** Consider CAPTCHA or stricter rate limits for production; monitor waitlist growth and bounces.

---

### Issue AUDIT-008

- **Location:** `supabase/functions/ocr-google-vision/index.ts`, `supabase/functions/ocr-fallback/index.ts`.
- **Type:** Security / Config
- **Severity:** Low
- **Impact:** Not listed in `supabase/config.toml` under `[functions.*]`, so they use Supabase default `verify_jwt = true`; function code also verifies Bearer. Redundant but not insecure. Inconsistent with other functions that set `verify_jwt = false` and validate in code.
- **Evidence:** config.toml has no `[functions.ocr-google-vision]` or `[functions.ocr-fallback]`; both functions call `getUser(token)` after checking Authorization header.
- **Recommendation:** Add explicit `[functions.ocr-google-vision]` and `[functions.ocr-fallback]` with `verify_jwt = false` for consistency and to avoid gateway 401 issues with refresh timing (as done for check-subscription, create-checkout, customer-portal).

---

### Issue AUDIT-009

- **Location:** `src/components/ui/chart.tsx` (lines 94–99).
- **Type:** Security (XSS)
- **Severity:** Low
- **Impact:** `dangerouslySetInnerHTML` used for chart theme styles; if `config` were ever derived from user input, XSS could result.
- **Evidence:** `ChartStyle` uses `dangerouslySetInnerHTML` with `safeId` and color values from config; `sanitizeChartId` and `sanitizeCssColor` restrict input; comment states config must be app-controlled.
- **Exploitation scenario:** Only if chart config were supplied by user (e.g. from DB or URL) and passed unsanitized; current usage is app-controlled.
- **Recommendation:** Keep chart config from trusted sources only; if config can ever be user-driven, run color/label through sanitizers or avoid injecting into HTML.

---

### Issue AUDIT-010

- **Location:** Dev dependencies (eslint, typescript-eslint, ajv, minimatch, etc.).
- **Type:** Dependency
- **Severity:** Low (dev-only)
- **Impact:** npm audit reports high/moderate in dev dependencies; no evidence they are bundled into production.
- **Evidence:** package.json devDependencies; Vite production build typically tree-shakes and excludes dev-only code.
- **Recommendation:** Run `npm audit fix` where possible; upgrade to eslint 10 / typescript-eslint 8 when ready; confirm production bundle does not include these.

---

### Issue AUDIT-011

- **Location:** `diagnose-signup.js`, `add-2000-test-contacts.js` in repo root.
- **Type:** Code Quality / Hygiene
- **Severity:** Low
- **Impact:** Scripts use Supabase and env (e.g. TEST_PASSWORD, SUPABASE_ACCESS_TOKEN); if run in CI or by mistake, could affect real data or leak env.
- **Evidence:** Files present; add-2000-test-contacts.js calls bulk-insert-contacts and requires SUPABASE_ACCESS_TOKEN.
- **Recommendation:** Move to `scripts/` or document as dev-only; ensure CI does not run them with production env; consider excluding from production image/artifact.

---

### Issue AUDIT-012

- **Location:** `supabase/functions/contact-share/index.ts` — token in query string.
- **Type:** Security
- **Severity:** Low
- **Impact:** Share link token appears in URL; could be logged (server/proxy logs, Referer) or cached.
- **Evidence:** `const token = url.searchParams.get("token");`; token is UUID-like and single-use for viewing one contact.
- **Exploitation scenario:** Anyone with the link can view the contact until expiry; link leakage is the main risk (e.g. Referer to third party).
- **Recommendation:** Document short expiry and one-time or limited use if applicable; consider POST with token in body for in-app flows to avoid Referer leakage.

---

### Issue AUDIT-013

- **Location:** Multiple Edge functions (parse-contact-pdf, scan-business-card, scan-business-card-ai, ocr-google-vision, ocr-fallback).
- **Type:** Performance / Security
- **Severity:** Medium
- **Impact:** No per-user or per-IP rate limit on expensive OCR/AI endpoints; authenticated abuse could cause cost or CPU spikes.
- **Evidence:** Only waitlist, contact-share, llm-proxy, help-email use `checkRateLimit`; scan/parse/OCR functions do not.
- **Recommendation:** Add rate limit by user id (and optionally by IP) for scan-business-card, scan-business-card-ai, parse-contact-pdf, ocr-google-vision, ocr-fallback (e.g. N requests per minute per user).

---

## EXECUTIVE SUMMARY

**Total issues found:** 13  

**By severity:**  
- **Critical:** 0  
- **High:** 0  
- **Medium:** 3 (AUDIT-002, AUDIT-003, AUDIT-013)  
- **Low:** 10 (AUDIT-001, AUDIT-004, AUDIT-005, AUDIT-006, AUDIT-007, AUDIT-008, AUDIT-009, AUDIT-010, AUDIT-011, AUDIT-012)

**Top 5 fixes (immediate action):**

1. **Rate limit expensive Edge functions (AUDIT-013)** — Add per-user (and optionally per-IP) rate limiting for parse-contact-pdf, scan-business-card, scan-business-card-ai, ocr-google-vision, ocr-fallback to limit cost and DoS.
2. **Unify password validation (AUDIT-001)** — Single password policy and helper for SettingsDialog and AccountManagementDialog (min length and complexity).
3. **Split searchQueryParser (AUDIT-002)** — Break 2,800+ line file into smaller modules (time, actions, keywords, etc.) for maintainability and testing.
4. **Split scan-business-card (AUDIT-003)** — Extract parsing/formatting into shared module; keep HTTP and auth in index.
5. **Document OAuth state secret (AUDIT-005)** — Ensure OAUTH_STATE_SECRET is set in production for Slack/Teams; consider failing callback if unset in prod.

**Overall risk score: 4/10**

- **Justification:** No critical or high issues; RLS and auth are in place; Stripe webhook and secrets handling are correct; main risks are rate limiting on expensive endpoints, consistency (password, config), and maintainability (large files). Dependency issues are dev-only.

**Recommended action plan**

- **Immediate (this week):**  
  - Add rate limiting to OCR/scan/parse Edge functions (AUDIT-013).  
  - Unify password validation and document OAuth state secret requirement (AUDIT-001, AUDIT-005).

- **Short-term (this sprint):**  
  - Add explicit config for ocr-google-vision and ocr-fallback (AUDIT-008).  
  - Move or document dev scripts (AUDIT-011).  
  - Plan refactor of searchQueryParser and scan-business-card (AUDIT-002, AUDIT-003).

- **Long-term (refactor roadmap):**  
  - Reduce size of ContactDetailsDialog, SettingsDialog, contactSearchEngine, parse-contact-pdf (AUDIT-004).  
  - Increase test coverage for Edge and critical frontend paths.  
  - Revisit llm-proxy auth/cost controls if usage grows (AUDIT-006).

---

*Audit completed from a full, stateless scan of the repository with code-backed findings only.*

---

## Post-audit change: llm-proxy removed (2025-02-20)

The **llm-proxy** Edge Function was found to be **unused**: the app loads models from Supabase Storage (`VITE_MODEL_STORAGE_URL`) or bundled Tauri assets, and no code calls `/functions/v1/llm-proxy`. It has been removed to reduce attack surface. The `llm-proxy` function directory and config entry were removed; docs (e.g. DEPLOY_LLM_PROXY.md, LLM_IMPLEMENTATION_SUMMARY.md) may still reference it for historical context.
