# Waitlist Debugging Guide

## Step 1: Check Browser Console

Open your browser's Developer Tools (F12) and check the Console tab when you try to join the waitlist. Look for:

- **CORS errors** (e.g., "Access to fetch at ... has been blocked by CORS policy")
- **Network errors** (e.g., 404, 500, 401)
- **JavaScript errors**

## Step 2: Check Network Tab

1. Open Developer Tools → Network tab
2. Try to join the waitlist
3. Look for the request to `/functions/v1/waitlist`
4. Check:
   - **Status code** (200 = success, 4xx/5xx = error)
   - **Response body** (what error message is returned?)
   - **Request headers** (is `apikey` header present?)

## Step 3: Verify Waitlist Function is Deployed

1. Go to **Supabase Dashboard** → **Edge Functions**
2. Check if `waitlist` function exists and is deployed
3. If not deployed:
   - Click "Create a new function"
   - Name it `waitlist`
   - Copy code from `supabase/functions/waitlist/index.ts`
   - Deploy

## Step 4: Check Supabase Edge Function Secrets

The waitlist function needs these environment variables (set in Supabase Dashboard → Edge Functions → Settings → Secrets):

- ✅ `SUPABASE_URL` - Usually auto-set, but verify it's there
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Usually auto-set, but verify it's there
- ⚠️ `ALLOWED_ORIGINS` - **This is critical for CORS!**

**To set ALLOWED_ORIGINS:**
1. Go to Supabase Dashboard → Edge Functions → Settings → Secrets
2. Add secret: `ALLOWED_ORIGINS`
3. Value: Your production domain(s), comma-separated
   - Example: `https://yourdomain.com,https://www.yourdomain.com`
   - For local dev: `http://localhost:8080,http://localhost:5173,http://localhost:3000`

## Step 5: Verify Waitlist Table Exists

1. Go to **Supabase Dashboard** → **Database** → **Tables**
2. Check if `waitlist` table exists
3. If not, run the migration:
   - `supabase/migrations/20260112124454_waitlist_table.sql`
   - `supabase/migrations/20260118000000_waitlist_enable_rls.sql`

## Step 6: Check Function Logs

1. Go to **Supabase Dashboard** → **Edge Functions** → **Logs**
2. Select `waitlist` function
3. Try to join the waitlist again
4. Check the logs for error messages

Common errors you might see:
- "Missing Supabase configuration" → `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` not set
- "Failed to register email" → Database error (check table exists, RLS policies)
- CORS errors → `ALLOWED_ORIGINS` not set correctly

## Step 7: Test Function Directly

You can test the function with curl:

```bash
curl -X POST https://[your-project-ref].supabase.co/functions/v1/waitlist \
  -H "Content-Type: application/json" \
  -H "apikey: [your-anon-key]" \
  -d '{"email": "test@example.com"}'
```

Replace:
- `[your-project-ref]` with your Supabase project reference
- `[your-anon-key]` with your anon public key

Expected response:
```json
{"success": true, "message": "Email registered successfully"}
```

## Step 8: Check Netlify Environment Variables

Verify these are set in Netlify (Site settings → Environment variables):

- ✅ `VITE_SUPABASE_URL`
- ✅ `VITE_SUPABASE_PUBLISHABLE_KEY`

**Important:** After setting/changing these, you need to **rebuild** your site in Netlify!

## Common Issues & Fixes

### Issue: "CORS policy" error
**Fix:** Set `ALLOWED_ORIGINS` in Supabase Edge Function secrets with your domain

### Issue: "Server configuration error"
**Fix:** Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in Supabase Edge Function secrets

### Issue: "Failed to register email"
**Fix:** 
- Check if `waitlist` table exists
- Check if RLS is enabled (it should be, but service role bypasses it)
- Check function logs for specific database error

### Issue: 404 Not Found
**Fix:** The `waitlist` Edge Function is not deployed. Deploy it in Supabase Dashboard.

### Issue: Works locally but not in production
**Fix:** 
- Check `ALLOWED_ORIGINS` includes your production domain
- Verify Netlify environment variables are set
- Rebuild your Netlify site after setting environment variables

## Quick Test Script

Save this as `test-waitlist.html` and open in browser:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Waitlist Test</title>
</head>
<body>
  <h1>Waitlist Test</h1>
  <input type="email" id="email" placeholder="test@example.com" />
  <button onclick="testWaitlist()">Test</button>
  <pre id="result"></pre>

  <script>
    async function testWaitlist() {
      const email = document.getElementById('email').value;
      const supabaseUrl = prompt('Enter your Supabase URL:');
      const anonKey = prompt('Enter your anon key:');
      
      const resultEl = document.getElementById('result');
      resultEl.textContent = 'Testing...';
      
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/waitlist`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': anonKey,
          },
          body: JSON.stringify({ email }),
        });
        
        const data = await response.json();
        resultEl.textContent = `Status: ${response.status}\nResponse: ${JSON.stringify(data, null, 2)}`;
      } catch (error) {
        resultEl.textContent = `Error: ${error.message}`;
      }
    }
  </script>
</body>
</html>
```
