# Deploy LLM Proxy Edge Function (Without CLI)

## Quick Deployment via Supabase Dashboard

### Step 1: Open Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your project

### Step 2: Navigate to Edge Functions
1. Click **Edge Functions** in the left sidebar
2. Click **Create a new function** (or **New Function**)

### Step 3: Create the Function
1. **Function Name**: Enter `llm-proxy`
2. **Function Code**: Copy the entire contents of `supabase/functions/llm-proxy/index-standalone.ts`
   - **Note**: Use the `-standalone.ts` version which doesn't require shared modules
   - This makes Dashboard deployment easier
3. Paste it into the code editor
4. Click **Deploy** (or **Save**)

**Alternative**: If you prefer the version with shared modules, you can copy `index.ts` but you'll need to manually inline the `_shared/security.ts` imports.

### Step 4: Disable JWT Verification (IMPORTANT)
The `llm-proxy` function must be public (no JWT required) because:
- It's called automatically by the transformers library via fetch interceptor
- We can't inject auth headers into those automatic requests
- The function is already secured (only allows specific model prefixes)

**In Supabase Dashboard:**
1. After deploying, click on the `llm-proxy` function
2. Go to **Settings** (or look for JWT/authentication settings)
3. Find **"Verify JWT"** or **"Require Authentication"** option
4. **Disable/Uncheck** JWT verification
5. Save the settings

**Note**: The function is still secure because it:
- Only allows `Xenova/` model prefixes
- Validates file paths to prevent path traversal
- Limits file size (100MB max)

### Step 5: (Optional) Add Hugging Face API Token
Hugging Face may block server-side requests with 401 errors. To fix this:

1. Get a Hugging Face API token:
   - Go to https://huggingface.co/settings/tokens
   - Create a new token (read access is sufficient)
   - Copy the token

2. Add it to Edge Function secrets:
   - Go to Supabase Dashboard → Edge Functions → Settings → Secrets
   - Add secret: `HUGGINGFACE_API_TOKEN` = `your-token-here`
   - Save

**Note**: The token is optional but recommended. Without it, Hugging Face may block requests with 401 errors.

### Step 6: Verify Deployment
1. After deployment, you should see the function in the list
2. The function URL will be: `https://[your-project-ref].supabase.co/functions/v1/llm-proxy`
3. Test it by clicking the function and using the "Invoke" button (optional)

## What the Function Does

The `llm-proxy` function:
- Accepts requests for Hugging Face model files
- Fetches them server-side (no CORS issues)
- Returns files with proper CORS headers
- Enables browser-based LLM model loading

## Testing the Proxy

Once deployed, the proxy will automatically be used when:
1. `VITE_SUPABASE_URL` is set in your `.env` file
2. You make a search query that triggers LLM loading
3. Check browser console for: `[LLM] Routing through proxy: ...`

## Alternative: Install Supabase CLI (Optional)

If you want to use CLI in the future:

```bash
# macOS
brew install supabase/tap/supabase

# Or download from:
# https://github.com/supabase/cli/releases
```

Then deploy:
```bash
supabase functions deploy llm-proxy
```

But the Dashboard method works just as well!

## Troubleshooting

**401 Unauthorized errors?**
- Hugging Face blocks server-side requests without authentication
- **Solution**: Add `HUGGINGFACE_API_TOKEN` to Edge Function secrets (see Step 5)
- Get token from: https://huggingface.co/settings/tokens
- Alternative: Use Tauri bundled models for desktop (no proxy needed)

**Function not working?**
- Verify the function is deployed and active
- Check that `VITE_SUPABASE_URL` matches your project URL
- Check browser console for proxy errors
- Check Edge Function logs for detailed error messages

**CORS errors?**
- The proxy should handle CORS automatically
- If issues persist, check the function logs in Supabase Dashboard
