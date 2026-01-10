# OCR Service 502 Error - Fix Guide

You're getting a **502 Bad Gateway** error, which means your edge function is reaching the OCR service, but the service is returning an error.

## ✅ What's Working

- ✅ Edge function is deployed and running
- ✅ `OCR_SERVICE_URL` is correctly configured
- ✅ Edge function is successfully calling the OCR service
- ✅ Request is being sent correctly

## ❌ What's Not Working

- ❌ OCR service is returning 502 (service unavailable)

---

## Step 1: Check Render Service Status

### In Render Dashboard:

1. Go to **https://dashboard.render.com**
2. Find your **`paddleocr-service`**
3. Check the **status**:
   - 🟢 **"Live"** = Service is running
   - 🟡 **"Building"** = Still deploying (wait for it to finish)
   - 🔴 **"Crashed"** = Service crashed (check logs)
   - ⚪ **"Sleeping"** = Free tier service is sleeping (needs to wake up)

---

## Step 2: Test OCR Service Health Endpoint

Open in your browser:
```
https://paddleocr-service-cnfl.onrender.com/health
```

### Expected Response:
```json
{
  "status": "healthy",
  "ocr_initialized": true,
  "gpu_available": false
}
```

### Possible Issues:

**If you see:**
- **502/503 Error Page** → Service is sleeping or crashed
- **Connection refused** → Service URL is wrong or service doesn't exist
- **"Not Found"** → Service isn't deployed yet
- **Works!** → Service is fine, issue might be with `/ocr` endpoint

---

## Step 3: Check Render Logs

### In Render Dashboard:

1. Go to your **`paddleocr-service`**
2. Click **"Logs"** tab
3. Look for:
   - **Build errors** (red text)
   - **Runtime errors** (Python errors, crashes)
   - **"Listening on port 8000"** (service started successfully)
   - **"PaddleOCR initialized successfully"** (OCR is ready)

### Common Errors in Logs:

**"ModuleNotFoundError"** → Dependencies not installed properly
**"Port already in use"** → Configuration issue
**"PaddleOCR initialization failed"** → Model download issue
**No errors, but service crashed** → Memory limit exceeded (free tier)

---

## Step 4: Render Free Tier - Service Sleeping

If your service is on **Render Free Tier**:

- ⏰ **Services sleep after 15 minutes of inactivity**
- 🔄 **First request after sleep takes 30-60 seconds** to wake up
- ⚠️ **502 errors are common** during wake-up period

### Solutions:

**Option A: Wait and Retry**
- Wait 30-60 seconds
- Try scanning again
- Service should wake up and work

**Option B: Keep Service Warm**
- Add a health check ping every 10 minutes (see below)

**Option C: Upgrade to Paid Tier**
- Render Starter: $7/month
- Service stays always-on (no sleeping)

---

## Step 5: Verify Service is Running

### Quick Test (in Browser):

1. Visit: `https://paddleocr-service-cnfl.onrender.com/health`
2. **If it works** → Service is running, issue might be with `/ocr` endpoint
3. **If it doesn't work** → Service is not running/deployed

### Test OCR Endpoint Directly:

If you have `curl` installed, test the OCR endpoint:

```bash
curl -X POST https://paddleocr-service-cnfl.onrender.com/ocr \
  -H "Content-Type: application/json" \
  -d '{"image": "data:image/jpeg;base64,/9j/4AAQ...", "enhance": true}'
```

Replace `/9j/4AAQ...` with actual base64 image data.

---

## Step 6: Common Issues & Fixes

### Issue: Service Status Shows "Building"

**Fix**: Wait for deployment to complete (5-10 minutes)

### Issue: Service Status Shows "Crashed"

**Fix**:
1. Check Render logs for errors
2. Common causes:
   - PaddleOCR initialization failed
   - Out of memory (free tier has limits)
   - Python dependencies missing
3. Try redeploying the service

### Issue: Service Status Shows "Sleeping"

**Fix**:
- First request will take 30-60 seconds
- Wait and retry
- Or upgrade to paid tier for always-on

### Issue: Health Check Works, But /ocr Returns 502

**Fix**:
- Check Render logs for `/ocr` endpoint errors
- May be a Python error in the OCR processing
- Check if PaddleOCR initialized successfully

### Issue: Service Returns HTML Error Page

**Fix**:
- Service crashed or not properly deployed
- Check Render logs
- Verify Docker build completed successfully

---

## Step 7: Keep Free Tier Service Warm (Optional)

To prevent service from sleeping, you can ping it periodically.

### Add to Your App (Optional):

```typescript
// Ping OCR service every 10 minutes to keep it awake
if (typeof window !== 'undefined') {
  setInterval(() => {
    fetch('https://paddleocr-service-cnfl.onrender.com/health')
      .catch(() => {}); // Ignore errors
  }, 10 * 60 * 1000); // 10 minutes
}
```

Add this to your `main.tsx` or `App.tsx` file.

---

## Quick Diagnostic Checklist

- [ ] Render service status shows "Live" (not "Building" or "Crashed")
- [ ] Health endpoint works: `https://paddleocr-service-cnfl.onrender.com/health`
- [ ] Render logs show "PaddleOCR initialized successfully"
- [ ] Render logs show "Listening on port 8000"
- [ ] No Python errors in Render logs
- [ ] Service has been running for at least 1 minute (if first request)
- [ ] Tried waiting 30-60 seconds and scanning again (for free tier)

---

## Most Likely Issue

Based on the 502 error, your service is probably:

1. **On free tier and sleeping** → Wait 30-60 seconds and try again
2. **Still building/deploying** → Check Render dashboard, wait for "Live" status
3. **Crashed during startup** → Check Render logs for errors

**Check the Render service status first** - that will tell you exactly what's wrong!

---

## If Still Not Working

Share:
1. Render service status (Live/Building/Crashed/Sleeping)
2. Health endpoint test result
3. Last 20 lines of Render logs
4. Any errors you see in Render logs

This will help identify the exact issue!

