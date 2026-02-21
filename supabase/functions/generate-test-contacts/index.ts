import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkLaunchMode, waitlistModeBlockedResponse, getCorsHeaders, handleCorsPreflightRequest } from "../_shared/security.ts";

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
]

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
]

const companies = [
  { name: 'TechCorp Solutions', domain: 'techcorp.com' },
  { name: 'CloudBase Inc', domain: 'cloudbase.io' },
  { name: 'DataSync Technologies', domain: 'datasync.tech' },
  { name: 'ByteForge Systems', domain: 'byteforge.com' },
  { name: 'QuantumSoft Labs', domain: 'quantumsoft.com' },
  { name: 'FinancePlus Holdings', domain: 'financeplus.com' },
  { name: 'Capital Partners Group', domain: 'capitalpartners.com' },
  { name: 'Apex Investments LLC', domain: 'apexinvest.com' },
  { name: 'Sterling Bank & Trust', domain: 'sterlingbank.com' },
  { name: 'HealthTech Medical', domain: 'healthtech.med' },
  { name: 'MedCore Systems', domain: 'medcore.com' },
  { name: 'Wellness Labs Inc', domain: 'wellnesslabs.com' },
  { name: 'BioGenix Research', domain: 'biogenix.com' },
  { name: 'DesignLab Creative', domain: 'designlab.co' },
  { name: 'MediaHub Productions', domain: 'mediahub.com' },
  { name: 'Creative Studios Agency', domain: 'creativestudios.com' },
  { name: 'BrandWorks Marketing', domain: 'brandworks.com' },
  { name: 'Legal Partners LLP', domain: 'legalpartners.com' },
  { name: 'Consulting Group International', domain: 'cgi-consulting.com' },
  { name: 'HR Solutions Corp', domain: 'hrsolutions.com' },
  { name: 'Logistics Pro Services', domain: 'logisticspro.com' },
  { name: 'Global Trade Enterprises', domain: 'globaltrade.com' },
  { name: 'Precision Manufacturing', domain: 'precisionmfg.com' },
  { name: 'EcoGreen Industries', domain: 'ecogreen.com' },
  { name: 'NextGen Robotics', domain: 'nextgenrobotics.com' }
]

const departmentRoles: Record<string, { roles: string[], tags: string[] }> = {
  'Engineering': {
    roles: ['Software Engineer', 'Senior Software Engineer', 'Staff Engineer', 'Principal Engineer', 'DevOps Engineer', 'QA Engineer', 'Tech Lead', 'Engineering Manager', 'VP of Engineering', 'CTO', 'Data Engineer', 'ML Engineer', 'Platform Engineer', 'Security Engineer', 'SRE'],
    tags: ['engineering', 'technical', 'developer']
  },
  'Marketing': {
    roles: ['Marketing Coordinator', 'Marketing Manager', 'Senior Marketing Manager', 'Content Strategist', 'Brand Manager', 'Digital Marketing Specialist', 'SEO Specialist', 'Social Media Manager', 'Marketing Director', 'CMO', 'Growth Manager', 'Product Marketing Manager'],
    tags: ['marketing', 'creative', 'growth']
  },
  'Sales': {
    roles: ['Sales Representative', 'Account Executive', 'Senior Account Executive', 'Sales Manager', 'Sales Director', 'VP of Sales', 'Business Development Rep', 'Enterprise Account Manager', 'Regional Sales Manager', 'Chief Revenue Officer', 'Inside Sales Rep', 'Solutions Consultant'],
    tags: ['sales', 'revenue', 'client-facing']
  },
  'Finance': {
    roles: ['Financial Analyst', 'Senior Financial Analyst', 'Accountant', 'Senior Accountant', 'Controller', 'Finance Manager', 'Treasury Analyst', 'FP&A Manager', 'VP of Finance', 'CFO', 'Payroll Specialist', 'Tax Specialist'],
    tags: ['finance', 'accounting', 'numbers']
  },
  'HR': {
    roles: ['HR Coordinator', 'HR Specialist', 'Recruiter', 'Senior Recruiter', 'HR Manager', 'HR Business Partner', 'Talent Acquisition Manager', 'People Operations Manager', 'HR Director', 'CHRO', 'Compensation Analyst', 'Learning & Development Manager'],
    tags: ['hr', 'people', 'talent']
  },
  'Design': {
    roles: ['UX Designer', 'UI Designer', 'Senior Product Designer', 'Lead Designer', 'UX Researcher', 'Visual Designer', 'Interaction Designer', 'Design Manager', 'Creative Director', 'Head of Design', 'Brand Designer', 'Motion Designer'],
    tags: ['design', 'creative', 'ux']
  },
  'Product': {
    roles: ['Associate Product Manager', 'Product Manager', 'Senior Product Manager', 'Group Product Manager', 'Director of Product', 'VP of Product', 'Chief Product Officer', 'Product Owner', 'Technical Product Manager', 'Product Analyst'],
    tags: ['product', 'strategy', 'roadmap']
  },
  'Operations': {
    roles: ['Operations Coordinator', 'Operations Analyst', 'Operations Manager', 'Senior Operations Manager', 'Director of Operations', 'VP of Operations', 'COO', 'Project Manager', 'Program Manager', 'Business Analyst', 'Office Manager'],
    tags: ['operations', 'efficiency', 'process']
  },
  'Legal': {
    roles: ['Paralegal', 'Legal Assistant', 'Associate Attorney', 'Senior Counsel', 'Legal Counsel', 'Corporate Counsel', 'General Counsel', 'Chief Legal Officer', 'Compliance Officer', 'Contract Manager', 'IP Attorney'],
    tags: ['legal', 'compliance', 'contracts']
  },
  'Customer Success': {
    roles: ['Customer Support Rep', 'Customer Success Manager', 'Senior CSM', 'Technical Support Specialist', 'Support Team Lead', 'Customer Success Director', 'VP of Customer Success', 'Implementation Manager', 'Onboarding Specialist', 'Customer Experience Manager'],
    tags: ['customer-success', 'support', 'client-facing']
  }
}

