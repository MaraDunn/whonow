/**
 * Script to verify actual contact count in database vs what's displayed
 * Run with: node check-contact-count.js
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env.local') });
dotenv.config({ path: join(__dirname, '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.error('   Required: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkContactCount() {
  console.log('🔍 Checking contact counts in database...\n');

  try {
    // Get current user session (you'll need to be logged in)
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.error('❌ Not authenticated. Please log in first.');
      console.error('   You can get your session token from browser DevTools → Application → Local Storage → supabase.auth.token');
      process.exit(1);
    }

    const userId = session.user.id;
    console.log(`👤 User ID: ${userId}\n`);

    // Method 1: Use the count function we just created
    console.log('📊 Method 1: Using count_active_contacts function...');
    const { data: functionCount, error: functionError } = await supabase.rpc('count_active_contacts', {
      _user_id: userId,
    });

    if (functionError) {
      console.error('❌ Error calling count function:', functionError);
    } else {
      console.log(`   Function count: ${functionCount || 0} contacts\n`);
    }

    // Method 2: Direct count query (may be limited to 1000)
    console.log('📊 Method 2: Direct count query (may be limited)...');
    const { count: directCount, error: directError } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .or(`owner_id.eq.${userId},is_shared.eq.true`);

    if (directError) {
      console.error('❌ Error with direct count:', directError);
    } else {
      console.log(`   Direct count: ${directCount || 0} contacts\n`);
    }

    // Method 3: Fetch all and count (will show if hitting 1000 limit)
    console.log('📊 Method 3: Fetching all contacts (shows actual limit)...');
    const { data: allContacts, error: fetchError } = await supabase
      .from('contacts')
      .select('id')
      .is('deleted_at', null)
      .or(`owner_id.eq.${userId},is_shared.eq.true`);

    if (fetchError) {
      console.error('❌ Error fetching contacts:', fetchError);
    } else {
      const fetchedCount = allContacts?.length || 0;
      console.log(`   Fetched count: ${fetchedCount} contacts`);
      if (fetchedCount === 1000) {
        console.log('   ⚠️  WARNING: Hit 1000 row limit! Actual count may be higher.\n');
      } else {
        console.log('');
      }
    }

    // Method 4: Count with my-profile exclusion
    console.log('📊 Method 4: Count excluding my-profile contacts...');
    const { data: filteredContacts, error: filterError } = await supabase
      .from('contacts')
      .select('id, tags')
      .is('deleted_at', null)
      .or(`owner_id.eq.${userId},is_shared.eq.true`);

    if (filterError) {
      console.error('❌ Error fetching filtered contacts:', filterError);
    } else {
      const withoutProfile = (filteredContacts || []).filter(
        c => !c.tags || !c.tags.includes('my-profile')
      ).length;
      console.log(`   Count without my-profile: ${withoutProfile} contacts\n`);
    }

    // Summary
    console.log('📋 Summary:');
    console.log(`   Function count: ${functionCount || 0}`);
    console.log(`   Direct count: ${directCount || 0}`);
    console.log(`   Fetched count: ${allContacts?.length || 0}`);
    if (allContacts?.length === 1000) {
      console.log('\n⚠️  The fetched count hit the 1000 limit, so the actual count may be higher.');
      console.log('   The function count should be accurate if the migration was run correctly.\n');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

checkContactCount();
