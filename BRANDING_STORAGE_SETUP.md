# Branding Storage Bucket Setup

## Quick Fix: Create the Storage Bucket

The "Failed to upload logo" error occurs because the `branding` storage bucket doesn't exist yet. Follow these steps to create it:

### Step 1: Go to Supabase Storage

1. Open your Supabase Dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **"New bucket"** or **"Create bucket"**

### Step 2: Create the Bucket

1. **Bucket name:** `branding` (must be exactly this name)
2. **Public bucket:** Toggle this to **ON** (so logos can be displayed publicly)
3. Click **"Create bucket"**

### Step 3: Set Up Storage Policies

After creating the bucket, you need to set up policies so authenticated users can upload files:

1. Click on the `branding` bucket you just created
2. Go to the **"Policies"** tab
3. Click **"New Policy"**

#### Policy 1: Allow Authenticated Users to Upload

1. **Policy name:** `Allow authenticated uploads`
2. **Allowed operation:** `INSERT`
3. **Policy definition:**
   ```sql
   (bucket_id = 'branding'::text) AND (auth.role() = 'authenticated'::text)
   ```
4. Click **"Save"**

#### Policy 2: Allow Authenticated Users to Update/Delete Their Files

1. **Policy name:** `Allow authenticated updates`
2. **Allowed operation:** `UPDATE`
3. **Policy definition:**
   ```sql
   (bucket_id = 'branding'::text) AND (auth.role() = 'authenticated'::text)
   ```
4. Click **"Save"**

5. **Policy name:** `Allow authenticated deletes`
6. **Allowed operation:** `DELETE`
7. **Policy definition:**
   ```sql
   (bucket_id = 'branding'::text) AND (auth.role() = 'authenticated'::text)
   ```
8. Click **"Save"**

#### Policy 3: Allow Public Read Access

1. **Policy name:** `Allow public read access`
2. **Allowed operation:** `SELECT`
3. **Policy definition:**
   ```sql
   bucket_id = 'branding'::text
   ```
4. Click **"Save"**

### Alternative: Use SQL Editor

If you prefer to set up policies via SQL, run this in your Supabase SQL Editor:

```sql
-- Note: The bucket must be created via the Storage UI first
-- Then you can create policies via SQL:

-- Allow authenticated users to upload
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'branding');

-- Allow authenticated users to update
CREATE POLICY "Allow authenticated updates"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'branding');

-- Allow authenticated users to delete
CREATE POLICY "Allow authenticated deletes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'branding');

-- Allow public read access
CREATE POLICY "Allow public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'branding');
```

### Step 4: Test

After setting up the bucket and policies:

1. Go back to your app
2. Navigate to **Settings** → **Organization** → **Custom Branding**
3. Try uploading a logo again

The upload should now work!

## Troubleshooting

### Error: "Bucket not found"
- Make sure the bucket name is exactly `branding` (lowercase, no spaces)
- Verify the bucket exists in Storage → Buckets

### Error: "new row violates row-level security policy"
- The storage policies aren't set up correctly
- Go back to Step 3 and ensure all policies are created

### Error: "permission denied"
- Check that you're logged in as an authenticated user
- Verify the upload policies allow `authenticated` role

### Files upload but can't be viewed
- Make sure the public read policy is set up
- Verify the bucket is set to "Public"

## Bucket Configuration Summary

- **Name:** `branding`
- **Public:** Yes (for public read access)
- **File size limit:** 5MB for logos, 1MB for favicons
- **Allowed file types:** PNG, JPEG, SVG, WebP (logos), PNG, ICO, SVG (favicons)

