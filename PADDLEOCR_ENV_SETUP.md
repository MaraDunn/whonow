# Environment Variables Setup for PaddleOCR

After deploying the OCR service, you need to configure one environment variable in Supabase.

## Required Environment Variable

Add this to your Supabase Edge Functions environment variables:

```
OCR_SERVICE_URL=https://your-ocr-service.railway.app
```

### Where to Add This:

#### Option 1: Supabase Dashboard
1. Go to your Supabase project
2. Navigate to **Edge Functions** → **Settings**
3. Add environment variable:
   - **Name**: `OCR_SERVICE_URL`
   - **Value**: Your deployed OCR service URL (e.g., `https://paddleocr-production.up.railway.app`)

#### Option 2: Supabase CLI
```bash
supabase secrets set OCR_SERVICE_URL=https://your-ocr-service.railway.app
```

## Getting Your OCR Service URL

After deploying to Railway/Render, you'll get a public URL like:

**Railway**: `https://paddleocr-production.up.railway.app`  
**Render**: `https://paddleocr-service.onrender.com`

Use this URL as the value for `OCR_SERVICE_URL` (without trailing slash).

## Testing

Once configured, the `scan-business-card-ai` edge function will automatically use your OCR service.

Test it by scanning a business card in your app!

