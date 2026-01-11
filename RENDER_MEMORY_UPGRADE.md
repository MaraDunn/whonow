# Render Memory Upgrade Guide

## Current Issue

**Error Messages:**
- "Ran out of memory (used over 512MB) while running your code"
- "Service recovered" (indicates intermittent failures)

**Root Cause:**
- Render free tier has **512MB memory limit**
- PaddleOCR models require **~200-300MB memory**
- Python/FastAPI runtime requires **~100-150MB memory**
- Total usage: **~400-450MB** (too close to 512MB limit)
- Result: **Service crashes when memory spikes**

---

## ✅ Solution: Upgrade to Render Starter Plan

### Why Upgrade?

**Render Starter Plan ($7/month):**
- ✅ **1GB memory** (double the free tier)
- ✅ **Always-on service** (no sleep after inactivity)
- ✅ **Better reliability** (more memory headroom)
- ✅ **Same code** (no changes needed)
- ✅ **Same configuration** (just more resources)

**Free Tier Issues:**
- ❌ Only 512MB memory (too tight for PaddleOCR)
- ❌ Service sleeps after 15 min inactivity
- ❌ Intermittent crashes (memory limit exceeded)

---

## 📋 Upgrade Steps

### Step 1: Go to Render Dashboard

1. Visit: https://dashboard.render.com
2. Sign in to your account
3. Navigate to your **`paddleocr-service`** service

### Step 2: Change Plan

1. Click on your service name
2. Go to **"Settings"** tab (or click "Settings" in the sidebar)
3. Scroll down to **"Plan"** section
4. Click **"Change Plan"** or **"Upgrade"** button
5. Select **"Starter"** plan ($7/month)
6. Review the changes
7. Click **"Confirm"** or **"Update Plan"**

### Step 3: Service Restart

- Render will automatically restart your service
- The service will restart with **1GB memory** instead of 512MB
- Wait 2-5 minutes for restart to complete
- Check service status - should show "Live"

### Step 4: Verify

1. **Check Service Status**: Should show "Live" (green)
2. **Check Logs**: Should show no memory errors
3. **Test Health Endpoint**:
   ```bash
   curl https://your-service.onrender.com/health
   ```
   Should return: `{"status": "healthy", ...}`

4. **Test OCR Request**: Should work without crashes

---

## 💰 Cost Comparison

| Plan | Memory | Always-On | Monthly Cost | Reliability |
|------|--------|-----------|--------------|-------------|
| **Free** | 512MB | ❌ No | $0 | ⚠️ Unstable (crashes) |
| **Starter** | 1GB | ✅ Yes | $7 | ✅ Reliable |
| **Standard** | 2GB | ✅ Yes | $25 | ✅ Very Reliable |

**Recommendation:** **Starter plan ($7/month)** is sufficient for PaddleOCR service.

---

## 🔄 Alternative: Migrate to Railway

If you prefer a different platform, Railway is also an option:

### Railway Pricing
- **Hobby**: $5/month (512MB memory) - still tight
- **Developer**: $20/month (1GB memory) - similar to Render Starter
- **Pro**: $20/month + usage (scales better)

### Migration Steps (if switching)

1. **Create Railway Account**: https://railway.app
2. **Create New Project**: Deploy from GitHub repo
3. **Select Directory**: `ocr-service`
4. **Railway auto-detects**: Dockerfile
5. **Deploy**: Automatic deployment
6. **Get URL**: Copy from Railway dashboard
7. **Update Supabase**: Change `OCR_SERVICE_URL` secret

**Note:** Railway Hobby plan ($5/month) still has 512MB memory limit, so you'd need Developer plan ($20/month) for reliable operation.

---

## 📊 Memory Usage Breakdown

### Current Memory Usage (Free Tier - 512MB Limit)

