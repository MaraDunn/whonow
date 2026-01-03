import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Deterministic Contact Text Parser - NO AI/LLM
 * Rule-based extraction from freeform text
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
  const apostropheIndex = word.indexOf("'");
  if (apostropheIndex > 0 && apostropheIndex < word.length - 1) {
    const before = word.slice(0, apostropheIndex);
    const after = word.slice(apostropheIndex + 1);
    return before.charAt(0).toUpperCase() + before.slice(1).toLowerCase() + "'" + after.charAt(0).toUpperCase() + after.slice(1).toLowerCase();
  }
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

// Format phone number into readable format
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
    let countryCode: string;
    let rest: string;
    if (digits.length <= 11) {
      countryCode = digits.slice(0, digits.length > 10 ? digits.length - 10 : 1);
      rest = digits.slice(countryCode.length);
    } else {
      countryCode = digits.slice(0, Math.min(3, digits.length - 9));
      rest = digits.slice(countryCode.length);
    }
    const groups: string[] = [];
    for (let i = 0; i < rest.length; i += 3) {
      groups.push(rest.slice(i, Math.min(i + 3, rest.length)));
    }
    return `+${countryCode} ${groups.join(' ')}`;
  }
  return trimmed;
}

// Regex patterns
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_PATTERNS = [
  /\+\d{1,3}[-.\s]?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g,
  /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
  /\d{2,4}[-.\s]\d{3,4}[-.\s]\d{3,4}/g,
  /\d{10,11}/g,
];

// Role detection
const ROLE_PATTERNS = [
  /(?:senior|junior|chief|principal|staff|lead)?\s*(?:ceo|cto|cfo|coo|cmo|president|director|manager|lead|head|founder|partner|consultant|engineer|developer|designer|analyst|specialist|coordinator)/gi,
];

// Company suffix detection
const COMPANY_SUFFIXES = /\b(Inc\.?|LLC\.?|Ltd\.?|Corp\.?|Corporation|Company|Co\.?|Group|Technologies|Tech|Solutions)\b/i;

function extractEmails(text: string): string[] {
  return text.match(EMAIL_REGEX) || [];
}

function extractPhones(text: string): string[] {
  const phones: string[] = [];
  for (const pattern of PHONE_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) phones.push(...matches);
  }
  const seen = new Set<string>();
  return phones.filter(p => {
    const digits = p.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) return false;
    if (seen.has(digits)) return false;
    seen.add(digits);
    return true;
  });
}

function extractCompany(text: string, email: string | null): string | null {
  // Try "at Company" pattern
  const prepMatch = text.match(/(?:at|from|@)\s+([A-Z][A-Za-z0-9\s&]+(?:Inc\.?|LLC\.?|Ltd\.?|Corp\.?)?)/i);
  if (prepMatch) return prepMatch[1].trim();
  
  // Try company suffix
  const suffixMatch = text.match(/([A-Z][A-Za-z0-9\s&]+(?:Inc\.?|LLC\.?|Ltd\.?|Corp\.?|Corporation|Company|Co\.?|Group|Technologies|Tech|Solutions))/i);
  if (suffixMatch) return suffixMatch[1].trim();
  
  // Try domain extraction
  if (email) {
    const domain = email.split("@")[1];
    if (domain && !["gmail", "yahoo", "hotmail", "outlook", "icloud", "aol"].some(d => domain.includes(d))) {
      const name = domain.split(".")[0];
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
  }
  
  return null;
}

function extractRole(text: string): string | null {
  for (const pattern of ROLE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return match[0].split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
  }
  return null;
}

function extractName(text: string, email: string | null): string {
  let cleanText = text;
  if (email) cleanText = cleanText.replace(email, "");
  for (const pattern of PHONE_PATTERNS) {
    cleanText = cleanText.replace(pattern, "");
  }
  cleanText = cleanText.replace(/[-–—|•,;]/g, " ").trim();
  
  const words = cleanText.split(/\s+/).filter(Boolean);
  const nameWords: string[] = [];
  
  for (const word of words) {
    if (/^(at|from|@|works|handles|manages|leads|senior|junior|marketing|sales|ceo|cto|cfo)$/i.test(word)) break;
    if (nameWords.length >= 2 && /^[a-z]/.test(word) && !word.match(/^(van|von|de|del|della|der|di|du|la|le|lo|mc|mac|o')$/i)) break;
    if (/^[A-Z]/.test(word) || /^(van|von|de|del|della|der|di|du|la|le|lo|mc|mac|o')/i.test(word)) {
      nameWords.push(word);
      if (nameWords.length >= 4) break;
    } else if (nameWords.length === 0) {
      nameWords.push(word);
    }
  }
  
  if (nameWords.length === 0 && email) {
    const emailPrefix = email.split("@")[0];
    return emailPrefix.replace(/[._-]/g, " ").split(/\s+/).map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" ");
  }
  
  return nameWords.join(" ") || "Unknown";
}

function generateKeywords(data: { role?: string | null; company?: string | null; description?: string | null }): string[] {
  const keywords: string[] = [];
  const seen = new Set<string>();
  
  const addKeyword = (word: string) => {
    const lower = word.toLowerCase();
    if (lower.length >= 3 && !seen.has(lower)) {
      seen.add(lower);
      keywords.push(lower);
    }
  };
  
  if (data.role) data.role.split(/\s+/).forEach(w => addKeyword(w));
  if (data.company) {
    const cleanCompany = data.company.replace(COMPANY_SUFFIXES, "").trim();
    cleanCompany.split(/\s+/).forEach(w => addKeyword(w));
  }
  if (data.description) {
    const stopWords = new Set(["the", "and", "for", "our", "all", "with", "has", "handles", "works", "manages"]);
    data.description.split(/\s+/).filter(w => !stopWords.has(w.toLowerCase()) && w.length >= 4).slice(0, 5).forEach(w => addKeyword(w));
  }
  
  return keywords.slice(0, 8);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { input } = await req.json();
    
    if (!input || typeof input !== "string" || input.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Input text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Deterministic parsing contact input:", input.substring(0, 100));

    const text = input.trim();
    const emails = extractEmails(text);
    const phones = extractPhones(text);
    const email = emails[0] || null;
    const phone = phones[0] || null;
    const company = extractCompany(text, email);
    const role = extractRole(text);
    const name = extractName(text, email);
    
    // Try to extract description (what's left)
    let description: string | null = null;
    const descPatterns = [/handles?\s+(.+)/i, /works?\s+(?:on|with)?\s*(.+)/i, /manages?\s+(.+)/i, /-\s*(.{10,})/];
    for (const pattern of descPatterns) {
      const match = text.match(pattern);
      if (match && match[1].trim().length > 5) {
        description = match[1].trim();
        break;
      }
    }
    
    const parsed = {
      name: formatName(name),
      email,
      phone: phone ? formatPhoneNumber(phone) : null,
      company,
      role,
      description,
      suggestedKeywords: generateKeywords({ role, company, description }),
    };

    console.log("Parsed result:", parsed);

    return new Response(
      JSON.stringify({ success: true, parsed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in parse-contact-input:", error);
    return new Response(
      JSON.stringify({ error: "Failed to parse contact information" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
