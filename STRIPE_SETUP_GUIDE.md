# Stripe Integration Setup Guide

## Current Issue: "Edge Function returned a non-2xx status code"

This error typically means the `create-checkout` edge function is failing. Here's how to fix it:

## Step 1: Verify Edge Functions Are Deployed

1. Go to your Supabase Dashboard
2. Navigate to **Edge Functions**
3. Verify these functions are deployed:
   - `create-checkout`
   - `check-subscription`
   - `customer-portal`
   - `stripe-webhook`

If they're not deployed, you need to deploy them.

## Step 2: Set Up Stripe Secrets

The functions require Stripe API keys:

1. Go to **Supabase Dashboard** → **Edge Functions** → **Settings** → **Secrets**
2. Add these secrets:

### Required Secrets:

```
STRIPE_SECRET_KEY=sk_test_... (or sk_live_... for production)
```

**How to get your Stripe Secret Key:**
1. Go to https://dashboard.stripe.com/apikeys
2. Copy your **Secret key** (starts with `sk_test_` for test mode or `sk_live_` for live mode)
3. Paste it into Supabase secrets

### Optional but Recommended:

```
APP_URL=http://localhost:8080 (or your production URL)
```

## Step 3: Verify Stripe Price IDs

The price IDs in the code must match your Stripe products:

1. Go to **Stripe Dashboard** → **Products**
2. For each subscription tier, check the **Price ID** (starts with `price_`)
3. Update the price IDs in `supabase/functions/create-checkout/index.ts` (self-serve tiers only):

```typescript
const TIER_PRICES: Record<string, string> = {
  pro: "price_YOUR_PRO_PRICE_ID",
  team: "price_YOUR_TEAM_PRICE_ID",
  business: "price_YOUR_BUSINESS_PRICE_ID",
};
```

**Current price IDs in code (self-serve):**
- Pro: `price_1RifXqDXpGeDw1xnkNvKgEzI`
- Team: `price_1RifYIDXpGeDw1xn1rBKxeH7`
- Business: `price_1RifYIDXpGeDw1xni9LJxRLQ`

**Enterprise / Global Enterprise**
- These tiers are no longer offered as self-serve plans.
- The landing page should direct larger orgs to `sales@whonow.com`.

**If these don't match your Stripe products, update them!**

## Step 4: Set Up Stripe Webhook (For Production)

For subscription events to work properly:

1. Go to **Stripe Dashboard** → **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Set endpoint URL to: `https://[your-project-ref].supabase.co/functions/v1/stripe-webhook`
4. Select events to listen to:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
5. Copy the **Signing secret** (starts with `whsec_`)
6. Add it to Supabase secrets as: `STRIPE_WEBHOOK_SECRET`

## Step 5: Free Trial and Customer Portal (No charge until trial end)

**Free trial (14 days):**
- The `create-checkout` Edge Function applies a **14-day free trial** for first-time subscribers. No payment is charged until the trial ends.
- This is set in code via `subscription_data.trial_period_days: 14`. Do **not** add a "Setup fee" or "Initial payment" on your Stripe Prices, or customers could be charged at signup.
- In **Stripe Dashboard → Products → [each Price]**: ensure the price is recurring only, with no one-time or setup fee that would charge immediately.

**Cancel anytime:**
- Users can cancel during the trial (or anytime) to avoid being charged. They do this via the **Stripe Customer Portal** (opened from the app’s "Manage subscription" / "Cancel subscription").
- In **Stripe Dashboard → Settings → Billing → Customer portal**: enable **Cancel subscriptions** so customers can cancel their subscription. Without this, users cannot cancel and may be charged at trial end.

## Step 6: Test the Integration

1. **Check function logs:**
   - Go to **Supabase Dashboard** → **Edge Functions** → **Logs**
   - Try to subscribe
   - Check the logs for error messages

2. **Common errors and fixes:**

   **"STRIPE_SECRET_KEY is not set"**
   - Fix: Add `STRIPE_SECRET_KEY` to Supabase secrets

   **"Invalid tier: ..."**
   - Fix: The tier name doesn't match. Check the tier being passed.

   **"No such price: ..."**
   - Fix: Price ID doesn't exist in Stripe. Update `TIER_PRICES` with correct IDs.

   **"Invalid request body"**
   - Fix: The request isn't sending the tier correctly. Check the frontend code.

## Step 7: Deploy Functions (If Using CLI)

If you have Supabase CLI installed:

```bash
cd /Users/maradunn/whonow
supabase functions deploy create-checkout
supabase functions deploy check-subscription
supabase functions deploy customer-portal
supabase functions deploy stripe-webhook
```

## Troubleshooting

### Check Function Logs

1. Go to **Supabase Dashboard** → **Edge Functions** → **Logs**
2. Select `create-checkout` function
3. Try subscribing again
4. Check the logs for detailed error messages

### Test with curl

```bash
curl -X POST https://[your-project-ref].supabase.co/functions/v1/create-checkout \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tier": "pro"}'
```

Replace:
- `[your-project-ref]` with your Supabase project reference
- `YOUR_ACCESS_TOKEN` with a valid JWT token from your app

### Common Issues

1. **Function not deployed** → Deploy it in Supabase Dashboard
2. **Missing STRIPE_SECRET_KEY** → Add it to secrets
3. **Wrong price IDs** → Update `TIER_PRICES` in the function
4. **CORS errors** → Already handled in the function
5. **Authentication errors** → Check that JWT token is valid

## Quick Checklist

- [ ] Edge functions deployed
- [ ] `STRIPE_SECRET_KEY` set in Supabase secrets
- [ ] Price IDs match your Stripe products
- [ ] `APP_URL` set (optional but recommended)
- [ ] Webhook configured (for production)
- [ ] Test subscription works

## Need Help?

Check the function logs in Supabase Dashboard for detailed error messages. The logs will show exactly what's failing.

