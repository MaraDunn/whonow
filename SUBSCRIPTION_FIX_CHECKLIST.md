# Subscription Not Updating - Complete Fix Checklist

## Current Situation
You subscribed to Business tier in Stripe, but the app still shows your old tier.
The Supabase logs show "Invalid time value" errors.

## Root Cause Analysis

The "Invalid time value" error means the date conversion is failing. I've fixed this in the code, but **the fixed code needs to be deployed to production**.

## ✅ SOLUTION: Deploy the Fixed Functions

### Option 1: Using Supabase CLI (Recommended)

```bash
cd /Users/maradunn/whonow

# Deploy both updated functions
supabase functions deploy check-subscription
supabase functions deploy stripe-webhook
```

### Option 2: Using Supabase Dashboard

1. Go to **Supabase Dashboard** → **Edge Functions**
2. Click on `check-subscription`
3. Click **"Deploy new version"** or **"Edit function"**
4. Copy the entire contents from `/Users/maradunn/whonow/supabase/functions/check-subscription/index.ts`
5. Paste and deploy
6. Repeat for `stripe-webhook`

### Option 3: Using Git Push (if you have CI/CD)

```bash
git add supabase/functions/
git commit -m "Fix subscription date validation"
git push
```

Your deployment pipeline should automatically deploy the functions.

## 🔍 Verification Steps

### 1. Verify Functions Are Deployed

After deploying, check:
1. **Supabase Dashboard** → **Edge Functions** → `check-subscription`
2. Look at "Last deployed" timestamp
3. Should be very recent (within last few minutes)

### 2. Check Logs Again

1. **Supabase Dashboard** → **Edge Functions** → **Logs** → `check-subscription`
2. Force a new check by refreshing your app
3. Look for NEW logs that say:
   ```
   [CHECK-SUBSCRIPTION] Determined subscription tier - {"tier":"business","seatsLimit":100,...}
   ```

### 3. Verify in App

1. Clear browser cache: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
2. Or run in console:
   ```javascript
   localStorage.clear();
   window.location.href = window.location.origin + '/?subscription=success';
   ```
3. App should now show **Business** tier

## 🚨 If Still Not Working After Deployment

### Step A: Get Your Stripe Price ID

1. **Stripe Dashboard** → **Customers** → Search for your email
2. Click your customer → Click the subscription
3. **Copy the Price ID** (looks like `price_1234567890abcdef`)
4. Share this with me

### Step B: Check if Price ID is Mapped

The code looks for this mapping:
```typescript
const DEFAULT_PRICE_TO_TIER = {
  "price_1RifXqDXpGeDw1xnkNvKgEzI": "pro",
  "price_1RifYIDXpGeDw1xn1rBKxeH7": "team",
  "price_1RifYIDXpGeDw1xni9LJxRLQ": "business",  // ← Is this YOUR price ID?
};
```

**If your Price ID doesn't match**, do ONE of these:

**Option A: Add Environment Variable (Recommended)**
1. **Supabase Dashboard** → **Project Settings** → **Edge Functions** → **Secrets**
2. Add: `STRIPE_PRICE_ID_BUSINESS` = `your_actual_price_id`
3. Redeploy functions

**Option B: Update the Code**
Update `DEFAULT_PRICE_TO_TIER` in both functions to include your Price ID:
```typescript
const DEFAULT_PRICE_TO_TIER = {
  "price_1RifXqDXpGeDw1xnkNvKgEzI": "pro",
  "price_1RifYIDXpGeDw1xn1rBKxeH7": "team",
  "price_1RifYIDXpGeDw1xni9LJxRLQ": "business",
  "YOUR_ACTUAL_PRICE_ID": "business",  // ← Add this
};
```

### Step C: Manually Trigger Webhook

If the webhook didn't fire when you subscribed:

1. **Stripe Dashboard** → **Customers** → Your customer → Subscription
2. Click **"Update subscription"**
3. Add a metadata field (any key/value like `test: 1`)
4. Save
5. This triggers `customer.subscription.updated` webhook
6. Check your app again

### Step D: Direct Database Fix (Last Resort)

If everything else fails, manually insert/update:

1. **Supabase Dashboard** → **SQL Editor**
2. Run this (replace `YOUR_USER_ID`):
```sql
-- First, get your user ID
SELECT id, email FROM auth.users WHERE email = 'your@email.com';

-- Then insert/update subscription
INSERT INTO public.subscriptions (
  user_id,
  tier,
  status,
  employee_seats_limit,
  employee_seats_used
) VALUES (
  'YOUR_USER_ID',
  'business',
  'active',
  100,
  0
)
ON CONFLICT (user_id) DO UPDATE SET
  tier = 'business',
  status = 'active',
  employee_seats_limit = 100,
  updated_at = now();
```

3. Refresh your app - should now show Business tier

## 🎯 Most Likely Solution

Based on your error logs, the issue is:
1. ✅ **Date validation error** - FIXED in code (needs deployment)
2. ⚠️ **Functions not deployed yet** - YOU NEED TO DO THIS
3. ⚠️ **Price ID might not match** - CHECK THIS AFTER DEPLOYMENT

## 📋 Action Items (In Order)

- [ ] Deploy `check-subscription` function (via CLI or Dashboard)
- [ ] Deploy `stripe-webhook` function (via CLI or Dashboard)
- [ ] Wait 1-2 minutes for deployment
- [ ] Clear browser cache and refresh app
- [ ] Check if tier updated to Business
- [ ] If still not working, get your Stripe Price ID and share it
- [ ] If needed, add environment variable for your Price ID
- [ ] Last resort: manually update database

## 🆘 What to Share if Still Broken

If it's STILL not working after all this, share:

1. **Screenshot of Supabase Edge Functions page** showing deployment timestamp
2. **Your Stripe Price ID** (from Stripe Dashboard → Your subscription)
3. **Latest Supabase function logs** (from AFTER deployment)
4. **Database subscriptions table** (your row, if it exists)

## ⏱️ Timeline Expectations

- Deploy functions: 2-3 minutes
- Webhook processing: 30-60 seconds
- App refresh: Immediate
- **Total time to fix: 5 minutes** (after deployment)

---

**IMPORTANT:** The code fix is done, but it won't take effect until you deploy the functions. The "Invalid time value" error will keep happening until deployment is complete.

