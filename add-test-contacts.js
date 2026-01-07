#!/usr/bin/env node

/**
 * Script to add 100 generated contacts to the current user's account
 * 
 * Usage:
 *   1. Browser Console: Copy and paste the browser version
 *   2. Node.js: node add-test-contacts.js (requires SUPABASE_URL and SUPABASE_ANON_KEY env vars)
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

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Name lists
const firstNames = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth',
  'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen',
  'Christopher', 'Nancy', 'Daniel', 'Lisa', 'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra',
  'Donald', 'Ashley', 'Steven', 'Kimberly', 'Paul', 'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle',
  'Kenneth', 'Dorothy', 'Kevin', 'Carol', 'Brian', 'Amanda', 'George', 'Melissa', 'Timothy', 'Deborah',
  'Ronald', 'Stephanie', 'Edward', 'Rebecca', 'Jason', 'Sharon', 'Jeffrey', 'Laura', 'Ryan', 'Cynthia',
  'Jacob', 'Kathleen', 'Gary', 'Amy', 'Nicholas', 'Angela', 'Eric', 'Shirley', 'Jonathan', 'Anna',
  'Stephen', 'Brenda', 'Larry', 'Pamela', 'Justin', 'Emma', 'Scott', 'Nicole', 'Brandon', 'Helen',
  'Benjamin', 'Samantha', 'Samuel', 'Katherine', 'Raymond', 'Christine', 'Gregory', 'Debra', 'Frank', 'Rachel',
  'Alexander', 'Carolyn', 'Patrick', 'Janet', 'Jack', 'Catherine', 'Dennis', 'Maria', 'Jerry', 'Heather'
];

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
  'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes',
  'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper',
  'Peterson', 'Bailey', 'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson',
  'Watson', 'Brooks', 'Chavez', 'Wood', 'James', 'Bennett', 'Gray', 'Mendoza', 'Ruiz', 'Hughes',
  'Price', 'Alvarez', 'Castillo', 'Sanders', 'Patel', 'Myers', 'Long', 'Ross', 'Foster', 'Jimenez'
];

const companies = [
  'TechCorp Solutions', 'CloudBase Inc', 'DataSync Technologies', 'ByteForge Systems', 'QuantumSoft Labs',
  'FinancePlus Holdings', 'Capital Partners Group', 'Apex Investments LLC', 'Sterling Bank & Trust', 'HealthTech Medical',
  'MedCore Systems', 'Wellness Labs Inc', 'BioGenix Research', 'DesignLab Creative', 'MediaHub Productions',
  'Creative Studios Agency', 'BrandWorks Marketing', 'Legal Partners LLP', 'Consulting Group International', 'HR Solutions Corp',
  'Logistics Pro Services', 'Global Trade Enterprises', 'Precision Manufacturing', 'EcoGreen Industries', 'NextGen Robotics'
];

const roles = [
  'Software Engineer', 'Product Manager', 'Marketing Director', 'Sales Manager', 'HR Manager',
  'CEO', 'CTO', 'CFO', 'VP of Engineering', 'VP of Sales', 'Design Director', 'Operations Manager',
  'Business Analyst', 'Data Scientist', 'UX Designer', 'Account Executive', 'Customer Success Manager',
  'Financial Analyst', 'HR Business Partner', 'Legal Counsel', 'Project Manager', 'Content Strategist'
];

const departments = ['Engineering', 'Marketing', 'Sales', 'Finance', 'HR', 'Design', 'Product', 'Operations', 'Legal', 'Customer Success'];

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPhone() {
  const area = Math.floor(Math.random() * 900) + 100;
  const prefix = Math.floor(Math.random() * 900) + 100;
  const line = Math.floor(Math.random() * 9000) + 1000;
  return `(${area}) ${prefix}-${line}`;
}

function generateDescription(firstName, role, company, department) {
  const templates = [
    `${firstName} is a ${role} at ${company}, bringing expertise in ${department.toLowerCase()} strategy and execution.`,
    `Experienced ${role} with ${Math.floor(Math.random() * 15) + 2}+ years in ${department.toLowerCase()}. Currently leading initiatives at ${company}.`,
    `${role} specializing in ${department.toLowerCase()} operations. ${firstName} drives results through innovative approaches at ${company}.`,
    `Dynamic ${role} at ${company}. ${firstName} focuses on ${department.toLowerCase()} excellence and team collaboration.`,
    `${firstName} leads ${department.toLowerCase()} efforts at ${company} as ${role}. Known for strategic thinking and execution.`,
  ];
  return randomElement(templates);
}

async function addContacts() {
  console.log('🔍 Checking authentication...');
  
  // Check for existing session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session) {
    console.error('❌ Not authenticated. Please sign in first.');
    console.log('\nTo use this script:');
    console.log('1. Sign in to your app at http://localhost:8080');
    console.log('2. Open browser console (F12)');
    console.log('3. Run the browser version of this script (see add-test-contacts-browser.js)');
    process.exit(1);
  }

  const userId = session.user.id;
  console.log(`✅ Authenticated as: ${session.user.email}`);
  console.log(`📝 Generating 100 contacts for user: ${userId}\n`);

  // Get user's profile to get company_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', userId)
    .single();

  const companyId = profile?.company_id || null;

  // Get existing folders for the user
  const { data: folders } = await supabase
    .from('folders')
    .select('id, name')
    .eq('owner_id', userId);

  const folderIds = folders?.map(f => f.id) || [];
  console.log(`📁 Found ${folderIds.length} folders\n`);

  // Generate 100 contacts
  const contacts = [];
  for (let i = 0; i < 100; i++) {
    const firstName = randomElement(firstNames);
    const lastName = randomElement(lastNames);
    const name = `${firstName} ${lastName}`;
    
    const company = randomElement(companies);
    const department = randomElement(departments);
    const role = randomElement(roles);
    
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${company.toLowerCase().replace(/\s+/g, '')}.com`;
    const phone = randomPhone();
    
    // Build tags
    const tags = [department.toLowerCase()];
    if (Math.random() > 0.7) tags.push('priority');
    if (Math.random() > 0.6) tags.push('client');
    
    const description = generateDescription(firstName, role, company, department);
    
    // Assign to folder (30% chance) or leave unassigned
    const folderId = folderIds.length > 0 && Math.random() > 0.7 
      ? randomElement(folderIds) 
      : null;

    contacts.push({
      name,
      email,
      phone,
      company,
      role,
      description,
      tags,
      folder_id: folderId,
      owner_id: userId,
      company_id: companyId,
      is_shared: false, // Personal contacts
    });
  }

  console.log(`📦 Inserting ${contacts.length} contacts in batches...\n`);

  // Insert in batches of 50
  const batchSize = 50;
  let inserted = 0;
  
  for (let i = 0; i < contacts.length; i += batchSize) {
    const batch = contacts.slice(i, i + batchSize);
    const { data, error } = await supabase.from('contacts').insert(batch).select('id');
    
    if (error) {
      console.error(`❌ Batch ${Math.floor(i / batchSize) + 1} error:`, error);
      throw error;
    }
    
    inserted += batch.length;
    console.log(`✅ Inserted ${inserted}/${contacts.length} contacts`);
  }

  console.log(`\n🎉 Successfully created ${inserted} contacts!`);
  console.log(`\n📊 Summary:`);
  console.log(`   - Contacts created: ${inserted}`);
  console.log(`   - Assigned to folders: ${contacts.filter(c => c.folder_id).length}`);
  console.log(`   - Personal contacts (not shared): ${inserted}`);
}

addContacts().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});

