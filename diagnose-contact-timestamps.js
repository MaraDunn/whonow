#!/usr/bin/env node

/**
 * Diagnostic script to check which contacts are missing created_at timestamps
 * 
 * Usage:
 *   node diagnose-contact-timestamps.js
 * 
 * Requires SUPABASE_URL and SUPABASE_ANON_KEY in .env file
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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
  console.error('   Required: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function diagnoseTimestamps() {
  console.log('🔍 Diagnosing contact timestamps...\n');

  try {
    // Query all contacts (including deleted ones for full picture)
    const { data: allContacts, error: allError } = await supabase
      .from('contacts')
      .select('id, name, created_at, updated_at, deleted_at')
      .order('updated_at', { ascending: false });

    if (allError) {
      console.error('❌ Error fetching contacts:', allError);
      process.exit(1);
    }

    // Query only active (non-deleted) contacts
    const { data: activeContacts, error: activeError } = await supabase
      .from('contacts')
      .select('id, name, created_at, updated_at')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (activeError) {
      console.error('❌ Error fetching active contacts:', activeError);
      process.exit(1);
    }

    // Analyze timestamps
    const allWithTimestamp = allContacts.filter(c => c.created_at);
    const allWithoutTimestamp = allContacts.filter(c => !c.created_at);
    
    const activeWithTimestamp = activeContacts.filter(c => c.created_at);
    const activeWithoutTimestamp = activeContacts.filter(c => !c.created_at);

    // Get sample contacts without timestamps
    const sampleWithoutTimestamp = activeWithoutTimestamp.slice(0, 5);

    // Calculate date ranges for contacts with timestamps
    const timestamps = activeWithTimestamp
      .map(c => new Date(c.created_at))
      .filter(d => !isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    const oldestTimestamp = timestamps.length > 0 ? timestamps[0] : null;
    const newestTimestamp = timestamps.length > 0 ? timestamps[timestamps.length - 1] : null;

    // Report findings
    console.log('📊 TIMESTAMP DIAGNOSTIC REPORT');
    console.log('═'.repeat(60));
    console.log('\n📋 ALL CONTACTS (including deleted):');
    console.log(`   Total: ${allContacts.length}`);
    console.log(`   With created_at: ${allWithTimestamp.length}`);
    console.log(`   Without created_at: ${allWithoutTimestamp.length}`);
    
    console.log('\n✅ ACTIVE CONTACTS (not deleted):');
    console.log(`   Total: ${activeContacts.length}`);
    console.log(`   With created_at: ${activeWithTimestamp.length}`);
    console.log(`   Without created_at: ${activeWithoutTimestamp.length}`);

    if (activeWithoutTimestamp.length > 0) {
      console.log('\n⚠️  CONTACTS MISSING TIMESTAMPS:');
      console.log(`   Found ${activeWithoutTimestamp.length} active contacts without created_at`);
      
      if (sampleWithoutTimestamp.length > 0) {
        console.log('\n   Sample contacts missing timestamps:');
        sampleWithoutTimestamp.forEach((contact, idx) => {
          console.log(`   ${idx + 1}. ${contact.name || 'Unnamed'} (ID: ${contact.id})`);
          console.log(`      updated_at: ${contact.updated_at || 'N/A'}`);
        });
      }
    } else {
      console.log('\n✅ All active contacts have created_at timestamps!');
    }

    if (activeWithTimestamp.length > 0) {
      console.log('\n📅 TIMESTAMP RANGES:');
      if (oldestTimestamp) {
        console.log(`   Oldest contact: ${oldestTimestamp.toLocaleString()}`);
      }
      if (newestTimestamp) {
        console.log(`   Newest contact: ${newestTimestamp.toLocaleString()}`);
      }
      
      // Check for contacts created this week
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      
      const thisWeek = activeWithTimestamp.filter(c => {
        const createdAt = new Date(c.created_at);
        return createdAt >= startOfWeek;
      });
      
      console.log(`\n   Contacts created this week: ${thisWeek.length}`);
    }

    console.log('\n' + '═'.repeat(60));
    
    if (activeWithoutTimestamp.length > 0) {
      console.log('\n💡 RECOMMENDATION:');
      console.log('   Run backfill-contact-timestamps.js to fix missing timestamps');
      console.log('   This will use updated_at as fallback, or set a default date');
      process.exit(1);
    } else {
      console.log('\n✅ No action needed - all contacts have timestamps!');
      process.exit(0);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

diagnoseTimestamps();





