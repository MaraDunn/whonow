# Quick Start: Migrate to Your Own Supabase

## 🚀 Fast Track (5 Steps)

### Step 1: Create Supabase Project (5 minutes)
1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Name: `whonow`
4. Set database password (save it!)
5. Choose region
6. Click "Create"

### Step 2: Get Credentials (2 minutes)
1. In your new project, go to **Settings** → **API**
2. Copy these values:
   - **Project URL**: `https://[xxx].supabase.co`
   - **anon public key**: `eyJ...` (the long string)
   - **Project Reference**: Found in URL or project settings

### Step 3: Run Migrations (2-3 minutes)
**Option A: Use Combined File (Recommended)**
1. Run the combination script:
   ```bash
   ./combine-migrations.sh
   # or
   node combine-migrations.js
   ```
2. This creates `combined-migrations.sql` with all migrations
3. Go to **SQL Editor** in Supabase dashboard
4. Open `combined-migrations.sql` and copy all contents
5. Paste into SQL Editor
6. Click "Run" - all migrations run at once!

**Option B: Run Individually**
1. Go to **SQL Editor** in Supabase dashboard
2. Open each file from `supabase/migrations/` in order (sorted by filename)
3. Copy all SQL content
4. Paste into SQL Editor
5. Click "Run"
6. Repeat for all 16 migration files

### Step 4: Update .env File (1 minute)
```bash
# Edit .env file
VITE_SUPABASE_PROJECT_ID="[your-new-project-ref]"
VITE_SUPABASE_PUBLISHABLE_KEY="[your-new-anon-key]"
VITE_SUPABASE_URL="https://[your-new-project-ref].supabase.co"
```

### Step 5: Deploy Edge Functions (10-15 minutes)
1. Go to **Edge Functions** in dashboard
2. For each function in `supabase/functions/`:
   - Click "Create function"
   - Name it (match the folder name)
   - Copy code from `index.ts`
   - Deploy

**Functions to deploy:**
- parse-search-query
- generate-test-contacts
- scan-business-card
- slack-integration
- teams-integration
- parse-contact-pdf
- check-subscription
- create-checkout
- customer-portal
- stripe-webhook

### Step 6: Test! (2 minutes)
```bash
npm run dev
```

Visit http://localhost:8080 and test:
- Sign up a new user
- Sign in
- Create a contact

## 📚 Detailed Guides

- **Full Guide**: See `MIGRATION_GUIDE.md`
- **Checklist**: See `MIGRATION_CHECKLIST.md`
- **Helper Script**: Run `./migrate-to-supabase.sh`

## ⚠️ Important Notes

1. **Data Migration**: If you have existing data, export it from the old project and import to the new one
2. **Secrets**: Some Edge Functions may need secrets configured (check function code)
3. **RLS Policies**: All tables have Row Level Security - verify policies after migration
4. **Email**: Configure email templates in **Authentication** → **Email Templates**

## 🆘 Need Help?

- Check `MIGRATION_GUIDE.md` for detailed troubleshooting
- Supabase Docs: https://supabase.com/docs
- Supabase Discord: https://discord.supabase.com

