import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Deterministic PDF/Document Contact Parser - NO AI/LLM
 * Rule-based extraction from document text
 * 
 * NOTE: This function now expects pre-extracted text from the client.
 * Client-side PDF text extraction should be done using pdfjs-dist.
 */

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

function formatPhoneNumber(phone: string): string {
  if (!phone || typeof phone !== 'string') return '';
  const trimmed = phone.trim();
  if (!trimmed) return '';
  
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return trimmed;
  
  if (digits.length === 10) {
    return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length >= 8 && (hasPlus || digits.length > 10)) {
    const countryCode = digits.slice(0, digits.length > 10 ? digits.length - 10 : 1);
    const rest = digits.slice(countryCode.length);
    const groups: string[] = [];
    for (let i = 0; i < rest.length; i += 3) {
      groups.push(rest.slice(i, Math.min(i + 3, rest.length)));
    }
    return `+${countryCode} ${groups.join(' ')}`;
  }
  return trimmed;
}

// Patterns
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
const PHONE_REGEX = /(?:\+\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}/g;
const BLOCK_SEPARATORS = /\n\s*\n|\r\n\s*\r\n|(?:^|\n)[-=_]{3,}(?:\n|$)/g;

// Contact headers for table detection
const CONTACT_HEADERS = ["name", "first name", "last name", "full name", "email", "e-mail", "phone", "telephone", "mobile", "company", "organization", "title", "role", "position"];

interface DocumentContact {
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
}

