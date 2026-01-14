/**
 * Browser Console Script to Add 200 Random Contacts
 * 
 * Usage:
 *   1. Open your app in the browser and log in
 *   2. Open DevTools (F12) → Console tab
 *   3. Copy and paste this entire script and press Enter
 */

(async function() {
  // Try to get Supabase client from window (if app exposes it) or create one
  let supabase;
  
  // Check if app has supabase client exposed
  if (window.supabase) {
    supabase = window.supabase;
    console.log('✅ Using existing Supabase client from app');
  } else {
    // Create client using hardcoded values (same as your existing script)
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    supabase = createClient(
      'https://yinicwvgwdjlkwjegrun.supabase.co',
      'sb_publishable_nd05Lzm_bfT5ZCMTjkVPBQ_WBqO8dx6'
    );
    console.log('✅ Created new Supabase client');
  }
  
  // Check authentication
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session) {
    console.error('❌ Not authenticated. Please log in first.');
    return;
  }
  
  const userId = session.user.id;
  console.log(`✅ Authenticated as: ${session.user.email}`);
  console.log(`📝 Generating 200 contacts for user: ${userId}\n`);

  // Get user's company_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', userId)
    .single();

  const companyId = profile?.company_id || null;

  // Sample data
  const firstNames = [
    'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
    'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
    'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa',
    'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Donald', 'Ashley',
    'Steven', 'Kimberly', 'Andrew', 'Emily', 'Paul', 'Donna', 'Joshua', 'Michelle',
    'Kenneth', 'Dorothy', 'Kevin', 'Carol', 'Brian', 'Amanda', 'George', 'Melissa',
    'Edward', 'Deborah', 'Ronald', 'Stephanie', 'Timothy', 'Rebecca', 'Jason', 'Sharon',
    'Jeffrey', 'Laura', 'Ryan', 'Cynthia', 'Jacob', 'Kathleen', 'Gary', 'Amy',
    'Nicholas', 'Angela', 'Eric', 'Shirley', 'Jonathan', 'Anna', 'Stephen', 'Brenda',
    'Larry', 'Pamela', 'Justin', 'Emma', 'Scott', 'Nicole', 'Brandon', 'Helen',
    'Benjamin', 'Samantha', 'Samuel', 'Katherine', 'Frank', 'Christine', 'Gregory', 'Debra',
    'Raymond', 'Rachel', 'Alexander', 'Carolyn', 'Patrick', 'Janet', 'Jack', 'Virginia',
    'Dennis', 'Maria', 'Jerry', 'Heather', 'Tyler', 'Diane', 'Aaron', 'Julie'
  ];

  const lastNames = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
    'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Wilson', 'Anderson', 'Thomas', 'Taylor',
    'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White', 'Harris', 'Sanchez',
    'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King',
    'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green', 'Adams',
    'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
    'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards',
    'Collins', 'Reyes', 'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook', 'Rogers',
    'Gutierrez', 'Ortiz', 'Morgan', 'Cooper', 'Peterson', 'Bailey', 'Reed', 'Kelly',
    'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson', 'Watson', 'Brooks',
    'Chavez', 'Wood', 'James', 'Bennett', 'Gray', 'Mendoza', 'Ruiz', 'Hughes',
    'Price', 'Alvarez', 'Castillo', 'Sanders', 'Patel', 'Myers', 'Long', 'Ross'
  ];

  const companies = [
    'Tech Solutions Inc', 'Digital Innovations', 'Global Systems', 'Creative Media',
    'Advanced Analytics', 'Cloud Services Co', 'Smart Solutions', 'Data Dynamics',
    'Innovation Labs', 'Future Tech', 'Enterprise Solutions', 'Strategic Partners',
    'Apex Industries', 'Prime Consulting', 'Synergy Group', 'Vertex Ventures',
    'Elite Business Services', 'Quantum Solutions', 'Nexus Corporation', 'Pinnacle Group'
  ];

  const roles = [
    'Software Engineer', 'Product Manager', 'Designer', 'Marketing Director',
    'Sales Manager', 'Business Analyst', 'Operations Manager', 'Data Scientist',
    'HR Manager', 'Finance Director', 'CEO', 'CTO', 'CFO', 'VP of Engineering',
    'VP of Sales', 'VP of Marketing', 'Account Manager', 'Project Manager',
    'Developer', 'Senior Developer', 'UI/UX Designer', 'Content Manager',
    'Customer Success Manager', 'Business Development', 'Consultant', 'Architect'
  ];

  function randomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function randomPhone() {
    const area = Math.floor(Math.random() * 900) + 100;
    const exchange = Math.floor(Math.random() * 900) + 100;
    const number = Math.floor(Math.random() * 10000);
    return `(${area}) ${exchange}-${number.toString().padStart(4, '0')}`;
  }

  // Generate 200 contacts
  const contacts = [];
  console.log('📝 Generating 200 random contacts...\n');

  for (let i = 0; i < 200; i++) {
    const firstName = randomElement(firstNames);
    const lastName = randomElement(lastNames);
    const name = `${firstName} ${lastName}`;
    const company = randomElement(companies);
    const role = randomElement(roles);
    
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@${company.toLowerCase().replace(/\s+/g, '')}.com`;
    const phone = randomPhone();

    contacts.push({
      name,
      email,
      phone,
      company,
      role,
      owner_id: userId,
      company_id: companyId,
      is_shared: false,
      tags: [],
    });
  }

  console.log(`📦 Inserting ${contacts.length} contacts in batches of 50...\n`);

  // Insert in batches of 50
  const batchSize = 50;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < contacts.length; i += batchSize) {
    const batch = contacts.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(contacts.length / batchSize);
    
    console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} contacts)...`);
    
    const { data, error } = await supabase
      .from('contacts')
      .insert(batch)
      .select('id');

    if (error) {
      console.error(`❌ Batch ${batchNum} error:`, error.message);
      errors++;
      continue;
    }

    inserted += data?.length || 0;
    console.log(`✅ Batch ${batchNum}: Inserted ${data?.length || 0} contacts (Total: ${inserted})\n`);

    // Small delay between batches
    if (i + batchSize < contacts.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('\n🎉 Summary:');
  console.log(`   ✅ Successfully inserted: ${inserted} contacts`);
  if (errors > 0) {
    console.log(`   ❌ Failed batches: ${errors}`);
  }
  console.log(`\n📊 You should now see approximately ${inserted + 3} total contacts (${inserted} new + 3 user contact cards)`);
  console.log('   The count should display correctly in the header!');
  console.log('\n🔄 Refreshing page in 2 seconds...');
  setTimeout(() => window.location.reload(), 2000);
})();
