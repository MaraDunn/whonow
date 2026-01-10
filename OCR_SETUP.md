# Business Card OCR Setup Guide

## Problem
Tesseract.js (client-side OCR) has poor accuracy for business cards, producing incorrect text like "Lidia Tt )" instead of "Mr. Chris Green".

## Solution
Use cloud-based OCR services that are significantly more accurate:

1. **Google Cloud Vision API** (primary, most accurate)
2. **OCR.space API** (fallback, free tier available)
3. **Tesseract.js** (last resort fallback)

---

## Setup Instructions

### Option 1: Google Cloud Vision API (Recommended - Most Accurate)

**Cost**: $1.50 per 1,000 images (first 1,000/month free)

**Steps**:

1. **Create a Google Cloud Project**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one

2. **Enable Cloud Vision API**:
   - In the Cloud Console, go to "APIs & Services" > "Library"
   - Search for "Cloud Vision API"
   - Click "Enable"

3. **Create API Key**:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API Key"
   - Copy the API key

4. **Add to Supabase**:
   ```bash
   # In your Supabase project dashboard:
   # Settings > Edge Functions > Add secret
   # Name: GOOGLE_CLOUD_VISION_API_KEY
   # Value: your-api-key-here
   ```

5. **Deploy the Edge Function**:
   ```bash
   supabase functions deploy ocr-google-vision
   ```

---

### Option 2: OCR.space API (Free Fallback)

**Cost**: FREE for 25,000 requests/month

**Steps**:

1. **Get Free API Key**:
   - Go to [OCR.space](https://ocr.space/ocrapi)
   - Click "Register for free API key"
   - Enter your email and get the key

2. **Add to Supabase**:
   ```bash
   # In your Supabase project dashboard:
   # Settings > Edge Functions > Add secret
   # Name: OCR_SPACE_API_KEY
   # Value: your-api-key-here
   ```

3. **Deploy the Edge Function**:
   ```bash
   supabase functions deploy ocr-fallback
   ```

---

## Testing

After setup, the system will:
1. Try Google Cloud Vision first (if configured)
2. Fall back to OCR.space (if Google fails)
3. Fall back to Tesseract.js (if both cloud services fail)

Test by scanning a business card - you should see much better accuracy!

---

## Disabling Cloud OCR

If you want to use only Tesseract.js (not recommended), edit `src/hooks/useBusinessCardScanner.ts`:

```typescript
const USE_CLOUD_OCR = false; // Change to false
```

---

## Troubleshooting

### "Google Cloud Vision API key not configured"
- Make sure you added the API key as a Supabase secret
- Redeploy the edge function after adding secrets
- Check that the API is enabled in Google Cloud Console

### "OCR.space API key not configured"
- Make sure you registered and got a free API key
- Add it as `OCR_SPACE_API_KEY` in Supabase secrets
- Redeploy the edge function

### Still getting poor OCR results
- Check the console logs to see which OCR service was used
- Verify API keys are correct
- Try taking a clearer photo with better lighting
- Ensure the business card fills most of the frame

---

## Cost Comparison

| Service | Cost | Accuracy | Speed |
|---------|------|----------|-------|
| Google Cloud Vision | $1.50/1K (1K free/mo) | ★★★★★ Excellent | Fast |
| OCR.space | FREE (25K/mo) | ★★★★☆ Very Good | Medium |
| Tesseract.js | FREE | ★★☆☆☆ Poor | Slow |

**Recommendation**: Use Google Cloud Vision for production. The accuracy improvement is worth the minimal cost.