const priorityTags = ['priority', 'vip', 'hot-lead', 'key-account', 'strategic']
const relationshipTags = ['client', 'vendor', 'partner', 'investor', 'contractor', 'prospect', 'referral']

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomPhone(): string {
  const area = Math.floor(Math.random() * 900) + 100
  const prefix = Math.floor(Math.random() * 900) + 100
  const line = Math.floor(Math.random() * 9000) + 1000
  return `(${area}) ${prefix}-${line}`
}

function generateDescription(firstName: string, role: string, company: string, department: string): string {
  const templates = [
    `${firstName} is a ${role} at ${company}, bringing expertise in ${department.toLowerCase()} strategy and execution.`,
    `Experienced ${role} with ${Math.floor(Math.random() * 15) + 2}+ years in ${department.toLowerCase()}. Currently leading initiatives at ${company}.`,
    `${role} specializing in ${department.toLowerCase()} operations. ${firstName} drives results through innovative approaches at ${company}.`,
    `Dynamic ${role} at ${company}. ${firstName} focuses on ${department.toLowerCase()} excellence and team collaboration.`,
    `${firstName} leads ${department.toLowerCase()} efforts at ${company} as ${role}. Known for strategic thinking and execution.`,
    `Passionate ${role} with deep ${department.toLowerCase()} background. ${firstName} currently contributes to ${company}'s growth.`,
    `${role} at ${company}. ${firstName} specializes in building high-performing ${department.toLowerCase()} teams.`,
    `Results-driven ${role} supporting ${company}'s ${department.toLowerCase()} initiatives with data-driven strategies.`
  ]
  return randomElement(templates)
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  // Check launch mode - block in waitlist mode
  const { blocked } = checkLaunchMode();
  if (blocked) {
    return waitlistModeBlockedResponse(origin);
  }

  // Require JWT so only authenticated users can create test data
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Missing authorization header" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Optional: disable in production unless explicitly allowed (set ALLOW_GENERATE_TEST_CONTACTS=true in dev/staging only)
    if (Deno.env.get("ALLOW_GENERATE_TEST_CONTACTS") !== "true") {
      return new Response(
        JSON.stringify({ error: "Generate test contacts is not enabled" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get existing folders
    const { data: folders } = await supabase
      .from('folders')
      .select('id, name')
    
    console.log('Found folders:', folders)
    
    const folderIds = folders?.map(f => f.id) || []
    
    const departments = Object.keys(departmentRoles)
    const contacts = []

    for (let i = 0; i < 500; i++) {
      const firstName = randomElement(firstNames)
      const lastName = randomElement(lastNames)
      const name = `${firstName} ${lastName}`
      
      const company = randomElement(companies)
      const department = randomElement(departments)
      const { roles, tags: deptTags } = departmentRoles[department]
      const role = randomElement(roles)
      
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${company.domain}`
      const phone = randomPhone()
      
      // Build tags array
      const tags = [...deptTags]
      if (Math.random() > 0.7) tags.push(randomElement(priorityTags))
      if (Math.random() > 0.6) tags.push(randomElement(relationshipTags))
      
      const description = generateDescription(firstName, role, company.name, department)
      
      // Assign to folder (70% chance) or leave unassigned
      const folderId = folderIds.length > 0 && Math.random() > 0.3 
        ? randomElement(folderIds) 
        : null

      contacts.push({
        name,
        email,
        phone,
        company: company.name,
        role,
        description,
        tags,
        folder_id: folderId,
        owner_id: user.id,
        is_shared: true // Make them visible to company
      })
    }

    console.log(`Generated ${contacts.length} contacts, inserting in batches...`)

    // Insert in batches of 100
    const batchSize = 100
    let inserted = 0
    
    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize)
      const { error } = await supabase.from('contacts').insert(batch)
      
      if (error) {
        console.error(`Batch ${i / batchSize + 1} error:`, error)
        throw error
      }
      
      inserted += batch.length
      console.log(`Inserted ${inserted}/${contacts.length} contacts`)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully created ${contacts.length} test contacts`,
        folders_used: folderIds.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error generating contacts:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
