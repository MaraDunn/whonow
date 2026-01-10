# OCR 500 Error - Diagnostic Guide

You're getting a 500 error from the edge function. Follow these steps to diagnose:

## Step 1: Check Supabase Edge Function Logs

1. Go to **Supabase Dashboard** → **Edge Functions** → **scan-business-card-ai**
2. Click **"Logs"** tab
3. Look for the most recent error entries

You should see messages like:
- `OCR_SERVICE_URL configured: YES/NO`
- `Calling OCR service at: https://...`
- `OCR service fetch error: ...`
- Or specific error messages

**Share what you see in the logs** - this will tell us exactly what's failing.

---

## Step 2: Verify OCR Service is Deployed and Running

### Check if OCR Service is Deployed:

1. Go to **Render Dashboard** (or Railway)
2. Check if `paddleocr-service` is deployed and running
3. Look for status: Should be "Live" or "Running"

### Test OCR Service Directly:

Open in your browser:
```
https://your-ocr-service.onrender.com/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "ocr_initialized": true,
  "gpu_available": false
}
```

**If you get:**
- **502/503/404**: Service is not deployed or crashed
- **Connection refused**: Service URL is wrong
- **Works**: Service is fine, issue is in edge function

---

## Step 3: Verify OCR_SERVICE_URL is Set in Supabase

1. Go to **Supabase Dashboard** → **Edge Functions** → **Settings** (or **Manage secrets**)
2. Look for `OCR_SERVICE_URL` in the list
3. **If missing**, add it:
   - Click **"Add new secret"** or **"New environment variable"**
   - **Name**: `OCR_SERVICE_URL`
   - **Value**: Your OCR service URL from Render (e.g., `https://paddleocr-service-xxxx.onrender.com`)
   - **Important**: No trailing slash!
   - Click **"Save"**
4. **Redeploy** the edge function after adding:
   - Go to **scan-business-card-ai** → Click **"Deploy"** or **"Redeploy"**

---

## Step 4: Common Issues & Solutions

### Issue: "OCR_SERVICE_URL environment variable not set"

**Fix**: See Step 3 above

### Issue: "Failed to reach OCR service" or "Connection refused"

**Possible causes:**
- OCR service URL is incorrect (typo, wrong domain)
- OCR service is not deployed yet
- OCR service crashed

**Fix**:
1. Verify service URL is correct (copy from Render dashboard)
2. Check Render logs to see if service is running
3. Make sure service is actually deployed (not just created)

### Issue: "OCR service returned error 502/503"

**Fix**:
- Service is starting up (wait 30 seconds and retry)
- Service crashed (check Render logs)
- Render free tier service went to sleep (first request takes 30-60 seconds)

### Issue: "OCR service returned error page" (HTML instead of JSON)

**Fix**:
- Service is not properly deployed
- Check Render logs for build/runtime errors
- Redeploy the OCR service

---

## Step 5: Test OCR Service Directly with cURL

If you have terminal access, test the OCR service:

```bash
curl -X POST https://your-ocr-service.onrender.com/ocr \
  -H "Content-Type: application/json" \
  -d '{"image": "data:image/jpeg;base64,/9j/4AAQ...", "enhance": true}'
```

**If this works**: Edge function issue
**If this fails**: OCR service issue

---

## Quick Checklist

- [ ] OCR service is deployed and shows "Live" status in Render
- [ ] OCR service health check works: `https://your-service.onrender.com/health`
- [ ] `OCR_SERVICE_URL` is set in Supabase Edge Functions settings
- [ ] `OCR_SERVICE_URL` has no trailing slash
- [ ] Edge function was redeployed after setting `OCR_SERVICE_URL`
- [ ] Checked Supabase edge function logs for specific error
- [ ] Checked Render OCR service logs for errors

---

## Most Likely Issue

Based on the 500 error, the most common issues are:

1. **OCR_SERVICE_URL not set** (90% of cases)
2. **OCR service not deployed/running** (5%)
3. **Wrong URL or typo in OCR_SERVICE_URL** (3%)
4. **OCR service crashed** (2%)

**Start with Step 1** - check the Supabase logs. They will tell you exactly what's wrong!

