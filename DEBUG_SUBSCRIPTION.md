# Debugging Subscription Errors

## Common Issues

### 1. Edge Function Not Deployed
The `check-subscription` function needs to be deployed to your Supabase project.

**Fix:**
1. Go to Supabase Dashboard → Edge Functions
2. Deploy `check-subscription` function
3. Or use CLI: `supabase functions deploy check-subscription`

### 2. Missing Environment Variables
The function requires `STRIPE_SECRET_KEY` to be set.

**Fix:**
1. Go to Supabase Dashboard → Edge Functions → Settings → Secrets
2. Add `STRIPE_SECRET_KEY` with your Stripe secret key
3. Also ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set (usually auto-set)

### 3. Function Returns Error
The function might be failing silently. Check the error handling.

### 4. Database Table Missing
The `subscriptions` table might not exist if migrations weren't run.

**Fix:**
- Run all migrations, especially `20251228201424_b3b0772b-840f-49b2-a5ba-c409591c06c5.sql`

## Quick Fix: Make Subscription Check Optional

If you don't need Stripe subscriptions right now, we can make the subscription check fail gracefully and default to "starter" tier.