| Component | Memory Usage | Notes |
|-----------|--------------|-------|
| Python Runtime | ~50MB | Base Python interpreter |
| FastAPI/Uvicorn | ~50MB | Web server |
| System Libraries | ~50MB | OS dependencies |
| PaddleOCR Models | ~200-300MB | **Largest component** |
| **Total Base** | **~350-450MB** | **Too close to 512MB limit!** |
| **Spike/Margin** | **~50-100MB** | **Not enough headroom** |

### After Upgrade (Starter - 1GB Limit)

| Component | Memory Usage | Notes |
|-----------|--------------|-------|
| Python Runtime | ~50MB | Base Python interpreter |
| FastAPI/Uvicorn | ~50MB | Web server |
| System Libraries | ~50MB | OS dependencies |
| PaddleOCR Models | ~200-300MB | Models loaded |
| **Total Base** | **~350-450MB** | Same as before |
| **Available Headroom** | **~550-650MB** | **Plenty of room!** |

**Result:** Service will be stable with 1GB memory.

---

## ⚠️ Important Notes

### Before Upgrading

1. **Backup**: Your service configuration is in `render.yaml` (already safe)
2. **No Code Changes**: Upgrade doesn't require any code changes
3. **Same URL**: Your service URL will remain the same
4. **Downtime**: ~2-5 minutes during restart (automatic)

### After Upgrading

1. **Monitor Logs**: Check for any errors after restart
2. **Test Service**: Verify health endpoint and OCR requests work
3. **No Memory Errors**: Should not see "out of memory" errors anymore
4. **Better Performance**: Service will be more reliable

### If You Can't Upgrade Right Now

**Temporary Workarounds** (not recommended for production):

1. **Accept Intermittent Failures**: Service will work sometimes, crash sometimes
2. **Reduce Usage**: Process fewer/smaller images (not practical)
3. **Optimize Code**: Would require significant code changes (not worth it)

**Note:** These workarounds are not sustainable. Upgrade is the best solution.

---

## ✅ Verification Checklist

After upgrading, verify:

- [ ] Service status shows "Live" (not "Failed")
- [ ] No memory errors in logs
- [ ] Health endpoint returns 200 OK
- [ ] OCR requests complete successfully
- [ ] No "out of memory" errors
- [ ] Service remains stable over time

---

## 🆘 Troubleshooting

### Issue: Upgrade button not visible

**Possible causes:**
- Already on Starter plan (check Settings → Plan)
- Payment method not added
- Account restrictions

**Fix:**
- Add payment method in Render Dashboard → Billing
- Contact Render support if needed

### Issue: Service still shows memory errors after upgrade

**Possible causes:**
- Service hasn't restarted yet (wait 5 minutes)
- Wrong plan selected (verify Settings → Plan shows "Starter")
- Multiple services (check you upgraded the correct one)

**Fix:**
- Wait for service restart to complete
- Verify plan in Settings
- Check logs for confirmation of memory limit

### Issue: Service URL changed after upgrade

**This shouldn't happen**, but if it does:
- Check new URL in Render Dashboard
- Update `OCR_SERVICE_URL` in Supabase secrets
- Redeploy edge function if needed

---

## 📞 Support

- **Render Support**: https://render.com/docs/support
- **Render Dashboard**: https://dashboard.render.com
- **Render Documentation**: https://render.com/docs

---

## 📝 Summary

**Your Current Situation:**
- ✅ Service code is correct (lazy initialization implemented)
- ✅ Configuration is correct (render.yaml)
- ❌ Memory limit is too low (512MB on free tier)
- ❌ Service crashes when memory usage spikes

**Solution:**
- ✅ Upgrade to Render Starter plan ($7/month)
- ✅ Provides 1GB memory (sufficient for PaddleOCR)
- ✅ Always-on service (no sleep)
- ✅ Better reliability

**Cost:** $7/month (well worth it for production use)

**Next Steps:**
1. Go to Render Dashboard → Your Service → Settings
2. Click "Change Plan" → Select "Starter"
3. Confirm upgrade
4. Wait for service restart (2-5 minutes)
5. Verify service is working (no memory errors)

---

**You're ready to upgrade!** 🚀
