# Render Deployment Guide for PaddleOCR

**Last Updated:** Based on recent commits (2024)
**Status:** ✅ Ready for Deployment

---

## 📋 Overview

This guide will help you deploy the PaddleOCR service to Render.com. The service is configured with:
- ✅ Lazy initialization (prevents startup timeouts)
- ✅ Docker-based deployment
- ✅ Proper Render configuration (`render.yaml`)
- ✅ Health check endpoint

---

## 🚀 Quick Deployment Steps

### Step 1: Verify Configuration Files

Your repository has the correct `render.yaml` at the root:
- ✅ Uses `rootDir: ocr-service` (correct approach)
- ✅ Environment: Docker
- ✅ Health check path: `/health`
- ✅ Environment variables configured

### Step 2: Deploy to Render

#### Option A: Using Render Dashboard (Recommended)

1. **Go to Render Dashboard**
   - Visit: https://dashboard.render.com
   - Sign in or create an account

2. **Create New Web Service**
   - Click **"New +"** → **"Web Service"**
   - Connect your GitHub repository (or GitLab/Bitbucket)
   - Select your `whonow` repository

3. **Configure Service Settings**
   - **Name**: `paddleocr-service` (or any name you prefer)
   - **Environment**: **Docker** (important!)
   - **Region**: Choose closest to your users
   - **Branch**: `main` (or your default branch)
   - **Root Directory**: `ocr-service` (this is critical!)
   - **Dockerfile Path**: Leave empty or set to `Dockerfile` (Render will find it in rootDir)
   - **Plan**: Free (750 hours/month) or Starter ($7/month for always-on)

4. **Environment Variables** (Render will auto-detect from render.yaml, but verify):
   - `PORT`: `8000`
   - `PYTHONUNBUFFERED`: `1`

5. **Health Check**
   - **Path**: `/health`
   - This helps Render know when your service is ready

6. **Deploy**
   - Click **"Create Web Service"**
   - Wait for deployment (5-10 minutes for first build)
   - Render will:
     - Clone your repository
     - Navigate to `ocr-service` directory
     - Build Docker image
     - Start the service

#### Option B: Using Render Blueprint (render.yaml)

If you've connected your repository, Render should auto-detect the `render.yaml` file:

1. Go to **Dashboard** → **New** → **Blueprint**
2. Connect your repository
3. Render will read `render.yaml` and create the service automatically
4. Review settings and click **"Apply"**

---

## ✅ Verification Steps

### 1. Check Service Status

1. Go to your service in Render Dashboard
2. Status should show **"Live"** (not "Building" or "Failed")
3. Check **Logs** tab for any errors

### 2. Test Health Endpoint

Your service URL will be: `https://paddleocr-service-XXXX.onrender.com`

Test the health endpoint:
```bash
curl https://paddleocr-service-XXXX.onrender.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "ocr_initialized": false,
  "ocr_initializing": false,
  "ocr_init_error": null,
  "gpu_available": false
}
```

**Note**: `ocr_initialized: false` is normal - PaddleOCR initializes on first request (lazy initialization).

### 3. Test OCR Endpoint (First Request)

The first request will take 60-120 seconds while PaddleOCR downloads models:

```bash
# Create a test image (base64 encoded)
# Or use this minimal test:
curl -X POST https://paddleocr-service-XXXX.onrender.com/ocr \
  -H "Content-Type: application/json" \
  -d '{"image": "data:image/jpeg;base64,/9j/4AAQ...", "enhance": true}'
```

After models are downloaded, subsequent requests will be much faster (2-5 seconds).

---

## 🔧 Configuration Details

### render.yaml Structure

Your root `render.yaml` file contains:

```yaml
services:
  - type: web
    name: paddleocr-service
    rootDir: ocr-service          # Directory containing Dockerfile
    env: docker                   # Use Docker (not Python directly)
    plan: free                    # Free tier (or 'starter' for $7/month)
    healthCheckPath: /health      # Health check endpoint
    envVars:
      - key: PORT
        value: 8000
      - key: PYTHONUNBUFFERED
        value: 1
```

### Key Configuration Points

1. **rootDir: ocr-service**
   - Tells Render where to find your Dockerfile
   - Render will look for `Dockerfile` in this directory
   - This is the correct approach (newer than dockerfilePath/dockerContext)

2. **env: docker**
   - Uses Docker instead of native Python
   - Required for PaddleOCR (needs system dependencies)
   - More reliable for complex dependencies

3. **healthCheckPath: /health**
   - Render checks this endpoint to know if service is ready
   - Helps prevent deployment issues

---

## 📊 Expected Behavior

### First Deployment
- **Build time**: 5-10 minutes (downloads PaddleOCR models during Docker build)
- **Startup time**: 10-30 seconds
- **First request**: 60-120 seconds (models download if not pre-downloaded)
- **Subsequent requests**: 2-5 seconds

### Service Behavior

1. **Service starts** → FastAPI server runs
2. **PaddleOCR NOT initialized** → Lazy initialization prevents startup timeouts
3. **First OCR request** → PaddleOCR initializes (60-120 seconds)
4. **Subsequent requests** → Fast (2-5 seconds)

### Render Free Tier Considerations

