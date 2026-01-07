# Subscription Tier Not Updating - Troubleshooting Guide

## Issue
After subscribing to Business tier in Stripe, the app still shows the old subscription tier.

## Root Causes & Solutions

### 1. **Price ID Mapping Missing (Most Common)**

The `check-subscription` function maps Stripe price IDs to tiers. If your Business tier price ID isn't configured, it won't be recognized.

**Check the mapping in:**
- `supabase/functions/check-subscription/index.ts` (lines 13-18)
- `supabase/functions/stripe-webhook/index.ts` (lines 9-23)

**Current mapping:**
```typescript
const DEFAULT_PRICE_TO_TIER: Record<string, string> = {
  "price_1RifXqDXpGeDw1xnkNvKgEzI": "pro",
  "price_1RifYIDXpGeDw1xn1rBKxeH7": "team",
  "price_1RifYIDXpGeDw1xni9LJxRLQ": "business",
};
```

**To fix:**
1. Go to Stripe Dashboard → Products
2. Find your Business tier product
3. Copy the **Price ID** (starts with `price_`)
4. Add environment variable in Supabase:
   ```
   STRIPE_PRICE_ID_BUSINESS = your_actual_price_id
   ```
5. Or update the DEFAULT_PRICE_TO_TIER map in both functions

### 2. **Stripe Webhook Not Configured**

Webhooks update subscriptions in real-time. Without them, the app only checks when you manually refresh.

**To verify webhooks:**
1. Go to Stripe Dashboard → Developers → Webhooks
2. Check if endpoint exists: `https://[your-project-ref].supabase.co/functions/v1/stripe-webhook`
3. Verify these events are selected:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`

**If webhook is missing:**
1. Add the endpoint URL above
2. Select the events
3. Copy the **Signing Secret** (whsec_...)
4. Add to Supabase secrets: `STRIPE_WEBHOOK_SECRET`

### 3. **Database Not Synced**

The subscription might exist in Stripe but not in your Supabase database.

**Check your database:**
```sql
-- Run in Supabase SQL Editor
SELECT * FROM subscriptions WHERE user_id = 'YOUR_USER_ID';
```

**If row is missing or wrong:**
The `check-subscription` function should sync it automatically. Try forcing a refresh (see Solution #4).

### 4. **Frontend Cache Issue**

The app checks subscription every 60 seconds. You might just need to wait or force refresh.

**Immediate fixes:**
1. **Hard refresh the page**: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
2. **Clear browser cache**
3. **Wait 60 seconds** (automatic refresh interval)
4. **Add `?subscription=success` to URL** - This triggers immediate refresh

## Step-by-Step Resolution

### Option A: Quick Fix (Recommended)

1. **Open browser console** (F12)
2. **Run this command**:
   ```javascript
   localStorage.clear();
   window.location.href = window.location.origin + '/?subscription=success';
   ```
3. This will clear cache and force a subscription check

### Option B: Check Supabase Logs

1. Go to **Supabase Dashboard** → **Edge Functions** → **Logs**
2. Select `check-subscription` function
3. Look for recent calls - you should see:
   ```
   [CHECK-SUBSCRIPTION] Active subscription found
   [CHECK-SUBSCRIPTION] Determined subscription tier - {"tier":"business","seatsLimit":100}
   ```
4. If you see errors, they'll tell you what's wrong

### Option C: Manual Database Check

1. Go to **Supabase Dashboard** → **Table Editor** → **subscriptions**
2. Find your user's row
3. Check the `tier` column - it should say "business"
4. If wrong, the webhook or check-subscription function isn't working

### Option D: Verify Stripe Subscription

1. Go to **Stripe Dashboard** → **Customers**
2. Find your customer (search by email)
3. Check subscription status is "Active"
4. Copy the **Price ID** from the subscription
5. Verify it matches one of these:
   - Environment variable: `STRIPE_PRICE_ID_BUSINESS`
   - Or default map: `"price_1RifYIDXpGeDw1xni9LJxRLQ"`

## Common Error Messages

### "No active subscription found"
- Subscription isn't active in Stripe
- Check Stripe dashboard to verify status

### "Subscription check failed"
- Edge function error
- Check Supabase function logs for details

### Tier shows as "pro" instead of "business"
- Price ID mapping is wrong
- Add correct `STRIPE_PRICE_ID_BUSINESS` environment variable

## Environment Variables Checklist

Make sure these are set in Supabase (Project Settings → Edge Functions → Secrets):

```bash
STRIPE_SECRET_KEY=sk_live_...         # or sk_test_ for testing
STRIPE_WEBHOOK_SECRET=whsec_...       # From Stripe webhooks page
STRIPE_PRICE_ID_PRO=price_...         # Optional (has default)
STRIPE_PRICE_ID_TEAM=price_...        # Optional (has default)
STRIPE_PRICE_ID_BUSINESS=price_...    # REQUIRED if using different price ID
```

## Testing the Fix

After applying fixes:

1. **Force refresh**: Add `?subscription=success` to URL
2. **Check the UI**: Should show "Business" tier badge
3. **Test features**: Try accessing Business-tier features
4. **Verify in console**: 
   ```javascript
   // In browser console
   localStorage.getItem('sb-subscription')
   ```

## Still Not Working?

If none of the above work, provide these details:

1. **From Stripe Dashboard**:
   - Subscription status (Active/Cancelled/etc)
   - Price ID of the subscription
   
2. **From Supabase Function Logs** (check-subscription):
   - Recent log messages
   - Any error messages
   
3. **From Browser Console**:
   - Any JavaScript errors
   - Output of: `console.log(subscription)`

## Prevention

To avoid this in the future:

1. **Always configure webhooks** before launching
2. **Test with Stripe test mode** before going live
3. **Set environment variables** for all price IDs
4. **Monitor function logs** after deployments

## Quick Reference Commands

```bash
# Deploy updated functions
supabase functions deploy check-subscription
supabase functions deploy stripe-webhook

# Check function logs
supabase functions logs check-subscription

# Test subscription check manually (in browser console)
fetch('/api/check-subscription', {
  headers: { 'Authorization': 'Bearer ' + localStorage.getItem('sb-access-token') }
})
.then(r => r.json())
.then(console.log)
```

