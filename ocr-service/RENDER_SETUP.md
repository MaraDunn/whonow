# Render.com Setup Instructions

If you're getting `ModuleNotFoundError: No module named 'fastapi'`, Render is not using Docker. Follow these steps:

## Option 1: Configure Render to Use Docker (Recommended)

### In Render Dashboard:

1. **Go to your service** → **Settings**

2. **Check "Environment"**:
   - Should be set to **"Docker"**
   - If it's set to "Python", change it to **"Docker"**

3. **Check "Root Directory"**:
   - Set to: **`ocr-service`**
   - This tells Render where your Dockerfile is

4. **Check "Dockerfile Path"**:
   - Should be: **`Dockerfile`** (relative to root directory)
   - Or: **`./Dockerfile`**

5. **Save** and **Redeploy**

---

## Option 2: Recreate Service with Correct Settings

If Option 1 doesn't work, delete and recreate:

1. **Delete** the current service in Render

2. **Create New Web Service**:
   - Connect your GitHub repo
   - **Root Directory**: `ocr-service`
   - **Environment**: **Docker** (important!)
   - **Dockerfile Path**: `Dockerfile`
   - **Name**: `paddleocr-service`
   - **Plan**: Free (or Starter for $7/month)

3. **Environment Variables**:
   - `PORT`: `8000`
   - `PYTHONUNBUFFERED`: `1`

4. **Health Check Path**: `/health`

5. **Click "Create Web Service"**

---

## Option 3: Use Railway Instead (Easier)

Railway auto-detects Dockerfiles better:

1. Go to https://railway.app
2. **New Project** → **Deploy from GitHub repo**
3. Select your `whonow` repo
4. **Select directory**: `ocr-service`
5. Railway will auto-detect the Dockerfile
6. That's it! 🎉

---

## Verification

After deploying, check logs. You should see:
```
Installing Python dependencies...
Successfully installed fastapi uvicorn paddleocr...
Starting server on port 8000...
```

NOT:
```
ModuleNotFoundError: No module named 'fastapi'
```

---

## If Still Getting Errors

1. **Check Render logs** for the build phase
2. **Verify** the service shows "Docker" as environment
3. **Try Railway** (Option 3) - it's simpler and more reliable for Docker

