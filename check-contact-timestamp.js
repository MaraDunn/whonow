#!/usr/bin/env node

/**
 * Quick script to check if a specific contact has a timestamp
 * Usage: node check-contact-timestamp.js "Mitchel Dunn"
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
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkContact() {
  const contactName = process.argv[2] || 'Mitchel Dunn';
  console.log(`🔍 Checking contact: "${contactName}"\n`);

  try {
    // Find the contact
    const { data: contacts, error } = await supabase
      .from('contacts')
      .select('id, name, created_at, updated_at, deleted_at')
      .ilike('name', `%${contactName}%`)
      .is('deleted_at', null);

    if (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }

    if (!contacts || contacts.length === 0) {
      console.log(`❌ No contact found matching "${contactName}"`);
      process.exit(1);
    }

    const contact = contacts[0];
    console.log(`✅ Found contact: ${contact.name}`);
    console.log(`   ID: ${contact.id}`);
    console.log(`   created_at: ${contact.created_at || 'NULL/MISSING'}`);
    console.log(`   updated_at: ${contact.updated_at || 'NULL/MISSING'}\n`);

    if (!contact.created_at) {
      console.log('⚠️  Contact is missing created_at timestamp!');
      console.log('💡 Run: node backfill-contact-timestamps.js');
      process.exit(1);
    }

    // Check if it's today
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const createdAt = new Date(contact.created_at);
    const isToday = createdAt >= todayStart && createdAt <= todayEnd;

    console.log('📅 Date Analysis:');
    console.log(`   Contact created_at: ${createdAt.toISOString()}`);
    console.log(`   Contact created_at (local): ${createdAt.toLocaleString()}`);
    console.log(`   Today start: ${todayStart.toISOString()}`);
    console.log(`   Today start (local): ${todayStart.toLocaleString()}`);
    console.log(`   Today end: ${todayEnd.toISOString()}`);
    console.log(`   Today end (local): ${todayEnd.toLocaleString()}`);
    console.log(`   Is today: ${isToday ? '✅ YES' : '❌ NO'}\n`);

    if (!isToday) {
      const daysDiff = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`   Contact was created ${daysDiff} day(s) ago`);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

checkContact();





