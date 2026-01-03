#!/usr/bin/env node

/**
 * Script to combine all Supabase migrations into a single SQL file
 * Usage: node combine-migrations.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = 'supabase/migrations';
const OUTPUT_FILE = 'combined-migrations.sql';

console.log('🔄 Combining Supabase migrations...\n');

// Check if migrations directory exists
if (!fs.existsSync(MIGRATIONS_DIR)) {
  console.error(`❌ Error: Migrations directory not found: ${MIGRATIONS_DIR}`);
  process.exit(1);
}

// Get all migration files and sort them
const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
  .filter(file => file.endsWith('.sql'))
  .sort();

if (migrationFiles.length === 0) {
  console.error('❌ Error: No migration files found');
  process.exit(1);
}

// Create output file with header
const header = `-- ============================================
-- Combined Supabase Migrations
-- ============================================
-- This file contains all migrations combined in chronological order
-- Generated: ${new Date().toLocaleString()}
-- 
-- Instructions:
-- 1. Copy the entire contents of this file
-- 2. Go to your Supabase Dashboard → SQL Editor
-- 3. Paste and click "Run"
-- ============================================

-- ============================================

`;

let output = header;

// Process each migration file
migrationFiles.forEach((filename, index) => {
  const filePath = path.join(MIGRATIONS_DIR, filename);
  const content = fs.readFileSync(filePath, 'utf8');
  
  console.log(`  [${index + 1}/${migrationFiles.length}] Processing: ${filename}`);
  
  // Add separator and comment
  output += `-- ============================================
-- Migration ${index + 1}: ${filename}
-- ============================================

${content}

`;
});

// Add footer
output += `-- ============================================
-- End of Migrations
-- ============================================
`;

// Write output file
fs.writeFileSync(OUTPUT_FILE, output, 'utf8');

console.log(`\n✅ Successfully combined ${migrationFiles.length} migrations into: ${OUTPUT_FILE}`);
console.log(`\n📋 Next steps:`);
console.log(`   1. Review the file: cat ${OUTPUT_FILE}`);
console.log(`   2. Copy the contents`);
console.log(`   3. Go to Supabase Dashboard → SQL Editor`);
console.log(`   4. Paste and run\n`);