function cleanDocumentText(text: string): string {
  let cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  
  // Remove PDF operators and formatting commands that get mixed into text extraction
  // Common PDF operators: Tf (text font), Td (text position), TJ/Tj (text show), etc.
  // Also remove font commands like "/Helvetica 12 Tf"
  // IMPORTANT: Preserve newlines - only clean multiple spaces within lines, not across lines
  cleaned = cleaned
    // Remove PDF font commands: /FontName size Tf
    .replace(/\/[A-Za-z0-9]+\s+\d+\s+Tf\s+\d+\s+g/g, ' ')
    .replace(/\/[A-Za-z0-9]+\s+\d+\s+Tf/g, ' ')
    // Remove PDF operators: Tf, Td, TJ, Tj, etc.
    .replace(/\b(BT|ET|Tf|Td|TD|Tm|T\*|Tj|TJ|'|"|Tc|Tw|Tz|TL|Ts|Tr|Tg|TK)\s*\d*\s*/g, ' ')
    // Remove standalone PDF numbers that are likely coordinates
    .replace(/\b\d+\s+\d+\s+[TMLRBSWcmhre]+\s*\d*\b/g, ' ')
    // Remove PDF stream operators
    .replace(/stream\s*[\s\S]*?endstream/gi, ' ')
    // Remove common PDF object references
    .replace(/\b\d+\s+\d+\s+R\b/g, ' ')
    // Clean up multiple spaces within lines (but preserve newlines)
    .replace(/[ \t]+/g, ' ')
    // Remove spaces at start/end of lines (but keep the lines)
    .replace(/^[ \t]+/gm, '')
    .replace(/[ \t]+$/gm, '')
    // Remove excessive empty lines (more than 2 in a row)
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
  
  return cleaned;
}

function detectTableFormat(text: string): { isTable: boolean; delimiter: string; headers: string[] } {
  const lines = text.split("\n").filter(l => l.trim());
  if (lines.length < 2) return { isTable: false, delimiter: "", headers: [] };
  
  const delimiters = ["\t", ",", "|", ";"];
  
  // First, try to detect with headers
  for (const delimiter of delimiters) {
    const firstLineParts = lines[0].split(delimiter);
    if (firstLineParts.length >= 2) {
      const lowerParts = firstLineParts.map(p => p.toLowerCase().trim());
      const headerMatches = lowerParts.filter(p => CONTACT_HEADERS.some(h => p.includes(h)));
      if (headerMatches.length >= 2) {
        return { isTable: true, delimiter, headers: firstLineParts.map(h => h.trim()) };
      }
    }
  }
  
  // If no headers found, check if it looks like a table anyway (consistent delimiter usage)
  // This handles contact sheets without headers
  for (const delimiter of delimiters) {
    let consistentRows = 0;
    let columnCount = 0;
    
    // Check first 10 lines for consistency
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const parts = lines[i].split(delimiter).filter(p => p.trim().length > 0);
      if (parts.length >= 2) {
        if (columnCount === 0) {
          columnCount = parts.length;
        }
        if (parts.length === columnCount) {
          consistentRows++;
        }
      }
    }
    
    // If at least 5 rows have consistent column count, it's likely a table
    if (consistentRows >= 5 && columnCount >= 2) {
      // Check if rows contain contact-like data (emails, phones, names)
      let contactLikeRows = 0;
      for (let i = 0; i < Math.min(10, lines.length); i++) {
        const line = lines[i];
        if (EMAIL_REGEX.test(line) || PHONE_REGEX.test(line) || 
            /^[A-Z][a-z]+\s+[A-Z][a-z]+/.test(line)) {
          contactLikeRows++;
        }
      }
      
      // If at least 3 rows look like contacts, treat as table
      if (contactLikeRows >= 3) {
        // Generate generic headers based on column count
        const headers = Array.from({ length: columnCount }, (_, i) => {
          const headerNames = ["Name", "Email", "Phone", "Company", "Role", "Notes"];
          return headerNames[i] || `Column ${i + 1}`;
        });
        return { isTable: true, delimiter, headers };
      }
    }
  }
  
  return { isTable: false, delimiter: "", headers: [] };
}

function parseTableFormat(text: string, delimiter: string, headers: string[]): DocumentContact[] {
  const lines = text.split("\n").filter(l => l.trim());
  const contacts: DocumentContact[] = [];
  
  const lowerHeaders = headers.map(h => h.toLowerCase());
  const nameIdx = lowerHeaders.findIndex(h => h.includes("name") || h.includes("full"));
  const firstNameIdx = lowerHeaders.findIndex(h => h.includes("first"));
  const lastNameIdx = lowerHeaders.findIndex(h => h.includes("last"));
  const emailIdx = lowerHeaders.findIndex(h => h.includes("email") || h.includes("e-mail"));
  const phoneIdx = lowerHeaders.findIndex(h => h.includes("phone") || h.includes("tel") || h.includes("mobile") || h.includes("cell"));
  const companyIdx = lowerHeaders.findIndex(h => h.includes("company") || h.includes("org") || h.includes("organization"));
  const roleIdx = lowerHeaders.findIndex(h => h.includes("title") || h.includes("role") || h.includes("position") || h.includes("job"));
  
  // Determine start row (skip header if it exists)
  const startRow = lowerHeaders.some(h => CONTACT_HEADERS.some(ch => h.includes(ch))) ? 1 : 0;
  
  console.log(`[parse-contact-pdf] Parsing table: ${lines.length} lines, start row: ${startRow}`);
  console.log(`[parse-contact-pdf] Column indices - name: ${nameIdx}, email: ${emailIdx}, phone: ${phoneIdx}, company: ${companyIdx}, role: ${roleIdx}`);
  
  for (let i = startRow; i < lines.length; i++) {
    const parts = lines[i].split(delimiter).map(p => p.trim()).filter(p => p.length > 0);
    if (parts.length < 2) continue;
    
    // Extract data based on column indices
    let name = "";
    if (nameIdx >= 0 && nameIdx < parts.length && parts[nameIdx]) {
      name = parts[nameIdx];
    } else if (firstNameIdx >= 0 || lastNameIdx >= 0) {
      const first = firstNameIdx >= 0 && firstNameIdx < parts.length ? parts[firstNameIdx] || "" : "";
      const last = lastNameIdx >= 0 && lastNameIdx < parts.length ? parts[lastNameIdx] || "" : "";
      name = `${first} ${last}`.trim();
    } else if (parts.length > 0) {
      // If no name column, try first column that looks like a name
      const firstPart = parts[0];
      if (firstPart && /^[A-Z][a-z]+/.test(firstPart) && firstPart.split(/\s+/).length <= 5) {
        name = firstPart;
      }
    }
    
    // Extract email - check specified column or search all columns
    let email: string | null = null;
    if (emailIdx >= 0 && emailIdx < parts.length && parts[emailIdx]) {
      email = parts[emailIdx];
    } else {
      // Search all columns for email
      for (const part of parts) {
        if (EMAIL_REGEX.test(part)) {
          email = part.match(EMAIL_REGEX)?.[0] || null;
          break;
        }
      }
    }
    
  // Extract phone - check specified column or search all columns
  let phone: string | null = null;
  if (phoneIdx >= 0 && phoneIdx < parts.length && parts[phoneIdx]) {
    const phoneCandidate = parts[phoneIdx];
    // Validate it's actually a phone number (not just numbers)
    if (PHONE_REGEX.test(phoneCandidate) && phoneCandidate.replace(/\D/g, '').length >= 7) {
      phone = phoneCandidate.match(PHONE_REGEX)?.[0] || null;
    }
  } else {
    // Search all columns for phone
    for (const part of parts) {
      if (PHONE_REGEX.test(part)) {
        const phoneMatch = part.match(PHONE_REGEX)?.[0];
        // Validate it's a real phone number (at least 7 digits)
        if (phoneMatch && phoneMatch.replace(/\D/g, '').length >= 7) {
          phone = phoneMatch;
          break;
        }
      }
    }
  }
    
    // Extract company
    const company = companyIdx >= 0 && companyIdx < parts.length ? parts[companyIdx] || null : null;
    
    // Extract role
    const role = roleIdx >= 0 && roleIdx < parts.length ? parts[roleIdx] || null : null;
    
    // Require at least name or email/phone
    if (!name && !email && !phone) continue;
    
    // Reject names that are PDF operators
    const pdfOperators = new Set(['Tf', 'Td', 'TJ', 'Tj', 'BT', 'ET', 'Tm', 'T*', 'Tc', 'Tw', 'Tz', 'TL', 'Ts', 'Tr', 'Tg', 'TK']);
    if (name && pdfOperators.has(name.trim())) {
      name = ""; // Reset name if it's a PDF operator
    }
    
    // Fallback name
    if (!name) {
      if (email) {
        name = email.split("@")[0].replace(/[._-]/g, " ");
      } else if (phone) {
        name = `Contact ${phone.substring(0, 4)}`;
      } else {
        name = "Unknown Contact";
      }
    }
    
    contacts.push({
      name: formatName(name),
      email,
      phone: phone ? formatPhoneNumber(phone) : null,
      company,
      role,
    });
  }
  
  console.log(`[parse-contact-pdf] Extracted ${contacts.length} contacts from table`);
  return contacts;
}

function parseVCards(text: string): DocumentContact[] {
  const contacts: DocumentContact[] = [];
  const cards = text.split(/BEGIN:VCARD/i).filter(c => c.trim());
  
  for (const card of cards) {
    const contact: DocumentContact = { name: "", email: null, phone: null, company: null, role: null };
    const lines = card.split("\n");
    
    for (const line of lines) {
      const nameMatch = line.match(/(?:FN|N)[;:](.+)/i);
      if (nameMatch) contact.name = formatName(nameMatch[1].replace(/;/g, " ").trim());
      
      const emailMatch = line.match(/EMAIL[;:](.+)/i);
      if (emailMatch) contact.email = emailMatch[1].trim();
      
      const telMatch = line.match(/TEL[;:](.+)/i);
      if (telMatch) contact.phone = formatPhoneNumber(telMatch[1].trim());
      
      const orgMatch = line.match(/ORG[;:](.+)/i);
      if (orgMatch) contact.company = orgMatch[1].trim();
      
      const titleMatch = line.match(/TITLE[;:](.+)/i);
      if (titleMatch) contact.role = titleMatch[1].trim();
    }
    
    if (contact.name) contacts.push(contact);
  }
  
  return contacts;
}

function detectContactBlocks(text: string): string[] {
  const blocks: string[] = [];
  const lines = text.split("\n").filter(l => l.trim());
  
  // Pattern to detect name+phone on same line
  // Handles: "Raynard Howard :+1(202)436-6981", "David Clayton :+1(202)600-5050"
  // Also handles when it's in the middle of a line: "text before David Clayton :+1(202)600-5050"
  // Pattern: Capitalized name (one or two words) + optional colon + phone number
  const namePhonePattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*:?\s*\+?1?\s*\(?\d{3}\)?\s*-?\s*\d{3}\s*-?\s*\d{4}/;
  
  console.log(`[parse-contact-pdf] detectContactBlocks: checking ${lines.length} lines for name+phone patterns`);
  
  // Find all lines that contain name+phone patterns
  const contactStartLines: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (namePhonePattern.test(line)) {
      contactStartLines.push(i);
      if (contactStartLines.length <= 5) {
        const match = line.match(namePhonePattern);
        console.log(`[parse-contact-pdf] Found name+phone pattern on line ${i + 1}: "${match ? match[0] : line.substring(0, 60)}"`);
      }
    }
  }
  
  console.log(`[parse-contact-pdf] Total name+phone patterns found: ${contactStartLines.length}`);
  
  // Create blocks starting at each name+phone line
  for (let idx = 0; idx < contactStartLines.length; idx++) {
    const startLineIdx = contactStartLines[idx];
    const nextStartLineIdx = contactStartLines[idx + 1];
    
    const currentBlock: string[] = [];
    
    // Add the line with the name+phone pattern
    currentBlock.push(lines[startLineIdx]);
    
    // Add following lines up to (but not including) the next name+phone line
    // Or up to 10 lines, whichever comes first
    const endLineIdx = nextStartLineIdx !== undefined 
      ? Math.min(nextStartLineIdx, startLineIdx + 11)
      : Math.min(startLineIdx + 11, lines.length);
    
    for (let j = startLineIdx + 1; j < endLineIdx; j++) {
      currentBlock.push(lines[j]);
    }
    
    if (currentBlock.length > 0) {
      blocks.push(currentBlock.join("\n"));
    }
  }
  
  console.log(`[parse-contact-pdf] Line-by-line detection: found ${contactStartLines.length} name+phone patterns, created ${blocks.length} contact blocks`);
  
  // If we found blocks, log first few for debugging
  if (blocks.length > 0) {
    console.log(`[parse-contact-pdf] First 3 blocks preview:`, blocks.slice(0, 3).map(b => b.substring(0, 100)));
  } else if (contactStartLines.length > 0) {
    console.log(`[parse-contact-pdf] WARNING: Found ${contactStartLines.length} name+phone patterns but created 0 blocks!`);
  }
  
  // If no blocks found, try pattern-based detection as fallback
  if (blocks.length === 0) {
    
    // Look for name patterns followed by contact info
    const namePattern = /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}$/;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const looksLikeName = namePattern.test(line) || 
                           (line.split(/\s+/).length >= 2 && line.split(/\s+/).length <= 5 && 
                            /[A-Z]/.test(line) && !EMAIL_REGEX.test(line) && !PHONE_REGEX.test(line));
      
      if (looksLikeName) {
        // Collect surrounding lines (up to 6 lines after)
        const blockLines = [line];
        for (let j = i + 1; j < Math.min(i + 7, lines.length); j++) {
          blockLines.push(lines[j].trim());
        }
        const block = blockLines.join("\n");
        // Only add if it has email or phone
        if (EMAIL_REGEX.test(block) || PHONE_REGEX.test(block)) {
          blocks.push(block);
        }
      }
    }
  }
  
  console.log(`[parse-contact-pdf] Detected ${blocks.length} contact blocks`);
  
  return blocks;
}

