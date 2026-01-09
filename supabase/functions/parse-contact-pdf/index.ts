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
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/[ \t]+/g, " ").split("\n").map(line => line.trim()).join("\n").trim();
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
  
  // First, try splitting by double newlines or separator lines
  const parts = text.split(BLOCK_SEPARATORS);
  
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const hasEmail = EMAIL_REGEX.test(trimmed);
    const hasPhone = PHONE_REGEX.test(trimmed);
    if (hasEmail || hasPhone) {
      // If this part has multiple emails/phones, split it further
      const emails = trimmed.match(EMAIL_REGEX);
      const phones = trimmed.match(PHONE_REGEX);
      const totalContacts = Math.max(emails?.length || 0, phones?.length || 0);
      
      if (totalContacts > 1) {
        // Multiple contacts in one block - split by email/phone occurrences
        const lines = trimmed.split("\n");
        let currentBlock: string[] = [];
        
        for (const line of lines) {
          const lineHasEmail = EMAIL_REGEX.test(line);
          const lineHasPhone = PHONE_REGEX.test(line);
          
          if (lineHasEmail || lineHasPhone) {
            // New contact starts here
            if (currentBlock.length > 0) {
              blocks.push(currentBlock.join("\n"));
            }
            currentBlock = [line];
          } else if (currentBlock.length > 0) {
            // Continue current contact (limit to 8 lines per contact)
            if (currentBlock.length < 8) {
              currentBlock.push(line);
            } else {
              // Contact block is getting too long, save it and start new
              blocks.push(currentBlock.join("\n"));
              currentBlock = [];
            }
          }
        }
        
        if (currentBlock.length > 0) {
          blocks.push(currentBlock.join("\n"));
        }
      } else {
        // Single contact in this block
        blocks.push(trimmed);
      }
    }
  }
  
  // If no blocks found from separator splitting, try line-by-line
  if (blocks.length === 0) {
    const lines = text.split("\n").filter(l => l.trim());
    let currentBlock: string[] = [];
    
    for (const line of lines) {
      const hasEmail = EMAIL_REGEX.test(line);
      const hasPhone = PHONE_REGEX.test(line);
      
      if (hasEmail || hasPhone) {
        // New contact - save previous if exists
        if (currentBlock.length > 0) {
          blocks.push(currentBlock.join("\n"));
        }
        currentBlock = [line];
      } else if (currentBlock.length > 0) {
        // Continue building current contact
        // Limit to 6 lines per contact to avoid combining multiple contacts
        if (currentBlock.length < 6) {
          currentBlock.push(line);
        } else {
          // Block is getting long, save it and look for next contact
          blocks.push(currentBlock.join("\n"));
          currentBlock = [];
        }
      }
    }
    
    if (currentBlock.length > 0) {
      blocks.push(currentBlock.join("\n"));
    }
  }
  
  // If still no blocks, try pattern-based detection
  if (blocks.length === 0) {
    const lines = text.split("\n").filter(l => l.trim());
    
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
  const emails = block.match(EMAIL_REGEX);
  const phones = block.match(PHONE_REGEX);
  const email = emails?.[0] || null;
  const phone = phones?.[0] || null;
  
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
  
  // Extract company (look for "works for", "at", "@" patterns)
  let company: string | null = null;
  const worksForMatch = block.match(/\bworks?\s+for\s+([A-Z][A-Za-z0-9\s&]+(?:Inc\.?|LLC\.?|Ltd\.?|Corp\.?|Corporation|Company|Co\.?|Group|Technologies|Tech|Solutions|Systems)?)/i);
  if (worksForMatch) {
    company = worksForMatch[1].trim();
  } else {
    const atMatch = block.match(/(?:at|from|@)\s+([A-Z][A-Za-z0-9\s&]+(?:Inc\.?|LLC\.?|Ltd\.?|Corp\.?|Corporation|Company|Co\.?|Group|Technologies|Tech|Solutions|Systems)?)/i);
    if (atMatch) {
      company = atMatch[1].trim();
    } else if (email) {
      // Try domain extraction
      const domain = email.split("@")[1];
      if (domain && !domain.includes("gmail") && !domain.includes("yahoo") && 
          !domain.includes("hotmail") && !domain.includes("outlook")) {
        const name = domain.split(".")[0];
        company = name.charAt(0).toUpperCase() + name.slice(1);
      }
    }
  }
  
  // Extract name - remove email, phone, role, company first
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
  
  let name = nameWords.join(" ");
  
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
    const contact = parseContactBlock(block);
    if (contact) {
      console.log(`[parse-contact-pdf] Extracted contact: ${contact.name} (${contact.email || contact.phone || 'no contact info'})`);
      contacts.push(contact);
    } else {
      console.warn(`[parse-contact-pdf] Block ${i + 1} did not yield a contact`);
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
    
    // If base64 is provided, extract text from it (for PDFs)
    if (!extractedText && pdfBase64 && mimeType === 'application/pdf') {
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
          const decodedText = text
            .replace(/\\n/g, '\n')  // Preserve newlines for structure
            .replace(/\\r/g, '\n')
            .replace(/\\t/g, '\t')
            .replace(/\\([0-7]{1,3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)))
            .replace(/\\/g, '');
          
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

    return new Response(
      JSON.stringify({ success: true, contacts }),
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
