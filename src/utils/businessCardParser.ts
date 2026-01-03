/**
 * Deterministic Business Card Text Parser
 * Rule-based extraction from OCR output - NO AI/LLM
 */

import { formatName, formatPhoneNumber } from "./formatContact";

export interface BusinessCardContact {
  name: string;
  email: string;
  phone: string;
  company: string;
  role: string;
}

// Email regex
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;

// Phone patterns - business cards often have specific formats
const PHONE_PATTERNS = [
  // With labels
  /(?:tel|phone|mobile|cell|fax|office|direct)[:\s]*([+\d\s().-]{7,20})/gi,
  // International format
  /\+\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g,
  // US format
  /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g,
  // Generic long numbers
  /\d{3}[\s.-]\d{3}[\s.-]\d{4}/g,
];

// URL patterns (to exclude from company extraction)
const URL_REGEX = /(?:https?:\/\/)?(?:www\.)?[\w.-]+\.[a-z]{2,}(?:\/\S*)?/gi;

// Role/title keywords
const ROLE_TITLES = [
  "chief executive officer", "chief technology officer", "chief financial officer",
  "chief operating officer", "chief marketing officer", "chief information officer",
  "ceo", "cto", "cfo", "coo", "cmo", "cio",
  "president", "vice president", "vp",
  "director", "managing director", "executive director", "creative director",
  "manager", "senior manager", "general manager", "project manager", "account manager",
  "lead", "team lead", "tech lead",
  "head of", "head",
  "founder", "co-founder", "owner", "partner", "principal",
  "consultant", "advisor", "analyst", "strategist",
  "engineer", "developer", "architect", "designer", "specialist",
  "coordinator", "assistant", "associate", "executive", "administrator",
  "sales representative", "account executive", "business development",
  "marketing manager", "product manager", "operations manager",
];

// Company suffixes
const COMPANY_SUFFIXES = /\b(Inc\.?|LLC\.?|Ltd\.?|Corp\.?|Corporation|Company|Co\.?|Group|Holdings|Partners|Solutions|Technologies|Tech|Systems|Enterprises|Industries|Services|Consulting|Agency|Associates|International|Worldwide|Global)\b/i;

/**
 * Clean OCR text - handle common OCR artifacts
 */
