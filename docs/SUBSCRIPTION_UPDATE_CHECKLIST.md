# Subscription not updating – checklist

Use this list when payments succeed but the user’s tier (e.g. Pro) doesn’t update in the app.

---

## 1. Deployments

- [ ] **Edge Functions are deployed** after your latest code (push alone is not enough). From the repo root:
  ```bash
  supabase functions deploy stripe-webhook
  supabase functions deploy check-subscription
  supabase functions deploy create-checkout
  supabase functions deploy customer-portal
  ```
  If you deploy via CI/CD, confirm the pipeline ran for the commit that has the subscription changes.

- [ ] **Frontend** (whonow.co) is built and deployed from the same commit (so it has the login refresh, success-param retries, and cache-clear on login).

---

## 2. Stripe webhook

- [ ] **Webhook URL** (Stripe Dashboard → Developers → Webhooks) points to your Supabase function:
  - `https://<YOUR-PROJECT-REF>.supabase.co/functions/v1/stripe-webhook`
  - No typo, no localhost, correct project ref.

- [ ] **Events to send** include at least:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - (Optional) `invoice.payment_failed`

- [ ] **Recent deliveries** (Stripe → Webhooks → your endpoint → “Recent deliveries”):
  - After a test checkout, do you see requests for the events above?
  - If **no**: endpoint URL wrong, or Stripe not sending (check endpoint “Events to send”).
  - If **yes**: note the **response status** (200 = success, 4xx/5xx = failure).

- [ ] **Signing secret**: In Stripe, open the endpoint and copy the **Signing secret** (`whsec_...`). In Supabase (Edge Functions → Secrets), `STRIPE_WEBHOOK_SECRET` must match exactly. If you recreated the webhook or rotated the secret, update Supabase.

---

## 3. Stripe mode and keys

- [ ] **Test vs Live**: If users pay with real cards, you must use **Live** mode (live keys and live price IDs). If testing with test cards, use **Test** mode.

- [ ] **Supabase secrets** (Edge Functions → Secrets):
  - `STRIPE_SECRET_KEY`: `sk_live_...` for live, `sk_test_...` for test.
  - `STRIPE_WEBHOOK_SECRET`: from the webhook endpoint (see above).

- [ ] **Price IDs**: The Pro (and Team/Business) price IDs in code or in Supabase secrets must match the **same Stripe mode** (test or live). In Stripe Dashboard → Products → your plan → copy the **Price ID** (`price_...`). If you use Live mode, the price IDs must be from Live mode, not Test.

---

## 4. Supabase

- [ ] **Secrets** (Edge Functions): `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are set. Optionally `APP_URL` (e.g. `https://whonow.co`) and `STRIPE_PRICE_ID_PRO` / `STRIPE_PRICE_ID_TEAM` / `STRIPE_PRICE_ID_BUSINESS` if you override defaults.

- [ ] **`subscriptions` table** exists and has (at least): `user_id`, `tier`, `stripe_customer_id`, `stripe_subscription_id`, `status`, `current_period_start`, `current_period_end`, `employee_seats_limit`, and a **unique constraint on `user_id`** (so upsert works).

- [ ] **RLS**: No need to change RLS for the webhook (it uses the service role). The app reads via `get_user_subscription_tier` and `subscriptions` with RLS; users only see their own row.

---

## 5. Webhook logs (Supabase)

- [ ] **stripe-webhook logs** (Supabase → Edge Functions → stripe-webhook → Logs). After a test checkout, look for:
  - `Webhook received` with `type: "checkout.session.completed"` or `"customer.subscription.created"` / `"customer.subscription.updated"`.
  - `Subscription synced` with `tier`, `status`, `userId` → webhook ran and wrote to DB.
  - If you see **signature verification failed**: `STRIPE_WEBHOOK_SECRET` does not match the endpoint’s signing secret.
  - If you see **No user_id in checkout session metadata**: checkout was not created by our `create-checkout` (metadata must include `user_id`).
  - If you see **Error upserting subscription**: check the error message (e.g. missing column, constraint, or permissions).

---

## 6. Database (subscriptions table)

- [ ] **Table Editor** (Supabase → Table Editor → `subscriptions`). After a successful checkout:
  - Is there a row for the user (match by `user_id` or email via `profiles`)?
  - Is `tier` set correctly (e.g. `pro`)?
  - Is `status` = `active`? The app and `get_user_subscription_tier` only treat `status = 'active'` as active. If you see `trialing` or something else, the code now maps `trialing` → `active` in the webhook; redeploy `stripe-webhook` if you have that change.

---

## 7. create-checkout and waitlist

- [ ] **Starting checkout**: If the app is in **waitlist** mode, `create-checkout` is blocked unless you use a tester build or set `APP_LAUNCH_MODE` to `live`. Ensure the user can actually open Stripe Checkout (button works and redirects to Stripe, not a 403).

- [ ] **Redirect after payment**: Success URL should be `https://whonow.co/app?subscription=success` (or your canonical app URL). If it was `app.whonow.co` before, the code now uses `getStripeRedirectOrigin`; redeploy `create-checkout` and `customer-portal`.

---

## 8. App behavior

- [ ] **Login**: On login we clear subscription cache and call `checkSubscription()`. Relogging should refetch tier from DB/Stripe.

- [ ] **After checkout**: We show the success toast and call `checkSubscription()` immediately, then again at 2.5s and 5s so a slightly delayed webhook still updates the UI. If the user is on the waitlist landing, they must be on a build that has this retry logic and that can call `check-subscription` (we no longer block it in waitlist mode).

---

## 9. Quick test flow

1. Use a test card in Stripe Test mode (e.g. `4242 4242 4242 4242`).
2. Complete checkout.
3. In Stripe → Webhooks → Recent deliveries: confirm a `checkout.session.completed` (and usually `customer.subscription.created`) with **200** response.
4. In Supabase → stripe-webhook logs: confirm `Subscription synced` with the expected tier.
5. In Supabase → Table Editor → `subscriptions`: confirm a row for that user with `tier` = `pro` (or chosen tier) and `status` = `active`.
6. In the app: log out and log back in (or hard refresh). Tier should show as Pro.

If any step fails, use the section above that matches that step (webhook URL, secrets, logs, table, etc.).

---

## 10. "Invalid JWT" (401)

If you see `{"code":401,"message":"Invalid JWT"}`:

- **Meaning:** The request to a subscription Edge Function (`check-subscription`, `create-checkout`, or `customer-portal`) was sent with a missing, expired, or invalid auth token. Supabase rejects it before the function runs.
- **Typical causes:**
  - Session expired (e.g. tab open a long time). **Fix:** Sign out and sign in again, or refresh the page so the app can refresh the session.
  - Calling the function without being signed in. **Fix:** Ensure the user is logged in when opening checkout or the billing portal, or when the app runs a subscription check.
  - Manually calling the function URL (e.g. Postman/curl) without an `Authorization: Bearer <access_token>` header. **Fix:** Use the app while signed in, or send a valid JWT in the header when testing.
- **In the app:** We now refresh the session before calling these functions when possible, so an expired-but-refreshable token is replaced and 401s from expiry are reduced. If the refresh fails (e.g. refresh token expired), the user must sign in again.
