# Migration Guide: Lovable Cloud to Supabase

This guide will walk you through migrating your whonow project from Lovable's managed Supabase instance to your own Supabase project.

## Prerequisites

- A Supabase account (sign up at https://supabase.com if you don't have one)
- Access to your current Supabase project credentials (in `.env`)

## Step 1: Create a New Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Fill in:
   - **Name**: whonow (or your preferred name)
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose the closest region to your users
   - **Pricing Plan**: Free tier is fine to start
4. Click "Create new project"
5. Wait for the project to be provisioned (2-3 minutes)

## Step 2: Get Your New Supabase Credentials

Once your project is ready:

1. Go to **Settings** → **API** in your Supabase dashboard
2. You'll need:
   - **Project URL**: `https://[your-project-ref].supabase.co`
   - **anon/public key**: The `anon` `public` key (starts with `eyJ...`)
   - **Project Reference ID**: Found in the URL or project settings

## Step 3: Run Database Migrations

You have three options:

### Option A: Using Combined File (Fastest - Recommended)

1. Run the combination script:
   ```bash
   ./combine-migrations.sh
   # or
   node combine-migrations.js
   ```
2. This creates `combined-migrations.sql` with all 16 migrations in order
3. Go to **SQL Editor** in your Supabase dashboard
4. Open `combined-migrations.sql` and copy all contents
5. Paste into SQL Editor
6. Click "Run" - all migrations execute at once!

### Option B: Using Supabase Dashboard (One by one)

1. Go to **SQL Editor** in your Supabase dashboard
2. Open each migration file from `supabase/migrations/` in order (by timestamp)
3. Copy and paste the SQL content into the SQL Editor
4. Click "Run" to execute each migration
5. Repeat for all migration files

### Option B: Using Supabase CLI (Advanced)

1. Install Supabase CLI:
   ```bash
   # macOS with Homebrew
   brew install supabase/tap/supabase
   
   # Or download from: https://github.com/supabase/cli/releases
   ```

2. Link your project:
   ```bash
   cd /Users/maradunn/whonow
   supabase link --project-ref [your-project-ref]
   ```

3. Push migrations:
   ```bash
   supabase db push
   ```

## Step 4: Update Environment Variables

Update your `.env` file with the new credentials:

```env
VITE_SUPABASE_PROJECT_ID="[your-new-project-ref]"
VITE_SUPABASE_PUBLISHABLE_KEY="[your-new-anon-key]"
VITE_SUPABASE_URL="https://[your-new-project-ref].supabase.co"
```

## Step 5: Update Supabase Config

Update `supabase/config.toml`:

```toml
project_id = "[your-new-project-ref]"
```

## Step 6: Deploy Edge Functions

Your project has several Edge Functions. Deploy them:

1. Go to **Edge Functions** in your Supabase dashboard
2. For each function in `supabase/functions/`:
   - Click "Create a new function"
   - Name it (e.g., `parse-search-query`)
   - Copy the function code
   - Deploy

Or use CLI:
```bash
supabase functions deploy [function-name]
```

## Step 7: Migrate Data (If Applicable)

If you have existing data in your Lovable-managed Supabase:

1. Export data from old project:
   - Go to old Supabase project dashboard
   - Use **Table Editor** to export data as CSV/JSON
   - Or use SQL Editor to export: `COPY table_name TO '/path/to/file.csv'`

2. Import data to new project:
   - Use **Table Editor** → **Import** feature
   - Or use SQL Editor with INSERT statements

## Step 8: Update Row Level Security (RLS) Policies

Your migrations include RLS policies, but verify they're correct:

1. Go to **Authentication** → **Policies** in Supabase dashboard
2. Review policies for each table
3. Ensure they match your security requirements

## Step 9: Test Your Application

1. Restart your dev server:
   ```bash
   npm run dev
   ```

2. Test key features:
   - User authentication (sign up, sign in, sign out)
   - CRUD operations on contacts
   - Any integrations (Slack, Teams, etc.)
   - File uploads (avatars, business cards)

## Step 10: Update Production Environment

If you have a production deployment:

1. Update production environment variables
2. Deploy updated code
3. Test production environment

## Troubleshooting

### Migration Errors
- Check that migrations run in chronological order
- Verify foreign key constraints are satisfied
- Check for any custom functions or triggers

### Authentication Issues
- Verify RLS policies allow authenticated users
- Check that auth is enabled in Supabase dashboard
- Review email templates in **Authentication** → **Email Templates**

### Edge Function Issues
- Verify function secrets are set in dashboard
- Check function logs in **Edge Functions** → **Logs**
- Ensure `verify_jwt` settings match your needs

## Next Steps

- Set up custom domain (optional)
- Configure email templates
- Set up backup schedules
- Review and optimize RLS policies
- Monitor usage in dashboard

## Support

- Supabase Docs: https://supabase.com/docs
- Supabase Discord: https://discord.supabase.com
- Supabase GitHub: https://github.com/supabase/supabase