function cleanOCRText(text: string): string {
  return text
    // Fix common OCR mistakes
    .replace(/[|]/g, "I")
    .replace(/[`'']/g, "'")
    .replace(/[""]/g, '"')
    // Normalize whitespace
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Split text into lines/blocks
 */
function splitIntoBlocks(text: string): string[] {
  return text
    .split(/[\n\r]+/)
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

/**
 * Extract email from text
 */
function extractEmail(text: string): string | null {
  const match = text.match(EMAIL_REGEX);
  return match ? match[0].toLowerCase() : null;
}

/**
 * Extract phone number from text
 */
function extractPhone(text: string): string | null {
  for (const pattern of PHONE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      // Get the phone number part (might be in capture group)
      const phoneStr = match[1] || match[0];
      const digits = phoneStr.replace(/\D/g, "");
      if (digits.length >= 7 && digits.length <= 15) {
        return phoneStr;
      }
    }
  }
  return null;
}

/**
 * Extract company name from text blocks
 */
function extractCompany(blocks: string[], email: string | null): string | null {
  // Try domain-based company extraction from email
  if (email) {
    const domain = email.split("@")[1];
    if (domain) {
      const personalDomains = ["gmail", "yahoo", "hotmail", "outlook", "icloud", "aol", "mail"];
      const domainParts = domain.split(".");
      const mainDomain = domainParts[0];
      
      if (!personalDomains.some(pd => mainDomain.includes(pd))) {
        // Look for matching company name in blocks
        for (const block of blocks) {
          if (block.toLowerCase().includes(mainDomain.toLowerCase()) || 
              mainDomain.toLowerCase().includes(block.toLowerCase().slice(0, 4))) {
            const cleaned = block.replace(EMAIL_REGEX, "").replace(URL_REGEX, "").trim();
            if (cleaned.length > 2) {
              return cleaned;
            }
          }
        }
        // Fallback: capitalize domain name
        return mainDomain.charAt(0).toUpperCase() + mainDomain.slice(1);
      }
    }
  }
  
  // Look for company suffix patterns
  for (const block of blocks) {
    const cleaned = block.replace(EMAIL_REGEX, "").replace(URL_REGEX, "").trim();
    if (COMPANY_SUFFIXES.test(cleaned)) {
      return cleaned;
    }
  }
  
  // Look for ALL CAPS lines (often company names on business cards)
  for (const block of blocks) {
    const cleaned = block.replace(EMAIL_REGEX, "").replace(URL_REGEX, "").trim();
    if (cleaned === cleaned.toUpperCase() && 
        cleaned.length > 3 && 
        cleaned.length < 50 &&
        !/^\d+$/.test(cleaned) &&
        !PHONE_PATTERNS.some(p => p.test(cleaned))) {
      return cleaned.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
    }
  }
  
  return null;
}

/**
 * Extract role/title from text blocks
 */
function extractRole(blocks: string[]): string | null {
  const textLower = blocks.join(" ").toLowerCase();
  
  // Look for exact role matches
  for (const title of ROLE_TITLES) {
    const pattern = new RegExp(`\\b${title.replace(/\s+/g, "\\s+")}\\b`, "i");
    for (const block of blocks) {
      const match = block.match(pattern);
      if (match) {
        // Get surrounding context for the full title
        const idx = block.toLowerCase().indexOf(match[0].toLowerCase());
        const start = idx;
        const end = idx + match[0].length;
        
        // Expand to capture prefixes like "Senior" or suffixes
        const words = block.split(/\s+/);
        let result = "";
        let capturing = false;
        
        for (const word of words) {
          const wordLower = word.toLowerCase();
          if (match[0].toLowerCase().includes(wordLower)) {
            capturing = true;
            result += (result ? " " : "") + word;
          } else if (capturing) {
            // Check if this is a continuation
            if (["of", "and", "-", "|"].includes(wordLower) || 
                ROLE_TITLES.some(rt => wordLower.includes(rt.split(" ")[0]))) {
              result += " " + word;
            } else {
              break;
            }
          } else if (["senior", "junior", "lead", "chief", "head", "executive", "principal", "staff", "associate"].includes(wordLower)) {
            result += (result ? " " : "") + word;
          }
        }
        
        if (result.length > 0) {
          return result.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
        }
      }
    }
  }
  
  return null;
}

/**
 * Extract name from text blocks
 * Business cards typically have name as one of the first/largest items
 */
function extractName(blocks: string[], email: string | null, company: string | null, role: string | null): string {
  // Filter out blocks that are clearly not names
  const candidates: string[] = [];
  
  for (const block of blocks) {
    const cleaned = block.replace(EMAIL_REGEX, "").replace(URL_REGEX, "").trim();
    
    // Skip if empty or too short
    if (cleaned.length < 2) continue;
    
    // Skip if it's clearly not a name
    if (PHONE_PATTERNS.some(p => p.test(cleaned))) continue;
    if (email && cleaned.toLowerCase() === email.toLowerCase()) continue;
    if (company && cleaned.toLowerCase() === company.toLowerCase()) continue;
    if (role && cleaned.toLowerCase() === role.toLowerCase()) continue;
    if (COMPANY_SUFFIXES.test(cleaned)) continue;
    if (/^[0-9\s,.-]+$/.test(cleaned)) continue; // Just numbers
    if (/^\d{3,}/.test(cleaned)) continue; // Starts with long number (address/phone)
    
    // Check if it looks like a name (2-4 capitalized words, not too long)
    const words = cleaned.split(/\s+/);
    if (words.length >= 1 && words.length <= 5) {
      const looksLikeName = words.every(w => 
        /^[A-Z]/.test(w) || 
        /^(van|von|de|del|della|der|di|du|la|le|lo|mc|mac|o')/i.test(w)
      );
      
      if (looksLikeName && cleaned.length < 40) {
        candidates.push(cleaned);
      }
    }
  }
  
  // Prefer first candidate (usually at top of card)
  if (candidates.length > 0) {
    return candidates[0];
  }
  
  // Fallback: extract from email
  if (email) {
    const localPart = email.split("@")[0];
    const nameParts = localPart
      .replace(/[._-]/g, " ")
      .split(/\s+/)
      .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
    return nameParts.join(" ");
  }
  
  return "";
}

/**
 * Parse business card OCR text into structured contact
 */
export function parseBusinessCard(ocrText: string): BusinessCardContact {
  const cleanedText = cleanOCRText(ocrText);
  const blocks = splitIntoBlocks(cleanedText);
  
  // Extract structured fields
  const email = extractEmail(cleanedText);
  const phone = extractPhone(cleanedText);
  const company = extractCompany(blocks, email);
  const role = extractRole(blocks);
  const name = extractName(blocks, email, company, role);
  
  return {
    name: formatName(name),
    email: email || "",
    phone: phone ? formatPhoneNumber(phone) : "",
    company: company || "",
    role: role || "",
  };
}
