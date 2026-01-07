#!/usr/bin/env node

/**
 * Script to backfill missing created_at timestamps for contacts
 * 
 * Strategy:
 *   1. Use updated_at as fallback if available and reasonable
 *   2. For contacts without updated_at, use a default date (7 days ago)
 *   3. Update contacts in batches to avoid timeouts
 * 
 * Usage:
 *   node backfill-contact-timestamps.js
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

async function backfillTimestamps() {
  console.log('🔄 Starting timestamp backfill...\n');

  try {
    // Find all contacts missing created_at (only active contacts)
    const { data: contactsToFix, error: fetchError } = await supabase
      .from('contacts')
      .select('id, name, created_at, updated_at')
      .is('deleted_at', null)
      .is('created_at', null);

    if (fetchError) {
      console.error('❌ Error fetching contacts:', fetchError);
      process.exit(1);
    }

    if (!contactsToFix || contactsToFix.length === 0) {
      console.log('✅ No contacts need backfilling - all have created_at timestamps!');
      process.exit(0);
    }

    console.log(`📋 Found ${contactsToFix.length} contacts missing created_at timestamps\n`);

    // Calculate default date (7 days ago)
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() - 7);
    defaultDate.setHours(12, 0, 0, 0); // Set to noon for consistency
    const defaultDateISO = defaultDate.toISOString();

    console.log(`📅 Default fallback date: ${defaultDate.toLocaleString()}\n`);

    // Prepare updates
    const updates = contactsToFix.map(contact => {
      // Use updated_at as fallback if available, otherwise use default date
      const fallbackDate = contact.updated_at || defaultDateISO;
      
      return {
        id: contact.id,
        name: contact.name || 'Unnamed',
        fallbackDate: fallbackDate,
        source: contact.updated_at ? 'updated_at' : 'default (7 days ago)'
      };
    });

    // Show statistics
    const usingUpdatedAt = updates.filter(u => u.source === 'updated_at').length;
    const usingDefault = updates.filter(u => u.source === 'default (7 days ago)').length;

    console.log('📊 BACKFILL STATISTICS:');
    console.log(`   Using updated_at: ${usingUpdatedAt}`);
    console.log(`   Using default date: ${usingDefault}\n`);

    // Update in batches
    const batchSize = 50;
    let updated = 0;
    let errors = 0;

    console.log(`🔄 Updating contacts in batches of ${batchSize}...\n`);

    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(updates.length / batchSize);

      console.log(`📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} contacts)...`);

      // Update each contact in the batch
      for (const update of batch) {
        const { error: updateError } = await supabase
          .from('contacts')
          .update({ created_at: update.fallbackDate })
          .eq('id', update.id);

        if (updateError) {
          console.error(`   ❌ Error updating ${update.name} (${update.id}):`, updateError.message);
          errors++;
        } else {
          updated++;
        }
      }

      console.log(`   ✅ Batch ${batchNum} complete (${updated} updated, ${errors} errors so far)\n`);
    }

    // Final report
    console.log('═'.repeat(60));
    console.log('📊 BACKFILL COMPLETE');
    console.log('═'.repeat(60));
    console.log(`   Total contacts processed: ${updates.length}`);
    console.log(`   Successfully updated: ${updated}`);
    console.log(`   Errors: ${errors}`);

    if (errors > 0) {
      console.log('\n⚠️  Some contacts could not be updated. Check errors above.');
      process.exit(1);
    } else {
      console.log('\n✅ All contacts have been backfilled with created_at timestamps!');
      console.log('\n💡 Next steps:');
      console.log('   1. Test time-based searches (e.g., "who did I add earlier this week?")');
      console.log('   2. Verify contacts appear in search results');
      process.exit(0);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

backfillTimestamps();





