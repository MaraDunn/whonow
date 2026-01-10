# PaddleOCR Troubleshooting Guide

## 500 Error: Edge Function Failed

If you're seeing a **500 error** when scanning business cards, follow these steps:

---

## Step 1: Check OCR_SERVICE_URL is Set ✅

### In Supabase Dashboard:

1. Go to **Edge Functions** → **Settings** (or **Manage secrets**)
2. Look for `OCR_SERVICE_URL` in the environment variables list
3. **If it's missing**, add it:
   - Click **"Add new secret"** or **"New environment variable"**
   - **Name**: `OCR_SERVICE_URL`
   - **Value**: Your OCR service URL (e.g., `https://paddleocr-service.onrender.com`)
   - **Important**: No trailing slash!
   - Click **"Save"**

4. **Redeploy** the edge function:
   - Go to **Edge Functions** → **scan-business-card-ai**
   - Click **"Deploy"** or **"Redeploy"**

---

## Step 2: Verify OCR Service is Running ✅

### Test the OCR Service Health:

1. **Open your browser**
2. **Go to**: `https://your-ocr-service.onrender.com/health`
   - Replace `your-ocr-service` with your actual service name
3. **Should see**:
   ```json
   {
     "status": "healthy",
     "ocr_initialized": true,
     "gpu_available": false
   }
   ```

### If Service is Down:

**Render Free Tier**:
- Service may be sleeping (spins down after 15 min of inactivity)
- **First request after sleep**: Takes 30-60 seconds to wake up
- **Solution**: Upgrade to paid tier ($7/month) for always-on

**Railway**:
- Check logs in Railway dashboard
- Service should always be running

---

## Step 3: Check Supabase Edge Function Logs ✅

### View Logs:

1. Go to **Supabase Dashboard** → **Edge Functions** → **scan-business-card-ai**
2. Click **"Logs"** tab
3. Look for error messages

### Common Error Messages:

#### "OCR_SERVICE_URL environment variable not set"
**Fix**: See Step 1 above

#### "OCR service failed with status 503"
**Fix**: OCR service is starting up or unavailable. Wait 30 seconds and try again.

#### "Failed to reach OCR service"
**Fix**: 
- Check OCR service URL is correct
- Verify service is deployed and running
- Check service logs in Render/Railway dashboard

#### "Parsing failed: 401"
**Fix**: The `scan-business-card` function requires authentication. Make sure you're logged in to your app.

---

## Step 4: Test OCR Service Directly ✅

### Using cURL (Terminal):

```bash
# Replace with your actual OCR service URL
curl -X POST https://your-ocr-service.onrender.com/ocr \
  -H "Content-Type: application/json" \
  -d '{"image": "data:image/jpeg;base64,/9j/4AAQ...", "enhance": true}'
```

### Using Browser Dev Tools:

1. Open browser console (F12)
2. Run:
```javascript
fetch('https://your-ocr-service.onrender.com/health')
  .then(r => r.json())
  .then(console.log)
```

Should return: `{status: "healthy", ...}`

---

## Step 5: Verify Edge Function is Deployed ✅

### Check Deployment:

1. **Supabase Dashboard** → **Edge Functions**
2. **Verify** `scan-business-card-ai` appears in the list
3. **Check status**: Should show green checkmark or "Active"

### If Function is Missing:

1. Go to **Edge Functions** → **Create a new function**
2. **Name**: `scan-business-card-ai`
3. **Copy code** from `supabase/functions/scan-business-card-ai/index.ts`
4. **Paste** into editor
5. **Click "Deploy"**

---

## Common Issues & Solutions

### Issue: "OCR service request timed out"

**Cause**: OCR service took longer than 60 seconds
**Solutions**:
- Check OCR service logs for errors
- Reduce image size before uploading
- Verify OCR service has enough resources (upgrade plan if needed)

### Issue: Service works in browser but not from edge function

**Cause**: CORS or URL issue
**Solutions**:
- Verify OCR service URL has no trailing slash
- Check OCR service allows requests from Supabase domain
- Check OCR service CORS settings (should allow all origins)

### Issue: First scan works, second scan fails

**Cause**: Render free tier service went to sleep
**Solutions**:
- Wait 30 seconds between scans
- Upgrade to Render paid tier
- Switch to Railway ($5/month, no sleep)

### Issue: "No text detected in image"

**Cause**: Image quality too poor or OCR service issue
**Solutions**:
- Try a clearer image
- Check OCR service logs
- Verify image is valid base64

---

## Debug Checklist

- [ ] `OCR_SERVICE_URL` is set in Supabase Edge Functions settings
- [ ] OCR service health check returns `{"status": "healthy"}`
- [ ] Edge function `scan-business-card-ai` is deployed
- [ ] Edge function logs show no errors
- [ ] OCR service logs show successful requests
- [ ] Image is valid base64 format
- [ ] User is logged in (for authenticated requests)

---

## Getting Help

### Check Logs First:

1. **Supabase Edge Function Logs**:
   - Dashboard → Edge Functions → scan-business-card-ai → Logs
   
2. **OCR Service Logs**:
   - **Render**: Dashboard → Your Service → Logs
   - **Railway**: Dashboard → Your Service → Deployments → View Logs

### Common Log Patterns:

**✅ Success**:
```
=== Calling PaddleOCR Service ===
Calling OCR service at: https://...
OCR Result: { success: true, confidence: 92.3, ... }
=== Calling Parsing Function ===
=== OCR + Parsing Complete ===
```

**❌ Failure**:
```
OCR_SERVICE_URL environment variable not set
```
or
```
OCR service failed with status 503
```
or
```
Failed to reach OCR service: ...
```

---

## Quick Fixes

### Fix 1: Re-deploy Everything

1. **Redeploy OCR Service** (Render/Railway dashboard)
2. **Redeploy Edge Function** (Supabase dashboard)
3. **Clear browser cache** and test again

### Fix 2: Verify Environment Variable

1. Check `OCR_SERVICE_URL` is exactly correct (no typos, no trailing slash)
2. Copy/paste from Render/Railway service URL directly
3. Save and redeploy edge function

### Fix 3: Test with Health Check

1. Call health endpoint first: `https://your-service.com/health`
2. If that works, the service is fine
3. Issue is likely with the edge function or environment variable

---

## Still Not Working?

1. **Share the exact error message** from browser console
2. **Share Supabase edge function logs** (last 20 lines)
3. **Share OCR service logs** (last 20 lines)
4. **Verify** all steps above are completed

Most issues are:
- ❌ Missing `OCR_SERVICE_URL` (90% of issues)
- ❌ OCR service is sleeping (Render free tier)
- ❌ OCR service crashed (check logs)
- ❌ Wrong URL (typo or trailing slash)