- **Service sleeps** after 15 minutes of inactivity
- **First request after sleep**: 30-60 seconds to wake up
- **Memory limit**: 512MB (may cause issues with large models)
- **Recommendation**: Upgrade to Starter ($7/month) for:
  - Always-on service (no sleep)
  - 1GB memory (more reliable)
  - Better performance

---

## 🐛 Troubleshooting

### Issue: Service shows "Failed" status

**Check logs** in Render Dashboard:
- Look for Docker build errors
- Check for Python dependency issues
- Verify Dockerfile syntax

**Common fixes**:
- Ensure `rootDir: ocr-service` is correct
- Verify `Dockerfile` exists in `ocr-service/` directory
- Check Docker build logs for specific errors

### Issue: Health endpoint returns 502

**Causes**:
- Service is still building (wait 5-10 minutes)
- Service crashed during startup (check logs)
- Docker build failed (check build logs)

**Fix**:
- Wait for deployment to complete
- Check Render logs for errors
- Verify environment variables are set correctly

### Issue: First OCR request times out

**Expected behavior**: First request takes 60-120 seconds

**Solutions**:
- Wait longer (up to 2 minutes)
- Check Render logs to see if models are downloading
- Subsequent requests will be fast

### Issue: Service works but then stops responding

**Render Free Tier**: Service sleeps after 15 minutes of inactivity

**Fix**:
- Wait 30-60 seconds for service to wake up
- Or upgrade to Starter plan ($7/month) for always-on service

### Issue: "ModuleNotFoundError: No module named 'fastapi'"

**Cause**: Render is not using Docker (using Python instead)

**Fix**:
1. Go to service Settings
2. Change **Environment** from "Python" to **"Docker"**
3. Set **Root Directory** to `ocr-service`
4. Save and redeploy

---

## 🔗 Next Steps After Deployment

### 1. Configure Supabase

After your service is deployed, you need to configure Supabase:

1. **Get your service URL**:
   - From Render Dashboard: `https://paddleocr-service-XXXX.onrender.com`
   - Copy this URL (no trailing slash!)

2. **Add to Supabase Secrets**:
   - Go to Supabase Dashboard → Edge Functions → Settings
   - Add secret:
     - **Name**: `OCR_SERVICE_URL`
     - **Value**: `https://paddleocr-service-XXXX.onrender.com`

3. **Deploy Edge Function**:
   ```bash
   supabase functions deploy scan-business-card-ai
   ```

### 2. Test End-to-End

1. Upload a business card image in your app
2. First request may take 60-120 seconds (expected)
3. Subsequent requests should be fast (2-5 seconds)
4. Verify contact information is extracted correctly

---

## 📝 Recent Changes (Based on Git History)

### Latest Improvements

1. **Lazy Initialization** (commit `f5e9553`)
   - PaddleOCR initializes on first request, not at startup
   - Prevents 502 errors and startup timeouts
   - Critical for Render free tier

2. **Fixed render.yaml** (commit `54c05fb`)
   - Changed to use `rootDir: ocr-service`
   - More reliable Docker detection
   - Fixed Docker context issues

3. **Comprehensive Documentation** (commit `e595d2f`)
   - Added detailed deployment issues guide
   - Documented known limitations
   - Created troubleshooting guide

4. **Improved Error Handling** (commit `d05e91d`)
   - Better error messages
   - Comprehensive logging
   - HTML error page detection

---

## 💡 Best Practices

1. **Use Starter Plan for Production**
   - Free tier is fine for testing
   - Upgrade to Starter ($7/month) for production use
   - Prevents service sleep
   - More reliable memory allocation

2. **Monitor Service Health**
   - Set up Render health checks
   - Monitor logs regularly
   - Watch for memory issues

3. **Test Thoroughly**
   - Test health endpoint first
   - Test first OCR request (expect delay)
   - Test subsequent requests (should be fast)
   - Test with various image types

4. **Keep render.yaml Updated**
   - The root `render.yaml` is the source of truth
   - Render reads this file automatically
   - Don't modify settings in dashboard if using Blueprint

---

## 📚 Additional Resources

- **Render Dashboard**: https://dashboard.render.com
- **Render Documentation**: https://render.com/docs
- **PaddleOCR Documentation**: https://github.com/PaddlePaddle/PaddleOCR
- **Deployment Issues Guide**: See `PADDLEOCR_DEPLOYMENT_ISSUES.md`
- **Troubleshooting Guide**: See `PADDLEOCR_TROUBLESHOOTING.md`
- **Render Setup Guide**: See `ocr-service/RENDER_SETUP.md`

---

## ✅ Deployment Checklist

- [ ] Repository pushed to GitHub/GitLab
- [ ] `render.yaml` exists at repository root
- [ ] `render.yaml` uses `rootDir: ocr-service`
- [ ] `Dockerfile` exists in `ocr-service/` directory
- [ ] Render account created
- [ ] Service created in Render Dashboard
- [ ] Service status shows "Live"
- [ ] Health endpoint returns 200 OK
- [ ] Service URL copied (for Supabase configuration)
- [ ] `OCR_SERVICE_URL` added to Supabase secrets
- [ ] Edge function `scan-business-card-ai` deployed
- [ ] Tested first OCR request (expect 60-120 second delay)
- [ ] Tested subsequent OCR requests (should be fast)
- [ ] Verified end-to-end flow in application

---

**You're all set!** Your PaddleOCR service should now be running on Render. 🎉
