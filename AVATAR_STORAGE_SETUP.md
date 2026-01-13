# Avatar Storage Bucket Setup

## Quick Fix: Create the Storage Bucket

The "Failed to upload avatar" error occurs because the `avatars` storage bucket doesn't exist yet. Follow these steps to create it:

### Step 1: Go to Supabase Storage

1. Open your Supabase Dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **"New bucket"** or **"Create bucket"**

### Step 2: Create the Bucket

1. **Bucket name:** `avatars` (must be exactly this name)
2. **Public bucket:** Toggle this to **ON** (so avatars can be displayed publicly)
3. Click **"Create bucket"**

### Step 3: Set Up Storage Policies

After creating the bucket, you have two options to set up policies:

#### Option A: Run the Migration (Recommended)

1. Go to **SQL Editor** in your Supabase dashboard
2. Open the migration file: `supabase/migrations/20260115000000_create_avatars_storage_bucket.sql`
3. Copy and paste the SQL content into the SQL Editor
4. Click **"Run"** to execute the migration

This will automatically create all the necessary storage policies.

#### Option B: Set Up Policies Manually

If you prefer to set up policies via the UI:

1. Click on the `avatars` bucket you just created
2. Go to the **"Policies"** tab
3. Click **"New Policy"**

##### Policy 1: Allow Authenticated Users to Upload

1. **Policy name:** `Allow authenticated users to upload avatars`
2. **Allowed operation:** `INSERT`
3. **Policy definition:**
   ```sql
   bucket_id = 'avatars'::text
   ```
4. **Target roles:** `authenticated`
5. Click **"Save"**

##### Policy 2: Allow Authenticated Users to Update

1. **Policy name:** `Allow authenticated users to update avatars`
2. **Allowed operation:** `UPDATE`
3. **Policy definition:**
   ```sql
   bucket_id = 'avatars'::text
   ```
4. **Target roles:** `authenticated`
5. Click **"Save"**

##### Policy 3: Allow Authenticated Users to Delete

1. **Policy name:** `Allow authenticated users to delete avatars`
2. **Allowed operation:** `DELETE`
3. **Policy definition:**
   ```sql
   bucket_id = 'avatars'::text
   ```
4. **Target roles:** `authenticated`
5. Click **"Save"**

##### Policy 4: Allow Public Read Access

1. **Policy name:** `Allow public read access to avatars`
2. **Allowed operation:** `SELECT`
3. **Policy definition:**
   ```sql
   bucket_id = 'avatars'::text
   ```
4. **Target roles:** `public`
5. Click **"Save"**

### Step 4: Test

After setting up the bucket and policies:

1. Go back to your app
2. Navigate to a contact or profile page
3. Try uploading an avatar again

The upload should now work!

## Troubleshooting

### Error: "Bucket not found" or "does not exist"
- Make sure the bucket name is exactly `avatars` (lowercase, no spaces)
- Verify the bucket exists in Storage → Buckets
- Check that you're looking at the correct Supabase project

### Error: "new row violates row-level security policy"
- The storage policies aren't set up correctly
- Go back to Step 3 and ensure all policies are created
- Try running the migration file instead (Option A)

### Error: "permission denied"
- Check that you're logged in as an authenticated user
- Verify the upload policies allow `authenticated` role
- Make sure you've refreshed the page after setting up policies

### Files upload but can't be viewed
- Make sure the public read policy is set up
- Verify the bucket is set to "Public"
- Check that the policy allows `public` role for SELECT operations

### Error: "Avatar file is too large"
- Maximum file size is 5MB
- Compress or resize your image before uploading

### Error: "Invalid file type"
- Allowed file types: JPEG, PNG, GIF, WebP
- Convert your image to one of these formats

## Bucket Configuration Summary

- **Name:** `avatars`
- **Public:** Yes (for public read access)
- **File size limit:** 5MB
- **Allowed file types:** JPEG, PNG, GIF, WebP
- **Storage policies:** 
  - Authenticated users can upload, update, and delete
  - Public can read (view avatars)

## Migration File

If you're setting up a new Supabase project, make sure to run the migration file:
- `supabase/migrations/20260115000000_create_avatars_storage_bucket.sql`

This migration sets up all the storage policies automatically. **Note:** You still need to create the bucket manually via the Supabase Dashboard first (Step 2 above).
