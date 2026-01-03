/**
 * Deterministic Contact Text Parser
 * Rule-based extraction from freeform text - NO AI/LLM
 */

import { formatName, formatPhoneNumber } from "./formatContact";

export interface ParsedContactData {
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  description: string | null;
  suggestedKeywords: string[];
}

// Email regex - standard RFC 5322 simplified
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Phone regex - multiple formats
const PHONE_PATTERNS = [
  // International with + 
  /\+\d{1,3}[-.\s]?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g,
  // US format with area code
  /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
  // International without +
  /\d{2,4}[-.\s]\d{3,4}[-.\s]\d{3,4}/g,
  // Simple formats
  /\d{10,11}/g,
];

// Role/title vocabulary for detection
const ROLE_TITLES = new Set([
  "ceo", "cto", "cfo", "coo", "cmo", "cio",
  "president", "vice president", "vp",
  "director", "managing director", "executive director",
  "manager", "senior manager", "general manager",
  "lead", "team lead", "tech lead",
  "head", "head of",
  "founder", "co-founder", "owner", "partner",
  "consultant", "advisor", "analyst",
  "engineer", "developer", "architect", "designer",
  "specialist", "coordinator", "assistant", "associate",
  "administrator", "executive", "officer",
]);

// Common role keywords for extraction
const ROLE_KEYWORDS = [
  "senior", "junior", "chief", "principal", "staff",
  "marketing", "sales", "engineering", "product", "design",
  "operations", "finance", "hr", "human resources", "legal",
  "business", "development", "customer", "support", "success",
  "data", "software", "frontend", "backend", "fullstack", "full stack",
];

// Company suffixes
const COMPANY_SUFFIXES = /\b(inc\.?|llc\.?|ltd\.?|corp\.?|corporation|company|co\.?|group|holdings|partners|solutions|technologies|tech|systems|enterprises|industries|services|consulting|agency)\b/gi;

// Prepositions indicating company
const COMPANY_PREPOSITIONS = /\bat\s+|from\s+|@/gi;

/**
 * Extract emails from text
 */
function extractEmails(text: string): string[] {
  const matches = text.match(EMAIL_REGEX);
  return matches || [];
}

/**
 * Extract phone numbers from text
 */
function extractPhones(text: string): string[] {
  const phones: string[] = [];
  
  for (const pattern of PHONE_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      phones.push(...matches);
    }
  }
  
  // Deduplicate and clean
  const seen = new Set<string>();
  return phones.filter(p => {
    const digits = p.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) return false;
    if (seen.has(digits)) return false;
    seen.add(digits);
    return true;
  });
}

/**
 * Extract company name from text
 */
