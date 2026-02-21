# Follow-up Steps After Remediation

These are the steps you should take after the industry-standard fixes have been applied.

## 1. Install dependencies

```bash
npm install
```

This installs the new `vitest` and `happy-dom` devDependencies so `npm run test` works.

## 2. Run security audit

```bash
npm run audit
```

- **Critical/high (fixed):** `happy-dom` has been upgraded to ^20.0.0 to address the critical VM Context Escape advisory. Tests use `happy-dom` 20 and pass.
- **Remaining (dev-only):** Any remaining advisories are in **devDependencies** (eslint, typescript-eslint/minimatch/ajv, vite/esbuild). They do not affect the production build or runtime.
- **Optional fixes (breaking):** To try to fix the rest, run `npm audit fix` for non-breaking fixes. To apply all fixes (may require eslint@10, vite@7, etc.), run `npm audit fix --force` only when you are ready for potential breaking changes and plan to run the test suite and fix any issues.

## 3. Run tests

```bash
npm run test
```

Confirm existing tests pass. Add more tests for critical paths (auth, contact validation, Edge Function logic) as you go.

## 4. Signup diagnostic script (optional)

To run the signup test in `diagnose-signup.js`, add a test password to your `.env` (never commit real passwords):

```env
TEST_PASSWORD=YourSecureTestPassword1!
```

If `TEST_PASSWORD` is not set, the script skips the signup test and continues with other checks.

## 5. Rate limiting at scale (optional)

The in-memory rate limiter in `_shared/security.ts` is fine for current scale. When you scale out (multiple Edge Function instances or high traffic), consider:

- **Upstash Redis** (serverless Redis) with a small wrapper around `checkRateLimit`
- **Supabase table**–backed rate limits (e.g. count rows by identifier and window)
- Or your provider’s built-in rate limiting

No code change is required until you need it.

## 6. Optional: migrate more Edge Functions to shared contact formatting

You can gradually migrate `parse-contact-pdf` and `scan-business-card` to import `formatName` / `formatPhoneNumber` from `_shared/contactFormatting.ts` to remove duplication. The shared API is compatible.