/**
 * Parse a contact block using the same logic as parseContactText
 * This reuses the quick add parsing logic for consistency
 */
function parseContactBlock(block: string): DocumentContact | null {
  // Extract all emails and phones (there might be multiple per block)
  // Handle concatenated emails (e.g., "cguerrette@insomniacookies.comkdiaz@insomniacookies.com")
  let blockText = block;
  
  // Split concatenated emails (email.com followed by lowercase letters is likely concatenated)
  blockText = blockText.replace(/([a-z0-9]+@[a-z0-9.-]+\.[a-z]{2,})([a-z])/gi, '$1 $2');
  
  const allEmails = blockText.match(EMAIL_REGEX) || [];
  const allPhones = blockText.match(PHONE_REGEX) || [];
  
  // For now, take the first email and phone (we'll handle multiple contacts per block separately)
  const email = allEmails[0] || null;
  const phone = allPhones[0] || null;
  
  // If multiple emails/phones in one block, this might be multiple contacts
  // We'll handle that by splitting the block
  if (allEmails.length > 1 || allPhones.length > 1) {
    console.log(`[parse-contact-pdf] Block has multiple contacts: ${allEmails.length} emails, ${allPhones.length} phones`);
  }
  
  // Use blockText for further parsing (with fixed concatenated emails)
  block = blockText;
  
  // Use a simplified version of parseContactText logic
  // Extract role first (has clear patterns)
  let role: string | null = null;
  
  // VP pattern
  const vpPattern = /\b(vp|v\.?p\.?)(?:\s+of\s+([a-z]+(?:\s+[a-z]+)*))?/i;
  const vpMatch = block.match(vpPattern);
  if (vpMatch) {
    role = vpMatch[2] ? `VP Of ${vpMatch[2]}` : "VP";
    role = role.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
  }
  
  // Common role titles
  if (!role) {
    const roleTitles = /\b(ceo|cto|cfo|president|director|manager|engineer|designer|developer|analyst|coordinator|specialist|consultant|advisor|lead|officer|executive)\b/i;
    const roleMatch = block.match(roleTitles);
    if (roleMatch) {
      // Try to get domain prefix (e.g., "Marketing Manager")
      const beforeRole = block.substring(Math.max(0, (roleMatch.index || 0) - 30), roleMatch.index || 0);
      const domainMatch = beforeRole.match(/([a-z]+)\s*$/i);
      if (domainMatch && !/\b(at|from|works|handles|manages|leads)\b/i.test(domainMatch[1])) {
        role = `${domainMatch[1]} ${roleMatch[1]}`;
      } else {
        role = roleMatch[1];
      }
      role = role.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
    }
  }
  
  // Extract company (look for "works for", "at", "@" patterns, or extract from email domain)
  let company: string | null = null;
  const worksForMatch = block.match(/\bworks?\s+for\s+([A-Z][A-Za-z0-9\s&]+(?:Inc\.?|LLC\.?|Ltd\.?|Corp\.?|Corporation|Company|Co\.?|Group|Technologies|Tech|Solutions|Systems)?)/i);
  if (worksForMatch) {
    company = worksForMatch[1].trim();
  } else {
    const atMatch = block.match(/(?:at|from|@)\s+([A-Z][A-Za-z0-9\s&]+(?:Inc\.?|LLC\.?|Ltd\.?|Corp\.?|Corporation|Company|Co\.?|Group|Technologies|Tech|Solutions|Systems)?)/i);
    if (atMatch) {
      company = atMatch[1].trim();
    } else if (email) {
      // Try domain extraction - extract company name from email domain
      const domain = email.split("@")[1];
      if (domain && !domain.includes("gmail") && !domain.includes("yahoo") && 
          !domain.includes("hotmail") && !domain.includes("outlook") &&
          !domain.includes("icloud") && !domain.includes("protonmail")) {
        // Extract company name from domain (e.g., "insomniacookies.com" -> "Insomniacookies")
        const domainParts = domain.split(".");
        if (domainParts.length > 0) {
          const domainName = domainParts[0];
          // Capitalize properly
          company = domainName.charAt(0).toUpperCase() + domainName.slice(1);
          // Handle camelCase domains
          company = company.replace(/([a-z])([A-Z])/g, '$1 $2');
        }
      }
    }
  }
  
  // Extract name - FIRST try to extract from the name+phone pattern that was used to detect this block
  // Pattern: "FirstNameLastName:phone" or "FirstName LastName:phone" or "Raynard Howard :+1(202)436-6981"
  // Handles concatenated names like "RaynardHoward" and spaced names like "Raynard Howard"
  // Also handles space before colon: "Name :+1(202)436-6981"
  // IMPORTANT: Don't require ^ anchor - name+phone might be in the middle of a line with address text before it
  const namePhonePattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*:?\s*\+?1?\s*\(?\d{3}\)?\s*-?\s*\d{3}\s*-?\s*\d{4}/;
  const namePhoneMatch = block.match(namePhonePattern);
  
  let name = "";
  if (namePhoneMatch && namePhoneMatch[1]) {
    // Found name from name+phone pattern - this is the most reliable source
    name = namePhoneMatch[1].trim();
    // Fix concatenated names (e.g., "RaynardHoward" -> "Raynard Howard")
    name = name.replace(/([a-z])([A-Z])/g, '$1 $2');
  } else {
    // Try to find name in first line or lines before email/phone
    const lines = block.split("\n").filter(l => l.trim());
    
    // Look for name in first few lines (before email/phone lines)
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i];
      
      // Skip lines that are clearly not names (emails, phones, addresses starting with numbers)
      if (EMAIL_REGEX.test(line) || PHONE_REGEX.test(line) || 
          /^\d+\s/.test(line) || // Address starting with number
          /^\(/.test(line) || // Lines starting with parenthesis (role)
          (line.toLowerCase().includes('manager') && !/^[A-Z]/.test(line))) {
        continue;
      }
      
      // Look for name pattern: "FirstName LastName" or "FirstNameLastName"
      // Also handle "FirstNameLastName:" format
      const namePattern = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/;
      const nameMatch = line.match(namePattern);
      if (nameMatch && nameMatch[1]) {
        name = nameMatch[1].trim();
        // Fix concatenated names
        name = name.replace(/([a-z])([A-Z])/g, '$1 $2');
        break;
      }
      
      // Try "FirstNameLastName:" format (common in contact sheets)
      const concatenatedNamePattern = /^([A-Z][a-z]+[A-Z][a-zA-Z]+):/;
      const concatMatch = line.match(concatenatedNamePattern);
      if (concatMatch && concatMatch[1]) {
        name = concatMatch[1].trim();
        // Fix concatenated names
        name = name.replace(/([a-z])([A-Z])/g, '$1 $2');
        break;
      }
      
      // Try single capitalized word followed by colon (might be name)
      const singleNamePattern = /^([A-Z][a-z]{2,}):/;
      const singleMatch = line.match(singleNamePattern);
      if (singleMatch && singleMatch[1] && singleMatch[1].length > 2 && 
          !['Store', 'Address', 'Contact', 'Email', 'Phone', 'Manager', 'Director'].includes(singleMatch[1])) {
        name = singleMatch[1].trim();
        break;
      }
    }
  }
  
  // If still no name, try extracting from remaining text after removing email/phone
  if (!name) {
    let cleanText = block;
    if (email) cleanText = cleanText.replace(email, "");
    if (phone) cleanText = cleanText.replace(PHONE_REGEX, "");
    if (role) {
      const escapedRole = role.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      cleanText = cleanText.replace(new RegExp(escapedRole, "gi"), "");
    }
    if (company) {
      const escapedCompany = company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      cleanText = cleanText.replace(new RegExp(escapedCompany, "gi"), "");
    }
    
    // Remove role titles
    cleanText = cleanText.replace(/\b(VP|V\.?P\.?|CEO|CTO|CFO|President|Director|Manager|Engineer|Designer|Developer|Analyst|Coordinator|Specialist|Consultant|Advisor|Lead|Officer|Executive)\b/gi, "");
    
    // Clean up separators
    cleanText = cleanText.replace(/[-–—|•,;]/g, " ").trim();
    
    // Extract name from remaining text (first 2-4 words that look like a name)
    const words = cleanText.split(/\s+/).filter(Boolean);
    const nameWords: string[] = [];
    const stopKeywords = new Set(["at", "from", "works", "handles", "manages", "leads", "and", "or", "but", "for", "with", "on"]);
    
    for (let i = 0; i < Math.min(words.length, 4); i++) {
      const word = words[i];
      const wordLower = word.toLowerCase();
      
      if (stopKeywords.has(wordLower)) break;
      if (/^[A-Z]/.test(word) || (i < 2 && /^[a-z]{2,}$/i.test(word))) {
        nameWords.push(word);
      } else if (nameWords.length > 0) {
        break;
      }
    }
    
    name = nameWords.join(" ");
  }
  
  // Fallback to email prefix if no name found
  if (!name && email) {
    name = email.split("@")[0].replace(/[._-]/g, " ").split(/\s+/).map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" ");
  }
  
  // Validate extracted data - reject if it looks like PDF metadata
  const isMetadataName = (n: string): boolean => {
    const lower = n.toLowerCase();
    
    // PDF date format
    if (/^d:\d{14}[\+\-]/.test(lower)) return true;
    // Object references
    if (/^\d+\s+\d+\s+r$/.test(lower)) return true;
    // PDF library names and metadata
    const pdfMetadata = [
      'reportlab', 'pdf', 'adobe', 'acrobat', 'creator', 'producer', 'title', 'subject',
      'author', 'keywords', 'creationdate', 'moddate', 'trapped', 'pdfx', 'pdfa',
      'itext', 'fpdf', 'pycairo', 'cairo', 'poppler', 'xpdf', 'ghostscript', 'gs',
      'document', 'page', 'object', 'stream', 'xref', 'trailer', 'catalog'
    ];
    if (pdfMetadata.some(meta => lower.includes(meta) && lower.length < 30)) return true;
    // Very short or all special chars
    if (n.length <= 2 && !/[a-zA-Z]/.test(n)) return true;
    // All numbers/special chars (likely coordinates)
    if (!/[a-zA-Z]/.test(n) && n.length < 10) return true;
    // Looks like a filename
    if (/\.(pdf|jpg|png|gif|tiff|bmp)$/i.test(n)) return true;
    return false;
  };
  
  // Reject if name looks like metadata
  if (name && isMetadataName(name)) {
    console.warn(`[parse-contact-pdf] Rejected contact with metadata-like name: "${name}"`);
    return null;
  }
  
  // Require at least name or email/phone
  if (!name && !email && !phone) return null;
  
  // Fallback name (but validate it's not metadata)
  if (!name) {
    if (email) name = email.split("@")[0];
    else if (phone) name = `Contact ${phone.substring(0, 4)}`;
    else name = "Unknown Contact";
  }
  
  // Final validation - name must have at least one letter
  if (name && !/[a-zA-Z]/.test(name) && name !== "Unknown Contact") {
    console.warn(`[parse-contact-pdf] Rejected contact with invalid name: "${name}"`);
    return null;
  }
  
  // Reject names that are PDF operators (common false positives from PDF extraction)
  const pdfOperators = new Set(['Tf', 'Td', 'TJ', 'Tj', 'BT', 'ET', 'Tm', 'T*', 'Tc', 'Tw', 'Tz', 'TL', 'Ts', 'Tr', 'Tg', 'TK']);
  if (name && pdfOperators.has(name.trim())) {
    console.warn(`[parse-contact-pdf] Rejected contact with PDF operator name: "${name}"`);
    // If name is a PDF operator, try to extract from email instead
    if (email) {
      name = email.split("@")[0].replace(/[._-]/g, " ");
    } else {
      return null;
    }
  }
  
  return {
    name: formatName(name),
    email,
    phone: phone ? formatPhoneNumber(phone) : null,
    company,
    role,
  };
}

