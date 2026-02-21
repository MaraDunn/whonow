#!/usr/bin/env node

/**
 * Diagnostic script to check Supabase signup configuration
 * Run: node diagnose-signup.js
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
  process.exit(1);
}

console.log('🔍 Diagnosing Supabase Signup Configuration\n');
console.log('Configuration:');
console.log(`  URL: ${SUPABASE_URL}`);
console.log(`  Key: ${SUPABASE_KEY.substring(0, 20)}...\n`);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function diagnose() {
  const issues = [];
  const fixes = [];

  // Test 1: Check connection
  console.log('1. Testing Supabase connection...');
  try {
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    if (error && error.code === 'PGRST116') {
      console.log('   ⚠️  profiles table does not exist - migrations may not have run');
      issues.push('profiles table missing');
      fixes.push('Run all migrations from supabase/migrations/ in your Supabase SQL Editor');
    } else if (error) {
      console.log(`   ❌ Connection error: ${error.message}`);
      issues.push(`Connection error: ${error.message}`);
    } else {
      console.log('   ✅ Connection successful');
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    issues.push(`Error: ${error.message}`);
  }

  // Test 2: Try a test signup (use TEST_PASSWORD from .env or process.env; never hardcode)
  console.log('\n2. Testing signup functionality...');
  const testPassword = envVars.TEST_PASSWORD || process.env.TEST_PASSWORD;
  if (!testPassword) {
    console.log('   ⏭️  Skipped (set TEST_PASSWORD in .env to run signup test)');
  } else {
  const testEmail = `test-${Date.now()}@example.com`;
  try {
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          full_name: 'Test User'
        }
      }
    });

    if (error) {
      console.log(`   ❌ Signup failed: ${error.message}`);
      issues.push(`Signup error: ${error.message}`);
      
      if (error.message.includes('email')) {
        fixes.push('Check email confirmation settings in Supabase Dashboard → Authentication → Providers → Email');
      }
      if (error.message.includes('password')) {
        fixes.push('Check password requirements in Supabase Dashboard → Authentication → Settings');
      }
    } else {
      console.log('   ✅ Signup request successful');
      if (data.user && !data.session) {
        console.log('   ⚠️  User created but no session - email confirmation may be required');
        issues.push('Email confirmation required');
        fixes.push('Disable email confirmation in Supabase Dashboard → Authentication → Providers → Email (for development)');
      } else if (data.session) {
        console.log('   ✅ User created and session established');
      }
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    issues.push(`Error: ${error.message}`);
  }
  }

  // Test 3: Check if profiles table structure is correct
  console.log('\n3. Checking database structure...');
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .limit(0);
    
    if (error) {
      console.log(`   ❌ Error accessing profiles: ${error.message}`);
      issues.push(`Profiles table error: ${error.message}`);
    } else {
      console.log('   ✅ Profiles table accessible');
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📋 DIAGNOSIS SUMMARY');
  console.log('='.repeat(50));
  
  if (issues.length === 0) {
    console.log('✅ No issues detected! Signup should work.');
    console.log('\nIf you\'re still having issues:');
    console.log('  1. Check browser console for errors');
    console.log('  2. Check Supabase Dashboard → Logs → Auth Logs');
    console.log('  3. Verify email confirmation settings');
  } else {
    console.log(`\n⚠️  Found ${issues.length} issue(s):\n`);
    issues.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue}`);
    });
    
    if (fixes.length > 0) {
      console.log('\n🔧 Suggested fixes:\n');
      fixes.forEach((fix, i) => {
        console.log(`   ${i + 1}. ${fix}`);
      });
    }
  }
  
  console.log('\n📚 For more help, see: TROUBLESHOOTING_SIGNUP.md\n');
}

diagnose().catch(console.error);

