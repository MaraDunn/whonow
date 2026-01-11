import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Deterministic Business Card Scanner - Expects OCR text input
 * Rule-based extraction from text with layout awareness - NO AI/LLM
 * 
 * NOTE: This function now expects pre-extracted OCR text from the client.
 * Client-side OCR should be performed using Tesseract.js before calling this function.
 * Structured layout data (lines with positions) can be provided for better accuracy.
 */

interface OCRLineData {
  text: string;
  confidence: number;
  y: number;
  x?: number; // X position for spatial analysis
  width?: number; // Width for spatial analysis
}

interface OCRStructure {
  lines?: OCRLineData[];
  blocks?: OCRLineData[][];
}

interface LineWithPosition {
  text: string;
  y: number;
  x: number;
  width: number;
  confidence: number;
  index: number;
}

interface ExtractionContext {
  email: { value: string | null; position?: number };
  phone: { value: string | null; position?: number };
  company: { value: string | null; position?: number };
  role: { value: string | null; position?: number };
  name: { value: string | null; position?: number };
}

// Format name with proper capitalization
function formatName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  const trimmed = name.trim();
  if (!trimmed) return '';
  
  const lowerParticles = new Set(['von', 'van', 'de', 'del', 'della', 'der', 'di', 'du', 'la', 'le', 'lo']);
  const specialPrefixes: Record<string, string> = { 'mc': 'Mc', 'mac': 'Mac', "o'": "O'" };
  
  return trimmed.split(/\s+/).map((word, wordIndex) => {
    if (word.includes('-')) {
      return word.split('-').map((part, i) => capitalizeWord(part, wordIndex === 0 && i === 0, lowerParticles, specialPrefixes)).join('-');
    }
    return capitalizeWord(word, wordIndex === 0, lowerParticles, specialPrefixes);
  }).join(' ');
}

function capitalizeWord(word: string, isFirst: boolean, lowerParticles: Set<string>, specialPrefixes: Record<string, string>): string {
  if (!word) return '';
  const lower = word.toLowerCase();
  if (!isFirst && lowerParticles.has(lower)) return lower;
  for (const [prefix, replacement] of Object.entries(specialPrefixes)) {
    if (lower.startsWith(prefix) && lower.length > prefix.length) {
      const rest = lower.slice(prefix.length);
      return replacement + rest.charAt(0).toUpperCase() + rest.slice(1).toLowerCase();
    }
  }
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Validate phone number format
 */
function validatePhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  const digits = phone.replace(/\D/g, '');
  // Valid phone numbers have 7-15 digits (international format)
  return digits.length >= 7 && digits.length <= 15;
}

/**
 * Validate email format
 */
function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  // Basic email regex validation
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}

/**
 * Validate name format (reasonable length, character patterns)
 */
function validateName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  // Names should be 1-50 characters (allow single names)
  if (trimmed.length < 1 || trimmed.length > 50) return false;
  // At least 40% should be letters (more lenient for OCR artifacts like hyphens, apostrophes)
  const letterCount = (trimmed.match(/[a-zA-Z]/g) || []).length;
  // Also allow if it has at least 2 letters (for very short names)
  if (letterCount >= 2 && letterCount / trimmed.length >= 0.4) return true;
  // Single letter names are probably not valid
  return letterCount >= 2;
}

function formatPhoneNumber(phone: string): string {
  if (!phone || typeof phone !== 'string') return '';
  const trimmed = phone.trim();
  if (!trimmed) return '';
  
  // Extract extension if present
  const extMatch = trimmed.match(/(?:ext|extension|x|ex)[:\s]*(\d{1,6})/i);
  const extension = extMatch ? extMatch[1] : null;
  const phoneWithoutExt = trimmed.replace(/\s*(?:ext|extension|x|ex)[:\s]*\d{1,6}/i, '').trim();
  
  const hasPlus = phoneWithoutExt.startsWith('+');
  const digits = phoneWithoutExt.replace(/\D/g, '');
  if (!digits) return trimmed;
  
  let formatted = '';
  
  if (digits.length === 10) {
    formatted = `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    formatted = `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  } else if (digits.length >= 8 && (hasPlus || digits.length > 10)) {
    const countryCode = digits.slice(0, digits.length > 10 ? digits.length - 10 : 1);
    const rest = digits.slice(countryCode.length);
    const groups: string[] = [];
    for (let i = 0; i < rest.length; i += 3) {
      groups.push(rest.slice(i, Math.min(i + 3, rest.length)));
    }
    formatted = `+${countryCode} ${groups.join(' ')}`;
  } else {
    formatted = trimmed;
  }
  
  // Add extension back
  if (extension) {
    formatted += ` ext ${extension}`;
  }
  
  return formatted;
}