function extractCompany(text: string): string | null {
  // Try to find pattern: "at Company" or "from Company" or "@Company"
  const prepMatch = text.match(/(?:at|from|@)\s+([A-Z][A-Za-z0-9\s&]+(?:Inc\.?|LLC\.?|Ltd\.?|Corp\.?)?)/i);
  if (prepMatch) {
    return prepMatch[1].trim();
  }
  
  // Try to find company with suffix
  const suffixMatch = text.match(/([A-Z][A-Za-z0-9\s&]+(?:Inc\.?|LLC\.?|Ltd\.?|Corp\.?|Corporation|Company|Co\.?|Group|Technologies|Tech|Solutions))/i);
  if (suffixMatch) {
    return suffixMatch[1].trim();
  }
  
  // Try domain extraction from email
  const emails = extractEmails(text);
  if (emails.length > 0) {
    const domain = emails[0].split("@")[1];
    if (domain && !domain.includes("gmail") && !domain.includes("yahoo") && 
        !domain.includes("hotmail") && !domain.includes("outlook") && 
        !domain.includes("icloud") && !domain.includes("aol")) {
      // Convert domain to company name
      const name = domain.split(".")[0];
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
  }
  
  return null;
}

/**
 * Extract role/title from text
 */
function extractRole(text: string): string | null {
  const lowerText = text.toLowerCase();
  
  // Look for patterns with role titles
  for (const title of ROLE_TITLES) {
    const pattern = new RegExp(`((?:senior|junior|chief|principal|staff|lead)?\\s*${title}(?:\\s+of\\s+[\\w\\s]+)?)`, "i");
    const match = text.match(pattern);
    if (match) {
      return formatRoleTitle(match[1].trim());
    }
  }
  
  // Look for "Role at Company" or "Role - Company" patterns
  const roleCompanyPattern = /([A-Z][A-Za-z\s]+(?:Manager|Director|Lead|Engineer|Designer|Developer|Analyst|Coordinator|Specialist|Consultant|Advisor))\s*(?:at|@|-|,)/i;
  const roleMatch = text.match(roleCompanyPattern);
  if (roleMatch) {
    return formatRoleTitle(roleMatch[1].trim());
  }
  
  return null;
}

/**
 * Format role title with proper capitalization
 */
function formatRoleTitle(role: string): string {
  return role
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Extract name from text using heuristics
 */
function extractName(text: string, email: string | null): string {
  // Remove extracted elements to find name
  let cleanText = text;
  
  // Remove email
  if (email) {
    cleanText = cleanText.replace(email, "");
  }
  
  // Remove phone numbers
  for (const pattern of PHONE_PATTERNS) {
    cleanText = cleanText.replace(pattern, "");
  }
  
  // Clean up separators
  cleanText = cleanText.replace(/[-–—|•,;]/g, " ").trim();
  
  // Try to find name at start - typically first capitalized words
  const words = cleanText.split(/\s+/).filter(Boolean);
  const nameWords: string[] = [];
  
  for (const word of words) {
    // Stop at common role/company indicators
    if (/^(at|from|@|works|handles|manages|leads|senior|junior|marketing|sales|ceo|cto|cfo)$/i.test(word)) {
      break;
    }
    // Stop at lowercase words after we have some name parts (likely description)
    if (nameWords.length >= 2 && /^[a-z]/.test(word) && !word.match(/^(van|von|de|del|della|der|di|du|la|le|lo|mc|mac|o')$/i)) {
      break;
    }
    // Check if word looks like a name part (capitalized or known particle)
    if (/^[A-Z]/.test(word) || /^(van|von|de|del|della|der|di|du|la|le|lo|mc|mac|o')/i.test(word)) {
      nameWords.push(word);
      if (nameWords.length >= 4) break; // Max 4 name parts
    } else if (nameWords.length === 0) {
      // First word might be lowercase in informal input
      nameWords.push(word);
    }
  }
  
  // Fallback to email prefix
  if (nameWords.length === 0 && email) {
    const emailPrefix = email.split("@")[0];
    const nameParts = emailPrefix
      .replace(/[._-]/g, " ")
      .split(/\s+/)
      .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
    return nameParts.join(" ");
  }
  
  return nameWords.join(" ") || "Unknown";
}

/**
 * Extract description/notes from text (what's left after extracting structured data)
 */
function extractDescription(
  text: string, 
  extracted: { name: string; email: string | null; phone: string | null; company: string | null; role: string | null }
): string | null {
  let remaining = text;
  
  // Remove extracted elements
  if (extracted.email) remaining = remaining.replace(extracted.email, "");
  for (const pattern of PHONE_PATTERNS) {
    remaining = remaining.replace(pattern, "");
  }
  if (extracted.company) {
    remaining = remaining.replace(new RegExp(extracted.company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), "");
  }
  if (extracted.role) {
    remaining = remaining.replace(new RegExp(extracted.role.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), "");
  }
  if (extracted.name) {
    remaining = remaining.replace(new RegExp(extracted.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), "");
  }
  
  // Clean up and check for meaningful content
  remaining = remaining
    .replace(/\bat\b|\bfrom\b|@|[-–—|•,;:]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  
  // Look for description patterns like "handles X" or "works on Y"
  const descPatterns = [
    /handles?\s+(.+)/i,
    /works?\s+(?:on|with)?\s*(.+)/i,
    /manages?\s+(.+)/i,
    /leads?\s+(.+)/i,
    /responsible\s+for\s+(.+)/i,
    /-\s*(.{10,})/,  // After a dash, longer text
  ];
  
  for (const pattern of descPatterns) {
    const match = text.match(pattern);
    if (match && match[1].trim().length > 5) {
      return match[1].trim();
    }
  }
  
  // If remaining text is substantial, use it as description
  if (remaining.length > 10 && remaining.split(/\s+/).length >= 2) {
    return remaining;
  }
  
  return null;
}

/**
 * Generate keyword suggestions from extracted data
 */
function generateKeywords(data: Omit<ParsedContactData, "suggestedKeywords">): string[] {
  const keywords: string[] = [];
  const seen = new Set<string>();
  
  const addKeyword = (word: string) => {
    const lower = word.toLowerCase();
    if (lower.length >= 3 && !seen.has(lower)) {
      seen.add(lower);
      keywords.push(lower);
    }
  };
  
  // Extract from role
  if (data.role) {
    data.role.split(/\s+/).forEach(w => addKeyword(w));
  }
  
  // Extract from company
  if (data.company) {
    const cleanCompany = data.company.replace(COMPANY_SUFFIXES, "").trim();
    cleanCompany.split(/\s+/).forEach(w => addKeyword(w));
  }
  
  // Extract from description
  if (data.description) {
    const stopWords = new Set(["the", "and", "for", "our", "all", "with", "has", "are", "was", "been", "have", "handles", "works", "manages"]);
    data.description.split(/\s+/)
      .filter(w => !stopWords.has(w.toLowerCase()) && w.length >= 4)
      .slice(0, 5)
      .forEach(w => addKeyword(w));
  }
  
  return keywords.slice(0, 8);
}

/**
 * Parse freeform text into structured contact data
 */
export function parseContactText(input: string): ParsedContactData {
  const text = input.trim();
  
  if (!text) {
    return {
      name: "",
      email: null,
      phone: null,
      company: null,
      role: null,
      description: null,
      suggestedKeywords: [],
    };
  }
  
  // Extract structured fields
  const emails = extractEmails(text);
  const phones = extractPhones(text);
  const company = extractCompany(text);
  const role = extractRole(text);
  const email = emails[0] || null;
  const phone = phones[0] || null;
  const name = extractName(text, email);
  
  const extracted = { name, email, phone, company, role };
  const description = extractDescription(text, extracted);
  
  const data: ParsedContactData = {
    name: formatName(name),
    email,
    phone: phone ? formatPhoneNumber(phone) : null,
    company,
    role,
    description,
    suggestedKeywords: [],
  };
  
  data.suggestedKeywords = generateKeywords(data);
  
  return data;
}
