import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
  
  return { isTable: false, delimiter: "", headers: [] };
}

function parseTableFormat(text: string, delimiter: string, headers: string[]): DocumentContact[] {
  const lines = text.split("\n").filter(l => l.trim());
  const contacts: DocumentContact[] = [];
  
  const lowerHeaders = headers.map(h => h.toLowerCase());
  const nameIdx = lowerHeaders.findIndex(h => h.includes("name") || h.includes("full"));
  const firstNameIdx = lowerHeaders.findIndex(h => h.includes("first"));
  const lastNameIdx = lowerHeaders.findIndex(h => h.includes("last"));
  const emailIdx = lowerHeaders.findIndex(h => h.includes("email"));
  const phoneIdx = lowerHeaders.findIndex(h => h.includes("phone") || h.includes("tel") || h.includes("mobile"));
  const companyIdx = lowerHeaders.findIndex(h => h.includes("company") || h.includes("org"));
  const roleIdx = lowerHeaders.findIndex(h => h.includes("title") || h.includes("role") || h.includes("position"));
  
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
  const parts = text.split(BLOCK_SEPARATORS);
  
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const hasEmail = EMAIL_REGEX.test(trimmed);
    const hasPhone = PHONE_REGEX.test(trimmed);
    if (hasEmail || hasPhone) blocks.push(trimmed);
  }
  
  if (blocks.length === 0) {
    const lines = text.split("\n").filter(l => l.trim());
    let currentBlock: string[] = [];
    
    for (const line of lines) {
      const hasEmail = EMAIL_REGEX.test(line);
      const hasPhone = PHONE_REGEX.test(line);
      
      if (hasEmail || hasPhone) {
        if (currentBlock.length > 0) blocks.push(currentBlock.join("\n"));
        currentBlock = [line];
      } else if (currentBlock.length > 0 && currentBlock.length < 6) {
        currentBlock.push(line);
      }
    }
    
    if (currentBlock.length > 0) blocks.push(currentBlock.join("\n"));
  }
  
  return blocks;
}

function parseContactBlock(block: string): DocumentContact | null {
  const emails = block.match(EMAIL_REGEX);
  const phones = block.match(PHONE_REGEX);
  const email = emails?.[0] || null;
  const phone = phones?.[0] || null;
  
  // Simple name extraction
  const lines = block.split("\n");
  let name = "";
  
  for (const line of lines) {
    const cleaned = line.replace(EMAIL_REGEX, "").replace(PHONE_REGEX, "").trim();
    if (cleaned.length >= 2 && cleaned.length < 50 && !cleaned.match(/^[\d\s\-().+]+$/)) {
      const words = cleaned.split(/\s+/);
      if (words.length >= 1 && words.length <= 5) {
        name = cleaned;
        break;
      }
    }
  }
  
  if (!name && email) {
    name = email.split("@")[0].replace(/[._-]/g, " ").split(/\s+/).map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" ");
  }
  
  if (!name) return null;
  
  return {
    name: formatName(name),
    email,
    phone: phone ? formatPhoneNumber(phone) : null,
    company: null,
    role: null,
  };
}

function parseDocumentContacts(text: string): DocumentContact[] {
  const cleanedText = cleanDocumentText(text);
  if (!cleanedText || cleanedText.length < 5) return [];
  
  // Check vCard
  if (/BEGIN:VCARD/i.test(cleanedText)) {
    return parseVCards(cleanedText);
  }
  
  // Check table format
  const tableInfo = detectTableFormat(cleanedText);
  if (tableInfo.isTable) {
    return parseTableFormat(cleanedText, tableInfo.delimiter, tableInfo.headers);
  }
  
  // Freeform blocks
  const blocks = detectContactBlocks(cleanedText);
  const contacts: DocumentContact[] = [];
  
  for (const block of blocks) {
    const contact = parseContactBlock(block);
    if (contact) contacts.push(contact);
  }
  
  return contacts;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // Support pre-extracted text or legacy base64 input
    const extractedText = body.extractedText || body.text;
    const pdfBase64 = body.pdfBase64;
    
    if (!extractedText && pdfBase64) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Server-side PDF parsing has been removed. Please extract text client-side using pdfjs-dist and send it in the 'extractedText' field." 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!extractedText || typeof extractedText !== 'string' || extractedText.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Extracted text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Deterministic parsing document text, length:', extractedText.length);

    const contacts = parseDocumentContacts(extractedText);

    console.log(`Extracted ${contacts.length} contacts`);

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
