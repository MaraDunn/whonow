/**
 * Deterministic Document Contact Parser
 * Rule-based extraction from PDF/document text - NO AI/LLM
 */

import { formatName, formatPhoneNumber } from "./formatContact";
import { parseContactText, ParsedContactData } from "./contactTextParser";

export interface DocumentContact {
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
}

// Email regex
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;

// Phone patterns
const PHONE_REGEX = /(?:\+\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}/g;

// Contact block separators
const BLOCK_SEPARATORS = /\n\s*\n|\r\n\s*\r\n|(?:^|\n)[-=_]{3,}(?:\n|$)/g;

// Table row patterns (tab or multiple spaces separated)
const TABLE_ROW_PATTERN = /^(.+?)\t(.+?)(?:\t(.+?))?(?:\t(.+?))?(?:\t(.+?))?$/;

// vCard patterns
const VCARD_NAME = /(?:FN|N)[;:](.+)/i;
const VCARD_EMAIL = /EMAIL[;:](.+)/i;
const VCARD_TEL = /TEL[;:](.+)/i;
const VCARD_ORG = /ORG[;:](.+)/i;
const VCARD_TITLE = /TITLE[;:](.+)/i;

// CSV header detection
const CONTACT_HEADERS = [
  "name", "first name", "last name", "full name",
  "email", "e-mail", "email address",
  "phone", "telephone", "mobile", "cell",
  "company", "organization", "org",
  "title", "role", "position", "job title",
];

/**
 * Clean document text
 */
function cleanDocumentText(text: string): string {
  return text
    // Normalize line endings
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    // Remove excessive whitespace
    .replace(/[ \t]+/g, " ")
    // Trim each line
    .split("\n")
    .map(line => line.trim())
    .join("\n")
    .trim();
}

/**
 * Detect if text is a table format (CSV/TSV)
 */
function detectTableFormat(text: string): { isTable: boolean; delimiter: string; headers: string[] } {
  const lines = text.split("\n").filter(l => l.trim());
  if (lines.length < 2) return { isTable: false, delimiter: "", headers: [] };
  
  // Check for common delimiters
  const delimiters = ["\t", ",", "|", ";"];
  
  for (const delimiter of delimiters) {
    const firstLineParts = lines[0].split(delimiter);
    if (firstLineParts.length >= 2) {
      // Check if first line looks like headers
      const lowerParts = firstLineParts.map(p => p.toLowerCase().trim());
      const headerMatches = lowerParts.filter(p => 
        CONTACT_HEADERS.some(h => p.includes(h))
      );
      
      if (headerMatches.length >= 2) {
        return { isTable: true, delimiter, headers: firstLineParts.map(h => h.trim()) };
      }
    }
  }
  
  return { isTable: false, delimiter: "", headers: [] };
}

/**
 * Parse table format data
 */
function parseTableFormat(text: string, delimiter: string, headers: string[]): DocumentContact[] {
  const lines = text.split("\n").filter(l => l.trim());
  const contacts: DocumentContact[] = [];
  
  // Find header indices
  const lowerHeaders = headers.map(h => h.toLowerCase());
  const nameIdx = lowerHeaders.findIndex(h => h.includes("name") || h.includes("full"));
  const firstNameIdx = lowerHeaders.findIndex(h => h.includes("first"));
  const lastNameIdx = lowerHeaders.findIndex(h => h.includes("last"));
  const emailIdx = lowerHeaders.findIndex(h => h.includes("email") || h.includes("e-mail"));
  const phoneIdx = lowerHeaders.findIndex(h => h.includes("phone") || h.includes("tel") || h.includes("mobile"));
  const companyIdx = lowerHeaders.findIndex(h => h.includes("company") || h.includes("org"));
  const roleIdx = lowerHeaders.findIndex(h => h.includes("title") || h.includes("role") || h.includes("position"));
  
  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(delimiter).map(p => p.trim());
    if (parts.length < 2) continue;
    
    let name = "";
    if (nameIdx >= 0 && parts[nameIdx]) {
      name = parts[nameIdx];
    } else if (firstNameIdx >= 0 || lastNameIdx >= 0) {
      const first = firstNameIdx >= 0 ? parts[firstNameIdx] || "" : "";
      const last = lastNameIdx >= 0 ? parts[lastNameIdx] || "" : "";
      name = `${first} ${last}`.trim();
    }
    
    if (!name) continue;
    
    contacts.push({
      name: formatName(name),
      email: emailIdx >= 0 ? parts[emailIdx] || null : null,
      phone: phoneIdx >= 0 ? (parts[phoneIdx] ? formatPhoneNumber(parts[phoneIdx]) : null) : null,
      company: companyIdx >= 0 ? parts[companyIdx] || null : null,
      role: roleIdx >= 0 ? parts[roleIdx] || null : null,
    });
  }
  
  return contacts;
}

