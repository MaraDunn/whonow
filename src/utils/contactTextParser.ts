/**
 * Deterministic Contact Text Parser
 * Rule-based extraction from freeform text - NO AI/LLM
 * Enhanced with context-aware multi-pass parsing
 */

import { formatName, formatPhoneNumber } from "./formatContact";
import {
  detectPhraseBoundaries,
  tagWords,
  analyzeWorksContext,
  scoreMatch,
  type TaggedWord,
  type TextSpan
} from "./contextAnalysis";

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
const COMPANY_SUFFIXES = /\b(inc\.?|llc\.?|ltd\.?|corp\.?|corporation|company|co\.?|group|holdings|partners|solutions|technologies|tech|systems|enterprises|industries|international|services|consulting|agency)\b/gi;

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
 * Only matches explicit company patterns, not descriptions or random capitalized words
 */
function extractCompany(text: string): string | null {
  // First, try "works for [Company]" pattern - case-insensitive and flexible
  // Step 1: Find "works for" in the text (case-insensitive)
  const worksForRegex = /\bworks?\s+for\s+/i;
  const worksForMatch = text.match(worksForRegex);
  
  if (worksForMatch && worksForMatch.index !== undefined) {
    // Step 2: Extract everything after "works for"
    const afterWorksFor = text.substring(worksForMatch.index + worksForMatch[0].length);
    
    // Step 3: Find where description keywords start (handles, manages, leads, etc.)
    const descKeywordRegex = /\b(handles?|manages?|leads?|responsible\s+for|does|and|or|but)\b/i;
    const descKeywordMatch = afterWorksFor.match(descKeywordRegex);
    const descKeywordIndex = descKeywordMatch && descKeywordMatch.index !== undefined ? descKeywordMatch.index : afterWorksFor.length;
    
    // Step 4: Extract the company text (everything before description keyword)
    let companyText = afterWorksFor.substring(0, descKeywordIndex).trim();
    
    // Step 5: Clean up - remove trailing punctuation
    companyText = companyText.replace(/[.,;:!?]+$/, "").trim();
    
    if (companyText) {
      // Step 6: Extract company name using intelligent word detection (case-insensitive)
      // Split into words and analyze each word
      const words = companyText.split(/\s+/).filter(w => w.length > 0);
      const companyWords: string[] = [];
      
      // Company suffix words (case-insensitive) - these are strong indicators
      const companySuffixes = new Set([
        "inc", "llc", "ltd", "corp", "co", "international", "industries", 
        "enterprises", "holdings", "partners", "technologies", "tech", 
        "solutions", "systems", "group", "corporation", "company"
      ]);
      
      for (let i = 0; i < words.length; i++) {
        const word = words[i].replace(/[.,;:!?]+$/, ""); // Remove trailing punctuation
        const wordLower = word.toLowerCase();
        
        // Check if this word is a company suffix
        const isCompanySuffix = companySuffixes.has(wordLower);
        
        // Check if word looks like part of a company name:
        // 1. Starts with capital letter (common but not required)
        // 2. Is a company suffix
        // 3. Is a capitalized word (even if user typed lowercase, we'll capitalize it)
        // 4. Is a multi-letter word (not single letter or number)
        const isCapitalized = /^[A-Z]/.test(word);
        const isMultiLetterWord = /^[A-Za-z]{2,}$/.test(word);
        const isNumber = /^\d+$/.test(word);
        
        // If it's a company suffix, always include it
        if (isCompanySuffix) {
          // Capitalize properly: "international" -> "International"
          companyWords.push(word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
          // If we hit a suffix, this is likely the end of the company name
          break;
        }
        
        // If it's a capitalized word or looks like a company name word, include it
        if (isMultiLetterWord && !isNumber) {
          // Capitalize the word properly for consistency
          const capitalizedWord = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
          companyWords.push(capitalizedWord);
        } else if (isNumber) {
          // Numbers can be part of company names (e.g., "Company 123")
          companyWords.push(word);
        } else {
          // Stop at words that don't look like company name parts
          // But allow a few lowercase words if they're common company words
          const commonCompanyWords = ["and", "of", "the"];
          if (commonCompanyWords.includes(wordLower) && companyWords.length > 0) {
            companyWords.push(wordLower);
          } else {
            break;
          }
        }
      }
      
      // If we found company words, return them (capitalize first letter of each word)
      if (companyWords.length > 0) {
        return companyWords
          .map((w, idx) => {
            // Capitalize first letter, lowercase rest (except for common words like "and", "of", "the")
            const lower = w.toLowerCase();
            if (idx > 0 && ["and", "of", "the"].includes(lower)) {
              return lower;
            }
            return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
          })
          .join(" ");
      }
    }
  }
  
  // Description keywords that indicate we're past company info (but exclude "works for" since we handle it above)
  const descriptionKeywords = /\b(handles?|manages?|leads?|responsible\s+for|does|handling|managing|leading)\b/i;
  
  // Find where description starts (if any)
  const descMatch = text.match(descriptionKeywords);
  const stopIndex = descMatch && descMatch.index !== undefined ? descMatch.index : text.length;
  const companyText = text.substring(0, stopIndex).trim();
  
  if (!companyText) return null;
  
  // Try to find pattern: "at Company" or "from Company" or "@Company"
  // This is the most reliable indicator
  const prepMatch = companyText.match(/(?:at|from|@)\s+([A-Z][A-Za-z0-9\s&]+(?:Inc\.?|LLC\.?|Ltd\.?|Corp\.?|Corporation|Company|Co\.?|Group|Technologies|Tech|Solutions|Systems|International|Industries|Enterprises|Holdings|Partners)?)/i);
  if (prepMatch) {
    const company = prepMatch[1].trim();
    // Ensure it's not a description word
    if (!descriptionKeywords.test(company)) {
      return company;
    }
  }
  
  // Try to find company with suffix (but only if it's clearly a company)
  // This should only match if there's a company suffix, not just any capitalized words
  const suffixMatch = companyText.match(/([A-Z][A-Za-z0-9\s&]+(?:Inc\.?|LLC\.?|Ltd\.?|Corp\.?|Corporation|Company|Co\.?|Group|Technologies|Tech|Solutions|Systems|International|Industries|Enterprises|Holdings|Partners))\b/i);
  if (suffixMatch) {
    const company = suffixMatch[1].trim();
    // Only return if it has a company suffix or common company word (not just any capitalized words)
    if ((COMPANY_SUFFIXES.test(company) || /\b(International|Industries|Enterprises|Holdings|Partners|Technologies|Tech|Solutions|Systems|Group)\b/i.test(company)) && !descriptionKeywords.test(company)) {
      return company;
    }
  }
  
  // Try domain extraction from email (most reliable)
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
 * Stops at description keywords and connecting words to avoid capturing descriptions in the role field
 */
function extractRole(text: string): string | null {
  // Description keywords and connecting words that should stop role extraction
  const stopKeywords = /\b(handles?|works?\s+(?:on|with|for)|manages?|leads?|responsible\s+for|does|handling|working|managing|leading|and|or|but)\b/i;
  
  // Find where description/connecting words start (if any)
  const stopMatch = text.match(stopKeywords);
  const stopIndex = stopMatch && stopMatch.index !== undefined ? stopMatch.index : text.length;
  const roleText = text.substring(0, stopIndex).trim();
  
  if (!roleText) return null;
  
  // Look for VP patterns first (e.g., "VP", "VP Of Sales", "vp of sales")
  // Be case-insensitive to handle lowercase input
  const vpPattern = /\b(vp|v\.?p\.?)(?:\s+of\s+([a-z]+(?:\s+[a-z]+)*))?/i;
  const vpMatch = roleText.match(vpPattern);
  
  if (vpMatch && vpMatch.index !== undefined) {
    let role: string;
    
    if (vpMatch[2]) {
      // We have "VP of [Department]"
      const department = vpMatch[2].trim();
      role = `VP Of ${department}`;
    } else {
      // Check if "of [Department]" comes after (might be separated by space)
      const afterVp = roleText.substring(vpMatch.index + vpMatch[0].length).trim();
      const deptMatch = afterVp.match(/^of\s+([a-z]+(?:\s+[a-z]+)*)/i);
      
      if (deptMatch && deptMatch[1]) {
        role = `VP Of ${deptMatch[1]}`;
      } else {
        // Just standalone VP
        role = "VP";
      }
    }
    
    // Ensure we didn't capture stop keywords (but "of" is okay)
    const hasStopKeywords = stopKeywords.test(role.replace(/\bof\b/gi, ""));
    if (!hasStopKeywords) {
      return formatRoleTitle(role);
    }
  }
  
  // Look for patterns with role titles in the role text (before description)
  for (const title of ROLE_TITLES) {
    // Match role title, optionally with prefixes and "of X" suffix, but stop before stop keywords
    const pattern = new RegExp(`((?:senior|junior|chief|principal|staff|lead)?\\s*${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s+of\\s+[\\w\\s]+)?)`, "i");
    const match = roleText.match(pattern);
    if (match && match.index !== undefined) {
      let role = match[1].trim();
      // Stop at connecting words if they appear
      const stopInMatch = role.match(/\b(and|or|but)\b/i);
      if (stopInMatch && stopInMatch.index !== undefined) {
        role = role.substring(0, stopInMatch.index).trim();
      }
      // Ensure we didn't capture stop keywords
      if (role && !stopKeywords.test(role)) {
        return formatRoleTitle(role);
      }
    }
  }
  
  // Look for "Role at Company" or "Role - Company" patterns (but stop before description)
  // Be case-insensitive to handle lowercase input
  const roleCompanyPattern = /([a-z]+(?:\s+[a-z]+)*\s+(?:manager|director|lead|engineer|designer|developer|analyst|coordinator|specialist|consultant|advisor))\s*(?:at|@|-|,)/i;
  const roleMatch = roleText.match(roleCompanyPattern);
  if (roleMatch && roleMatch.index !== undefined) {
    let role = roleMatch[1].trim();
    // Stop at connecting words if they appear
    const stopInMatch = role.match(/\b(and|or|but)\b/i);
    if (stopInMatch && stopInMatch.index !== undefined) {
      role = role.substring(0, stopInMatch.index).trim();
    }
    // Ensure we didn't capture stop keywords
    if (role && !stopKeywords.test(role)) {
      return formatRoleTitle(role);
    }
  }
  
  // Try matching role keywords with domain prefixes (e.g., "Marketing Manager", "Sales Director")
  // Be case-insensitive to handle lowercase input
  const roleWithDomainPattern = /([a-z]+(?:\s+[a-z]+)*\s+(?:manager|director|lead|engineer|designer|developer|analyst|coordinator|specialist|consultant|advisor|executive|officer))\b/i;
  const domainRoleMatch = roleText.match(roleWithDomainPattern);
  if (domainRoleMatch && domainRoleMatch.index !== undefined) {
    let role = domainRoleMatch[1].trim();
    // Stop at connecting words or description keywords if they appear
    const stopInMatch = role.match(/\b(and|or|but|handles?|works?|manages?|leads?)\b/i);
    if (stopInMatch && stopInMatch.index !== undefined) {
      role = role.substring(0, stopInMatch.index).trim();
    }
    if (role && !stopKeywords.test(role)) {
      return formatRoleTitle(role);
    }
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
 * Excludes role titles and company information
 */
function extractName(text: string, email: string | null, role: string | null = null): string {
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
  
  // Remove extracted role first if we have it (most accurate)
  if (role) {
    // Escape special regex characters in the role
    const escapedRole = role.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    cleanText = cleanText.replace(new RegExp(escapedRole, "gi"), "");
  }
  
  // Remove role titles and patterns before extracting name (fallback if role wasn't extracted)
  // Check for VP patterns
  cleanText = cleanText.replace(/\b(VP|V\.?P\.?)(?:\s+of\s+[A-Z][A-Za-z\s]+)?\b/gi, "");
  
  // Remove role titles from ROLE_TITLES set
  for (const title of ROLE_TITLES) {
    const rolePattern = new RegExp(`(?:senior|junior|chief|principal|staff|lead)?\\s*${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s+of\s+[\\w\\s]+)?`, "gi");
    cleanText = cleanText.replace(rolePattern, "");
  }
  
  // Remove role patterns with domain prefixes
  cleanText = cleanText.replace(/[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*\s+(?:Manager|Director|Lead|Engineer|Designer|Developer|Analyst|Coordinator|Specialist|Consultant|Advisor|Executive|Officer)\b/gi, "");
  
  // Clean up separators
  cleanText = cleanText.replace(/[-–—|•,;]/g, " ").trim();
  
  // Try to find name at start - be flexible with capitalization for first 2-3 words
  const words = cleanText.split(/\s+/).filter(Boolean);
  const nameWords: string[] = [];
  
  // Role/company/description keywords to stop at
  const stopKeywords = new Set([
    "at", "from", "works", "handles", "manages", "leads", 
    "senior", "junior", "marketing", "sales", "ceo", "cto", "cfo",
    "and", "or", "but", "for", "with", "on"
  ]);
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const wordLower = word.toLowerCase();
    
    // Stop at common role/company/description indicators
    if (stopKeywords.has(wordLower)) {
      break;
    }
    
    // Skip if it's a role keyword
    if (ROLE_TITLES.has(wordLower) || /^(vp|v\.?p\.?)$/i.test(word)) {
      break;
    }
    
    // For the first 2 words, be lenient with capitalization
    // Names can be lowercase if they're at the beginning
    if (i < 2) {
      // Allow lowercase words as name parts if they're at the start
      // and look like name words (not action verbs or prepositions)
      const looksLikeName = /^[a-z]{2,}$/i.test(word) && 
                           !stopKeywords.has(wordLower) &&
                           word.length >= 2 &&
                           word.length <= 20;
      
      if (looksLikeName) {
        // Capitalize the word properly for the name
        nameWords.push(word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
        continue;
      }
    }
    
    // After 2 words, require capitalization or be a known name particle
    if (/^[A-Z]/.test(word) || /^(van|von|de|del|della|der|di|du|la|le|lo|mc|mac|o')/i.test(word)) {
      nameWords.push(word);
      if (nameWords.length >= 4) break; // Max 4 name parts
    } else if (nameWords.length === 0 && i === 0) {
      // First word might be lowercase in informal input
      nameWords.push(word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
    } else if (nameWords.length > 0 && /^[a-z]/.test(word) && !word.match(/^(van|von|de|del|della|der|di|du|la|le|lo|mc|mac|o')$/i)) {
      // Stop at lowercase words after we have some name parts (likely description)
      break;
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
  
  // Remove leading/trailing punctuation
  remaining = remaining.replace(/^[.,;:!?\s]+|[.,;:!?\s]+$/g, '').trim();
  
  if (!remaining || remaining.length < 5) {
    return null;
  }
  
  // Remove "works for [Company]" patterns from remaining text (company info, not description)
  // Remove "works for" followed by company name (if extracted) - case-insensitive
  if (extracted.company) {
    // Remove "works for [Company]" pattern using the extracted company name (case-insensitive)
    const escapedCompany = extracted.company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const worksForCompanyPattern = new RegExp(`\\bworks?\\s+for\\s+${escapedCompany}\\b`, "gi");
    remaining = remaining.replace(worksForCompanyPattern, "");
  }
  
  // Always remove "works for" phrase followed by any words until description keywords
  // This handles cases where company wasn't extracted or doesn't match exactly
  // Match "works for" followed by words until we hit description keywords or end
  const worksForPattern = /\bworks?\s+for\s+[A-Za-z0-9&]+(?:\s+[A-Za-z0-9&]+)*(?:\s+(?:handles?|manages?|leads?|responsible\s+for|does|and|or|but))?/gi;
  remaining = remaining.replace(worksForPattern, "");
  
  // Also remove standalone "works for" if it's left behind
  remaining = remaining.replace(/\bworks?\s+for\b/gi, "");
  
  // Look for description patterns in the REMAINING text (not original text)
  // This ensures we capture descriptions that come after extracted fields
  // Exclude "works for" since that's company information, not description
  const descPatterns = [
    /handles?\s+(.+)/i,
    /works?\s+(?:on|with)\s*(.+)/i,  // Only "works on" or "works with", not "works for"
    /manages?\s+(.+)/i,
    /leads?\s+(.+)/i,
    /responsible\s+for\s+(.+)/i,
    /-\s*(.+)/,  // After a dash
  ];
  
  // Find all matches and pick the longest one (most complete description)
  let bestMatch: { text: string; length: number } | null = null;
  
  for (const pattern of descPatterns) {
    const match = remaining.match(pattern);
    if (match && match[1]) {
      const descText = match[1].trim();
      // Exclude company names from description
      const hasCompanyPattern = /\b(Inc\.?|LLC\.?|Ltd\.?|Corp\.?|Corporation|Company|Co\.?|Group|Technologies|Tech|Solutions|Systems|International|Industries|Enterprises|Holdings|Partners)\b/i.test(descText);
      if (descText.length > 5 && !hasCompanyPattern) {
        // Prefer longer descriptions
        if (!bestMatch || descText.length > bestMatch.length) {
          bestMatch = { text: descText, length: descText.length };
        }
      }
    }
  }
  
  if (bestMatch) {
    let description = bestMatch.text;
    // Clean up leading/trailing punctuation
    description = description.replace(/^[.,;:!?\s]+|[.,;:!?\s]+$/g, '').trim();
    return description;
  }
  
  // If no pattern match but remaining text is substantial, use it as description
  // But filter out common connecting words at the start
  const filteredRemaining = remaining.replace(/^(and|or|but|for|at|from|with)\s+/i, "").trim();
  if (filteredRemaining.length > 10 && filteredRemaining.split(/\s+/).length >= 3) {
    // Clean up leading/trailing punctuation
    const cleaned = filteredRemaining.replace(/^[.,;:!?\s]+|[.,;:!?\s]+$/g, '').trim();
    return cleaned;
  }
  
  // If remaining text is substantial even with connecting words, use it
  if (remaining.length > 10 && remaining.split(/\s+/).length >= 2) {
    // Clean up leading/trailing punctuation
    const cleaned = remaining.replace(/^[.,;:!?\s]+|[.,;:!?\s]+$/g, '').trim();
    return cleaned;
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
    // Filter out common words, prepositions, and very short words
    const commonWords = new Set([
      "the", "and", "for", "our", "all", "with", "has", "are", "was", "been", "have", 
      "handles", "works", "manages", "leads", "does", "from", "at", "to", "in", "on", 
      "of", "a", "an", "as", "is", "it", "this", "that", "these", "those", "be", "been",
      "can", "could", "should", "would", "may", "might", "must", "will", "shall"
    ]);
    
    if (lower.length >= 3 && !seen.has(lower) && !commonWords.has(lower) && !/^\d+$/.test(lower)) {
      seen.add(lower);
      keywords.push(lower);
    }
  };
  
  // Extract from role (exclude "VP", "Of" as standalone)
  if (data.role) {
    data.role.split(/\s+/)
      .filter(w => w.length > 0 && w.toLowerCase() !== "of")
      .forEach(w => addKeyword(w));
  }
  
  // Extract from company (exclude common suffixes)
  if (data.company) {
    const cleanCompany = data.company.replace(COMPANY_SUFFIXES, "").trim();
    cleanCompany.split(/\s+/)
      .filter(w => w.length > 0)
      .forEach(w => addKeyword(w));
  }
  
  // Extract from description - focus on meaningful words
  if (data.description) {
    const stopWords = new Set([
      "the", "and", "for", "our", "all", "with", "has", "are", "was", "been", "have", 
      "handles", "works", "manages", "leads", "does", "from", "at", "to", "in", "on", 
      "of", "a", "an", "as", "is", "it", "this", "that", "these", "those", "be", "been",
      "can", "could", "should", "would", "may", "might", "must", "will", "shall",
      "acme", "international" // Common company words that shouldn't be keywords if company is already extracted
    ]);
    
    // Don't add company name as keyword if company is already extracted
    const companyWords = data.company ? new Set(data.company.toLowerCase().split(/\s+/)) : new Set();
    
    data.description.split(/\s+/)
      .map(w => w.replace(/[.,;:!?()\[\]{}'"]/g, "")) // Remove punctuation
      .filter(w => {
        const lower = w.toLowerCase();
        return w.length >= 4 && 
               !stopWords.has(lower) && 
               !companyWords.has(lower) &&
               !/^\d+$/.test(w); // Exclude pure numbers
      })
      .slice(0, 6) // Get more words from description
      .forEach(w => addKeyword(w));
  }
  
  return keywords.slice(0, 8);
}

/**
 * Entity Detection Context - stores potential entities found in text
 */
interface EntityContext {
  emails: string[];
  phones: string[];
  potentialRoles: Array<{ text: string; position: number; confidence: number }>;
  potentialCompanies: Array<{ text: string; position: number; confidence: number }>;
  potentialNames: Array<{ text: string; position: number; confidence: number }>;
  potentialDescriptions: Array<{ text: string; position: number; confidence: number }>;
  phrases: TextSpan[];
  taggedWords: TaggedWord[];
}

/**
 * PASS 1: Entity Detection
 * Identify all potential entities in the text with confidence scores
 */
function detectEntities(text: string): EntityContext {
  const context: EntityContext = {
    emails: extractEmails(text),
    phones: extractPhones(text),
    potentialRoles: [],
    potentialCompanies: [],
    potentialNames: [],
    potentialDescriptions: [],
    phrases: detectPhraseBoundaries(text),
    taggedWords: tagWords(text)
  };
  
  // Detect potential roles using existing logic
  const roleMatch = extractRoleWithPosition(text);
  if (roleMatch) {
    context.potentialRoles.push(roleMatch);
  }
  
  // Detect potential companies
  const companyMatch = extractCompanyWithPosition(text);
  if (companyMatch) {
    context.potentialCompanies.push(companyMatch);
  }
  
  // Detect potential names (first capitalized words before role/company)
  const nameMatch = extractNameWithPosition(text, context.emails[0] || null);
  if (nameMatch) {
    context.potentialNames.push(nameMatch);
  }
  
  // Detect potential descriptions (text after action verbs)
  const descMatches = extractDescriptionCandidates(text);
  context.potentialDescriptions.push(...descMatches);
  
  // Fallback: If no descriptions found via patterns, try extractDescription function
  if (context.potentialDescriptions.length === 0) {
    // Create a temporary extracted object for fallback
    const tempExtracted = {
      name: nameMatch?.text || "",
      email: context.emails[0] || null,
      phone: context.phones[0] || null,
      company: companyMatch?.text || null,
      role: roleMatch?.text || null
    };
    
    const fallbackDesc = extractDescription(text, tempExtracted);
    if (fallbackDesc) {
      context.potentialDescriptions.push({
        text: fallbackDesc,
        position: text.indexOf(fallbackDesc),
        confidence: 0.7
      });
    }
  }
  
  return context;
}

/**
 * PASS 2: Context Resolution  
 * Use surrounding context to resolve ambiguities and select best matches
 * Extraction order: email/phone → role → company → name → description
 * Each extraction uses previous results as context
 */
function resolveEntities(context: EntityContext, text: string): {
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  description: string | null;
} {
  // Step 1: Email and phone are most reliable (no ambiguity)
  const email = context.emails[0] || null;
  const phone = context.phones[0] || null;
  
  // Step 2: Extract role (has clear patterns like VP, Manager, CEO)
  // Select highest confidence role
  const role = context.potentialRoles.length > 0
    ? context.potentialRoles.sort((a, b) => b.confidence - a.confidence)[0].text
    : null;
  
  // Step 3: Extract company (use role position as context)
  // Prefer companies that appear after role or have strong indicators ("works for", "at")
  const company = context.potentialCompanies.length > 0
    ? context.potentialCompanies.sort((a, b) => {
        // Boost confidence if company appears after role
        let scoreA = a.confidence;
        let scoreB = b.confidence;
        
        if (role) {
          const rolePos = text.toLowerCase().indexOf(role.toLowerCase());
          if (rolePos !== -1) {
            if (a.position > rolePos) scoreA += 0.1;
            if (b.position > rolePos) scoreB += 0.1;
          }
        }
        
        return scoreB - scoreA;
      })[0].text
    : null;
  
  // Step 4: Extract name (use role + company positions to avoid confusion)
  // Name should appear before role/company in most cases
  const name = context.potentialNames.length > 0
    ? context.potentialNames.sort((a, b) => {
        let scoreA = a.confidence;
        let scoreB = b.confidence;
        
        // Boost confidence if name appears before role and company
        const rolePos = role ? text.toLowerCase().indexOf(role.toLowerCase()) : text.length;
        const companyPos = company ? text.toLowerCase().indexOf(company.toLowerCase()) : text.length;
        const earliestFieldPos = Math.min(rolePos, companyPos);
        
        if (a.position < earliestFieldPos) scoreA += 0.2;
        if (b.position < earliestFieldPos) scoreB += 0.2;
        
        // Prefer earlier positions if confidence is similar
        if (Math.abs(scoreA - scoreB) < 0.15) {
          return a.position - b.position;
        }
        
        return scoreB - scoreA;
      })[0].text
    : "";
  
  // Step 5: Extract description (everything remaining after action verbs)
  // Use all previously extracted fields as context
  let description: string | null = null;
  
  if (context.potentialDescriptions.length > 0) {
    // Filter out descriptions that overlap with already extracted fields
    // BUT be lenient - only filter if the overlap is substantial
    const filtered = context.potentialDescriptions.filter(desc => {
      const descLower = desc.text.toLowerCase();
      
      // Only exclude if description is ONLY the company name (allow mentions of company in description)
      if (company && descLower.trim() === company.toLowerCase().trim()) {
        return false;
      }
      
      // Only exclude if description is ONLY the role (allow role mentions)
      if (role && descLower.trim() === role.toLowerCase().trim()) {
        return false;
      }
      
      return true;
    });
    
    // Select longest, most complete description
    // If filtering removed all candidates, use unfiltered list
    const candidates = filtered.length > 0 ? filtered : context.potentialDescriptions;
    
    description = candidates.sort((a, b) => {
      // Prefer longer descriptions with higher confidence
      const scoreA = a.confidence + (a.text.length / 100);
      const scoreB = b.confidence + (b.text.length / 100);
      return scoreB - scoreA;
    })[0].text;
    
    // Clean up leading/trailing punctuation from description
    if (description) {
      description = description.replace(/^[.,;:!?\s]+|[.,;:!?\s]+$/g, '').trim();
    }
  }
  
  return { name, email, phone, company, role, description };
}

/**
 * Helper function to extract role with position info
 * Enhanced to directly detect roles without depending on extractRole
 */
function extractRoleWithPosition(text: string): { text: string; position: number; confidence: number } | null {
  // Try direct pattern matching first (more reliable)
  
  // 1. VP pattern (case-insensitive)
  const vpPattern = /\b(vp|v\.?p\.?)(?:\s+of\s+([a-z]+(?:\s+[a-z]+)*))?/i;
  const vpMatch = text.match(vpPattern);
  if (vpMatch && vpMatch.index !== undefined) {
    let roleText: string;
    if (vpMatch[2]) {
      roleText = `VP Of ${vpMatch[2]}`;
    } else {
      // Check if "of [Department]" comes after
      const afterVp = text.substring(vpMatch.index + vpMatch[0].length).trim();
      const deptMatch = afterVp.match(/^of\s+([a-z]+(?:\s+[a-z]+)*)/i);
      roleText = deptMatch && deptMatch[1] ? `VP Of ${deptMatch[1]}` : "VP";
    }
    
    return {
      text: formatRoleTitle(roleText),
      position: vpMatch.index,
      confidence: 0.95
    };
  }
  
  // 2. Common role titles (case-insensitive)
  const roleTitlePattern = /\b(ceo|cto|cfo|coo|president|director|manager|engineer|designer|developer|analyst|coordinator|specialist|consultant|advisor|lead|officer|executive)\b/i;
  const titleMatch = text.match(roleTitlePattern);
  if (titleMatch && titleMatch.index !== undefined) {
    // Try to capture domain prefix if present (e.g., "Marketing Manager")
    const beforeTitle = text.substring(Math.max(0, titleMatch.index - 50), titleMatch.index);
    const domainMatch = beforeTitle.match(/([a-z]+)\s*$/i);
    
    let roleText = titleMatch[1];
    if (domainMatch && domainMatch[1] && 
        !/\b(at|from|works|handles|manages|leads|and|or|but)\b/i.test(domainMatch[1])) {
      roleText = `${domainMatch[1]} ${roleText}`;
    }
    
    return {
      text: formatRoleTitle(roleText),
      position: domainMatch ? titleMatch.index - domainMatch[1].length - 1 : titleMatch.index,
      confidence: 0.85
    };
  }
  
  // 3. Fallback to original extractRole function
  const role = extractRole(text);
  if (!role) return null;
  
  const position = text.toLowerCase().indexOf(role.toLowerCase());
  return {
    text: role,
    position: position !== -1 ? position : 0,
    confidence: 0.8
  };
}

/**
 * Helper function to extract company with position info
 */
function extractCompanyWithPosition(text: string): { text: string; position: number; confidence: number } | null {
  const company = extractCompany(text);
  if (!company) return null;
  
  const position = text.toLowerCase().indexOf(company.toLowerCase());
  
  // Higher confidence if "works for" or "at" precedes it
  const hasIndicator = /\b(works?\s+for|at|from)\s+/i.test(text.substring(Math.max(0, position - 20), position + company.length));
  
  return {
    text: company,
    position: position !== -1 ? position : 0,
    confidence: hasIndicator ? 0.95 : 0.8
  };
}

/**
 * Helper function to extract name with position info
 */
function extractNameWithPosition(text: string, email: string | null): { text: string; position: number; confidence: number } | null {
  const role = extractRole(text);
  const name = extractName(text, email, role);
  if (!name || name === "Unknown") return null;
  
  const position = text.indexOf(name);
  
  // Higher confidence if at the start
  const isAtStart = position < 10;
  
  return {
    text: name,
    position: position !== -1 ? position : 0,
    confidence: isAtStart ? 0.9 : 0.7
  };
}

/**
 * Helper function to extract description candidates
 */
function extractDescriptionCandidates(text: string): Array<{ text: string; position: number; confidence: number }> {
  const candidates: Array<{ text: string; position: number; confidence: number }> = [];
  
  // Look for description patterns - be more flexible with matching
  const descPatterns = [
    { pattern: /\bhandles?\s+(.+)/i, confidence: 0.9 },
    { pattern: /\bmanages?\s+(.+)/i, confidence: 0.9 },
    { pattern: /\bleads?\s+(.+)/i, confidence: 0.9 },
    { pattern: /\bworks?\s+(?:on|with)\s+(.+)/i, confidence: 0.85 },
    { pattern: /\bresponsible\s+for\s+(.+)/i, confidence: 0.9 },
    { pattern: /\bcoordinates?\s+(.+)/i, confidence: 0.85 },
    { pattern: /\boversees?\s+(.+)/i, confidence: 0.85 },
    { pattern: /\bdevelops?\s+(.+)/i, confidence: 0.8 },
  ];
  
  for (const { pattern, confidence } of descPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      let descText = match[1].trim();
      const position = match.index !== undefined ? match.index : 0;
      
      // Clean up - remove trailing conjunctions and prepositions
      descText = descText.replace(/\s+(and|or|but|at|for|from)$/i, "").trim();
      
      // Remove leading/trailing punctuation
      descText = descText.replace(/^[.,;:!?\s]+|[.,;:!?\s]+$/g, '').trim();
      
      if (descText.length > 3) {
        candidates.push({
          text: descText,
          position,
          confidence
        });
      }
    }
  }
  
  return candidates;
}

/**
 * Parse freeform text into structured contact data
 * Uses multi-pass context-aware parsing
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
  
  // PASS 1: Entity Detection - identify all potential entities
  const entityContext = detectEntities(text);
  
  // PASS 2: Context Resolution - select best matches using context
  const resolved = resolveEntities(entityContext, text);
  
  // PASS 3: Validation and Formatting
  const data: ParsedContactData = {
    name: resolved.name ? formatName(resolved.name) : "",
    email: resolved.email,
    phone: resolved.phone ? formatPhoneNumber(resolved.phone) : null,
    company: resolved.company,
    role: resolved.role,
    description: resolved.description,
    suggestedKeywords: [],
  };
  
  data.suggestedKeywords = generateKeywords(data);
  
  return data;
}
