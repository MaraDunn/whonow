# Migration Checklist: Lovable Cloud → Your Supabase

Use this checklist to track your migration progress.

## Phase 1: Setup New Supabase Project

- [ ] Create account at https://supabase.com (if needed)
- [ ] Create new project in Supabase dashboard
- [ ] Choose region and set database password
- [ ] Wait for project provisioning (2-3 minutes)
- [ ] Note down your new project credentials:
  - [ ] Project URL: `https://[project-ref].supabase.co`
  - [ ] Project Reference ID: `[project-ref]`
  - [ ] Anon/Public Key: `eyJ...` (from Settings → API)

## Phase 2: Database Migrations

You have **17 migration files** to run. Execute them in this order:

1. [ ] `20251219221658_77de93ea-2826-4188-862c-7387d6eba370.sql` - Creates contacts table
2. [ ] `20251220033452_56719322-35b7-4846-a471-494f9ae5a783.sql`
3. [ ] `20251220035023_2855f25a-d105-44b8-ace2-adee9145fef4.sql`
4. [ ] `20251220201301_17c1fb46-2c05-4d82-811e-985089753c86.sql` - Creates profiles, companies, auth
5. [ ] `20251220202858_743187da-2701-4088-86d7-ba38aadaa73a.sql`
6. [ ] `20251220214224_ade82030-024e-47f5-b1a8-7b5b8ef5bf3b.sql`
7. [ ] `20251220214652_6db44657-27fb-4ef2-b7a1-f1f4d683620c.sql`
8. [ ] `20251220215011_cbfccb4c-ec7d-4db7-a01a-534e4acdbfed.sql`
9. [ ] `20251224025152_dbf990b6-ec9f-4ede-ad06-64699902221b.sql`
10. [ ] `20251225024240_faba7b6e-dbea-4432-b414-b0fe0c3887bf.sql`
11. [ ] `20251226011350_405ca796-61c4-4017-acdd-eb7a2d2ea957.sql`
12. [ ] `20251226194244_81fa7a7b-76e9-4738-b992-97f3f695f751.sql`
13. [ ] `20251226195413_2903190b-1cc5-4d13-8f0c-2817e9a7d326.sql`
14. [ ] `20251228201424_b3b0772b-840f-49b2-a5ba-c409591c06c5.sql`
15. [ ] `20251231002227_901e3077-8570-4a82-b742-7f3ee817f09b.sql`
16. [ ] `20260102041106_ad7535a2-5e77-4645-b67d-36ca9a436411.sql`

**How to run migrations:**
1. Go to Supabase Dashboard → SQL Editor
2. Open each migration file from `supabase/migrations/`
3. Copy entire SQL content
4. Paste into SQL Editor
5. Click "Run" (or Cmd/Ctrl + Enter)
6. Verify success message
7. Repeat for next migration

## Phase 3: Update Configuration

- [ ] Backup current `.env` file (rename to `.env.old`)
- [ ] Update `.env` with new credentials:
  ```env
  VITE_SUPABASE_PROJECT_ID="[your-new-project-ref]"
  VITE_SUPABASE_PUBLISHABLE_KEY="[your-new-anon-key]"
  VITE_SUPABASE_URL="https://[your-new-project-ref].supabase.co"
  ```
- [ ] Update `supabase/config.toml`:
  ```toml
  project_id = "[your-new-project-ref]"
  ```

## Phase 4: Deploy Edge Functions

You have **13 Edge Functions** to deploy:

1. [ ] `check-subscription`
2. [ ] `create-checkout`
3. [ ] `customer-portal`
4. [ ] `generate-test-contacts`
5. [ ] `parse-contact-input`
6. [ ] `parse-contact-pdf`
7. [ ] `parse-search-query`
8. [ ] `scan-business-card`
9. [ ] `slack-integration`
10. [ ] `stripe-webhook`
11. [ ] `teams-integration`

**How to deploy functions:**
1. Go to Supabase Dashboard → Edge Functions
2. Click "Create a new function"
3. Name it (e.g., `parse-search-query`)
4. Copy the code from `supabase/functions/[function-name]/index.ts`
5. Deploy
6. Configure function secrets if needed (Settings → Edge Functions → Secrets)
7. Repeat for each function

## Phase 5: Data Migration (If Applicable)

- [ ] Export data from old Supabase project (if you have existing data)
- [ ] Import data to new Supabase project
- [ ] Verify data integrity

**Data Export/Import Methods:**
- Use Table Editor → Export/Import (for small datasets)
- Use SQL Editor with COPY commands (for large datasets)
- Use pg_dump/pg_restore (for full database backup)

## Phase 6: Configure Authentication

- [ ] Review Authentication settings in new project
- [ ] Configure email templates (if custom)
- [ ] Set up OAuth providers (if needed)
- [ ] Test user signup flow
- [ ] Test user signin flow
- [ ] Verify email confirmations work

## Phase 7: Test Application

- [ ] Restart dev server: `npm run dev`
- [ ] Test user registration
- [ ] Test user login
- [ ] Test contact CRUD operations
- [ ] Test file uploads (avatars, business cards)
- [ ] Test integrations (Slack, Teams)
- [ ] Test subscription features (if applicable)
- [ ] Check browser console for errors
- [ ] Verify all API calls work

## Phase 8: Production Deployment

- [ ] Update production environment variables
- [ ] Deploy updated code
- [ ] Test production environment
- [ ] Monitor for errors
- [ ] Set up monitoring/alerts

## Troubleshooting

### Common Issues:

**Migration Errors:**
- Ensure migrations run in order
- Check for foreign key constraint errors
- Verify all required tables exist before adding relationships

**Authentication Not Working:**
- Check RLS policies are correct
- Verify auth is enabled in dashboard
- Check email confirmation settings

**Edge Functions Failing:**
- Verify function secrets are set
- Check function logs in dashboard
- Ensure JWT verification settings match

**Data Not Loading:**
- Check RLS policies allow access
- Verify user is authenticated
- Check browser console for errors

## Support Resources

- Supabase Docs: https://supabase.com/docs
- Supabase Discord: https://discord.supabase.com
- Migration Guide: See `MIGRATION_GUIDE.md`

