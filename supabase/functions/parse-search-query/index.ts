import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { checkLaunchMode, waitlistModeBlockedResponse } from "../_shared/security.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Deterministic Search Query Parser - NO AI/LLM
 * Rule-based natural language query parsing
 */

// Action keywords that trigger specific actions
const ACTION_KEYWORDS: Record<string, string> = {
  email: "email",
  mail: "email",
  message: "email",
  send: "email",
  call: "call",
  phone: "call",
  ring: "call",
  dial: "call",
  text: "text",
  sms: "text",
};

// Question/intent detection patterns
const QUESTION_STARTERS = new Set([
  "who", "what", "where", "which", "find", "show", "get", 
  "search", "look", "can", "do", "does", "is", "are", "help",
  "list", "display", "give"
]);

// Role/department vocabulary
const ROLE_VOCABULARY = new Set([
  "hr", "sales", "marketing", "engineering", "finance", "legal", "operations",
  "support", "it", "tech", "product", "design", "research", "development",
  "ceo", "cto", "cfo", "coo", "vp", "director", "manager", "lead", "senior",
  "junior", "developer", "engineer", "designer", "analyst", "consultant"
]);

// Stop words
const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "as", "is", "was", "are", "were", "been",
  "be", "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "must", "shall", "can", "need", "our", "my",
  "your", "his", "her", "its", "their", "this", "that", "these", "those",
  "i", "you", "he", "she", "it", "we", "they", "someone", "anyone", "person"
]);

function normalizeQuery(query: string): string {
  return query.toLowerCase().trim().replace(/[?!.,;:]+$/g, "").replace(/\s+/g, " ");
}

function isQuestion(query: string): boolean {
  const normalized = normalizeQuery(query);
  if (query.trim().endsWith("?")) return true;
  const firstWord = normalized.split(" ")[0];
  return QUESTION_STARTERS.has(firstWord) || normalized.includes("someone") || normalized.includes("anyone");
}

interface Contact {
  name: string;
  role?: string;
  company?: string;
  description?: string;
  tags?: string[];
}

interface ParsedResult {
  isQuestion: boolean;
  intent: string;
  keywords: string[];
  matchingContactNames: string[];
  confidence: "high" | "medium" | "low";
}

function scoreContact(contact: Contact, searchTerms: string[]): number {
  let score = 0;
  const name = (contact.name || "").toLowerCase();
  const role = (contact.role || "").toLowerCase();
  const company = (contact.company || "").toLowerCase();
  const description = (contact.description || "").toLowerCase();
  const tags = (contact.tags || []).join(" ").toLowerCase();
  const allText = `${name} ${role} ${company} ${description} ${tags}`;
  
  for (const term of searchTerms) {
    if (name.includes(term)) score += 10;
    if (role.includes(term)) score += 8;
    if (tags.includes(term)) score += 7;
    if (description.includes(term)) score += 5;
    if (company.includes(term)) score += 4;
  }
  
  return score;
}

function parseSearchQuery(query: string, contacts: Contact[]): ParsedResult {
  const normalized = normalizeQuery(query);
  const words = normalized.split(" ").filter(Boolean);
  
  // Check for action prefix
  const firstWord = words[0];
  const isAction = firstWord && ACTION_KEYWORDS[firstWord];
  const searchWords = isAction ? words.slice(1) : words;
  
  // Extract keywords (non-stop words)
  const keywords = searchWords.filter(w => 
    w.length >= 2 && !STOP_WORDS.has(w) && !ACTION_KEYWORDS[w]
  );
  
  // Determine intent
  let intent = "search";
  if (isAction) {
    intent = `${ACTION_KEYWORDS[firstWord]} contact`;
  } else if (isQuestion(query)) {
    intent = "find matching contacts";
  }
  
  // Score contacts and find matches
  const scoredContacts = contacts
    .map(c => ({ contact: c, score: scoreContact(c, keywords) }))
    .filter(sc => sc.score >= 4)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  
  const matchingNames = scoredContacts.map(sc => sc.contact.name);
  
  // Determine confidence
  let confidence: "high" | "medium" | "low" = "low";
  if (scoredContacts.length > 0) {
    const topScore = scoredContacts[0].score;
    if (topScore >= 15) confidence = "high";
    else if (topScore >= 8) confidence = "medium";
  }
  
  return {
    isQuestion: isQuestion(query),
    intent,
    keywords,
    matchingContactNames: matchingNames,
    confidence,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Check launch mode - block in waitlist mode
  const { blocked } = checkLaunchMode();
  if (blocked) {
    const origin = req.headers.get("origin");
    return waitlistModeBlockedResponse(origin);
  }

  try {
    const { query, contacts } = await req.json();
    
    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sanitizedQuery = typeof query === 'string' ? query.slice(0, 500).trim() : '';
    if (!sanitizedQuery) {
      return new Response(
        JSON.stringify({ error: 'Invalid query' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Deterministic search for:', sanitizedQuery);

    // Use deterministic parsing - NO AI
    const result = parseSearchQuery(sanitizedQuery, contacts || []);

    console.log('Search result:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in parse-search-query:', error);
    return new Response(
      JSON.stringify({ error: 'Search failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
