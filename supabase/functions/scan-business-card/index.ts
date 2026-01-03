import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Deterministic Business Card Scanner - Expects OCR text input
 * Rule-based extraction from text - NO AI/LLM
 * 
 * NOTE: This function now expects pre-extracted OCR text from the client.
 * Client-side OCR should be performed using Tesseract.js before calling this function.
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

// Regex patterns
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
const PHONE_PATTERNS = [
  /(?:tel|phone|mobile|cell|fax|office|direct)[:\s]*([+\d\s().-]{7,20})/gi,
  /\+\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g,
  /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g,
  /\d{3}[\s.-]\d{3}[\s.-]\d{4}/g,
];

const ROLE_TITLES = [
  "chief executive officer", "chief technology officer", "chief financial officer",
  "ceo", "cto", "cfo", "coo", "cmo", "president", "vice president", "vp",
  "director", "manager", "lead", "head", "founder", "partner", "consultant",
  "engineer", "developer", "designer", "specialist", "coordinator", "analyst"
];

const COMPANY_SUFFIXES = /\b(Inc\.?|LLC\.?|Ltd\.?|Corp\.?|Corporation|Company|Co\.?|Group|Holdings|Partners|Solutions|Technologies|Tech|Systems|Enterprises)\b/i;

function cleanOCRText(text: string): string {
  return text.replace(/[|]/g, "I").replace(/[`'']/g, "'").replace(/[""]/g, '"').replace(/\s+/g, " ").trim();
}

function splitIntoBlocks(text: string): string[] {
  return text.split(/[\n\r]+/).map(line => line.trim()).filter(line => line.length > 0);
}

function extractEmail(text: string): string | null {
  const match = text.match(EMAIL_REGEX);
  return match ? match[0].toLowerCase() : null;
}

function extractPhone(text: string): string | null {
  for (const pattern of PHONE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const phoneStr = match[1] || match[0];
      const digits = phoneStr.replace(/\D/g, "");
      if (digits.length >= 7 && digits.length <= 15) return phoneStr;
    }
  }
  return null;
}

function extractCompany(blocks: string[], email: string | null): string | null {
  if (email) {
    const domain = email.split("@")[1];
    if (domain) {
      const personalDomains = ["gmail", "yahoo", "hotmail", "outlook", "icloud", "aol", "mail"];
      const mainDomain = domain.split(".")[0];
      if (!personalDomains.some(pd => mainDomain.includes(pd))) {
        return mainDomain.charAt(0).toUpperCase() + mainDomain.slice(1);
      }
    }
  }
  
  for (const block of blocks) {
    const cleaned = block.replace(EMAIL_REGEX, "").trim();
    if (COMPANY_SUFFIXES.test(cleaned)) return cleaned;
  }
  
  return null;
}

function extractRole(blocks: string[]): string | null {
  const textLower = blocks.join(" ").toLowerCase();
  for (const title of ROLE_TITLES) {
    const pattern = new RegExp(`\\b${title}\\b`, "i");
    for (const block of blocks) {
      const match = block.match(pattern);
      if (match) {
        return match[0].split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
      }
    }
  }
  return null;
}

function extractName(blocks: string[], email: string | null, company: string | null, role: string | null): string {
  const candidates: string[] = [];
  
  for (const block of blocks) {
    const cleaned = block.replace(EMAIL_REGEX, "").trim();
    if (cleaned.length < 2) continue;
    if (PHONE_PATTERNS.some(p => p.test(cleaned))) continue;
    if (email && cleaned.toLowerCase() === email.toLowerCase()) continue;
    if (company && cleaned.toLowerCase() === company.toLowerCase()) continue;
    if (role && cleaned.toLowerCase() === role.toLowerCase()) continue;
    if (COMPANY_SUFFIXES.test(cleaned)) continue;
    if (/^\d{3,}/.test(cleaned)) continue;
    
    const words = cleaned.split(/\s+/);
    if (words.length >= 1 && words.length <= 5) {
      const looksLikeName = words.every(w => /^[A-Z]/.test(w) || /^(van|von|de|del|della|der|di|du|la|le|lo)/i.test(w));
      if (looksLikeName && cleaned.length < 40) candidates.push(cleaned);
    }
  }
  
  if (candidates.length > 0) return candidates[0];
  
  if (email) {
    const localPart = email.split("@")[0];
    return localPart.replace(/[._-]/g, " ").split(/\s+/).map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" ");
  }
  
  return "";
}

function parseBusinessCard(ocrText: string): { name: string; email: string; phone: string; company: string; role: string } {
  const cleanedText = cleanOCRText(ocrText);
  const blocks = splitIntoBlocks(cleanedText);
  
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // Support both OCR text and legacy image input
    // For backwards compatibility, if imageBase64 is provided without ocrText,
    // we return an error explaining OCR must be done client-side
    const ocrText = body.ocrText || body.text;
    const imageBase64 = body.imageBase64;
    
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

    console.log("Deterministic parsing business card OCR text:", ocrText.substring(0, 200));

    const contact = parseBusinessCard(ocrText);

    console.log("Parsed contact:", contact);

    return new Response(
      JSON.stringify({ success: true, contact }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing business card:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to process business card" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