function parseDocumentContacts(text: string): DocumentContact[] {
  const cleanedText = cleanDocumentText(text);
  if (!cleanedText || cleanedText.length < 5) {
    console.log('[parse-contact-pdf] Text too short or empty');
    return [];
  }
  
  console.log(`[parse-contact-pdf] Parsing document, text length: ${cleanedText.length}`);
  console.log(`[parse-contact-pdf] First 500 chars: ${cleanedText.substring(0, 500)}`);
  
  // Check vCard
  if (/BEGIN:VCARD/i.test(cleanedText)) {
    console.log('[parse-contact-pdf] Detected vCard format');
    return parseVCards(cleanedText);
  }
  
  // Check table format (most likely for contact sheets)
  const tableInfo = detectTableFormat(cleanedText);
  if (tableInfo.isTable) {
    console.log(`[parse-contact-pdf] Detected table format with delimiter: ${tableInfo.delimiter}, headers: ${tableInfo.headers.length}`);
    const tableContacts = parseTableFormat(cleanedText, tableInfo.delimiter, tableInfo.headers);
    console.log(`[parse-contact-pdf] Parsed ${tableContacts.length} contacts from table`);
    
    // If table parsing found few contacts but we have many emails/phones, try freeform as well
    const emailCount = (cleanedText.match(EMAIL_REGEX) || []).length;
    const phoneCount = (cleanedText.match(PHONE_REGEX) || []).length;
    if (tableContacts.length < emailCount / 2 && emailCount > 5) {
      console.log(`[parse-contact-pdf] Table parsing found ${tableContacts.length} contacts but ${emailCount} emails found. Trying freeform extraction as well...`);
      const freeformBlocks = detectContactBlocks(cleanedText);
      const freeformContacts: DocumentContact[] = [];
      for (const block of freeformBlocks) {
        const contact = parseContactBlock(block);
        if (contact) {
          freeformContacts.push(contact);
        }
      }
      console.log(`[parse-contact-pdf] Freeform extraction found ${freeformContacts.length} additional contacts`);
      // Combine and deduplicate (prefer table contacts)
      const allContacts = [...tableContacts, ...freeformContacts];
      // Simple deduplication by email
      const seen = new Set<string>();
      const uniqueContacts = allContacts.filter(c => {
        if (c.email && seen.has(c.email.toLowerCase())) return false;
        if (c.email) seen.add(c.email.toLowerCase());
        return true;
      });
      return uniqueContacts;
    }
    
    return tableContacts;
  }
  
  // Freeform blocks
  console.log('[parse-contact-pdf] Using freeform block detection');
  const blocks = detectContactBlocks(cleanedText);
  console.log(`[parse-contact-pdf] Found ${blocks.length} contact blocks`);
  
  const contacts: DocumentContact[] = [];
  
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    console.log(`[parse-contact-pdf] Parsing block ${i + 1}/${blocks.length}, length: ${block.length}, preview: ${block.substring(0, 100)}`);
    
    // Check if block has multiple contacts (multiple name+phone patterns or multiple emails)
    // Pattern to match: "RaynardHoward:+1(202)436-6981" or "Raynard Howard :+1(202)436-6981"
    const namePhonePattern = /[A-Z][a-z]+(?:[A-Z][a-z]+)*(?:\s+[A-Z][a-z]+)*\s*:?\s*\+?1?\s*\(?\d{3}\)?\s*-?\s*\d{3}\s*-?\s*\d{4}/g;
    const namePhoneMatches = block.match(namePhonePattern) || [];
    const emails = block.match(EMAIL_REGEX) || [];
    
    console.log(`[parse-contact-pdf] Block ${i + 1} analysis: ${namePhoneMatches.length} name+phone patterns, ${emails.length} emails`);
    
    // If multiple name+phone patterns or multiple emails, split into separate contacts
    if (namePhoneMatches.length > 1 || (emails.length > 1 && namePhoneMatches.length >= 1)) {
      console.log(`[parse-contact-pdf] Block ${i + 1} has multiple contacts - splitting...`);
      
      // Split block by name+phone patterns - each pattern starts a new contact
      const lines = block.split("\n");
      let currentContactLines: string[] = [];
      const extractedContacts: DocumentContact[] = [];
      
      for (let j = 0; j < lines.length; j++) {
        const line = lines[j];
        // Check if line has name+phone pattern (use non-global match for single line)
        // Handle space before colon: "Raynard Howard :+1(202)436-6981"
        const lineNamePhonePattern = /^[A-Z][a-z]+(?:[A-Z][a-z]+)*(?:\s+[A-Z][a-z]+)*\s*:?\s*\+?1?\s*\(?\d{3}\)?\s*-?\s*\d{3}\s*-?\s*\d{4}/;
        const hasNamePhone = lineNamePhonePattern.test(line);
        const hasEmail = EMAIL_REGEX.test(line);
        
        if (hasNamePhone) {
          // New contact starting - save previous if exists
          if (currentContactLines.length > 0) {
            const contact = parseContactBlock(currentContactLines.join("\n"));
            if (contact) {
              console.log(`[parse-contact-pdf] Extracted contact from block ${i + 1}: ${contact.name}`);
              extractedContacts.push(contact);
            }
          }
          currentContactLines = [line];
        } else if (hasEmail && currentContactLines.length > 0) {
          // Email line - add to current contact
          currentContactLines.push(line);
          // Check if next line starts a new contact, if so finish this one
          const nextLine = j + 1 < lines.length ? lines[j + 1] : '';
          if (lineNamePhonePattern.test(nextLine)) {
            const contact = parseContactBlock(currentContactLines.join("\n"));
            if (contact) {
              console.log(`[parse-contact-pdf] Extracted contact from block ${i + 1}: ${contact.name}`);
              extractedContacts.push(contact);
            }
            currentContactLines = [];
          }
        } else if (currentContactLines.length > 0) {
          // Continue current contact (limit to 8 lines per contact for multi-line entries)
          if (currentContactLines.length < 8) {
            currentContactLines.push(line);
          } else {
            // Contact block getting long, finish it
            const contact = parseContactBlock(currentContactLines.join("\n"));
            if (contact) {
              console.log(`[parse-contact-pdf] Extracted contact from block ${i + 1}: ${contact.name}`);
              extractedContacts.push(contact);
            }
            currentContactLines = [];
          }
        }
      }
      
      // Handle last contact
      if (currentContactLines.length > 0) {
        const contact = parseContactBlock(currentContactLines.join("\n"));
        if (contact) {
          console.log(`[parse-contact-pdf] Extracted contact from block ${i + 1}: ${contact.name}`);
          extractedContacts.push(contact);
        }
      }
      
      contacts.push(...extractedContacts);
      console.log(`[parse-contact-pdf] Extracted ${extractedContacts.length} contacts from block ${i + 1}`);
    } else {
      // Single contact in block
      const contact = parseContactBlock(block);
      if (contact) {
        console.log(`[parse-contact-pdf] Extracted contact: ${contact.name} (${contact.email || contact.phone || 'no contact info'})`);
        contacts.push(contact);
      } else {
        console.warn(`[parse-contact-pdf] Block ${i + 1} did not yield a contact`);
      }
    }
  }
  
  console.log(`[parse-contact-pdf] Total contacts extracted: ${contacts.length}`);
  return contacts;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create Supabase client with service role key for authentication
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Manually verify JWT token from Authorization header
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body = await req.json();
    console.log('[parse-contact-pdf] Request body keys:', Object.keys(body));
    
    // Support pre-extracted text or base64 input
    let extractedText = body.extractedText || body.text;
    const pdfBase64 = body.pdfBase64;
    const mimeType = body.mimeType || 'application/pdf';
    
    console.log('[parse-contact-pdf] Input check:', {
      hasExtractedText: !!extractedText,
      hasPdfBase64: !!pdfBase64,
      mimeType,
      extractedTextLength: extractedText?.length || 0,
      pdfBase64Length: pdfBase64?.length || 0,
    });
    
    // If text is already extracted (client-side), use it directly
    if (extractedText && typeof extractedText === 'string' && extractedText.trim().length > 0) {
      console.log('[parse-contact-pdf] Using pre-extracted text from client (pdfjs-dist)');
      console.log('[parse-contact-pdf] Extracted text length:', extractedText.length);
      console.log('[parse-contact-pdf] Text preview (first 500 chars):', extractedText.substring(0, 500));
      
      // Count potential contacts
      const emailCount = (extractedText.match(EMAIL_REGEX) || []).length;
      const phoneCount = (extractedText.match(PHONE_REGEX) || []).length;
      console.log(`[parse-contact-pdf] Found ${emailCount} emails and ${phoneCount} phones in extracted text`);
    }
    // If base64 is provided and no text extracted yet, extract text from it (for PDFs)
    else if (!extractedText && pdfBase64 && mimeType === 'application/pdf') {
      try {
        console.log('[parse-contact-pdf] Attempting to extract text from PDF base64...');
        
        // Decode base64 to buffer
        const pdfBuffer = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));
        console.log('[parse-contact-pdf] PDF buffer size:', pdfBuffer.length);
        
        // Convert to string for text extraction (PDFs contain text in streams)
        const textDecoder = new TextDecoder('latin1', { fatal: false });
        const decoded = textDecoder.decode(pdfBuffer);
        
        // Extract text from PDF text objects (between parentheses in text streams)
        const textMatches: string[] = [];
        
        // Filter out PDF metadata patterns and library names
        const isMetadata = (text: string): boolean => {
          const lower = text.toLowerCase();
          
          // PDF date format: D:YYYYMMDDHHmmSSOHH'mm'
          if (/^d:\d{14}[\+\-]\d{2}'?\d{2}'?/.test(lower)) return true;
          // PDF object references
          if (/^\d+\s+\d+\s+r$/.test(lower)) return true;
          // PDF stream filters
          if (/^(flatedecode|dctdecode|ccittfaxdecode|runlengthdecode|lzwdecode|ascii85decode|asciihexdecode)/.test(lower)) return true;
          // PDF library names and common metadata
          const pdfLibraryNames = [
            'reportlab', 'pdf', 'adobe', 'acrobat', 'creator', 'producer', 'title', 'subject',
            'author', 'keywords', 'creationdate', 'moddate', 'trapped', 'pdfx', 'pdfa',
            'itext', 'fpdf', 'pycairo', 'cairo', 'poppler', 'xpdf', 'ghostscript', 'gs'
          ];
          if (pdfLibraryNames.some(lib => lower.includes(lib))) return true;
          // Very short text that's likely metadata
          if (text.length <= 2 && !/[a-zA-Z]/.test(text)) return true;
          // Text that's all numbers/special chars (likely coordinates or metadata)
          if (!/[a-zA-Z]/.test(text) && text.length < 10) return true;
          // Text that looks like a filename or path
          if (/\.(pdf|jpg|png|gif|tiff|bmp)$/i.test(text)) return true;
          return false;
        };
        
        // Method 1: Extract text from (text) patterns - preserve line structure
        const parenMatches = decoded.match(/\(([^)]+)\)/g) || [];
        for (const match of parenMatches) {
          const text = match.slice(1, -1); // Remove parentheses
          // Decode PDF string escapes
          let decodedText = text
            .replace(/\\n/g, '\n')  // Preserve newlines for structure
            .replace(/\\r/g, '\n')
            .replace(/\\t/g, '\t')
            .replace(/\\([0-7]{1,3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)))
            .replace(/\\/g, '');
          
          // Filter out PDF operators and formatting that gets mixed into text
          // Skip text that's clearly PDF formatting
          if (/^\/[A-Za-z]+\s+\d+\s+Tf/.test(decodedText)) continue; // Font commands
          if (/^\d+\s+\d+\s+T[fdm\*]/i.test(decodedText)) continue; // Text positioning
          if (/^[BTET]\s*$/.test(decodedText)) continue; // Text block operators
          if (/^\d+\s+\d+\s+R$/.test(decodedText)) continue; // Object references
          
          // Filter out metadata and very short/garbled text
          if (decodedText.length > 1 && 
              !isMetadata(decodedText) && 
              /[a-zA-Z0-9@.]/.test(decodedText) &&  // Must contain letters, numbers, email chars
              decodedText.length >= 2) {
            textMatches.push(decodedText);
          }
        }
        
        // Method 2: Extract from text between BT (Begin Text) and ET (End Text) operators
        if (textMatches.length === 0) {
          const btEtBlocks = decoded.match(/BT[\s\S]*?ET/g) || [];
          for (const block of btEtBlocks) {
            const blockTexts = block.match(/\(([^)]+)\)/g) || [];
            for (const textMatch of blockTexts) {
              const text = textMatch.slice(1, -1);
              const decodedText = text
                .replace(/\\n/g, '\n')  // Preserve newlines
                .replace(/\\r/g, '\n')
                .replace(/\\t/g, '\t')
                .replace(/\\([0-7]{1,3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)))
                .replace(/\\/g, '');
              
              // Filter out metadata
              if (decodedText.length > 1 && 
                  !isMetadata(decodedText) && 
                  /[a-zA-Z0-9@.]/.test(decodedText)) {
                textMatches.push(decodedText);
              }
            }
          }
        }
        
        // Join with newlines to preserve structure (important for tables/contact lists)
        extractedText = textMatches
          .filter(text => {
            const trimmed = text.trim();
            // Additional filtering: must have meaningful content
            return trimmed.length > 0 && 
                   !isMetadata(trimmed) &&
                   (trimmed.length >= 3 || EMAIL_REGEX.test(trimmed) || PHONE_REGEX.test(trimmed));
          })
          .join('\n')  // Use newlines instead of spaces to preserve structure
          .replace(/\n{3,}/g, '\n\n')  // Normalize multiple newlines
          .trim();
        
        console.log('[parse-contact-pdf] Extracted text length:', extractedText.length);
        console.log('[parse-contact-pdf] Extracted text preview (first 500 chars):', extractedText.substring(0, 500));
        console.log('[parse-contact-pdf] Extracted text preview (last 500 chars):', extractedText.substring(Math.max(0, extractedText.length - 500)));
        
        // Count potential contacts (emails/phones)
        const emailCount = (extractedText.match(EMAIL_REGEX) || []).length;
        const phoneCount = (extractedText.match(PHONE_REGEX) || []).length;
        console.log(`[parse-contact-pdf] Found ${emailCount} emails and ${phoneCount} phones in extracted text`);
        
        if (!extractedText || extractedText.length < 10) {
          console.warn('[parse-contact-pdf] Very little text extracted, PDF might be image-based or encrypted');
        } else if (emailCount === 0 && phoneCount === 0) {
          console.warn('[parse-contact-pdf] No emails or phones found in extracted text - may be extraction issue');
        }
      } catch (extractError) {
        console.error('[parse-contact-pdf] Error extracting text from PDF:', extractError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Failed to extract text from PDF: ${extractError instanceof Error ? extractError.message : 'Unknown error'}`,
            details: 'The PDF might be image-based, encrypted, or corrupted. Please ensure it contains readable text.'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // For images, we can't extract text without OCR
    if (!extractedText && pdfBase64 && mimeType.startsWith('image/')) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Image OCR is not supported. Please use a PDF with readable text or extract text manually.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!extractedText || typeof extractedText !== 'string' || extractedText.trim().length === 0) {
      console.error('[parse-contact-pdf] No text extracted from document');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No readable text found in document. The PDF might be image-based, encrypted, or contain no text content.',
          suggestion: 'Please ensure the PDF contains selectable text (not just images). For contact sheets, consider exporting as CSV and using the file import feature instead.'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Additional validation: check if extracted text looks like actual content
    const emailCount = (extractedText.match(EMAIL_REGEX) || []).length;
    const phoneCount = (extractedText.match(PHONE_REGEX) || []).length;
    const hasReadableText = /[a-zA-Z]{3,}/.test(extractedText); // At least one 3+ letter word
    
    if (!hasReadableText && emailCount === 0 && phoneCount === 0) {
      console.error('[parse-contact-pdf] Extracted text does not appear to contain readable contact information');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'The PDF text extraction did not find readable contact information. The PDF may be image-based or have complex formatting.',
          suggestion: 'For contact sheets with many contacts, we recommend exporting as CSV format and using the file import feature for better results.'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[parse-contact-pdf] Deterministic parsing document text, length:', extractedText.length);
    console.log('[parse-contact-pdf] Text preview (first 500 chars):', extractedText.substring(0, 500));

    const contacts = parseDocumentContacts(extractedText);

    console.log(`[parse-contact-pdf] Extracted ${contacts.length} contacts`);
    if (contacts.length > 0) {
      console.log('[parse-contact-pdf] Sample contact:', JSON.stringify(contacts[0], null, 2));
    } else {
      console.warn('[parse-contact-pdf] No contacts found. Text sample:', extractedText.substring(0, 1000));
    }

    // Include debug information in response (extracted text) to help diagnose parsing issues
    const includeDebug = body.debug === true;
    const response: any = { success: true, contacts };
    
    if (includeDebug || contacts.length === 0) {
      // Always include debug info if no contacts found, or if explicitly requested
      response.debug = {
        extractedTextLength: extractedText.length,
        extractedTextPreview: extractedText.substring(0, 2000), // First 2000 chars
        extractedTextFull: extractedText, // Full text for debugging
        emailCount: (extractedText.match(EMAIL_REGEX) || []).length,
        phoneCount: (extractedText.match(PHONE_REGEX) || []).length,
      };
    }

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error parsing document:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to parse document' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
