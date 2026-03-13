#!/usr/bin/env node

/**
 * Generates contacts-1000.csv with 1000 contacts for import.
 * Output: contacts-1000.csv (CSV with name, email, phone, company, role).
 * Does NOT insert into any account — use Import in the app to load this file.
 */

import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, "..", "contacts-1000.csv");

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
  "Henry", "Joyce", "Nathan", "Victoria", "Douglas", "Olivia", "Zachary", "Kelly",
  "Peter", "Lauren", "Kyle", "Christina", "Noah", "Evelyn", "Ethan", "Judith",
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
  "Foster", "Jimenez", "Powell", "Jenkins", "Perry", "Russell", "Sullivan", "Bell",
  "Coleman", "Butler", "Barnes", "Fisher", "Hamilton", "Graham", "Simmons", "Griffin",
];

const companies = [
  "Tech Solutions Inc", "Digital Innovations", "Global Systems", "Creative Media",
  "Advanced Analytics", "Cloud Services Co", "Smart Solutions", "Data Dynamics",
  "Innovation Labs", "Future Tech", "Enterprise Solutions", "Strategic Partners",
  "Apex Industries", "Prime Consulting", "Synergy Group", "Vertex Ventures",
  "Elite Business Services", "Quantum Solutions", "Nexus Corporation", "Pinnacle Group",
  "TechCorp Solutions", "CloudBase Inc", "DataSync Technologies", "ByteForge Systems",
  "FinancePlus Holdings", "Capital Partners Group", "HealthTech Medical", "DesignLab Creative",
  "MediaHub Productions", "BrandWorks Marketing", "Legal Partners LLP", "HR Solutions Corp",
];

const roles = [
  "Software Engineer", "Product Manager", "Designer", "Marketing Director",
  "Sales Manager", "Business Analyst", "Operations Manager", "Data Scientist",
  "HR Manager", "Finance Director", "CEO", "CTO", "CFO", "VP of Engineering",
  "VP of Sales", "VP of Marketing", "Account Manager", "Project Manager",
  "Developer", "Senior Developer", "UI/UX Designer", "Content Manager",
  "Customer Success Manager", "Business Development", "Consultant", "Architect",
  "Software Engineer", "Product Manager", "Marketing Director", "Sales Manager",
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

function escapeCsv(value) {
  if (value == null) return "";
  const s = String(value).trim();
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

const TOTAL = 1000;

function main() {
  const rows = [["name", "email", "phone", "company", "role"].map(escapeCsv).join(",")];

  for (let i = 0; i < TOTAL; i++) {
    const firstName = randomElement(firstNames);
    const lastName = randomElement(lastNames);
    const name = `${firstName} ${lastName}`;
    const company = randomElement(companies);
    const role = randomElement(roles);
    const domain = company.toLowerCase().replace(/\s+/g, "") + ".com";
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@${domain}`;
    const phone = randomPhone();

    rows.push([name, email, phone, company, role].map(escapeCsv).join(","));
  }

  const csv = rows.join("\n");
  writeFileSync(OUT_PATH, csv, "utf8");
  console.log(`Wrote ${TOTAL} contacts to ${OUT_PATH}`);
}

main();
