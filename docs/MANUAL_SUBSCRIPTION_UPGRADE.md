# Manually upgrading an account’s subscription tier (no Stripe)

Use this when you want to set or change a user’s subscription tier **without** going through Stripe (e.g. comped accounts, internal testers, support adjustments).

---

## 1. Valid tier values

The `tier` column uses the enum `subscription_tier`. Allowed values:

| Tier               | Value             | Typical seat limit |
|--------------------|-------------------|--------------------|
| Starter            | `starter`         | 1                  |
| Pro                | `pro`             | 1                  |
| Team               | `team`            | 25                 |
| Business           | `business`        | 100                |
| Enterprise         | `enterprise`      | set as needed      |
| Global Enterprise  | `global_enterprise` | set as needed   |

The app and `get_user_subscription_tier()` only treat rows with **`status = 'active'`** as active.

---

## 2. Get the user’s ID

You need the **Supabase Auth user UUID** for the account you’re upgrading.

- **Supabase Dashboard:** Authentication → Users → open the user → copy **User UID**.
- **Or via SQL:**  
  `SELECT id, email FROM auth.users WHERE email = 'user@example.com';`  
  Use the `id` (UUID) as `user_id`.

---

## 3. Run the update in Supabase (bypasses RLS)

RLS on `subscriptions` only allows users to update **their own** row. To change another account’s tier you must use one of:

- **Supabase Dashboard → SQL Editor** (runs with elevated privileges), or  
- **Service role** from a backend/script.

Replace `USER_ID_HERE` with the UUID from step 2, and adjust `tier` and `employee_seats_limit` as needed.

### Option A: User already has a row in `subscriptions`

```sql
UPDATE public.subscriptions
SET
  tier = 'pro',                    -- use: starter, pro, team, business, enterprise, global_enterprise
  status = 'active',
  employee_seats_limit = 1,        -- 1 for starter/pro; 25 for team; 100 for business; set as needed for enterprise
  updated_at = now()
WHERE user_id = 'USER_ID_HERE';
```

### Option B: User has no row yet (e.g. new account)

```sql
INSERT INTO public.subscriptions (
  user_id,
  tier,
  status,
  employee_seats_limit,
  company_id
) VALUES (
  'USER_ID_HERE',
  'pro',                           -- starter, pro, team, business, enterprise, global_enterprise
  'active',
  1,                               -- 1 for starter/pro; 25 for team; 100 for business
  NULL                             -- optional: set to company UUID if they already have an org
)
ON CONFLICT (user_id) DO UPDATE SET
  tier = EXCLUDED.tier,
  status = EXCLUDED.status,
  employee_seats_limit = EXCLUDED.employee_seats_limit,
  updated_at = now();
```

- **Stripe columns** (`stripe_customer_id`, `stripe_subscription_id`) can stay `NULL` or unchanged; the app does not require them for manual tiers.
- **Period dates** (`current_period_start`, `current_period_end`) can stay `NULL` for manual upgrades; the app will still treat the subscription as active.

---

## 4. Suggested seat limits by tier

Match what the app uses for Stripe-backed subscriptions:

| Tier   | `employee_seats_limit` |
|--------|------------------------|
| starter | 1  |
| pro    | 1  |
| team   | 25 |
| business | 100 |
| enterprise / global_enterprise | Set as needed (e.g. 100 or more) |

---

## 5. After updating

- **App:** The user may need to **sign out and sign back in** (or refresh) so the app clears its subscription cache and refetches from the DB.
- **Verification:** In Table Editor → `subscriptions`, confirm a row for that `user_id` with `tier` and `status = 'active'`.

---

## 6. Quick reference: one-liner (SQL Editor)

Upgrade a single user by email to Pro (no Stripe):

```sql
INSERT INTO public.subscriptions (user_id, tier, status, employee_seats_limit)
SELECT id, 'pro', 'active', 1
FROM auth.users
WHERE email = 'user@example.com'
ON CONFLICT (user_id) DO UPDATE SET
  tier = 'pro',
  status = 'active',
  employee_seats_limit = 1,
  updated_at = now();
```

Change `user@example.com` and `'pro'` / `1` as needed.
