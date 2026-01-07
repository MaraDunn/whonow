# Debug Subscription Issue - Step by Step

Based on the error logs showing "Invalid time value", let me help you systematically debug this.

## Step 1: Check Current Supabase Logs

1. Go to **Supabase Dashboard** → **Edge Functions** → **Logs**
2. Select `check-subscription`
3. Look for the **MOST RECENT** logs (after you deployed the fix)
4. Share what you see - specifically look for:
   - `[CHECK-SUBSCRIPTION] Determined subscription tier` - **What tier does it say?**
   - `[CHECK-SUBSCRIPTION] Active subscription found` - Is this present?
   - Any new error messages

## Step 2: Verify Functions Were Deployed

The fix won't work until the functions are deployed. Check:

1. **Supabase Dashboard** → **Edge Functions**
2. Look at `check-subscription` - what's the "Last deployed" timestamp?
3. If it's older than when you made the changes, **the fix isn't deployed yet**

**To deploy:**
```bash
# If you have Supabase CLI
supabase functions deploy check-subscription
supabase functions deploy stripe-webhook

# Or via Dashboard:
# Edge Functions → check-subscription → Deploy new version → Paste code
```

## Step 3: Get Your Actual Stripe Price ID

This is the most critical step:

1. Go to **Stripe Dashboard** → **Customers**
2. Search for your email
3. Click on your customer
4. Click on the subscription
5. **Copy the exact Price ID** (starts with `price_`)

**Then check if it's mapped:**

In `check-subscription/index.ts`, the DEFAULT_PRICE_TO_TIER is:
```typescript
const DEFAULT_PRICE_TO_TIER: Record<string, string> = {
  "price_1RifXqDXpGeDw1xnkNvKgEzI": "pro",
  "price_1RifYIDXpGeDw1xn1rBKxeH7": "team",
  "price_1RifYIDXpGeDw1xni9LJxRLQ": "business",
};
```

**Does your Price ID match `"price_1RifYIDXpGeDw1xni9LJxRLQ"`?**

If NO → That's the problem! Your price ID isn't mapped.

## Step 4: Check Subscription Status in Stripe

In Stripe, what is the **exact status** of your subscription?
- ✅ Active
- ⚠️ Incomplete
- ⚠️ Trialing
- ⚠️ Past Due
- ❌ Canceled

If it's anything other than "Active", that could be why.

## Step 5: Check Database Directly

Let's see what's actually in your database:

1. **Supabase Dashboard** → **Table Editor** → **subscriptions**
2. Find your row (if it exists)
3. What does the `tier` column say?
4. What does the `status` column say?

**If no row exists** → The upsert is failing or hasn't run yet

## Step 6: Force a Fresh Check

After functions are deployed, force a new subscription check:

**Open browser console (F12) and run:**
```javascript
// Clear all cached data
localStorage.clear();
sessionStorage.clear();

// Force fresh check with detailed logging
const checkSub = async () => {
  try {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const response = await fetch('https://[YOUR-PROJECT-REF].supabase.co/functions/v1/check-subscription', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    console.log('Subscription data:', data);
    return data;
  } catch (error) {
    console.error('Error:', error);
  }
};

checkSub();
```

Replace `[YOUR-PROJECT-REF]` with your actual Supabase project reference.

## Common Issues & Solutions

### Issue 1: "Invalid time value" still appearing
**Cause:** Functions not deployed yet
**Solution:** Deploy the updated functions

### Issue 2: Tier shows as "pro" instead of "business"
**Cause:** Price ID not mapped correctly
**Solution:** Add environment variable or update DEFAULT_PRICE_TO_TIER

### Issue 3: "No active subscription found"
**Cause:** Subscription status in Stripe isn't "active"
**Solution:** Check Stripe dashboard, might need to complete payment

### Issue 4: Database shows wrong tier
**Cause:** Webhook didn't fire or failed
**Solution:** Trigger manually by updating subscription in Stripe (add a tag)

## What I Need From You

To help you further, please provide:

1. **From Stripe Dashboard**:
   - Your subscription's exact Price ID: `price_???`
   - Subscription status: Active/Incomplete/etc.

2. **From Supabase Function Logs** (most recent):
   - Copy the full log output from `check-subscription`
   - Include any ERROR messages

3. **From Supabase Database**:
   - What's in your `subscriptions` table row (if exists)
   - Specifically: `tier`, `status`, `stripe_subscription_id`

4. **Deployment Status**:
   - Did you deploy the functions after the fix?
   - How did you deploy them (CLI or Dashboard)?

## Quick Diagnostic Command

If you have `curl`, run this to test the function directly:

```bash
# Get your access token first (from browser console):
# const token = (await supabase.auth.getSession()).data.session.access_token;
# console.log(token);

curl -X POST https://[YOUR-PROJECT-REF].supabase.co/functions/v1/check-subscription \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

This will show you exactly what the function is returning.