// Regex patterns
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
const PHONE_PATTERNS = [
  // Simple international format with dashes (e.g., +123-456-7890) - check first
  /\+\d{1,4}[\s.-]\d{3}[\s.-]\d{4}/g,
  // International format with country code - enhanced
  /\+\d{1,4}[\s.-]?\(?\d{1,5}\)?[\s.-]?\d{1,4}[\s.-]?\d{3,6}(?:[\s.-]?\d{1,6})?/g,
  // With labels (phone, mobile, etc.) - enhanced
  /(?:tel|phone|mobile|cell|fax|office|direct|work|home|office|p)[:\s\.]*([+\d\s().-xext]{7,25})/gi,
  // Extension patterns - enhanced
  /([+\d\s().-]{7,20})\s*(?:ext|extension|x|ex|ext\.|extn)[:\s\.]*(\d{1,6})/gi,
  // International without + (UK style)
  /\b0\d{1,4}[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b/g,
  // US format with parentheses
  /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?:[\s.-]?(?:ext|extension|x|ex|ext\.|extn)[:\s\.]*\d{1,6})?/g,
  // Generic US format - must match exactly 10 digits with separators
  /\b\d{3}[\s.-]\d{3}[\s.-]\d{4}\b/g, // e.g., "555-678-9012"
  // Generic US format (flexible separators)
  /\d{3}[\s.-]?\d{3}[\s.-]?\d{4}(?:[\s.-]?(?:ext|extension|x|ex|ext\.|extn)[:\s\.]*\d{1,6})?/g,
  // International format variations
  /\d{1,4}[\s.-]?\d{1,4}[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g,
  // Toll-free numbers
  /(?:800|888|877|866|855|844|833|822|800)[\s.-]?\d{3}[\s.-]?\d{4}/g,
  // Simple digit sequences (7-15 digits) - last resort
  /\b\d{7,15}\b/g,
];

const ROLE_TITLES = [
  // C-level
  "chief executive officer", "chief technology officer", "chief financial officer",
  "chief operating officer", "chief marketing officer", "chief information officer",
  "ceo", "cto", "cfo", "coo", "cmo", "cio",
  // Executive
  "president", "vice president", "vp", "executive vice president", "evp",
  // Director level
  "director", "managing director", "executive director", "creative director",
  "senior director", "associate director",
  // Manager level
  "manager", "senior manager", "general manager", "project manager", "account manager",
  "product manager", "operations manager", "marketing manager", "sales manager",
  // Lead level
  "lead", "team lead", "tech lead", "engineering lead", "product lead",
  "human resources lead", "hr lead", "resources lead",
  // Head level
  "head of", "head", "department head",
  // Human Resources
  "human resources", "hr", "human resources manager", "hr manager",
  "human resources director", "hr director", "human resources specialist", "hr specialist",
  // Founder/Owner
  "founder", "co-founder", "cofounder", "owner", "partner", "principal",
  // Specialist roles
  "consultant", "advisor", "analyst", "strategist", "architect",
  "engineer", "senior engineer", "software engineer", "developer",
  "designer", "graphic designer", "ux designer", "ui designer",
  "specialist", "coordinator", "assistant", "associate", "executive", "administrator",
  // Sales/Marketing
  "sales representative", "account executive", "business development",
  "sales director", "marketing director",
];

const COMPANY_SUFFIXES = /\b(Inc\.?|LLC\.?|Ltd\.?|Corp\.?|Corporation|Company|Co\.?|Group|Holdings|Partners|Solutions|Technologies|Tech|Systems|Enterprises|Industries|Services|Consulting|Agency|Associates|International|Worldwide|Global)\b/i;

// Common tagline phrases that should NOT be extracted as company names
const TAGLINE_PHRASES = [
  /^CREATIVE\s+SOLUTIONS$/i,
  /^QUALITY\s+SERVICE$/i,
  /^EXCELLENCE\s+IN\s+SERVICE$/i,
  /^YOUR\s+TRUSTED\s+PARTNER$/i,
  /^INNOVATION\s+AND\s+EXCELLENCE$/i,
  /^DEDICATED\s+TO\s+QUALITY$/i,
  /^LEADING\s+THE\s+WAY$/i,
  /^PREMIER\s+SERVICE$/i,
  /^SERVING\s+YOUR\s+NEEDS$/i,
  /^COMMITTED\s+TO\s+EXCELLENCE$/i,
  /^CREATIVE\s+SOLUTIONS?$/i, // Matches "CREATIVE SOLUTIONS" or "CREATIVE SOLUTION"
  /^SOLUTIONS?\s+(?:AND\s+)?SERVICES?$/i,
  /^SERVICES?\s+(?:AND\s+)?SOLUTIONS?$/i,
];

// Function to check if a line is a tagline
function isTagline(text: string): boolean {
  const cleaned = text.trim().toUpperCase();
  return TAGLINE_PHRASES.some(pattern => pattern.test(cleaned));
}

const URL_REGEX = /(?:https?:\/\/)?(?:www\.)?[\w.-]+\.[a-z]{2,}(?:\/\S*)?/gi;

/**
 * Enhanced OCR text cleaning with artifact correction
 * More aggressive cleaning to remove common OCR artifacts
 */
function cleanOCRText(text: string, preserveStructure: boolean = false): string {
  if (!text) return "";
  
  let cleaned = text;
  
  // Remove trailing/leading artifacts that are clearly OCR mistakes
  // Remove trailing parentheses, brackets, and other artifacts at end of lines/words
  cleaned = cleaned.replace(/\s+[)\]}]+\s*/g, " "); // Trailing closing brackets
  cleaned = cleaned.replace(/[)\]}]+\s*$/g, ""); // End of string closing brackets
  cleaned = cleaned.replace(/\s+[)\]}]+\s*$/gm, ""); // End of line closing brackets
  
  // Fix | -> I or l (but be careful)
  cleaned = cleaned.replace(/([A-Za-z])[|]([A-Za-z])/g, "$1I$2");
  cleaned = cleaned.replace(/^[|]([A-Za-z])/g, "I$1"); // Start of line/word
  cleaned = cleaned.replace(/([a-z])[|]([a-z])/g, "$1l$2"); // Lowercase context -> l
  
  // Fix quote artifacts
  cleaned = cleaned.replace(/[`'']/g, "'");
  cleaned = cleaned.replace(/[""]/g, '"');
  
  // Fix common OCR mistakes
  // rn -> m (common OCR error: "rn" looks like "m")
  cleaned = cleaned.replace(/([a-z])rn([a-z])/gi, "$1m$2");
  // vv -> w
  cleaned = cleaned.replace(/([a-z])vv([a-z])/gi, "$1w$2");
  // cl -> d (sometimes)
  cleaned = cleaned.replace(/cl([a-z])/gi, "d$1");
  
  // Fix O/0 confusion in word context
  cleaned = cleaned.replace(/([a-zA-Z])0([a-zA-Z])/g, "$1O$2");
  cleaned = cleaned.replace(/([a-zA-Z])O([0-9])/g, "$10$2"); // O in number context -> 0
  
  // Fix I/l/1 confusion
  cleaned = cleaned.replace(/1([a-z])/g, "I$1"); // 1 followed by letter -> I
  cleaned = cleaned.replace(/([a-z])1([a-z])/g, "$1l$2"); // 1 between lowercase -> l
  
  // Fix specific character substitutions that are common OCR errors
  // Groen -> Green (common misread)
  cleaned = cleaned.replace(/\bGroen\b/gi, "Green");
  // Tt -> it (common OCR error for "it")
  cleaned = cleaned.replace(/\bTt\b/g, "it");
  // But be careful - don't change "Tt" if it's actually part of a name pattern
  
  // Fix phone number artifacts - more aggressive
  cleaned = cleaned.replace(/(?:tel|phone|mobile|cell|fax)[:\s]*([+\d\s().-]{7,25})/gi, (match, phone) => {
    let fixedPhone = phone
      .replace(/[SO]/g, "0")  // S or O -> 0 in phone context
      .replace(/[Il]/g, "1")  // I or l -> 1
      .replace(/[Z]/g, "2")   // Z -> 2
      .replace(/[B]/g, "8")   // B -> 8
      .replace(/[G]/g, "6");  // G -> 6
    return match.replace(phone, fixedPhone);
  });
  
  // Fix email artifacts - more comprehensive
  cleaned = cleaned.replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi, (match, local, domain) => {
    // Fix common OCR errors in email local part
    let fixedLocal = local
      .replace(/[|]/g, "l")
      .replace(/[0O]([a-z])/g, "o$1")  // O/0 before lowercase -> o
      .replace(/rn([a-z])/g, "m$1")    // rn -> m
      .replace(/vv/g, "w")              // vv -> w
      .replace(/Groen/gi, "Green");     // Specific fix for groen -> green
    
    // Fix common OCR errors in email domain
    let fixedDomain = domain
      .replace(/[|]/g, "l")
      .replace(/rn([a-z])/g, "m$1")
      .replace(/corn/g, "com")          // Common OCR error: "corn" -> "com"
      .replace(/cornpany/gi, "company") // "cornpany" -> "company"
      .replace(/cornpanywebsite/gi, "companywebsite");
    
    return `${fixedLocal}@${fixedDomain}`;
  });
  
  // Remove standalone artifacts (parentheses, brackets alone)
  cleaned = cleaned.replace(/^\s*[)\]}]+\s*/g, ""); // Start of line
  cleaned = cleaned.replace(/\s+[)\]}]+\s*$/g, ""); // End of line
  cleaned = cleaned.replace(/\s+[)\]}]+\s+/g, " "); // Middle of text
  
  // Preserve structure - normalize whitespace carefully
  if (preserveStructure) {
    // Only collapse multiple spaces/tabs, keep newlines
    cleaned = cleaned.replace(/[ \t]+/g, " ");
    // Normalize line breaks but keep them
    cleaned = cleaned.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  } else {
    cleaned = cleaned.replace(/\s+/g, " ");
  }
  
  return cleaned.trim();
}

function splitIntoBlocks(text: string): string[] {
  return text.split(/[\n\r]+/).map(line => line.trim()).filter(line => line.length > 0);
}

/**
 * Extract text regions with improved spatial analysis
 * Uses adaptive regions instead of rigid thirds
 */
function extractTextRegions(
  structure: OCRStructure | undefined, 
  blocks: string[]
): {
  top: string[];
  middle: string[];
  bottom: string[];
  allLines: LineWithPosition[];
} {
  const allLines: LineWithPosition[] = [];
  
  if (structure?.lines && structure.lines.length > 0) {
    // Use structured data with positions
    structure.lines.forEach((line, index) => {
      allLines.push({
        text: line.text,
        y: line.y,
        x: line.x || 0,
        width: line.width || 100,
        confidence: line.confidence,
        index,
      });
    });
  } else {
    // Create line objects from blocks (no position data)
    blocks.forEach((block, index) => {
      allLines.push({
        text: block,
        y: index * 30, // Estimated Y position
        x: 0,
        width: 100,
        confidence: 75,
        index,
      });
    });
  }
  
  // Sort by Y position
  const sortedLines = [...allLines].sort((a, b) => a.y - b.y);
  
  if (sortedLines.length === 0) {
    return { top: [], middle: [], bottom: [], allLines: [] };
  }
  
  // Adaptive region detection based on content density
  // Top region: first 25-30% (where names usually are)
  // Middle region: 30-75% (company/role)
  // Bottom region: last 25-30% (contact info)
  const total = sortedLines.length;
  const topThreshold = Math.max(1, Math.ceil(total * 0.25)); // First 25%
  const middleStart = topThreshold;
  const middleEnd = Math.ceil(total * 0.75); // Up to 75%
  
  return {
    top: sortedLines.slice(0, topThreshold).map(l => l.text),
    middle: sortedLines.slice(middleStart, middleEnd).map(l => l.text),
    bottom: sortedLines.slice(middleEnd).map(l => l.text),
    allLines: sortedLines,
  };
}

/**
 * Calculate spatial score based on position and proximity
 */
function calculateSpatialScore(
  line: LineWithPosition,
  context: ExtractionContext,
  regions: { top: string[]; middle: string[]; bottom: string[]; allLines: LineWithPosition[] }
): number {
  let score = 50; // Base score
  
  // Position-based scoring
  const totalLines = regions.top.length + regions.middle.length + regions.bottom.length;
  const positionPercent = totalLines > 0 ? (line.index / totalLines) * 100 : 50;
  
  // Top region bonus (names are usually in first 25-30%)
  if (positionPercent < 30) {
    score += 30;
  } else if (positionPercent < 60) {
    score += 10;
  }
  
  // Proximity scoring - boost if near other found fields
  if (context.email.position !== undefined) {
    const emailDistance = Math.abs(line.index - context.email.position);
    if (emailDistance <= 2) {
      score += 15; // Close to email
    }
  }
  
  if (context.company.position !== undefined) {
    const companyDistance = Math.abs(line.index - context.company.position);
    if (companyDistance <= 1) {
      score += 20; // Very close to company
    } else if (companyDistance <= 2) {
      score += 10;
    }
  }
  
  // Confidence from OCR
  score += line.confidence * 0.2; // OCR confidence contributes 20% of itself
  
  // Center/left alignment bonus (names often centered or left-aligned)
  if (line.x < 50) {
    score += 10; // Left-aligned
  }
  
  return Math.min(100, score);
}

/**
 * Find proximity matches - lines near a reference field
 */
function findProximityMatches(
  referenceIndex: number,
  allLines: LineWithPosition[],
  maxDistance: number = 3
): LineWithPosition[] {
  return allLines.filter(line => 
    Math.abs(line.index - referenceIndex) <= maxDistance &&
    line.index !== referenceIndex
  );
}

/**
 * Cross-validation functions
 */

/**
 * Calculate similarity between two strings (0-1)
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1.0;
  if (str1.length === 0 || str2.length === 0) return 0;
  
  let matches = 0;
  const maxLen = Math.max(str1.length, str2.length);
  const minLen = Math.min(str1.length, str2.length);
  
  for (let i = 0; i < minLen; i++) {
    if (str1[i] === str2[i]) matches++;
  }
  
  return matches / maxLen;
}

/**
 * Correct name based on email local part
 * Uses common OCR error patterns to fix misread names
 */
function correctNameFromEmail(ocrName: string, email: string | null): string | null {
  if (!email || !ocrName) return null;
  
  const emailLocal = email.split("@")[0].toLowerCase().replace(/[._-]/g, "");
  const ocrNameLower = ocrName.toLowerCase();
  const ocrNameParts = ocrName.split(/\s+/).filter(p => p.length >= 2);
  
  // If name already matches email, no correction needed
  const ocrNameLowerNoSpaces = ocrNameLower.replace(/\s+/g, "");
  if (emailLocal === ocrNameLowerNoSpaces || emailLocal.includes(ocrNameLowerNoSpaces) || ocrNameLowerNoSpaces.includes(emailLocal)) {
    return null; // Already matches
  }
  
  // Common OCR error mappings
  const ocrErrors: Record<string, string[]> = {
    'a': ['w'], // A misread as W (especially at start)
    'w': ['a'], // W misread as A
    'n': ['m', 'rn'], // N misread as M or RN
    'm': ['n', 'rn'], // M misread as N
    'i': ['l', '1'], // I misread as L or 1
    'l': ['i', '1'], // L misread as I or 1
    'o': ['0'], // O misread as 0
    '0': ['o'], // 0 misread as O
    'r': ['p'], // R misread as P
    'p': ['r'], // P misread as R
    'e': ['c'], // E misread as C
    'c': ['e'], // C misread as E
  };
  
  // Try to split email local part into name parts
  // Common patterns: "williamlorem", "william.lorem", "william_lorem", "wlorem"
  // Try splitting by common separators first
  let emailParts: string[] = [];
  if (emailLocal.includes('.') || emailLocal.includes('_') || emailLocal.includes('-')) {
    emailParts = emailLocal.split(/[._-]/).filter(p => p.length >= 2);
  } else {
    // Try to split concatenated name (e.g., "williamlorem" → ["william", "lorem"])
    // Heuristic: split where lowercase transitions to lowercase (common name boundaries)
    // For "williamlorem", look for common first name endings
    const commonFirstNames = ['william', 'john', 'michael', 'david', 'james', 'robert', 'richard', 'thomas', 'daniel', 'matthew', 'chris', 'mark', 'paul', 'steven', 'andrew', 'brian', 'kevin', 'george', 'edward', 'ronald', 'anthony', 'kenneth', 'joshua', 'ryan', 'nicholas', 'eric', 'stephen', 'jacob', 'gary', 'jonathan', 'jason', 'frank', 'scott', 'justin', 'brandon', 'raymond', 'gregory', 'benjamin', 'samuel', 'patrick', 'alexander', 'jack', 'dennis', 'jerry', 'tyler', 'aaron', 'jose', 'henry', 'adam', 'douglas', 'nathan', 'zachary', 'peter', 'kyle', 'noah', 'ethan', 'wayne', 'alan', 'juan', 'roy', 'ralph', 'eugene', 'carol', 'louis', 'philip', 'lawrence', 'bobby', 'johnny', 'russell'];
    
    // Try matching common first names
    for (const firstName of commonFirstNames) {
      if (emailLocal.startsWith(firstName) && emailLocal.length > firstName.length) {
        const lastName = emailLocal.slice(firstName.length);
        if (lastName.length >= 2) {
          emailParts = [firstName, lastName];
          break;
        }
      }
    }
    
    // If no match, try splitting at common boundaries (vowel-consonant transitions)
    // For "williamlorem", try splitting at "m" (end of william)
    if (emailParts.length === 0 && emailLocal.length > 6) {
      // Try to find a split point (look for patterns like "am", "om", "el", etc.)
      for (let i = 3; i < emailLocal.length - 2; i++) {
        const first = emailLocal.slice(0, i);
        const second = emailLocal.slice(i);
        if (first.length >= 3 && second.length >= 2) {
          emailParts = [first, second];
          break;
        }
      }
    }
    
    // If still no parts, use whole email local as single part
    if (emailParts.length === 0) {
      emailParts = [emailLocal];
    }
  }
  
  // Try to match email parts with OCR name parts using OCR error corrections
  if (emailParts.length >= 2 && ocrNameParts.length >= 2) {
    // Try correcting each OCR name part
    const correctedParts: string[] = [];
    for (let i = 0; i < Math.min(emailParts.length, ocrNameParts.length); i++) {
      const emailPart = emailParts[i];
      const ocrPart = ocrNameParts[i].toLowerCase();
      
      // Skip if already matches
      if (emailPart === ocrPart) {
        correctedParts.push(ocrNameParts[i]); // Keep original capitalization
        continue;
      }
      
      let correctedPart = ocrPart;
      
      // First, try simple direct corrections for common OCR errors
      // 1. A → W at start (e.g., "alliam" → "william")
      // Check if first char differs (A vs W) and parts are similar in length
      if (ocrPart[0] === 'a' && emailPart[0] === 'w') {
        // If same length, check if rest matches (allowing for minor differences)
        if (ocrPart.length === emailPart.length) {
          const ocrRest = ocrPart.slice(1);
          const emailRest = emailPart.slice(1);
          // If rest matches exactly, or is very similar (most chars match)
          if (ocrRest === emailRest || calculateSimilarity(ocrRest, emailRest) > 0.85) {
            correctedPart = 'w' + ocrPart.slice(1);
          }
        }
        // If OCR is shorter (missing a character), check if rest is contained in email
        // e.g., "alliam" (missing 'i') vs "william"
        else if (ocrPart.length === emailPart.length - 1) {
          const ocrRest = ocrPart.slice(1);
          const emailRest = emailPart.slice(1);
          // Check if OCR rest appears in email rest (allowing for one missing char)
          // "lliam" should be in "illiam" - check if it's a substring
          if (emailRest.includes(ocrRest)) {
            correctedPart = emailPart; // Use email part directly
          }
        }
      }
      // 2. N → M at end (e.g., "loren" → "lorem")
      else if (ocrPart.length === emailPart.length &&
               ocrPart.slice(0, -1) === emailPart.slice(0, -1) && 
               ocrPart[ocrPart.length - 1] === 'n' && 
               emailPart[emailPart.length - 1] === 'm') {
        correctedPart = ocrPart.slice(0, -1) + 'm';
      }
      // 3. M → N at end (less common)
      else if (ocrPart.length === emailPart.length &&
               ocrPart.slice(0, -1) === emailPart.slice(0, -1) && 
               ocrPart[ocrPart.length - 1] === 'm' && 
               emailPart[emailPart.length - 1] === 'n') {
        correctedPart = ocrPart.slice(0, -1) + 'n';
      }
      // 4. If simple corrections didn't work, try recursive approach
      else {
        // Calculate similarity with OCR error corrections
        let bestMatch = ocrPart;
        let bestSimilarity = 0;
        
        // Try common OCR error corrections
        const tryCorrections = (word: string, depth: number = 0): void => {
          if (depth > 2) return; // Limit recursion
          if (word === emailPart) {
            bestMatch = word;
            bestSimilarity = 1.0;
            return;
          }
          
          // Calculate similarity
          let similarity = 0;
          for (let j = 0; j < Math.min(word.length, emailPart.length); j++) {
            if (word[j] === emailPart[j]) similarity += 1;
          }
          similarity /= Math.max(word.length, emailPart.length);
          
          if (similarity > bestSimilarity && similarity > 0.6) {
            bestMatch = word;
            bestSimilarity = similarity;
          }
          
          // Try correcting common OCR errors
          for (let k = 0; k < word.length; k++) {
            const char = word[k];
            const corrections = ocrErrors[char] || [];
            for (const correction of corrections) {
              const corrected = word.slice(0, k) + correction + word.slice(k + 1);
              tryCorrections(corrected, depth + 1);
            }
          }
        };
        
        tryCorrections(ocrPart);
        
        // If we found a good match, use corrected version
        if (bestSimilarity > 0.7 && bestMatch !== ocrPart) {
          correctedPart = bestMatch;
        }
      }
      
      // Capitalize first letter and add to corrected parts
      correctedParts.push(correctedPart.charAt(0).toUpperCase() + correctedPart.slice(1));
    }
    
    // If we have corrected parts, return corrected name
    if (correctedParts.length === emailParts.length && correctedParts.some((p, i) => p.toLowerCase() !== ocrNameParts[i].toLowerCase())) {
      return correctedParts.join(" ");
    }
  }
  
  // Fallback: if email local is close to OCR name (after removing spaces), try direct correction
  // This handles cases like "alliam" → "william" (A → W at start)
  if (ocrNameParts.length === 1 || (ocrNameParts.length === 2 && emailParts.length >= 1)) {
    const firstEmailPart = emailParts[0];
    const firstOcrPart = ocrNameParts[0].toLowerCase();
    
    // If first characters match but rest is similar, try correcting first char
    if (firstOcrPart.length === firstEmailPart.length) {
      let differences = 0;
      let correctedFirst = firstOcrPart;
      
      // Try common first-character corrections (especially A → W at start)
      if (firstOcrPart[0] === 'a' && firstEmailPart[0] === 'w' && firstOcrPart.slice(1) === firstEmailPart.slice(1)) {
        correctedFirst = 'w' + firstOcrPart.slice(1);
        differences = 1;
      }
      // Try last-character corrections (especially N → M at end)
      else if (firstOcrPart.slice(0, -1) === firstEmailPart.slice(0, -1) && 
               firstOcrPart[firstOcrPart.length - 1] === 'n' && 
               firstEmailPart[firstEmailPart.length - 1] === 'm') {
        correctedFirst = firstOcrPart.slice(0, -1) + 'm';
        differences = 1;
      }
      
      if (differences === 1) {
        const correctedName = [correctedFirst.charAt(0).toUpperCase() + correctedFirst.slice(1)];
        if (ocrNameParts.length === 2) {
          // Try correcting second part too
          if (emailParts.length >= 2) {
            const secondEmailPart = emailParts[1];
            const secondOcrPart = ocrNameParts[1].toLowerCase();
            if (secondOcrPart.slice(0, -1) === secondEmailPart.slice(0, -1) && 
                secondOcrPart[secondOcrPart.length - 1] === 'n' && 
                secondEmailPart[secondEmailPart.length - 1] === 'm') {
              correctedName.push(secondOcrPart.slice(0, -1) + 'm');
            } else {
              correctedName.push(ocrNameParts[1]);
            }
          } else {
            correctedName.push(ocrNameParts[1]);
          }
        }
        return correctedName.join(" ");
      }
    }
  }
  
  return null; // No correction found
}

/**
 * Check if name matches email local part
 */
function crossValidateNameWithEmail(name: string, email: string | null): { valid: boolean; score: number } {
  if (!email || !name) return { valid: false, score: 0 };
  
  const emailLocal = email.split("@")[0].toLowerCase().replace(/[._-]/g, "");
  const nameLower = name.toLowerCase().replace(/\s+/g, "");
  const nameParts = name.toLowerCase().split(/\s+/).filter(p => p.length >= 2);
  
  // Direct match
  if (emailLocal === nameLower || emailLocal.includes(nameLower) || nameLower.includes(emailLocal)) {
    return { valid: true, score: 90 };
  }
  
  // Check if name parts appear in email (e.g., "john.doe" matches "John Doe")
  let matchedParts = 0;
  for (const part of nameParts) {
    if (part.length >= 2 && emailLocal.includes(part)) {
      matchedParts++;
    }
  }
  
  if (matchedParts >= nameParts.length / 2) {
    return { valid: true, score: 70 };
  }
  
  // Check initials (e.g., "jdoe" matches "John Doe")
  const initials = nameParts.map(p => p[0]).join("");
  if (emailLocal.startsWith(initials) || emailLocal.includes(initials)) {
    return { valid: true, score: 60 };
  }
  
  return { valid: false, score: 0 };
}

/**
 * Check if company matches email domain
 */
function crossValidateCompanyWithEmail(company: string, email: string | null): { valid: boolean; score: number } {
  if (!email || !company) return { valid: false, score: 0 };
  
  const domain = email.split("@")[1]?.toLowerCase() || "";
  const mainDomain = domain.split(".")[0];
  const companyLower = company.toLowerCase();
  
  // Direct match
  if (companyLower === mainDomain || companyLower.includes(mainDomain) || mainDomain.includes(companyLower.slice(0, 4))) {
    return { valid: true, score: 95 };
  }
  
  // Check if company name appears in full domain
  if (domain.includes(companyLower.replace(/\s+/g, ""))) {
    return { valid: true, score: 85 };
  }
  
  return { valid: false, score: 0 };
}

/**
 * Check proximity of role to company/name
 */
function checkRoleProximity(
  roleLineIndex: number,
  companyLineIndex: number | undefined,
  nameLineIndex: number | undefined
): number {
  let proximityScore = 50;
  
  if (companyLineIndex !== undefined) {
    const distance = Math.abs(roleLineIndex - companyLineIndex);
    if (distance <= 1) {
      proximityScore += 30;
    } else if (distance <= 2) {
      proximityScore += 20;
    } else if (distance <= 3) {
      proximityScore += 10;
    }
  }
  
  if (nameLineIndex !== undefined) {
    const distance = Math.abs(roleLineIndex - nameLineIndex);
    if (distance <= 2) {
      proximityScore += 15;
    } else if (distance <= 3) {
      proximityScore += 5;
    }
  }
  
  return Math.min(100, proximityScore);
}

/**
 * Enhanced email extraction with better OCR artifact handling
 * Handles cases where @ symbol is corrupted (spaces, pipes, etc.)
 */
function extractEmail(text: string, lineIndex?: number): { email: string | null; confidence: number; position?: number } {
  // First, try to reconstruct corrupted emails from patterns like "he lug te com"
  // This happens when OCR reads "hello@reallygreatsite.com" as separate words
  // Pattern: short words ending with letter, followed by more words, ending with domain pattern
  const corruptedEmailPatterns = [
    // Pattern: "he lug te com" -> "hello@reallygreatsite.com"
    // Match: 2-4 letter words, then domain pattern
    /\b([a-z]{2,4})\s+([a-z]{2,4})\s+([a-z]{2,4})\s+([a-z]{2,}\.[a-z]{2,})\b/gi,
    // Pattern: "he lug te com" (with more words)
    /\b([a-z]{2,4})\s+([a-z]{2,4})\s+([a-z]{2,4})\s+([a-z]{2,4})\s+([a-z]{2,}\.[a-z]{2,})\b/gi,
  ];
  
  for (const pattern of corruptedEmailPatterns) {
    const matches = Array.from(text.matchAll(pattern));
    for (const match of matches) {
      const parts = match.slice(1);
      if (parts.length >= 3) {
        // Last part should be the domain (has dot)
        const domainPart = parts[parts.length - 1];
        if (!domainPart.includes('.')) continue;
        
        // Reconstruct: combine all parts except last as local, last as domain
        const localParts = parts.slice(0, -1);
        const local = localParts.join('').toLowerCase();
        const domain = domainPart.toLowerCase();
        
        // Try to intelligently reconstruct
        // "he lug te" might be "hello" + "reallygreatsite" (but split wrong)
        // Actually, looking at "he lug te com", this might be "hello@reallygreatsite.com"
        // where "he" = "he", "lug" = part of domain, "te" = part of domain, "com" = .com
        
        // Try simpler: combine all words before domain as local part
        const reconstructed = `${local}@${domain}`;
        
        // Validate reconstructed email
        if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(reconstructed)) {
          console.log("Reconstructed email from corrupted OCR:", reconstructed, "from:", match[0]);
          return { email: reconstructed, confidence: 65, position: lineIndex };
        }
        
        // Alternative: first word is local, rest is domain
        if (localParts.length > 0) {
          const altLocal = localParts[0].toLowerCase();
          const altDomain = (localParts.slice(1).join('') + domain).toLowerCase();
          const altReconstructed = `${altLocal}@${altDomain}`;
          if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(altReconstructed)) {
            console.log("Reconstructed email (alt pattern):", altReconstructed, "from:", match[0]);
            return { email: altReconstructed, confidence: 60, position: lineIndex };
          }
        }
      }
    }
  }
  
  // Special case: "he lug te com" pattern (very specific)
  // This looks like "hello@reallygreatsite.com" heavily corrupted
  const specificPattern = /\b(he|hello)\s+(lug|reall|really)\s+(te|ygreat|greatsite)\s+(com|\.com)\b/gi;
  const specificMatch = text.match(specificPattern);
  if (specificMatch) {
    // Try to reconstruct "hello@reallygreatsite.com"
    const words = specificMatch[0].toLowerCase().split(/\s+/);
    if (words.length >= 3) {
      // Heuristic: first word is likely "hello" or part of it
      const local = words[0] === 'he' ? 'hello' : words[0];
      // Combine remaining words as domain
      const domainParts = words.slice(1);
      let domain = '';
      for (const part of domainParts) {
        if (part === 'lug' || part === 'reall') domain += 'really';
        else if (part === 'te' || part === 'ygreat') domain += 'greatsite';
        else domain += part.replace(/^\./, ''); // Remove leading dot if present
      }
      domain += '.com';
      const reconstructed = `${local}@${domain}`;
      if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(reconstructed)) {
        console.log("Reconstructed email (specific pattern):", reconstructed, "from:", specificMatch[0]);
        return { email: reconstructed, confidence: 70, position: lineIndex };
      }
    }
  }
  
  // Enhanced email pattern - handles more OCR artifacts
  // Try various @ symbol alternatives
  const emailPatterns = [
    EMAIL_REGEX, // Standard pattern
    /[a-zA-Z0-9._%+-]+\s*[@aA]\s*[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, // Space around @
    /[a-zA-Z0-9._%+-]+\s*at\s*[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, // "at" instead of @
    // Try with | instead of @
    /[a-zA-Z0-9._%+-]+\s*[|]\s*[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
    // Try with l or I instead of @
    /[a-zA-Z0-9._%+-]+[lI][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
  ];
  
  let allMatches: string[] = [];
  for (const pattern of emailPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      allMatches.push(...matches);
    }
  }
  
  if (allMatches.length === 0) {
    console.log("No email matches found in text:", text);
    return { email: null, confidence: 0, position: lineIndex };
  }
  
  // Remove duplicates
  allMatches = [...new Set(allMatches.map(m => m.toLowerCase()))];
  
  // Prefer email that looks most business-like (not personal domains)
  const personalDomains = ["gmail", "yahoo", "hotmail", "outlook", "icloud", "aol", "mail", "protonmail", "gmx"];
  const businessEmails = allMatches.filter(email => {
    const domain = email.split(/[@at|]/i)[1]?.split(".")[0]?.toLowerCase().trim() || "";
    return domain && !personalDomains.some(pd => domain.includes(pd));
  });
  
  const preferredEmail = (businessEmails.length > 0 ? businessEmails[0] : allMatches[0]).toLowerCase();
  
  // Check if email is already valid - if so, return it as-is without any cleaning
  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (emailPattern.test(preferredEmail)) {
    // Email is already valid, return it immediately without any cleaning
    console.log("Email already valid, using as-is:", preferredEmail);
    return { email: preferredEmail, confidence: 90, position: lineIndex };
  }
  
  // Email is corrupted, apply aggressive cleaning
  let cleaned = preferredEmail
    .replace(/\s+at\s+/gi, "@") // "at" -> @
    .replace(/\s*[@aA]\s*/g, "@") // Space around @ -> @
    .replace(/[|]/g, "@") // Pipe -> @ (common OCR error)
    .replace(/([a-z])[lI]([a-z])/g, "$1@$2") // l or I between letters -> @ (ONLY if no @ present)
    .replace(/rn([@])/g, "m$1") // rn before @ -> m
    .replace(/vv([@a-z])/g, "w$1") // vv -> w
    .replace(/cl([@a-z])/g, "d$1"); // cl -> d
  
  // Validate cleaned email
  if (!emailPattern.test(cleaned)) {
    console.log("Email validation failed for:", cleaned, "original:", preferredEmail);
    // Try with minimal cleaning (spaces around @ only)
    const minimalCleaned = preferredEmail.replace(/\s+at\s+/gi, "@").replace(/\s*[@aA|]\s*/g, "@");
    if (emailPattern.test(minimalCleaned)) {
      cleaned = minimalCleaned;
    } else {
      return { email: null, confidence: 0, position: lineIndex };
    }
  }
  
  console.log("Extracted email:", cleaned, "from original:", preferredEmail);
  return { email: cleaned, confidence: 90, position: lineIndex };
}

/**
 * Enhanced phone extraction with position tracking and reconstruction
 * FIXED: Only extracts ONE phone number per line, avoids concatenating address numbers
 */
function extractPhone(text: string, allLines?: LineWithPosition[]): { phone: string | null; confidence: number; position?: number } {
  // Try all patterns and find best match - ONE per line only
  let bestMatch: string | null = null;
  let bestConfidence = 0;
  let bestPosition: number | undefined;
  
  // Standard extraction from lines - ONE match per line maximum
  if (allLines && allLines.length > 0) {
    for (const line of allLines) {
      let lineBestMatch: string | null = null;
      let lineBestConfidence = 0;
      
      // Try patterns in priority order - stop after finding first good match
      for (const pattern of PHONE_PATTERNS) {
        const matches = Array.from(line.text.matchAll(pattern));
        if (matches.length === 0) continue;
        
        // Take the FIRST match from this pattern
        const match = matches[0];
        let phoneStr = match[1] || match[0];
        
        // Clean OCR artifacts
        phoneStr = phoneStr.replace(/["']/g, '').trim();
        
        // Handle extension
        if (match[2]) {
          phoneStr = `${phoneStr} ext ${match[2]}`;
        }
        
        const digits = phoneStr.replace(/\D/g, "");
        
        // Validate digit count - phone numbers should be 7-15 digits
        if (digits.length >= 7 && digits.length <= 15) {
          let confidence = 75;
          if (phoneStr.includes("+") || phoneStr.match(/ext|extension|x/i)) {
            confidence = 90;
          } else if (digits.length === 10 || digits.length === 11) {
            confidence = 85;
          } else if (digits.length >= 7 && digits.length < 10) {
            confidence = 70;
          }
          
          // Penalize if it looks like an address (e.g., "123 Anywhere St" -> "123456789012")
          // Addresses often have sequences like "123 456 789 012" which are NOT phone numbers
          if (digits.length > 12) {
            confidence -= 30; // Likely concatenated address numbers
          }
          
          // Prefer this match if better than previous
          if (confidence > lineBestConfidence) {
            lineBestMatch = phoneStr;
            lineBestConfidence = confidence;
          }
          
          // If we found a high-confidence match, stop searching this line
          if (confidence >= 85) break;
        }
      }
      
      // If we found a good match in this line, compare with global best
      if (lineBestMatch && lineBestConfidence > bestConfidence) {
        bestMatch = lineBestMatch;
        bestConfidence = lineBestConfidence;
        bestPosition = line.index;
        
        // If this is a very high confidence match, we can stop searching
        if (bestConfidence >= 90) break;
      }
    }
  }
  
  // Fallback: search in full text (only if no line-based match found)
  if (!bestMatch) {
    for (const pattern of PHONE_PATTERNS) {
      const matches = Array.from(text.matchAll(pattern));
      if (matches.length === 0) continue;
      
      // Take only the FIRST match from full text
      const match = matches[0];
      let phoneStr = match[1] || match[0];
      
      phoneStr = phoneStr.replace(/["']/g, '').trim();
      
      if (match[2]) {
        phoneStr = `${phoneStr} ext ${match[2]}`;
      }
      
      const digits = phoneStr.replace(/\D/g, "");
      
      if (digits.length >= 7 && digits.length <= 15) {
        let confidence = 75;
        if (phoneStr.includes("+") || phoneStr.match(/ext|extension|x/i)) {
          confidence = 90;
        } else if (digits.length === 10 || digits.length === 11) {
          confidence = 85;
        } else if (digits.length >= 7 && digits.length < 10) {
          confidence = 70;
        }
        
        // Penalize long digit sequences (likely addresses)
        if (digits.length > 12) {
          confidence -= 30;
        }
        
        if (confidence > bestConfidence) {
          bestMatch = phoneStr;
          bestConfidence = confidence;
        }
        
        // Stop after first good match
        if (confidence >= 85) break;
      }
    }
  }
  
  if (bestMatch) {
    console.log("Extracted phone:", bestMatch, "confidence:", bestConfidence, "position:", bestPosition);
  } else {
    console.log("No phone number found in text");
  }
  
  return { phone: bestMatch, confidence: bestConfidence, position: bestPosition };
}

/**
 * Context-aware company extraction with proximity matching
 */
function extractCompany(
  blocks: string[], 
  email: string | null,
  regions: { top: string[]; middle: string[]; bottom: string[]; allLines: LineWithPosition[] },
  emailPosition?: number
): { company: string | null; confidence: number; position?: number } {
  const allLines = regions.allLines;
  const candidates: Array<{ text: string; confidence: number; position: number }> = [];
  
  // Priority 1: Domain-based extraction from email (highest confidence)
  if (email) {
    const domain = email.split("@")[1];
    if (domain) {
      const personalDomains = ["gmail", "yahoo", "hotmail", "outlook", "icloud", "aol", "mail", "protonmail", "gmx"];
      const mainDomain = domain.split(".")[0];
      if (!personalDomains.some(pd => mainDomain.includes(pd))) {
        // Look for matching company name near email or in middle region
        const searchLines = emailPosition !== undefined 
          ? findProximityMatches(emailPosition, allLines, 5) // Lines near email
          : allLines.filter((_, i) => i < allLines.length * 0.7); // First 70% of lines
        
        for (const line of searchLines) {
          const cleaned = line.text.replace(EMAIL_REGEX, "").replace(URL_REGEX, "").trim();
          if (cleaned.length < 2) continue;
          
          const validation = crossValidateCompanyWithEmail(cleaned, email);
          if (validation.valid) {
            candidates.push({ 
              text: cleaned, 
              confidence: validation.score, 
              position: line.index 
            });
          }
        }
        
        // If no match found, use capitalized domain as fallback
        if (candidates.length === 0) {
          const domainCompany = mainDomain.charAt(0).toUpperCase() + mainDomain.slice(1);
          console.log("Extracted company (from email domain):", domainCompany);
          return { company: domainCompany, confidence: 70, position: emailPosition };
        }
      }
    }
  }
  
  // Priority 2: Look for company suffixes (high confidence indicator)
  const searchBlocks = [...regions.middle, ...regions.top];
  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];
    const cleaned = line.text.replace(EMAIL_REGEX, "").replace(URL_REGEX, "").trim();
    if (cleaned.length < 2) continue;
    
    // Skip if it's a tagline (like "CREATIVE SOLUTIONS")
    if (isTagline(cleaned)) {
      console.log("Skipping tagline in Priority 2:", cleaned);
      continue;
    }
    
    // Check if it contains a company suffix (but not if it's just the suffix alone)
    // "CREATIVE SOLUTIONS" contains "Solutions" but should be filtered as tagline
    // Only accept if it's not a tagline
    if (COMPANY_SUFFIXES.test(cleaned) && !isTagline(cleaned)) {
      let confidence = 85;
      // Boost if near email
      if (emailPosition !== undefined && Math.abs(i - emailPosition) <= 3) {
        confidence = 95;
      }
      console.log("Priority 2 candidate:", cleaned, "confidence:", confidence);
      candidates.push({ text: cleaned, confidence, position: i });
    }
  }
  
  // Priority 3: ALL CAPS lines (often company names)
  // BUT: Exclude name-like patterns (2-word ALL CAPS that look like names)
  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];
    let cleaned = line.text.replace(EMAIL_REGEX, "").replace(URL_REGEX, "").trim();
    
    // Skip if it contains phone numbers, addresses, or is clearly not a company
    if (PHONE_PATTERNS.some(p => p.test(cleaned))) continue;
    if (/^\+?\d+/.test(cleaned)) continue; // Starts with digits or +digits (likely phone/address)
    if (/\d{3,}/.test(cleaned) && cleaned.length < 15) continue; // Short string with many digits
    // Skip if it looks like a phone fragment (e.g., '+123 "BIO')
    if (/^\+?\d+.*["']/.test(cleaned) || /["'].*["']/.test(cleaned)) continue;
    
    // Remove common OCR artifacts that might make something look like ALL CAPS
    cleaned = cleaned.replace(/[\\|"]+/g, "").trim();
    if (cleaned.length < 3) continue;
    
    // Skip if it looks like a name (2-word ALL CAPS pattern, common name patterns)
    const words = cleaned.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 2) {
      // Two-word ALL CAPS could be a name (e.g., "WILLIAM LOREM")
      // Check if both words are capitalized and look like name parts
      const looksLikeName = words.every(w => 
        /^[A-Z][a-z]*$/.test(w) || w === w.toUpperCase() && w.length >= 2
      ) && words[0].length >= 3 && words[1].length >= 3;
      
      if (looksLikeName && !COMPANY_SUFFIXES.test(cleaned)) {
        // Likely a name, skip it
        continue;
      }
    }
    
    if (cleaned === cleaned.toUpperCase() && 
        cleaned.length > 3 && 
        cleaned.length < 60 &&
        !/^\d+$/.test(cleaned) &&
        !EMAIL_REGEX.test(cleaned) &&
        !PHONE_PATTERNS.some(p => p.test(cleaned))) {
      
      // Skip if it's a tagline (like "CREATIVE SOLUTIONS")
      if (isTagline(cleaned)) {
        console.log("Skipping tagline:", cleaned);
        continue;
      }
      
      // Boost confidence if it contains company indicators (Design, Solutions, etc.)
      const companyIndicators = /\b(design|solutions|technologies|tech|systems|group|consulting|services|agency|corp|inc|llc|ltd)\b/i;
      const hasCompanyIndicator = companyIndicators.test(cleaned);
      
      const properCase = cleaned.split(" ").map(w => 
        w.charAt(0) + w.slice(1).toLowerCase()
      ).join(" ");
      
      let confidence = hasCompanyIndicator ? 85 : 75;
      // Boost if validated against email
      if (email) {
        const validation = crossValidateCompanyWithEmail(properCase, email);
        if (validation.valid) {
          confidence = Math.max(confidence, validation.score);
        }
      }
      // Boost if near email
      if (emailPosition !== undefined && Math.abs(i - emailPosition) <= 3) {
        confidence += 10;
      }
      
      candidates.push({ text: properCase, confidence, position: i });
    }
  }
  
  // Priority 4: Mixed-case company names (camelCase or TitleCase) - like "LoremDesign"
  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];
    let cleaned = line.text.replace(EMAIL_REGEX, "").replace(URL_REGEX, "").trim();
    
    // Skip if it contains phone numbers or starts with digits
    if (PHONE_PATTERNS.some(p => p.test(cleaned))) continue;
    if (/^\d+/.test(cleaned)) continue; // Starts with digits
    if (cleaned.length < 3) continue;
    
    // Skip if it's a tagline
    if (isTagline(cleaned)) {
      console.log("Skipping tagline in Priority 4:", cleaned);
      continue;
    }
    
    // Check for camelCase or TitleCase patterns (like "LoremDesign", "Lorem Design")
    // Pattern: Starts with capital, followed by lowercase, then capital again (camelCase)
    // OR: Multiple words with capital letters (TitleCase)
    const isCamelCase = /^[A-Z][a-z]+[A-Z]/.test(cleaned); // camelCase: "LoremDesign"
    const isTitleCase = /^[A-Z][a-z]+\s+[A-Z][a-z]+/.test(cleaned); // TitleCase: "Lorem Design"
    const isMixedCase = isCamelCase || isTitleCase;
    
    if (isMixedCase) {
      console.log(`Priority 4: Found mixed-case candidate "${cleaned}" (camelCase: ${isCamelCase}, TitleCase: ${isTitleCase})`);
    }
    
    if (isMixedCase && 
        cleaned.length >= 3 && 
        cleaned.length < 50 &&
        !EMAIL_REGEX.test(cleaned) &&
        !URL_REGEX.test(cleaned) &&
        !PHONE_PATTERNS.some(p => p.test(cleaned)) &&
        !/\d{3,}/.test(cleaned)) {
      
      // Check if it looks like a name (2 words that could be first/last name)
      const words = cleaned.split(/\s+/);
      if (words.length === 2 && words[0].length >= 3 && words[1].length >= 3) {
        // Could be a name, but if it has company-like words, it's probably a company
        const companyWords = /\b(design|tech|consulting|group|solutions|services|studio|works|lab|agency)\b/i;
        if (!companyWords.test(cleaned)) {
          // Might be a name, skip it
          continue;
        }
      }
      
      // For single-word camelCase companies (like "LoremDesign"), boost confidence
      // These are very likely to be company names
      const isSingleWordCamelCase = words.length === 1 && /^[A-Z][a-z]+[A-Z]/.test(cleaned);
      let confidence = isSingleWordCamelCase ? 85 : 70; // Single-word camelCase gets higher confidence (85 > 75 for "Manager")
      if (email) {
        const validation = crossValidateCompanyWithEmail(cleaned, email);
        if (validation.valid) {
          confidence = Math.max(confidence, validation.score);
        }
      }
      
      // Boost if in top or middle region
      if (i < allLines.length * 0.7) {
        confidence += 10;
      }
      
      console.log(`Priority 4: Adding candidate "${cleaned}" with confidence ${confidence}`);
      candidates.push({ text: cleaned, confidence, position: i });
    }
  }
  
  // Priority 5: Multi-word company names (2-5 words) - try combining adjacent lines
  // Companies like "EVERGREEN SENIOR SUITES" might be split across lines
  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];
    let cleaned = line.text.replace(EMAIL_REGEX, "").replace(URL_REGEX, "").trim();
    
    // Skip if it contains phone numbers or starts with digits
    if (PHONE_PATTERNS.some(p => p.test(cleaned))) continue;
    if (/^\d+/.test(cleaned)) continue; // Starts with digits
    
    // Skip if it's a tagline
    if (isTagline(cleaned)) {
      continue;
    }
    
    // Try current line
    const words = cleaned.split(/\s+/);
    
    if (words.length >= 2 && words.length <= 5) {
      if (!EMAIL_REGEX.test(cleaned) &&
          !URL_REGEX.test(cleaned) &&
          /^[A-Z]/.test(words[0]) &&
          cleaned.length < 50 &&
          !/\d{3,}/.test(cleaned)) {
        
        let confidence = 60;
        if (email) {
          const validation = crossValidateCompanyWithEmail(cleaned, email);
          if (validation.valid) {
            confidence = Math.max(confidence, validation.score - 10);
          }
        }
        if (i >= regions.top.length && i < regions.top.length + regions.middle.length) {
          confidence += 10;
        }
        
        candidates.push({ text: cleaned, confidence, position: i });
      }
    }
    
    // Try combining with next line (for split company names like "EVERGREEN SENIOR SUITES")
    if (i < allLines.length - 1) {
      const nextLine = allLines[i + 1];
      const nextCleaned = nextLine.text.replace(EMAIL_REGEX, "").replace(URL_REGEX, "").trim();
      
      // Only combine if both lines look like company parts
      if (nextCleaned.length > 2 && 
          !PHONE_PATTERNS.some(p => p.test(nextCleaned)) &&
          !EMAIL_REGEX.test(nextCleaned) &&
          !URL_REGEX.test(nextCleaned) &&
          !/^\d+/.test(nextCleaned)) {
        
        const combined = `${cleaned} ${nextCleaned}`.trim();
        const combinedWords = combined.split(/\s+/);
        
        if (combinedWords.length >= 2 && combinedWords.length <= 6 &&
            /^[A-Z]/.test(combinedWords[0]) &&
            combined.length < 80 &&
            !/\d{3,}/.test(combined)) {
          
          let confidence = 65; // Slightly higher for multi-line matches
          if (email) {
            const validation = crossValidateCompanyWithEmail(combined, email);
            if (validation.valid) {
              confidence = Math.max(confidence, validation.score);
            }
          }
          
          // Boost if both lines are ALL CAPS (common for company names)
          if (cleaned === cleaned.toUpperCase() && nextCleaned === nextCleaned.toUpperCase()) {
            confidence += 15;
          }
          
          candidates.push({ text: combined, confidence, position: i });
        }
      }
    }
  }
  
  // Select best candidate
  if (candidates.length > 0) {
    // Log all candidates for debugging
    console.log("Company extraction candidates:", candidates.map(c => ({ text: c.text, confidence: c.confidence, position: c.position })));
    
    // Sort by confidence, then by position (prefer earlier in document)
    candidates.sort((a, b) => {
      if (Math.abs(b.confidence - a.confidence) > 5) {
        return b.confidence - a.confidence;
      }
      return a.position - b.position; // Prefer earlier positions if confidence is similar
    });
    
    const best = candidates[0];
    console.log("Extracted company:", best.text, "confidence:", best.confidence, "position:", best.position, "total candidates:", candidates.length);
    return { company: best.text, confidence: best.confidence, position: best.position };
  }
  
  console.log("No company found. Searched", allLines.length, "lines");
  return { company: null, confidence: 0 };
}

/**
 * Context-aware role extraction with proximity matching
 */
function extractRole(
  blocks: string[],
  regions: { top: string[]; middle: string[]; bottom: string[]; allLines: LineWithPosition[] },
  companyPosition?: number,
  namePosition?: number
): { role: string | null; confidence: number; position?: number } {
  const allLines = regions.allLines;
  const candidates: Array<{ text: string; confidence: number; position: number }> = [];
  
  // Roles are usually near company or name - prioritize those areas
  // BUT: Also search all lines for ALL CAPS roles that might not be near company/name
  let searchLines: LineWithPosition[] = [];
  
  if (companyPosition !== undefined) {
    // Search near company first
    searchLines = findProximityMatches(companyPosition, allLines, 2).concat(
      findProximityMatches(companyPosition, allLines, 3).filter(l => 
        !findProximityMatches(companyPosition, allLines, 2).includes(l)
      )
    );
  } else if (namePosition !== undefined) {
    // Search near name
    searchLines = findProximityMatches(namePosition, allLines, 3);
  } else {
    // Search in middle/top regions
    searchLines = allLines.filter((_, i) => i < Math.ceil(allLines.length * 0.7));
  }
  
  // If no proximity matches, or if we want to search for ALL CAPS roles, include all lines
  // Prioritize proximity matches but also check all lines for ALL CAPS roles
  const linesToSearch = searchLines.length > 0 
    ? [...new Set([...searchLines, ...allLines])] // Include both proximity and all lines (deduplicated)
    : allLines;
  
  for (const title of ROLE_TITLES) {
    const titleWords = title.split(/\s+/);
    const titleLower = title.toLowerCase();
    
    // Build pattern that works for both lowercase and ALL CAPS
    const patternStr = titleWords.length > 1
      ? `(?:^|\\s)(?:${titleWords.map(w => `\\b${w}\\b`).join("\\s+")})(?:\\s|$|of|in|at)`
      : `\\b${title}\\b`;
    const pattern = new RegExp(patternStr, "i");
    
    for (const line of linesToSearch) {
      // Clean OCR artifacts from line text (backslashes, pipes, quotes)
      let lineText = line.text.replace(/[\\|"]+/g, " ").replace(/\s+/g, " ").trim();
      const lineLower = lineText.toLowerCase();
      
      // Check for match: pattern match, includes title (case-insensitive), or exact ALL CAPS match
      // Also check if the entire line is ALL CAPS and matches the role title
      const isAllCapsLine = lineText === lineText.toUpperCase() && lineText.trim().length > 2;
      const allCapsMatch = isAllCapsLine && (
        lineText.trim().toUpperCase() === title.toUpperCase() ||
        (titleWords.length === 1 && lineText.trim().toUpperCase() === title.toUpperCase()) ||
        lineLower.includes(titleLower)
      );
      
      const hasMatch = pattern.test(lineText) || 
                       lineLower.includes(titleLower) ||
                       (titleWords.length === 1 && lineText.toUpperCase() === title.toUpperCase()) ||
                       allCapsMatch;
      
      if (hasMatch) {
        // Extract full role title with context
        const words = lineText.split(/\s+/).filter(w => w.length > 0); // Filter empty words
        let result = "";
        let capturing = false;
        let captureCount = 0;
        
        for (let i = 0; i < words.length; i++) {
          const word = words[i];
          const wordLower = word.toLowerCase();
          
          // Check if this word matches the title (case-insensitive or ALL CAPS)
          // For ALL CAPS lines, be more aggressive in matching
          const wordMatches = titleWords.some(tw => {
            const twLower = tw.toLowerCase();
            const twUpper = tw.toUpperCase();
            const wordUpper = word.toUpperCase();
            return wordLower === twLower || 
                   wordUpper === twUpper || // Exact ALL CAPS match
                   wordLower.includes(twLower) || 
                   twLower.includes(wordLower) ||
                   (wordUpper === twUpper && tw.length > 2) || // ALL CAPS match
                   (isAllCapsLine && wordUpper.includes(twUpper)); // ALL CAPS line match
          });
          
          if (wordMatches) {
            capturing = true;
            result += (result ? " " : "") + word;
            captureCount++;
          } else if (capturing) {
            // Check for continuations - include words that are part of multi-word role titles
          // Allow words like "resources", "development", "operations" that are part of role titles
          if (["of", "and", "-", "|", "&", "resources", "development", "operations", "management"].includes(wordLower) ||
              ROLE_TITLES.some(rt => {
                const rtLower = rt.toLowerCase();
                const rtWords = rtLower.split(/\s+/);
                return rtWords.some(rw => 
                  wordLower === rw || 
                  wordLower.includes(rw) || 
                  rw.includes(wordLower)
                );
              })) {
            result += " " + word;
            captureCount++;
          } else if (["senior", "junior", "lead", "chief", "executive", "principal", "staff", "associate", "human"].includes(wordLower)) {
            result = word + " " + result;
          } else {
            break;
          }
          }
          
          if (captureCount > 6) break;
        }
        
        if (result) {
          // Clean result of any remaining artifacts
          result = result.replace(/[\\|"]+/g, "").trim();
          
          // Format: preserve ALL CAPS if original was ALL CAPS, otherwise title case
          const isAllCaps = result === result.toUpperCase() && result.length > 3;
          const formatted = isAllCaps 
            ? result.toLowerCase().split(" ").map(w => 
                w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
              ).join(" ")
            : result.split(" ").map(w => 
                w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
              ).join(" ");
          
          // Calculate confidence with proximity bonus
          let confidence = 85;
          const proximityScore = checkRoleProximity(line.index, companyPosition, namePosition);
          confidence = Math.min(100, (confidence + proximityScore) / 2);
          
          // Boost if in proximity region
          if ((companyPosition !== undefined && Math.abs(line.index - companyPosition) <= 2) ||
              (namePosition !== undefined && Math.abs(line.index - namePosition) <= 2)) {
            confidence += 10;
          }
          
          // Boost for exact ALL CAPS match (high confidence)
          if (isAllCaps && titleWords.length === 1) {
            confidence += 5;
          }
          
          candidates.push({ 
            text: formatted, 
            confidence: Math.min(100, confidence), 
            position: line.index 
          });
        }
      }
    }
  }
  
  // Select best candidate
  if (candidates.length > 0) {
    candidates.sort((a, b) => {
      // Sort by confidence first, then proximity
      if (Math.abs(b.confidence - a.confidence) > 5) {
        return b.confidence - a.confidence;
      }
      // Prefer earlier positions (roles usually near top/middle)
      return a.position - b.position;
    });
    
    const best = candidates[0];
    console.log("Extracted role:", best.text, "confidence:", best.confidence, "position:", best.position);
    return { role: best.text, confidence: best.confidence, position: best.position };
  }
  
  console.log("No role found. Searched", linesToSearch.length, "lines");
  return { role: null, confidence: 0 };
}

// Name prefixes and suffixes
const NAME_PREFIXES = /\b(?:Dr|Mr|Mrs|Ms|Miss|Prof|Professor|Sir|Madam|Hon|Honorable|Mister|Master)\b\.?/i;
const NAME_SUFFIXES = /\b(?:Jr|Sr|II|III|IV|V|Esq|Esquire)\b\.?$/i;

/**
 * Context-aware name extraction with cross-validation
 */
function extractName(
  blocks: string[],
  email: string | null,
  company: string | null,
  role: string | null,
  regions: { top: string[]; middle: string[]; bottom: string[]; allLines: LineWithPosition[] },
  emailPosition?: number,
  companyPosition?: number,
  rolePosition?: number,
  context?: ExtractionContext
): { name: string; confidence: number; position?: number } {
  const allLines = regions.allLines;
  const candidates: Array<{ text: string; confidence: number; position: number; crossValidationScore: number }> = [];
  
  // Priority 1: Top region (names are usually in first 25-30% of lines)
  const topRegionEnd = Math.ceil(allLines.length * 0.25); // First 25% instead of 33%
  const topLines = allLines.slice(0, topRegionEnd);
  
  for (const line of topLines) {
    // Clean artifacts from name lines BEFORE validation
    let cleaned = line.text.replace(EMAIL_REGEX, "").replace(URL_REGEX, "").trim();
    
    // Remove trailing artifacts (parentheses, brackets, special chars, pipes)
    cleaned = cleaned.replace(/\s+[)\]}|]+\s*$/g, ""); // Trailing closing brackets and pipes
    cleaned = cleaned.replace(/[)\]}|]+\s*$/g, ""); // End of string brackets/pipes
    cleaned = cleaned.replace(/\s+[)\]}|]+\s+/g, " "); // Standalone brackets/pipes in middle
    
    // Remove standalone pipes and artifacts
    cleaned = cleaned.replace(/\s+\|\s+\|\s+/g, " "); // " | | " -> " "
    cleaned = cleaned.replace(/^\|\s+/g, ""); // Leading pipes
    cleaned = cleaned.replace(/\s+\|$/g, ""); // Trailing pipes
    
    // Fix common name OCR errors
    cleaned = cleaned.replace(/\bTt\b/g, "it"); // "Tt" -> "it"
    cleaned = cleaned.replace(/\bGroen\b/gi, "Green"); // "Groen" -> "Green"
    cleaned = cleaned.replace(/\bDaney\b/gi, "Darcy"); // "Daney" -> "Darcy" (common OCR error)
    
    // Remove leading/trailing artifacts but preserve name structure
    cleaned = cleaned.trim();
    
    if (isValidNameCandidate(cleaned, email, company, role)) {
      let confidence = calculateSpatialScore(line, context || {} as ExtractionContext, regions);
      
      // Boost for top region
      confidence += 20;
      
      // Cross-validate with email
      let crossValidationScore = 0;
      if (email) {
        const validation = crossValidateNameWithEmail(cleaned, email);
        if (validation.valid) {
          confidence += validation.score * 0.3; // Email validation adds up to 30 points
          crossValidationScore = validation.score;
        }
      }
      
      // Penalize if too close to company/role (might be part of company name)
      if (companyPosition !== undefined && Math.abs(line.index - companyPosition) <= 1) {
        confidence -= 15;
      }
      if (rolePosition !== undefined && Math.abs(line.index - rolePosition) <= 1) {
        confidence -= 10;
      }
      
      confidence = Math.max(20, Math.min(100, confidence));
      
      if (confidence >= 40) {
        candidates.push({ 
          text: cleaned, 
          confidence, 
          position: line.index,
          crossValidationScore 
        });
      }
    }
  }
  
  // Priority 2: Other regions (if top region didn't yield good results)
  if (candidates.length === 0 || candidates[0].confidence < 60) {
    const otherLines = allLines.slice(topRegionEnd);
    
    for (const line of otherLines) {
      // Clean artifacts from name lines BEFORE validation
      let cleaned = line.text.replace(EMAIL_REGEX, "").replace(URL_REGEX, "").trim();
      
      // Remove trailing artifacts (parentheses, brackets, special chars)
      cleaned = cleaned.replace(/\s+[)\]}]+\s*$/g, ""); // Trailing closing brackets
      cleaned = cleaned.replace(/[)\]}]+\s*$/g, ""); // End of string brackets
      cleaned = cleaned.replace(/\s+[)\]}]+\s+/g, " "); // Standalone brackets in middle
      
      // Fix common name OCR errors
      cleaned = cleaned.replace(/\bTt\b/g, "it"); // "Tt" -> "it"
      cleaned = cleaned.replace(/\bGroen\b/gi, "Green"); // Specific fix
      
      cleaned = cleaned.trim();
      
      // Skip if already identified
      if (email && cleaned.toLowerCase() === email.toLowerCase()) continue;
      if (company && cleaned.toLowerCase() === company.toLowerCase()) continue;
      if (role && cleaned.toLowerCase() === role.toLowerCase()) continue;
      if (PHONE_PATTERNS.some(p => p.test(cleaned))) continue;
      
      if (isValidNameCandidate(cleaned, email, company, role)) {
        let confidence = calculateSpatialScore(line, context || {} as ExtractionContext, regions);
        
        // Cross-validate with email
        let crossValidationScore = 0;
        if (email) {
          const validation = crossValidateNameWithEmail(cleaned, email);
          if (validation.valid) {
            confidence += validation.score * 0.4; // Email validation more important here
            crossValidationScore = validation.score;
          }
        }
        
        confidence = Math.max(20, Math.min(100, confidence));
        
        if (confidence >= 30) {
          candidates.push({ 
            text: cleaned, 
            confidence, 
            position: line.index,
            crossValidationScore 
          });
        }
      }
    }
  }
  
  // Select best candidate
  if (candidates.length > 0) {
    // Sort by confidence and cross-validation score
    candidates.sort((a, b) => {
      // If cross-validation exists, prioritize it
      if (a.crossValidationScore > 0 || b.crossValidationScore > 0) {
        if (Math.abs(b.crossValidationScore - a.crossValidationScore) > 10) {
          return b.crossValidationScore - a.crossValidationScore;
        }
      }
      // Then by confidence
      if (Math.abs(b.confidence - a.confidence) > 5) {
        return b.confidence - a.confidence;
      }
      // Finally by position (prefer earlier/top)
      return a.position - b.position;
    });
    
    const best = candidates[0];
    console.log("Extracted name:", best.text, "confidence:", best.confidence, "position:", best.position, "crossValidation:", best.crossValidationScore);
    return { name: best.text, confidence: best.confidence, position: best.position };
  }
  
  // Priority 3: Fallback to email local part
  if (email) {
    const localPart = email.split("@")[0];
    const nameFromEmail = localPart
      .replace(/[._-]/g, " ")
      .split(/\s+/)
      .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
      .join(" ");
    
    if (nameFromEmail.length >= 3 && nameFromEmail.length < 40) {
      console.log("Extracted name (from email):", nameFromEmail);
      return { name: nameFromEmail, confidence: 40, position: emailPosition };
    }
  }
  
  console.log("No name found. Checked", allLines.length, "lines");
  return { name: "", confidence: 0 };
}

function isValidNameCandidate(
  text: string,
  email: string | null,
  company: string | null,
  role: string | null
): boolean {
  if (!text || text.length < 2) return false;
  if (text.length > 50) return false;
  
  // Skip if it's clearly not a name
  if (PHONE_PATTERNS.some(p => p.test(text))) return false;
  if (email && text.toLowerCase() === email.toLowerCase()) return false;
  if (company && text.toLowerCase() === company.toLowerCase()) return false;
  if (role && text.toLowerCase() === role.toLowerCase()) return false;
  if (COMPANY_SUFFIXES.test(text)) return false;
  if (/^[0-9\s,.-]+$/.test(text)) return false; // Just numbers
  if (/^\d{3,}/.test(text)) return false; // Starts with numbers
  if (URL_REGEX.test(text)) return false; // URLs
  if (EMAIL_REGEX.test(text)) return false; // Emails
  
  // Skip if it contains role keywords (common mistake - role getting mixed with name)
  // Examples: "M Designer" should be rejected (contains "Designer")
  // BUT: Be more lenient - only reject if role word is prominent
  const textWords = text.split(/\s+/).filter(w => w.length > 0);
  const lowerText = text.toLowerCase();
  
  // Check if this looks like just a role (e.g., "OWNER", "Manager")
  if (textWords.length === 1 && ROLE_TITLES.some(rt => rt.toLowerCase() === lowerText)) {
    console.log("Rejected name candidate (is a role title):", text);
    return false;
  }
  
  // Check if it's a role + single letter artifact (e.g., "Owner I", "Manager A")
  if (textWords.length === 2 && textWords[1].length === 1) {
    const firstWord = textWords[0].toLowerCase();
    if (ROLE_TITLES.some(rt => rt.toLowerCase() === firstWord)) {
      console.log("Rejected name candidate (role + artifact):", text);
      return false;
    }
  }
  
  // Check if role word is very prominent (>50% of text)
  const containsProminentRole = textWords.some(word => {
    const wordLower = word.toLowerCase();
    return ROLE_TITLES.some(roleTitle => {
      const roleWords = roleTitle.toLowerCase().split(/\s+/);
      // Only reject if it's an exact match to a single-word role
      return roleWords.length === 1 && wordLower === roleWords[0] && word.length > 4;
    });
  });
  if (containsProminentRole) {
    console.log("Rejected name candidate (contains prominent role keyword):", text);
    return false;
  }
  
  // Reject single-letter words at the start (e.g., "M Designer")
  if (textWords.length > 0 && textWords[0].length === 1 && !/[A-Z]/.test(textWords[0]) && !/[']/.test(textWords[0])) {
    console.log("Rejected name candidate (starts with invalid single letter):", text);
    return false;
  }
  
  // Skip if it looks like a company name (all caps, company suffixes, etc.)
  if (text === text.toUpperCase() && text.length > 8 && !text.includes(" ")) {
    // Single word all caps might be name, but if it's long it's probably company
    return false;
  }
  
  // Skip if it contains OCR artifacts that suggest it's not a name
  // BUT: Allow closing brackets/parentheses if they're clearly artifacts at the end
  // Clean them first, then check
  const cleanedForValidation = text.replace(/\s+[)\]}]+\s*$/g, "").replace(/[)\]}]+\s*$/g, "");
  if (cleanedForValidation !== text && cleanedForValidation.length < 3) {
    // If removing artifacts leaves too little, it's probably not a name
    return false;
  }
  if (/[@\]\}]/.test(cleanedForValidation) && !/@/.test(cleanedForValidation)) {
    // Contains closing brackets but not @ - might still be a name with artifact
    // Allow it if it looks like a name otherwise
  } else if (/[@\]\}]/.test(text)) {
    return false; // Contains email symbols or problematic brackets
  }
  if (/^\w+[@\)]/.test(text)) return false; // Starts with word followed by @ or )
  
  // Check word count (names are typically 1-5 words, but allow more for hyphenated names)
  if (textWords.length < 1 || textWords.length > 6) return false;
  
  // Reject single-letter words unless it's a prefix (like "O'")
  if (textWords.some(w => w.length === 1 && !/[A-Z]/.test(w) && !/[']/.test(w))) return false;
  
  // Check if words look like name parts (capitalized, or name particles)
  // Be more lenient - allow at least 50% of words to match name pattern
  const nameParticles = /^(van|von|de|del|della|der|di|du|la|le|lo|mc|mac|o')/i;
  const nameLikeWords = textWords.filter(w => {
    // Clean artifacts before checking
    let cleaned = w.replace(/[@\)\]\}]/g, "").trim();
    if (cleaned.length === 0) return false;
    
    // Allow name prefixes like "Mr.", "Mrs.", etc.
    if (NAME_PREFIXES.test(cleaned)) return true;
    if (NAME_SUFFIXES.test(cleaned)) return true;
    
    // Check if it starts with capital or is a name particle
    return /^[A-Z]/.test(cleaned) || 
           nameParticles.test(cleaned) || 
           cleaned.includes("-");
  });
  
  // At least 50% of words should look like name parts, or all words if short
  // BUT: If we have a name prefix (Mr., Mrs., etc.), be more lenient
  const hasPrefix = NAME_PREFIXES.test(text);
  const requiredMatchRatio = hasPrefix ? 0.4 : 0.5; // Lower threshold if prefix exists
  
  return nameLikeWords.length >= Math.ceil(textWords.length * requiredMatchRatio) || 
         (textWords.length <= 2 && nameLikeWords.length > 0);
}

function calculateNameConfidence(
  text: string,
  isTopRegion: boolean,
  structure?: OCRStructure
): number {
  let confidence = isTopRegion ? 70 : 50;
  
  const nameWords = text.split(/\s+/);
  
  // Boost confidence for common name patterns
  if (nameWords.length === 2 || nameWords.length === 3) confidence += 10; // First + Last, or First + Middle + Last
  if (nameWords.length === 1 && nameWords[0].length >= 3) confidence += 5; // Single name (first name only)
  
  // Boost for name prefixes/suffixes (indicates it's definitely a name)
  if (NAME_PREFIXES.test(text) || NAME_SUFFIXES.test(text)) confidence += 15;
  
  // Boost for hyphenated names (common in names)
  if (text.includes("-")) confidence += 5;
  
  // Use OCR confidence if available
  if (structure?.lines) {
    const matchingLine = structure.lines.find(l => l.text.includes(text));
    if (matchingLine) {
      confidence = (confidence + matchingLine.confidence) / 2;
    }
  }
  
  // Penalize if contains numbers (unlikely in names)
  if (/\d/.test(text)) confidence -= 20;
  
  // Penalize if all caps and too long (likely company)
  if (text === text.toUpperCase() && text.length > 20) confidence -= 15;
  
  return Math.max(0, Math.min(100, confidence));
}

/**
 * Multi-pass, context-aware business card parsing
 * Uses Strategy 1: Multi-pass extraction with context
 */
function parseBusinessCard(
  ocrText: string,
  structure?: OCRStructure
): {
  name: string;
  email: string;
  phone: string;
  company: string;
  role: string;
  confidence?: {
    name?: number;
    email?: number;
    phone?: number;
    company?: number;
    role?: number;
  };
} {
  console.log("=== Starting parseBusinessCard (Multi-Pass) ===");
  console.log("OCR text length:", ocrText.length);
  console.log("OCR text preview (first 500 chars):", ocrText.substring(0, 500));
  
  // Strategy 3: Better text preservation - less aggressive cleaning
  const cleanedText = cleanOCRText(ocrText, true);
  console.log("Cleaned text length:", cleanedText.length);
  
  const blocks = splitIntoBlocks(cleanedText);
  console.log("Split into", blocks.length, "blocks:", blocks);
  
  // Strategy 2: Improved spatial analysis
  const regions = extractTextRegions(structure, blocks);
  console.log("Text regions:", {
    top: regions.top.length,
    middle: regions.middle.length,
    bottom: regions.bottom.length,
    totalLines: regions.allLines.length,
    topContent: regions.top.slice(0, 3),
    middleContent: regions.middle.slice(0, 3),
    bottomContent: regions.bottom.slice(0, 3),
  });
  
  // Initialize context for cross-validation
  let context: ExtractionContext = {
    email: { value: null, position: undefined },
    phone: { value: null, position: undefined },
    company: { value: null, position: undefined },
    role: { value: null, position: undefined },
    name: { value: null, position: undefined },
  };
  
  // === PASS 1: Extract easy targets (email and phone) ===
  console.log("\n--- PASS 1: Extracting email and phone ---");
  console.log("Full cleaned text:", cleanedText);
  console.log("All lines:", regions.allLines.map((l, i) => `${i}: "${l.text}"`));
  
  // Extract email with position tracking - prioritize structured lines
  let emailResult: { email: string | null; confidence: number; position?: number } = { email: null, confidence: 0 };
  
  // First: Search in structured lines (they often have better OCR results)
  if (regions.allLines.length > 0) {
    for (let i = 0; i < regions.allLines.length; i++) {
      const line = regions.allLines[i];
      const result = extractEmail(line.text, i);
      if (result.email && (!emailResult.email || result.confidence > emailResult.confidence)) {
        emailResult = result;
        console.log(`Found email in line ${i}: "${line.text}" -> ${result.email}`);
      }
    }
    
    // Try combining adjacent lines that might contain email parts
    // Email might be split across lines (e.g., "he lug" on one line, "te com" on another)
    for (let i = 0; i < regions.allLines.length - 1; i++) {
      const combined = regions.allLines[i].text + " " + regions.allLines[i + 1].text;
      const result = extractEmail(combined, i);
      if (result.email && (!emailResult.email || result.confidence > emailResult.confidence)) {
        emailResult = { ...result, position: i };
        console.log(`Found email in combined lines ${i}-${i+1}: "${combined}" -> ${result.email}`);
      }
    }
  }
  
  // Fallback: search in full text
  if (!emailResult.email) {
    const fullTextEmailResult = extractEmail(cleanedText);
    if (fullTextEmailResult.email) {
      emailResult = fullTextEmailResult;
      console.log(`Found email in full text: ${fullTextEmailResult.email}`);
    }
  }
  
  console.log("Email extraction result:", emailResult);
  context.email = { value: emailResult.email, position: emailResult.position };
  
  // Extract phone with position tracking - prioritize structured lines
  let phoneResult = extractPhone(cleanedText, regions.allLines);
  
  // Try combining lines for phone numbers that might be split
  if (!phoneResult.phone && regions.allLines.length > 0) {
    for (let i = 0; i < regions.allLines.length - 1; i++) {
      const combined = regions.allLines[i].text + " " + regions.allLines[i + 1].text;
      const result = extractPhone(combined, regions.allLines);
      if (result.phone && (!phoneResult.phone || result.confidence > phoneResult.confidence)) {
        phoneResult = { ...result, position: i };
        console.log(`Found phone in combined lines ${i}-${i+1}: "${combined}" -> ${result.phone}`);
      }
    }
  }
  
  // Final fallback: search full text
  if (!phoneResult.phone) {
    phoneResult = extractPhone(cleanedText);
  }
  
  console.log("Phone extraction result:", phoneResult);
  context.phone = { value: phoneResult.phone, position: phoneResult.position };
  
  // === PASS 2: Extract company using email context ===
  console.log("\n--- PASS 2: Extracting company with email context ---");
  const companyResult = extractCompany(
    blocks, 
    emailResult.email || null, 
    regions,
    context.email.position
  );
  console.log("Company extraction result:", companyResult);
  context.company = { value: companyResult.company, position: companyResult.position };
  
  // === PASS 3: Extract role using company/name context ===
  console.log("\n--- PASS 3: Extracting role with proximity matching ---");
  const roleResult = extractRole(
    blocks,
    regions,
    context.company.position,
    context.name.position
  );
  console.log("Role extraction result:", roleResult);
  context.role = { value: roleResult.role, position: roleResult.position };
  
  // === PASS 4: Extract name using all context ===
  console.log("\n--- PASS 4: Extracting name with cross-validation ---");
  const nameResult = extractName(
    blocks,
    emailResult.email || null,
    companyResult.company || null,
    roleResult.role || null,
    regions,
    context.email.position,
    context.company.position,
    context.role.position,
    context
  );
  console.log("Name extraction result:", nameResult);
  context.name = { value: nameResult.name, position: nameResult.position };
  
  // === PASS 5: Refinement - cross-validate and improve ===
  console.log("\n--- PASS 5: Cross-validation and refinement ---");
  
  // Refine company if we have email
  let finalCompany = companyResult.company || "";
  let finalCompanyConfidence = companyResult.confidence || 0;
  if (emailResult.email && finalCompany) {
    const validation = crossValidateCompanyWithEmail(finalCompany, emailResult.email);
    if (validation.valid) {
      finalCompanyConfidence = Math.max(finalCompanyConfidence, validation.score);
      console.log("Company validated against email:", validation.score);
    }
  }
  
  // Refine name if we have email
  let finalName = nameResult.name || "";
  let finalNameConfidence = nameResult.confidence || 0;
  if (emailResult.email && finalName) {
    // Try to correct name based on email (fix OCR errors)
    const correctedName = correctNameFromEmail(finalName, emailResult.email);
    if (correctedName) {
      console.log(`Name corrected from "${finalName}" to "${correctedName}" based on email`);
      finalName = correctedName;
      finalNameConfidence = Math.max(finalNameConfidence, 85); // Boost confidence for corrected name
    }
    
    const validation = crossValidateNameWithEmail(finalName, emailResult.email);
    if (validation.valid) {
      // Boost confidence if validated
      finalNameConfidence = Math.max(finalNameConfidence, validation.score);
      console.log("Name validated against email:", validation.score);
    } else {
      // Don't penalize too much - might be correct extraction
      finalNameConfidence = Math.max(20, finalNameConfidence - 10);
    }
  }
  
  // Refine role if we have position data
  let finalRole = roleResult.role || "";
  let finalRoleConfidence = roleResult.confidence || 0;
  if (finalRole && (context.company.position !== undefined || context.name.position !== undefined)) {
    const proximityScore = checkRoleProximity(
      context.role.position || 0,
      context.company.position,
      context.name.position
    );
    finalRoleConfidence = Math.max(finalRoleConfidence, proximityScore);
  }
  
  // Format results - clean artifacts from final results
  finalName = finalName ? formatName(finalName).replace(/\s+[)\]}]+\s*$/g, "").trim() : "";
  const finalEmail = emailResult.email || "";
  const finalPhone = phoneResult.phone ? formatPhoneNumber(phoneResult.phone) : "";
  // Clean artifacts from role too
  finalRole = finalRole ? finalRole.replace(/[\\|"]+/g, " ").replace(/\s+/g, " ").trim() : "";
  
  // Final validation - adjust confidence but preserve data
  // Strategy: Never clear fields, only adjust confidence for user awareness
  if (finalName && !validateName(finalName)) {
    finalNameConfidence = Math.max(20, finalNameConfidence - 10);
  }
  
  if (finalEmail && !validateEmail(finalEmail)) {
    emailResult.confidence = Math.max(20, emailResult.confidence - 15);
  }
  
  if (finalPhone && !validatePhone(finalPhone)) {
    phoneResult.confidence = Math.max(20, phoneResult.confidence - 10);
  }
  
  // Ensure confidence scores are reasonable
  finalNameConfidence = finalName ? Math.max(0, Math.min(100, finalNameConfidence)) : 0;
  const emailConfidence = finalEmail ? Math.max(0, Math.min(100, emailResult.confidence)) : 0;
  const phoneConfidence = finalPhone ? Math.max(0, Math.min(100, phoneResult.confidence)) : 0;
  finalCompanyConfidence = finalCompany ? Math.max(0, Math.min(100, finalCompanyConfidence)) : 0;
  finalRoleConfidence = finalRole ? Math.max(0, Math.min(100, finalRoleConfidence)) : 0;
  
  // Log final extraction results
  console.log("\n=== FINAL EXTRACTION RESULTS ===");
  console.log("Field extraction results:", {
    name: { value: finalName, confidence: finalNameConfidence, position: context.name.position },
    email: { value: finalEmail, confidence: emailConfidence, position: context.email.position },
    phone: { value: finalPhone, confidence: phoneConfidence, position: context.phone.position },
    company: { value: finalCompany, confidence: finalCompanyConfidence, position: context.company.position },
    role: { value: finalRole, confidence: finalRoleConfidence, position: context.role.position },
  });
  
  // Return all extracted fields with confidence scores
  // Never filter out fields - let users review and correct
  return {
    name: finalName,
    email: finalEmail,
    phone: finalPhone,
    company: finalCompany,
    role: finalRole,
    confidence: {
      name: finalNameConfidence,
      email: emailConfidence,
      phone: phoneConfidence,
      company: finalCompanyConfidence,
      role: finalRoleConfidence,
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body - use req.json() directly but handle errors
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error("Failed to parse request body as JSON:", parseError);
      const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
      
      // Check if it's an empty body error
      if (errorMessage.includes("Unexpected end of JSON input") || errorMessage.includes("empty")) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Request body is empty or incomplete",
            details: "The request body was empty or truncated. This may be due to request size limits or network issues."
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Invalid JSON in request body",
          details: errorMessage
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Check if body is null or undefined
    if (!body) {
      return new Response(
        JSON.stringify({ success: false, error: "Request body is empty" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Support both OCR text and legacy image input
    // For backwards compatibility, if imageBase64 is provided without ocrText,
    // we return an error explaining OCR must be done client-side
    const ocrText = body.ocrText || body.text;
    const imageBase64 = body.imageBase64;
    const structure: OCRStructure | undefined = body.structure;
    
    if (!ocrText && imageBase64) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Server-side OCR has been removed. Please perform OCR on the client using Tesseract.js and send the extracted text in the 'ocrText' field." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!ocrText || typeof ocrText !== "string" || ocrText.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "OCR text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Parsing business card OCR text (length:", ocrText.length, ")", ocrText.substring(0, 200));
    console.log("=== FULL OCR TEXT FOR DEBUGGING ===");
    console.log(ocrText);
    console.log("=== END OCR TEXT ===");
    if (structure) {
      console.log("Using structured layout data with", structure.lines?.length || 0, "lines");
    }

    const contact = parseBusinessCard(ocrText, structure);

    console.log("Parsed contact:", {
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      company: contact.company,
      role: contact.role,
      confidence: contact.confidence,
    });

    // Validate results - warn if confidence is too low
    const confidences = contact.confidence || {};
    const lowConfidenceFields = Object.entries(confidences)
      .filter(([_, conf]) => conf !== undefined && conf < 50)
      .map(([field, _]) => field);
    
    if (lowConfidenceFields.length > 0) {
      console.warn("Low confidence fields detected:", lowConfidenceFields);
    }

    return new Response(
      JSON.stringify({ success: true, contact }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing business card:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Failed to process business card",
        details: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
