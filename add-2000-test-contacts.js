/**
 * Add 2000 test contacts to the current user via bulk-insert-contacts Edge Function.
 *
 * Run:
 *   1. Log in to your app in the browser.
 *   2. DevTools → Application → Local Storage → supabase.auth.token → copy "access_token".
 *   3. SUPABASE_ACCESS_TOKEN="<paste>" node add-2000-test-contacts.js
 *
 * Or export SUPABASE_ACCESS_TOKEN then run: node add-2000-test-contacts.js
 */

import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    const p = join(__dirname, f);
    if (existsSync(p)) {
      const text = readFileSync(p, "utf8");
      for (const line of text.split("\n")) {
        const m = line.match(/^\s*([^#=]+)=(.*)$/);
        if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
      }
    }
  }
}
loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env");
  process.exit(1);
}

if (!ACCESS_TOKEN) {
  console.error("❌ SUPABASE_ACCESS_TOKEN is required.");
  console.error("   1. Log into your app in the browser");
  console.error("   2. DevTools → Application → Local Storage → supabase.auth.token");
  console.error("   3. Copy the access_token value");
  console.error("   4. Run: SUPABASE_ACCESS_TOKEN=<token> node add-2000-test-contacts.js");
  process.exit(1);
}

const firstNames = [
  "James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda",
  "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
  "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy", "Daniel", "Lisa",
  "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra", "Donald", "Ashley",
  "Steven", "Kimberly", "Andrew", "Emily", "Paul", "Donna", "Joshua", "Michelle",
  "Kenneth", "Dorothy", "Kevin", "Carol", "Brian", "Amanda", "George", "Melissa",
  "Edward", "Deborah", "Ronald", "Stephanie", "Timothy", "Rebecca", "Jason", "Sharon",
  "Jeffrey", "Laura", "Ryan", "Cynthia", "Jacob", "Kathleen", "Gary", "Amy",
  "Nicholas", "Angela", "Eric", "Shirley", "Jonathan", "Anna", "Stephen", "Brenda",
  "Larry", "Pamela", "Justin", "Emma", "Scott", "Nicole", "Brandon", "Helen",
  "Benjamin", "Samantha", "Samuel", "Katherine", "Frank", "Christine", "Gregory", "Debra",
  "Raymond", "Rachel", "Alexander", "Carolyn", "Patrick", "Janet", "Jack", "Virginia",
  "Dennis", "Maria", "Jerry", "Heather", "Tyler", "Diane", "Aaron", "Julie",
];

const lastNames = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Wilson", "Anderson", "Thomas", "Taylor",
  "Moore", "Jackson", "Martin", "Lee", "Thompson", "White", "Harris", "Sanchez",
  "Clark", "Ramirez", "Lewis", "Robinson", "Walker", "Young", "Allen", "King",
  "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores", "Green", "Adams",
  "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell", "Carter", "Roberts",
  "Gomez", "Phillips", "Evans", "Turner", "Diaz", "Parker", "Cruz", "Edwards",
  "Collins", "Reyes", "Stewart", "Morris", "Morales", "Murphy", "Cook", "Rogers",
  "Gutierrez", "Ortiz", "Morgan", "Cooper", "Peterson", "Bailey", "Reed", "Kelly",
  "Howard", "Ramos", "Kim", "Cox", "Ward", "Richardson", "Watson", "Brooks",
  "Chavez", "Wood", "James", "Bennett", "Gray", "Mendoza", "Ruiz", "Hughes",
  "Price", "Alvarez", "Castillo", "Sanders", "Patel", "Myers", "Long", "Ross",
];

const companies = [
  "Tech Solutions Inc", "Digital Innovations", "Global Systems", "Creative Media",
  "Advanced Analytics", "Cloud Services Co", "Smart Solutions", "Data Dynamics",
  "Innovation Labs", "Future Tech", "Enterprise Solutions", "Strategic Partners",
  "Apex Industries", "Prime Consulting", "Synergy Group", "Vertex Ventures",
  "Elite Business Services", "Quantum Solutions", "Nexus Corporation", "Pinnacle Group",
];

const roles = [
  "Software Engineer", "Product Manager", "Designer", "Marketing Director",
  "Sales Manager", "Business Analyst", "Operations Manager", "Data Scientist",
  "HR Manager", "Finance Director", "CEO", "CTO", "CFO", "VP of Engineering",
  "VP of Sales", "VP of Marketing", "Account Manager", "Project Manager",
  "Developer", "Senior Developer", "UI/UX Designer", "Content Manager",
  "Customer Success Manager", "Business Development", "Consultant", "Architect",
];

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPhone() {
  const area = Math.floor(Math.random() * 900) + 100;
  const exchange = Math.floor(Math.random() * 900) + 100;
  const number = Math.floor(Math.random() * 10000);
  return `(${area}) ${exchange}-${number.toString().padStart(4, "0")}`;
}

const BATCH_SIZE = 100;
const TOTAL = 2000;

async function main() {
  console.log("📝 Generating 2000 contacts…\n");

  const contacts = [];
  for (let i = 0; i < TOTAL; i++) {
    const firstName = randomElement(firstNames);
    const lastName = randomElement(lastNames);
    const name = `${firstName} ${lastName}`;
    const company = randomElement(companies);
    const role = randomElement(roles);
    const domain = company.toLowerCase().replace(/\s+/g, "") + ".com";
    contacts.push({
      name,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@${domain}`,
      phone: randomPhone(),
      company,
      role,
      tags: [],
    });
  }

  const numBatches = Math.ceil(contacts.length / BATCH_SIZE);
  console.log(`📦 Sending ${contacts.length} contacts in ${numBatches} batches of ${BATCH_SIZE}…\n`);

  let inserted = 0;
  let failed = 0;

  for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
    const batch = contacts.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    const res = await fetch(`${SUPABASE_URL}/functions/v1/bulk-insert-contacts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ contacts: batch, isShared: false }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error(`❌ Batch ${batchNum}/${numBatches}: ${data.error || res.statusText}`);
      failed += batch.length;
      if (res.status === 401) {
        console.error("\n💡 Token may be expired. Log in again and copy a new access_token.");
        process.exit(1);
      }
      continue;
    }

    const count = data.inserted ?? data.merged ?? batch.length;
    inserted += count;
    console.log(`✅ Batch ${batchNum}/${numBatches}: ${count} (total: ${inserted})`);

    if (i + BATCH_SIZE < contacts.length) {
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  console.log("\n🎉 Done.");
  console.log(`   Inserted/merged: ${inserted}`);
  if (failed > 0) console.log(`   Failed: ${failed}`);
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
