# Add 100 Test Contacts

Scripts to add 100 generated contacts to your current user account.

## Method 1: Browser Console (Easiest) ✅

1. **Sign in** to your app at http://localhost:8080
2. **Open browser console**: Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
3. **Go to Console tab**
4. **Copy and paste** the contents of `add-contacts-simple.js`
5. **Update the Supabase credentials** at the top (lines 9-10) with values from your `.env` file:
   ```javascript
   const SUPABASE_URL = 'https://yinicwvgwdjlkwjegrun.supabase.co';
   const SUPABASE_KEY = 'sb_publishable_nd05Lzm_bfT5ZCMTjkVPBQ_WBqO8dx6';
   ```
6. **Press Enter**
7. Wait for the script to complete - it will refresh the page automatically

## Method 2: Node.js Script

1. **Make sure you're signed in** to your app (the script needs an active session)
2. **Run the script**:
   ```bash
   cd /Users/maradunn/whonow
   export NVM_DIR="$HOME/.nvm"
   [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
   node add-test-contacts.js
   ```

**Note**: The Node.js script requires an active Supabase session. If you get an authentication error, use Method 1 instead.

## What the Script Does

- ✅ Generates 100 realistic contacts with:
  - Random names (first + last)
  - Email addresses
  - Phone numbers
  - Companies
  - Roles and departments
  - Descriptions
  - Tags (department, priority, client)
- ✅ Associates contacts with your user account (`owner_id`)
- ✅ Optionally assigns contacts to existing folders (30% chance)
- ✅ Inserts contacts in batches for efficiency
- ✅ Shows progress as contacts are added

## Generated Contact Details

- **Names**: Random from common first/last names
- **Companies**: 25 different tech/finance/healthcare companies
- **Roles**: 22 different professional roles
- **Departments**: Engineering, Marketing, Sales, Finance, HR, Design, Product, Operations, Legal, Customer Success
- **Tags**: Department tags + optional priority/client tags
- **Emails**: Generated as `firstname.lastname@company.com`
- **Phones**: Random US phone numbers in format `(XXX) XXX-XXXX`

## Troubleshooting

**"Not authenticated" error:**
- Make sure you're signed in to the app first
- For browser method: Sign in at http://localhost:8080 before running the script
- For Node.js: The script uses your browser session, so you need to be signed in

**"Permission denied" or RLS error:**
- Check that your user has permission to insert contacts
- Verify your Supabase RLS policies allow inserts for authenticated users

**Script runs but no contacts appear:**
- Check browser console for errors
- Verify contacts were inserted in Supabase Dashboard → Table Editor → contacts
- Refresh the page manually

## Files

- `add-test-contacts.js` - Node.js version (requires active session)
- `add-contacts-simple.js` - Browser console version (recommended)
- `add-test-contacts-browser.js` - Alternative browser version