/**
 * Parse vCard format
 */
function parseVCards(text: string): DocumentContact[] {
  const contacts: DocumentContact[] = [];
  const cards = text.split(/BEGIN:VCARD/i).filter(c => c.trim());
  
  for (const card of cards) {
    const lines = card.split("\n");
    const contact: DocumentContact = {
      name: "",
      email: null,
      phone: null,
      company: null,
      role: null,
    };
    
    for (const line of lines) {
      const nameMatch = line.match(VCARD_NAME);
      if (nameMatch) {
        contact.name = formatName(nameMatch[1].replace(/;/g, " ").trim());
      }
      
      const emailMatch = line.match(VCARD_EMAIL);
      if (emailMatch) {
        contact.email = emailMatch[1].trim();
      }
      
      const telMatch = line.match(VCARD_TEL);
      if (telMatch) {
        contact.phone = formatPhoneNumber(telMatch[1].trim());
      }
      
      const orgMatch = line.match(VCARD_ORG);
      if (orgMatch) {
        contact.company = orgMatch[1].trim();
      }
      
      const titleMatch = line.match(VCARD_TITLE);
      if (titleMatch) {
        contact.role = titleMatch[1].trim();
      }
    }
    
    if (contact.name) {
      contacts.push(contact);
    }
  }
  
  return contacts;
}

/**
 * Detect contact blocks in freeform text
 */
function detectContactBlocks(text: string): string[] {
  const blocks: string[] = [];
  
  // Split by double newlines or separator lines
  const parts = text.split(BLOCK_SEPARATORS);
  
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    
    // Check if block contains contact-like patterns
    const hasEmail = EMAIL_REGEX.test(trimmed);
    const hasPhone = PHONE_REGEX.test(trimmed);
    
    if (hasEmail || hasPhone) {
      blocks.push(trimmed);
    }
  }
  
  // If no clear blocks found, try line-by-line analysis
  if (blocks.length === 0) {
    const lines = text.split("\n").filter(l => l.trim());
    let currentBlock: string[] = [];
    
    for (const line of lines) {
      const hasEmail = EMAIL_REGEX.test(line);
      const hasPhone = PHONE_REGEX.test(line);
      
      if (hasEmail || hasPhone) {
        if (currentBlock.length > 0) {
          blocks.push(currentBlock.join("\n"));
        }
        currentBlock = [line];
      } else if (currentBlock.length > 0 && currentBlock.length < 6) {
        // Continue building current block (name, role, company lines)
        currentBlock.push(line);
      }
    }
    
    if (currentBlock.length > 0) {
      blocks.push(currentBlock.join("\n"));
    }
  }
  
  return blocks;
}

/**
 * Parse freeform contact blocks
 */
function parseFreeformBlocks(blocks: string[]): DocumentContact[] {
  const contacts: DocumentContact[] = [];
  
  for (const block of blocks) {
    const parsed = parseContactText(block);
    
    if (parsed.name && parsed.name.length > 0) {
      contacts.push({
        name: parsed.name,
        email: parsed.email,
        phone: parsed.phone,
        company: parsed.company,
        role: parsed.role,
      });
    }
  }
  
  return contacts;
}

/**
 * Parse document text and extract contacts
 */
export function parseDocumentContacts(text: string): DocumentContact[] {
  const cleanedText = cleanDocumentText(text);
  
  if (!cleanedText || cleanedText.length < 5) {
    return [];
  }
  
  // Check for vCard format
  if (/BEGIN:VCARD/i.test(cleanedText)) {
    return parseVCards(cleanedText);
  }
  
  // Check for table format
  const tableInfo = detectTableFormat(cleanedText);
  if (tableInfo.isTable) {
    return parseTableFormat(cleanedText, tableInfo.delimiter, tableInfo.headers);
  }
  
  // Fallback to freeform block detection
  const blocks = detectContactBlocks(cleanedText);
  return parseFreeformBlocks(blocks);
}

/**
 * Extract contacts from already-extracted text (from PDF library)
 */
export function parseExtractedText(text: string): DocumentContact[] {
  return parseDocumentContacts(text);
}
