#!/usr/bin/env node

/**
 * Debug script to check why time-based searches aren't returning results
 * 
 * Usage:
 *   node debug-time-search.js
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { parseSearchQuery } from './src/utils/searchQueryParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
let envContent;
try {
  envContent = readFileSync(join(__dirname, '.env'), 'utf8');
} catch (error) {
  console.error('❌ Could not read .env file');
  process.exit(1);
}

const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)="?([^"]+)"?$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const SUPABASE_KEY = envVars.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function debugTimeSearch() {
  console.log('🔍 Debugging time-based search...\n');

  try {
    // Test query
    const testQuery = "Who did I meet today?";
    console.log(`📝 Test Query: "${testQuery}"\n`);

    // Parse the query
    const parsed = parseSearchQuery(testQuery);
    console.log('📊 Parsed Query:');
    console.log(`   Time Range: ${parsed.timeRange ? `${parsed.timeRange.start.toISOString()} to ${parsed.timeRange.end.toISOString()}` : 'None'}`);
    console.log(`   Interaction Type: ${parsed.interactionType || 'None'}`);
    console.log(`   Interaction Time Range: ${parsed.interactionTimeRange ? `${parsed.interactionTimeRange.start.toISOString()} to ${parsed.interactionTimeRange.end.toISOString()}` : 'None'}`);
    console.log(`   Keywords: ${parsed.keywords.join(', ') || 'None'}`);
    console.log(`   Interpretation: ${parsed.interpretation || 'None'}\n`);

    // Fetch contacts
    const { data: contacts, error: fetchError } = await supabase
      .from('contacts')
      .select('id, name, created_at, updated_at, deleted_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(20);

    if (fetchError) {
      console.error('❌ Error fetching contacts:', fetchError);
      process.exit(1);
    }

    if (!contacts || contacts.length === 0) {
      console.log('⚠️  No contacts found in database');
      process.exit(0);
    }

    console.log(`📋 Found ${contacts.length} contacts\n`);

    // Check timestamps
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    console.log(`📅 Today's range: ${todayStart.toISOString()} to ${todayEnd.toISOString()}\n`);

    const contactsWithTimestamps = contacts.filter(c => c.created_at);
    const contactsWithoutTimestamps = contacts.filter(c => !c.created_at);
    const contactsToday = contacts.filter(c => {
      if (!c.created_at) return false;
      const createdAt = new Date(c.created_at);
      return createdAt >= todayStart && createdAt <= todayEnd;
    });

    console.log('📊 Contact Statistics:');
    console.log(`   Total contacts: ${contacts.length}`);
    console.log(`   With created_at: ${contactsWithTimestamps.length}`);
    console.log(`   Without created_at: ${contactsWithoutTimestamps.length}`);
    console.log(`   Created today: ${contactsToday.length}\n`);

    if (contactsWithoutTimestamps.length > 0) {
      console.log('⚠️  Contacts missing timestamps:');
      contactsWithoutTimestamps.slice(0, 5).forEach(c => {
        console.log(`   - ${c.name || 'Unnamed'} (ID: ${c.id})`);
      });
      console.log('\n💡 Run: node backfill-contact-timestamps.js\n');
    }

    // Show sample contacts with timestamps
    if (contactsWithTimestamps.length > 0) {
      console.log('📋 Sample contacts with timestamps:');
      contactsWithTimestamps.slice(0, 5).forEach(c => {
        const createdAt = new Date(c.created_at);
        const isToday = createdAt >= todayStart && createdAt <= todayEnd;
        console.log(`   - ${c.name || 'Unnamed'}`);
        console.log(`     created_at: ${c.created_at}`);
        console.log(`     Local: ${createdAt.toLocaleString()}`);
        console.log(`     Is today: ${isToday ? '✅' : '❌'}`);
        console.log('');
      });
    }

    // Test the time range matching
    if (parsed.timeRange) {
      console.log('🔍 Testing time range matching:');
      const { start, end } = parsed.timeRange;
      console.log(`   Search range: ${start.toISOString()} to ${end.toISOString()}`);
      console.log(`   Search range (local): ${start.toLocaleString()} to ${end.toLocaleString()}\n`);

      const matchingContacts = contacts.filter(c => {
        if (!c.created_at) return false;
        const createdAt = new Date(c.created_at);
        return createdAt >= start && createdAt <= end;
      });

      console.log(`   Contacts matching time range: ${matchingContacts.length}`);
      if (matchingContacts.length > 0) {
        matchingContacts.slice(0, 5).forEach(c => {
          const createdAt = new Date(c.created_at);
          console.log(`   ✅ ${c.name || 'Unnamed'}: ${createdAt.toLocaleString()}`);
        });
      } else {
        console.log('   ❌ No contacts match the time range');
        console.log('\n   Possible issues:');
        console.log('   1. Contacts don\'t have created_at timestamps');
        console.log('   2. Timezone mismatch between database and search');
        console.log('   3. Contacts were created outside the time range');
      }
    }

    console.log('\n' + '═'.repeat(60));

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

debugTimeSearch();





