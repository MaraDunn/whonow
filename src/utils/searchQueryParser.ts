/**
 * Deterministic Search Query Parser
 * Rule-based natural language query parsing - NO AI/LLM
 */

import { 
  buildResponsibilityIndex, 
  matchResponsibility, 
  normalizeResponsibilityPhrase 
} from "./responsibilityIndex";
import { RESPONSIBILITIES } from "@/data/responsibilities";
import { SearchQuery, SearchIntent, RelationshipType, DateRange } from "@/types/searchQuery";

// Build responsibility index at module load time
const RESPONSIBILITY_INDEX = buildResponsibilityIndex();

export type ActionType = "email" | "call" | "text" | null;
export type IntentType = "find" | "action" | "filter" | "question";

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface ResponsibilityMatch {
  responsibilityId: string;
  matchedAlias: string;
  filters: {
    departments?: string[];
    roles?: string[];
    tags?: string[];
    owner?: string;
  };
}

export interface ParsedQuery {
  intent: IntentType;
  action: ActionType;
  entities: {
    names: string[];
    companies: string[];
    roles: string[];
    departments: string[];
    locations: string[];
    relationships: string[]; // Relationship types: client, prospect, vendor, etc.
    businesses: string[]; // Business names (e.g., "mcdonalds", "starbucks")
  };
  negatedEntities: {
    names: string[];
    companies: string[];
    roles: string[];
    departments: string[];
    locations: string[];
    relationships: string[];
    businesses: string[];
  };
  keywords: string[];
  filters: Record<string, string>;
  originalQuery: string;
  searchTerms: string[];
  searchType?: "business" | "location" | "both"; // Type of search for OpenStreetMap lookup
  timeRange?: TimeRange; // Time range for filtering contacts by creation date
  interactionType?: "email" | "call" | "meeting" | "text" | null; // Type of interaction
  interactionTimeRange?: TimeRange; // Time range for last interaction
  needsFollowUp?: boolean; // "need to follow up", "haven't talked to"
  responsibility?: ResponsibilityMatch | null; // Matched responsibility
  interpretation?: string; // Human-readable interpretation of the query
  comparativeFilters?: {
    timeRange?: { operator: "more than" | "less than" | "older than" | "newer than"; days: number };
  };
}

// Action keywords that trigger specific actions
const ACTION_KEYWORDS: Record<string, ActionType> = {
  email: "email",
  mail: "email",
  message: "email",
  send: "email",
  "send email": "email",
  "reach out via email": "email",
  "reach out": "email",
  call: "call",
  phone: "call",
  ring: "call",
  dial: "call",
  "reach out": "call",
  contact: "call",
  text: "text",
  sms: "text",
  dm: "text",
  "direct message": "text",
};

// Expanded synonym maps for better entity recognition
const SYNONYM_MAP: Record<string, string[]> = {
  // Role/Title abbreviations and full forms
  "ceo": ["chief executive officer", "chief exec", "executive officer"],
  "chief executive officer": ["ceo", "chief exec"],
  "chief exec": ["ceo", "chief executive officer"],
  "vp": ["vice president", "v.p.", "vice pres"],
  "vice president": ["vp", "v.p.", "vice pres"],
  "v.p.": ["vp", "vice president"],
  "cto": ["chief technology officer", "chief tech officer"],
  "chief technology officer": ["cto", "chief tech officer"],
  "chief tech officer": ["cto"],
  "cfo": ["chief financial officer"],
  "chief financial officer": ["cfo"],
  "coo": ["chief operating officer"],
  "chief operating officer": ["coo"],
  "pm": ["product manager", "project manager", "program manager"],
  "product manager": ["pm"],
  "project manager": ["pm"],
  "program manager": ["pm"],
  "hr": ["human resources", "people ops", "people operations"],
  "human resources": ["hr", "people ops"],
  "people ops": ["hr", "human resources"],
  "it": ["information technology", "tech support", "tech"],
  "information technology": ["it", "tech"],
  
  // Department synonyms (expanded)
  "engineering": ["dev", "development", "software", "tech", "engineering", "eng", "swe", "software engineering"],
  "dev": ["engineering", "development", "software", "developer", "devs", "devops"],
  "development": ["engineering", "dev", "software"],
  "software": ["engineering", "dev", "development", "swe"],
  "developer": ["dev", "engineer", "programmer", "coder"],
  "engineer": ["developer", "dev", "programmer"],
  "programmer": ["developer", "engineer", "coder"],
  "sales": ["business development", "bd", "revenue", "account management", "account exec", "ae", "sales rep"],
  "business development": ["sales", "bd"],
  "bd": ["sales", "business development"],
  "revenue": ["sales"],
  "marketing": ["growth", "demand gen", "brand", "marketing", "marcom", "communications"],
  "growth": ["marketing"],
  "demand gen": ["marketing", "demand generation"],
  "finance": ["accounting", "fpa", "fp&a", "financial planning", "accountant", "bookkeeping"],
  "accounting": ["finance", "accountant"],
  "fpa": ["finance", "financial planning"],
  "fp&a": ["finance", "financial planning"],
  "legal": ["law", "attorney", "lawyer", "counsel"],
  "operations": ["ops", "operational", "business operations"],
  "ops": ["operations"],
  "support": ["customer support", "customer service", "help desk", "tech support"],
  "customer support": ["support", "customer service"],
  "customer service": ["support", "customer support"],
  "product": ["product management", "pm", "product owner", "po"],
  "design": ["designer", "ux", "ui", "user experience", "user interface"],
  "ux": ["user experience", "design"],
  "ui": ["user interface", "design"],
  "research": ["r&d", "research and development", "researcher"],
  "r&d": ["research", "research and development"],
  
  // Location expansions (extended)
  "sf": ["san francisco", "bay area", "silicon valley"],
  "san francisco": ["sf", "bay area"],
  "bay area": ["sf", "san francisco", "silicon valley"],
  "nyc": ["new york", "new york city", "manhattan", "ny"],
  "new york": ["nyc", "new york city", "ny"],
  "new york city": ["nyc", "new york", "ny"],
  "ny": ["new york", "new york city", "nyc"],
  "la": ["los angeles", "l.a.", "l.a"],
  "los angeles": ["la", "l.a."],
  "dc": ["washington", "washington dc", "d.c.", "washington d.c."],
  "washington": ["dc", "washington dc"],
  "washington dc": ["dc", "washington"],
  "chicago": ["chi", "windy city"],
  "boston": ["beantown"],
  "seattle": ["sea"],
  "austin": ["atx"],
  "miami": ["mia"],
  "denver": ["mile high"],
  
  // Common role variations
  "manager": ["mgr", "mgmt", "management"],
  "director": ["dir"],
  "senior": ["sr", "sr."],
  "junior": ["jr", "jr."],
  "assistant": ["asst", "asst."],
  "associate": ["assoc"],
  "executive": ["exec"],
  "specialist": ["spec"],
  "coordinator": ["coord"],
};

// Abbreviation to full form mapping
const ABBREVIATION_MAP: Record<string, string> = {
  "ceo": "chief executive officer",
  "cto": "chief technology officer",
  "cfo": "chief financial officer",
  "coo": "chief operating officer",
  "vp": "vice president",
  "pm": "product manager",
  "hr": "human resources",
  "it": "information technology",
  "bd": "business development",
  "fpa": "financial planning",
  "sf": "san francisco",
  "nyc": "new york city",
  "ny": "new york",
  "la": "los angeles",
  "dc": "washington dc",
};

// Question/intent detection patterns (expanded)
const QUESTION_STARTERS = new Set([
  "who", "what", "where", "which", "when", "how", "why",
  "find", "show", "get", "search", "look", "can", "do", "does", "is", "are", "help",
  "list", "display", "give", "show me", "find all", "find me", "get me",
  "i need", "i need to", "i want", "i want to", "i'm looking for",
  "can you", "can you find", "can you show", "please find", "please show",
  "list all", "give me", "help me find"
]);

// Controlled vocabulary for roles/departments (expanded with synonyms)
const ROLE_VOCABULARY = new Set([
  // Departments
  "hr", "human resources", "people ops", "sales", "business development", "bd", "revenue",
  "marketing", "growth", "demand gen", "engineering", "dev", "development", "software", "eng", "swe",
  "finance", "accounting", "fpa", "fp&a", "legal", "operations", "ops",
  "support", "customer service", "customer support", "it", "information technology", "tech", "product", "design", "research", "r&d",
  "admin", "administration", "executive", "ux", "ui", "user experience", "user interface",
  // Titles (with abbreviations)
  "ceo", "chief executive officer", "chief exec", "cto", "chief technology officer", "chief tech officer",
  "cfo", "chief financial officer", "coo", "chief operating officer",
  "vp", "vice president", "v.p.", "vice pres",
  "pm", "product manager", "project manager", "program manager", "product owner", "po",
  "director", "dir", "manager", "mgr", "mgmt", "lead", "senior", "sr", "junior", "jr", "intern", "associate", "assoc",
  "analyst", "consultant", "specialist", "spec", "coordinator", "coord", "assistant", "asst",
  "founder", "partner", "president", "head", "chief", "officer", "exec",
  "developer", "dev", "engineer", "programmer", "coder", "designer", "architect",
  "account exec", "ae", "sales rep", "accountant", "lawyer", "attorney", "counsel"
]);

// Company suffixes to identify company names (expanded with variations)
const COMPANY_SUFFIXES = new Set([
  "inc", "inc.", "incorporated",
  "llc", "l.l.c.", "limited liability company",
  "ltd", "ltd.", "limited",
  "corp", "corp.", "corporation",
  "company", "co", "co.",
  "group", "holdings", "partners",
  "solutions", "technologies", "tech", "systems",
  "enterprises", "industries", "services", "consulting", "agency",
  // International suffixes
  "gmbh", "ag", "sa", "s.a.", "srl", "bv", "nv",
]);

// Stop words to filter from keywords
// Note: "add" and "added" are NOT in stop words - we need them to detect creation date searches
const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "as", "is", "was", "are", "were", "been",
  "be", "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "must", "shall", "can", "need", "our", "my",
  "your", "his", "her", "its", "their", "this", "that", "these", "those",
  "i", "you", "he", "she", "it", "we", "they", "what", "which", "who",
  "whom", "all", "each", "every", "both", "few", "more", "most", "other",
  "some", "such", "no", "not", "only", "own", "same", "so", "than", "too",
  "very", "just", "also", "now", "here", "there", "when", "where", "why",
  "how", "any", "if", "about", "into", "through", "during", "before", "after",
  "above", "below", "between", "under", "again", "further", "then", "once",
  "someone", "anyone", "person", "people", "contact", "contacts", "me", "help",
  "meet", "met", "did"
]);

// Time-of-day definitions (hour ranges)
const TIME_OF_DAY = {
  morning: { start: 5, end: 12 },      // 5am - 12pm
  afternoon: { start: 12, end: 17 },    // 12pm - 5pm
  evening: { start: 17, end: 21 },     // 5pm - 9pm
  night: { start: 21, end: 5 },        // 9pm - 5am (next day)
  // Alternative names
  am: { start: 0, end: 12 },
  pm: { start: 12, end: 24 },
  noon: { start: 12, end: 13 },
  midnight: { start: 0, end: 1 },
};

// Time-based query patterns
const TIME_PATTERNS = {
  "earlier this week": () => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    const dayOfWeek = start.getDay();
    start.setDate(start.getDate() - dayOfWeek);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  },
  "last week": () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 7);
    return { start, end };
  },
  "this week": () => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    const dayOfWeek = start.getDay();
    start.setDate(start.getDate() - dayOfWeek);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  },
  "last month": () => {
    const end = new Date();
    const start = new Date();
    start.setMonth(end.getMonth() - 1);
    return { start, end };
  },
  "this month": () => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  },
  "last year": () => {
    const end = new Date();
    const start = new Date();
    start.setFullYear(end.getFullYear() - 1);
    return { start, end };
  },
  "this year": () => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  },
  "yesterday": () => {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - 1);
    return { start, end };
  },
  "today": () => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return { start, end };
  },
  "recent": () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 7); // Last 7 days
    return { start, end };
  },
};

// Relationship keywords mapping
const RELATIONSHIP_KEYWORDS: Record<string, string[]> = {
  client: ["client", "clients", "customer", "customers"],
  prospect: ["prospect", "prospects", "lead", "leads", "potential"],
  vendor: ["vendor", "vendors", "supplier", "suppliers"],
  investor: ["investor", "investors", "vc", "venture", "capital"],
  friend: ["friend", "friends", "personal"],
  colleague: ["colleague", "colleagues", "coworker", "coworkers", "teammate", "teammates"],
  partner: ["partner", "partners"],
  contact: ["contact", "contacts", "person", "people"],
};

// Location synonyms
const LOCATION_SYNONYMS: Record<string, string[]> = {
  "san francisco": ["sf", "san fran", "san francisco", "bay area"],
  "new york": ["ny", "nyc", "new york", "new york city", "manhattan"],
  "los angeles": ["la", "los angeles", "l.a."],
  "washington": ["dc", "washington", "washington dc", "d.c."],
  "chicago": ["chi", "chicago"],
  "boston": ["boston"],
  "seattle": ["seattle"],
  "austin": ["austin"],
};

// Common location/event keywords
const LOCATION_KEYWORDS = new Set([
  "office", "conference", "event", "meeting", "ces", "sxsw", "summit",
  "convention", "expo", "trade show", "workshop", "seminar"
]);

// Interaction type keywords
const INTERACTION_KEYWORDS = {
  email: ["email", "emailed", "mail", "mailed", "message", "messaged", "sent"],
  call: ["call", "called", "phone", "phoned", "ring", "rang", "dial", "dialed"],
  meeting: ["meet", "met", "meeting", "met with", "saw", "see", "introduction", "intro"],
  text: ["text", "texted", "sms", "messaged"],
};

// Day names
const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

// Month names
const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december"
];

// Prepositions that indicate entity relationships
const ENTITY_PREPOSITIONS = {
  company: new Set(["at", "from", "with", "@"]),
  role: new Set(["as", "works"]),
  department: new Set(["in", "handles", "does"]),
  location: new Set(["in", "at", "from", "near"]),
  business: new Set(["at", "in"]), // "who do I know at mcdonalds"
};

// Semantic verb mapping - verbs that imply entity relationships
const SEMANTIC_VERB_MAP: Record<string, { entityType: keyof ParsedQuery["entities"]; hint: string }> = {
  "handles": { entityType: "departments", hint: "responsibility" },
  "handle": { entityType: "departments", hint: "responsibility" },
  "works at": { entityType: "companies", hint: "company" },
  "work at": { entityType: "companies", hint: "company" },
  "works for": { entityType: "companies", hint: "company" },
  "work for": { entityType: "companies", hint: "company" },
  "manages": { entityType: "roles", hint: "responsibility" },
  "manage": { entityType: "roles", hint: "responsibility" },
  "based in": { entityType: "locations", hint: "location" },
  "based at": { entityType: "locations", hint: "location" },
  "located in": { entityType: "locations", hint: "location" },
  "located at": { entityType: "locations", hint: "location" },
  "knows": { entityType: "relationships", hint: "relationship" },
  "know": { entityType: "relationships", hint: "relationship" },
  "met": { entityType: "relationships", hint: "interaction" },
  "meet": { entityType: "relationships", hint: "interaction" },
};

// Negation keywords
const NEGATION_KEYWORDS = new Set([
  "not", "except", "excluding", "without", "but not", "excluding",
  "no", "never", "neither", "nor"
]);

// Conversational patterns
const CONVERSATIONAL_PATTERNS = new Set([
  "show me", "show", "find", "find all", "find me", "get", "get me",
  "i need", "i need to", "i want", "i want to", "i'm looking for",
  "can you", "can you find", "can you show", "please find", "please show",
  "list", "list all", "display", "give me", "give", "help me find"
]);

/**
 * Expand contractions in query
 */
function expandContractions(query: string): string {
  const contractions: Record<string, string> = {
    "don't": "do not",
    "doesn't": "does not",
    "didn't": "did not",
    "won't": "will not",
    "can't": "cannot",
    "couldn't": "could not",
    "shouldn't": "should not",
    "wouldn't": "would not",
    "isn't": "is not",
    "aren't": "are not",
    "wasn't": "was not",
    "weren't": "were not",
    "haven't": "have not",
    "hasn't": "has not",
    "hadn't": "had not",
    "i've": "i have",
    "you've": "you have",
    "we've": "we have",
    "they've": "they have",
    "i'm": "i am",
    "you're": "you are",
    "he's": "he is",
    "she's": "she is",
    "it's": "it is",
    "we're": "we are",
    "they're": "they are",
    "i'd": "i would",
    "you'd": "you would",
    "he'd": "he would",
    "she'd": "she would",
    "we'd": "we would",
    "they'd": "they would",
    "i'll": "i will",
    "you'll": "you will",
    "he'll": "he will",
    "she'll": "she will",
    "we'll": "we will",
    "they'll": "they will",
  };
  
  let expanded = query.toLowerCase();
  for (const [contraction, expansion] of Object.entries(contractions)) {
    const regex = new RegExp(`\\b${contraction}\\b`, "gi");
    expanded = expanded.replace(regex, expansion);
  }
  return expanded;
}

/**
 * Detect email or phone in query
 */
function detectEmailOrPhone(text: string): { type: "email" | "phone" | null; value: string } {
  // Email pattern
  const emailPattern = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/;
  const emailMatch = text.match(emailPattern);
  if (emailMatch) {
    return { type: "email", value: emailMatch[0] };
  }
  
  // Phone pattern (7+ digits, may include formatting)
  const phonePattern = /\b[\d\s\-\(\)\+]{7,}\b/;
  const phoneMatch = text.match(phonePattern);
  if (phoneMatch) {
    const digits = phoneMatch[0].replace(/\D/g, "");
    if (digits.length >= 7) {
      return { type: "phone", value: phoneMatch[0] };
    }
  }
  
  return { type: null, value: "" };
}

/**
 * Expand query terms using synonym maps
 */
function expandQueryTerms(term: string): string[] {
  const lower = term.toLowerCase();
  const expanded: string[] = [term]; // Always include original
  
  // Check synonym map
  if (SYNONYM_MAP[lower]) {
    expanded.push(...SYNONYM_MAP[lower]);
  }
  
  // Check reverse mapping (if full form, include abbreviations)
  for (const [key, synonyms] of Object.entries(SYNONYM_MAP)) {
    if (synonyms.includes(lower)) {
      expanded.push(key);
    }
  }
  
  // Check abbreviation map
  if (ABBREVIATION_MAP[lower]) {
    expanded.push(ABBREVIATION_MAP[lower]);
  }
  
  // Reverse: if full form, check if it's an abbreviation
  for (const [abbr, full] of Object.entries(ABBREVIATION_MAP)) {
    if (full === lower) {
      expanded.push(abbr);
    }
  }
  
  return [...new Set(expanded)]; // Remove duplicates
}

/**
 * Normalize query text with enhanced processing
 */
function normalizeQuery(query: string): string {
  let normalized = query
    .trim()
    .replace(/[?!.,;:]+$/g, "") // Remove trailing punctuation
    .replace(/\s+/g, " "); // Normalize whitespace
  
  // Expand contractions
  normalized = expandContractions(normalized);
  
  // Convert to lowercase
  normalized = normalized.toLowerCase();
  
  return normalized;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  
  if (len1 === 0) return len2;
  if (len2 === 0) return len1;
  
  const matrix: number[][] = [];
  
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  return matrix[len1][len2];
}

/**
 * Fuzzy match entity with typo tolerance
 */
function fuzzyMatchEntity(term: string, candidates: string[], maxDistance: number = 2): string | null {
  const termLower = term.toLowerCase();
  
  for (const candidate of candidates) {
    const candidateLower = candidate.toLowerCase();
    const distance = levenshteinDistance(termLower, candidateLower);
    
    // Adjust threshold based on length
    const threshold = termLower.length <= 4 ? 1 : termLower.length <= 7 ? 2 : maxDistance;
    
    if (distance <= threshold) {
      return candidate;
    }
  }
  
  return null;
}

/**
 * Disambiguate entity type based on context
 */
function disambiguateEntity(
  entity: string,
  context: { before?: string; after?: string; query: string }
): { type: "name" | "company" | "role" | "location" | "unknown"; confidence: number } {
  let score = { name: 0, company: 0, role: 0, location: 0 };
  
  const entityLower = entity.toLowerCase();
  const queryLower = context.query.toLowerCase();
  
  // Capitalization pattern - proper nouns (names, companies) often capitalized
  if (entity[0] === entity[0].toUpperCase() && entity.length > 1) {
    score.name += 2;
    score.company += 2;
  }
  
  // Context clues - words before/after
  if (context.before) {
    const beforeLower = context.before.toLowerCase();
    if (ENTITY_PREPOSITIONS.company.has(beforeLower) || beforeLower === "from" || beforeLower === "at") {
      score.company += 5;
    }
    if (beforeLower === "named" || beforeLower === "called" || beforeLower === "is") {
      score.name += 5;
    }
    if (SEMANTIC_VERB_MAP[beforeLower]) {
      const hint = SEMANTIC_VERB_MAP[beforeLower];
      if (hint.entityType === "companies") score.company += 3;
      if (hint.entityType === "roles") score.role += 3;
      if (hint.entityType === "locations") score.location += 3;
    }
  }
  
  // Pattern matching
  if (/who\s+(works\s+at|at)\s+/i.test(queryLower)) {
    const match = queryLower.match(/who\s+(?:works\s+at|at)\s+([^?]+)/i);
    if (match && match[1].includes(entityLower)) {
      score.company += 4;
    }
  }
  
  if (/(?:named|called|is)\s+([^?]+)/i.test(queryLower)) {
    const match = queryLower.match(/(?:named|called|is)\s+([^?]+)/i);
    if (match && match[1].includes(entityLower)) {
      score.name += 4;
    }
  }
  
  // Company suffix check
  const words = entityLower.split(/\s+/);
  if (words.some(w => COMPANY_SUFFIXES.has(w))) {
    score.company += 5;
  }
  
  // Role vocabulary check
  if (ROLE_VOCABULARY.has(entityLower)) {
    score.role += 5;
  }
  
  // Location keywords check
  if (LOCATION_KEYWORDS.has(entityLower) || Object.keys(LOCATION_SYNONYMS).some(loc => 
    LOCATION_SYNONYMS[loc].includes(entityLower)
  )) {
    score.location += 5;
  }
  
  // Find highest score
  const maxScore = Math.max(score.name, score.company, score.role, score.location);
  if (maxScore === 0) return { type: "unknown", confidence: 0 };
  
  let type: "name" | "company" | "role" | "location" = "unknown";
  if (maxScore === score.company) type = "company";
  else if (maxScore === score.name) type = "name";
  else if (maxScore === score.role) type = "role";
  else if (maxScore === score.location) type = "location";
  
  return { type, confidence: maxScore / 10 }; // Normalize to 0-1
}

/**
 * Classify question type for better intent understanding
 */
function classifyQuestionType(query: string): { type: "who" | "what" | "where" | "when" | "how" | "unknown"; intent: string } {
  const normalized = normalizeQuery(query);
  const firstWord = normalized.split(" ")[0];
  
  if (firstWord === "who") {
    // "who handles X" → responsibility
    if (normalized.includes("handles") || normalized.includes("handle")) {
      return { type: "who", intent: "responsibility" };
    }
    // "who works at X" → company
    if (normalized.includes("works at") || normalized.includes("work at") || normalized.includes("at")) {
      return { type: "who", intent: "company" };
    }
    // "who did I meet" → interaction
    if (normalized.includes("meet") || normalized.includes("met")) {
      return { type: "who", intent: "interaction" };
    }
    return { type: "who", intent: "person" };
  }
  
  if (firstWord === "what") {
    return { type: "what", intent: "information" };
  }
  
  if (firstWord === "where") {
    return { type: "where", intent: "location" };
  }
  
  if (firstWord === "when") {
    return { type: "when", intent: "time" };
  }
  
  if (firstWord === "how") {
    return { type: "how", intent: "method" };
  }
  
  return { type: "unknown", intent: "search" };
}

/**
 * Check if query is a question (enhanced)
 */
function isQuestion(query: string): boolean {
  const normalized = normalizeQuery(query);
  
  // Check question mark
  if (query.trim().endsWith("?")) return true;
  
  // Check question starters
  const firstWord = normalized.split(" ")[0];
  if (QUESTION_STARTERS.has(firstWord)) return true;
  
  // Check conversational patterns
  for (const pattern of CONVERSATIONAL_PATTERNS) {
    if (normalized.startsWith(pattern)) return true;
  }
  
  // Check for "someone who" / "anyone who" patterns
  if (normalized.includes("someone") || normalized.includes("anyone")) {
    return true;
  }
  
  // Check for question patterns
  if (/do\s+i\s+know/i.test(query) || /is\s+there/i.test(query) || /can\s+you/i.test(query)) {
    return true;
  }
  
  return false;
}

/**
 * Detect action intent from query
 */
function detectAction(words: string[]): { action: ActionType; remainingWords: string[] } {
  const firstWord = words[0]?.toLowerCase();
  
  if (firstWord && ACTION_KEYWORDS[firstWord]) {
    return {
      action: ACTION_KEYWORDS[firstWord],
      remainingWords: words.slice(1)
    };
  }
  
  return { action: null, remainingWords: words };
}

/**
 * Extract negated entities from query
 */
function extractNegations(words: string[]): ParsedQuery["negatedEntities"] {
  const negated: ParsedQuery["negatedEntities"] = {
    names: [],
    companies: [],
    roles: [],
    departments: [],
    locations: [],
    relationships: [],
    businesses: [],
  };
  
  const normalized = words.join(" ").toLowerCase();
  
  // Find negation keywords and extract what follows
  for (let i = 0; i < words.length; i++) {
    const word = words[i].toLowerCase();
    
    if (NEGATION_KEYWORDS.has(word)) {
      // Extract entities after negation keyword
      const afterNegation = words.slice(i + 1).join(" ").toLowerCase();
      
      // Check for "except X" or "not X" patterns
      if (word === "except" || word === "excluding" || word === "but not") {
        // Try to extract what's being excluded
        const remaining = words.slice(i + 1);
        
        // Check if it's a relationship
        for (const [relType, keywords] of Object.entries(RELATIONSHIP_KEYWORDS)) {
          if (keywords.some(k => afterNegation.includes(k))) {
            negated.relationships.push(relType);
          }
        }
        
        // Check if it's a company (after "from" or "at")
        for (let j = 0; j < remaining.length; j++) {
          if (ENTITY_PREPOSITIONS.company.has(remaining[j]?.toLowerCase())) {
            const companyWords = remaining.slice(j + 1, j + 4);
            if (companyWords.length > 0) {
              negated.companies.push(companyWords.join(" "));
            }
            break;
          }
        }
        
        // Check if it's a role
        if (ROLE_VOCABULARY.has(remaining[0]?.toLowerCase())) {
          negated.roles.push(remaining[0]);
        }
      }
    }
  }
  
  return negated;
}

/**
 * Extract comparative filters from query
 */
function extractComparativeFilters(query: string): ParsedQuery["comparativeFilters"] {
  const normalized = normalizeQuery(query);
  const result: ParsedQuery["comparativeFilters"] = {};
  
  // Pattern: "more than X days ago", "less than X days", "older than X days", "newer than X days"
  const patterns = [
    { regex: /more\s+than\s+(\d+)\s+days?\s+ago/i, operator: "more than" as const },
    { regex: /less\s+than\s+(\d+)\s+days?\s+ago/i, operator: "less than" as const },
    { regex: /older\s+than\s+(\d+)\s+days?/i, operator: "older than" as const },
    { regex: /newer\s+than\s+(\d+)\s+days?/i, operator: "newer than" as const },
    { regex: /over\s+(\d+)\s+days?\s+ago/i, operator: "more than" as const },
    { regex: /within\s+(\d+)\s+days?/i, operator: "less than" as const },
  ];
  
  for (const { regex, operator } of patterns) {
    const match = normalized.match(regex);
    if (match && match[1]) {
      const days = parseInt(match[1], 10);
      result.timeRange = { operator, days };
      break;
    }
  }
  
  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Extract relationships from query
 */
function extractRelationships(words: string[]): string[] {
  const relationships: string[] = [];
  const normalized = words.join(" ").toLowerCase();
  
  for (const [relationshipType, keywords] of Object.entries(RELATIONSHIP_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) {
        if (!relationships.includes(relationshipType)) {
          relationships.push(relationshipType);
        }
      }
    }
  }
  
  return relationships;
}

/**
 * Extract locations from query
 * Only extracts locations when explicitly mentioned with location prepositions or as standalone location keywords
 */
function extractLocations(words: string[]): string[] {
  const locations: string[] = [];
  const normalized = words.join(" ").toLowerCase();
  
  // Check for "in [Location]" or "at [Location]" patterns first (most reliable)
  for (let i = 0; i < words.length; i++) {
    const word = words[i].toLowerCase();
    if (ENTITY_PREPOSITIONS.location.has(word) && words[i + 1]) {
      const locationWords: string[] = [];
      for (let j = i + 1; j < words.length && j < i + 4; j++) {
        const w = words[j].toLowerCase();
        if (STOP_WORDS.has(w) && j > i + 1) break;
        locationWords.push(words[j]);
      }
      if (locationWords.length > 0) {
        const location = locationWords.join(" ");
        const locationLower = location.toLowerCase();
        
        // Verify it's actually a known location
        let isKnownLocation = false;
        for (const [canonical, synonyms] of Object.entries(LOCATION_SYNONYMS)) {
          if (synonyms.some(s => s === locationLower || locationLower.includes(s))) {
            if (!locations.includes(canonical)) {
              locations.push(canonical);
            }
            isKnownLocation = true;
            break;
          }
        }
        
        // If not a known location but follows location preposition, add it anyway
        if (!isKnownLocation && !locations.includes(locationLower)) {
          locations.push(locationLower);
        }
      }
    }
  }
  
  // Only check for location synonyms if they appear as standalone words/phrases
  // Use word boundaries to avoid false matches (e.g., "new york" shouldn't match "new yorker")
  if (locations.length === 0) {
    for (const [canonical, synonyms] of Object.entries(LOCATION_SYNONYMS)) {
      for (const synonym of synonyms) {
        // Use word boundary regex to ensure exact match, not substring
        const regex = new RegExp(`\\b${synonym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(normalized)) {
          // Additional check: make sure it's not part of a larger phrase that's not a location
          // For example, "new york" in "new yorker" should not match
          const synonymIndex = normalized.indexOf(synonym);
          if (synonymIndex !== -1) {
            const before = normalized.substring(Math.max(0, synonymIndex - 1), synonymIndex);
            const after = normalized.substring(synonymIndex + synonym.length, synonymIndex + synonym.length + 1);
            // Check if it's surrounded by word boundaries (space, start, end, or punctuation)
            const isWordBoundary = (before === '' || before === ' ' || /[^a-z]/.test(before)) &&
                                   (after === '' || after === ' ' || /[^a-z]/.test(after));
            
            if (isWordBoundary && !locations.includes(canonical)) {
              locations.push(canonical);
            }
          }
          break;
        }
      }
    }
  }
  
  // Check for location keywords (office, conference, etc.) - these are standalone keywords
  for (const word of words) {
    const lower = word.toLowerCase();
    if (LOCATION_KEYWORDS.has(lower)) {
      if (!locations.includes(lower)) {
        locations.push(lower);
      }
    }
  }
  
  return locations;
}

/**
 * Extract interaction type from query
 */
function extractInteractionType(query: string): "email" | "call" | "meeting" | "text" | null {
  const normalized = normalizeQuery(query);
  
  for (const [type, keywords] of Object.entries(INTERACTION_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) {
        return type as "email" | "call" | "meeting" | "text";
      }
    }
  }
  
  return null;
}

/**
 * Extract "needs follow up" intent
 */
function extractNeedsFollowUp(query: string): boolean {
  const normalized = normalizeQuery(query);
  const followUpPatterns = [
    "need to follow up",
    "need follow up",
    "follow up",
    "haven't talked",
    "havent talked",
    "haven't contacted",
    "havent contacted",
    "no contact",
    "not contacted",
    "should follow up",
    "must follow up",
  ];
  
  return followUpPatterns.some(pattern => normalized.includes(pattern));
}

/**
 * Extract responsibility intent from query
 * Detects patterns like "who handles X", "who is responsible for X", etc.
 * Returns the matched responsibility or null if no match found
 */
function extractResponsibility(query: string): { match: ResponsibilityMatch | null; phrase: string | null } {
  const normalized = normalizeQuery(query);
  
  // Responsibility intent patterns
  const responsibilityPatterns: Array<{ pattern: RegExp; phraseIndex: number }> = [
    { pattern: /who\s+(handles|manages|owns)\s+(.+)/i, phraseIndex: 2 },
    { pattern: /who\s+is\s+responsible\s+for\s+(.+)/i, phraseIndex: 1 },
    { pattern: /point\s+of\s+contact\s+for\s+(.+)/i, phraseIndex: 1 },
    { pattern: /who\s+do\s+i\s+talk\s+to\s+about\s+(.+)/i, phraseIndex: 1 },
    { pattern: /who\s+should\s+i\s+contact\s+for\s+(.+)/i, phraseIndex: 1 },
    { pattern: /who\s+can\s+i\s+talk\s+to\s+about\s+(.+)/i, phraseIndex: 1 },
  ];
  
  for (const { pattern, phraseIndex } of responsibilityPatterns) {
    const match = normalized.match(pattern);
    if (match && match[phraseIndex]) {
      const responsibilityPhrase = match[phraseIndex].trim();
      
      // Match against responsibility aliases
      const matchResult = matchResponsibility(responsibilityPhrase, RESPONSIBILITY_INDEX);
      
      if (matchResult) {
        const responsibility = RESPONSIBILITIES[matchResult.responsibilityId];
        if (responsibility) {
          return {
            match: {
              responsibilityId: matchResult.responsibilityId,
              matchedAlias: matchResult.matchedAlias,
              filters: responsibility.filters,
            },
            phrase: responsibilityPhrase,
          };
        }
      }
      
      // If pattern matched but no responsibility found, return phrase for fallback
      return {
        match: null,
        phrase: responsibilityPhrase,
      };
    }
  }
  
  return { match: null, phrase: null };
}

/**
 * Extract entities from query using rule-based patterns
 */
function extractEntities(words: string[]): ParsedQuery["entities"] {
  const entities: ParsedQuery["entities"] = {
    names: [],
    companies: [],
    roles: [],
    departments: [],
    locations: [],
    relationships: [],
    businesses: [],
  };
  
  const text = words.join(" ");
  
  // Extract companies (words after "at", "from", or with company suffixes)
  // This must happen BEFORE semantic verb extraction to avoid conflicts
  for (let i = 0; i < words.length; i++) {
    const word = words[i].toLowerCase();
    const nextWord = words[i + 1]?.toLowerCase();
    
    // Pattern: "at Company" or "from Company"
    if (ENTITY_PREPOSITIONS.company.has(word) && nextWord) {
      // Capture potential multi-word company name
      const companyWords: string[] = [];
      for (let j = i + 1; j < words.length; j++) {
        const w = words[j];
        const wLower = w.toLowerCase();
        
        // Stop on stop words only if we've already collected at least one word
        // This allows "at quantum solutions" to work even if there are stop words
        // BUT: Don't stop on "at" if it appears later (it's a preposition, not a stop word in this context)
        // Also: Don't stop on question words that might appear at the end
        // IMPORTANT: Don't stop on "know" or "do" if they appear after we've collected company words
        // (they might be part of the query structure like "who do I know at company")
        if (STOP_WORDS.has(wLower) && j > i + 1 && companyWords.length > 0) {
          // Only break if we hit a significant stop word after collecting company words
          // Allow common words like "the", "a", "an" to be part of company name
          // Also allow "at" if it's part of a compound company name (rare but possible)
          // Don't break on question words that might be at the end
          // Don't break on "know" or "do" - they're likely part of the query structure
          const questionWords = ["who", "what", "where", "when", "why", "how"];
          const queryStructureWords = ["know", "do", "does", "did", "i", "you", "we", "they"];
          if (wLower !== "the" && wLower !== "a" && wLower !== "an" && wLower !== "at" && 
              !questionWords.includes(wLower) && !queryStructureWords.includes(wLower)) {
            break;
          }
        }
        companyWords.push(w);
        // If we hit a company suffix, include it and stop (this is good - we have the full company name)
        if (COMPANY_SUFFIXES.has(wLower)) break;
      }
      if (companyWords.length > 0) {
        const companyName = companyWords.join(" ").trim();
        // Remove any trailing punctuation that might have been included
        const cleanedName = companyName.replace(/[?!.,;:]+$/, "").trim();
        // Only add if not already added (avoid duplicates) and if it's not empty
        if (cleanedName && !entities.companies.includes(cleanedName)) {
          entities.companies.push(cleanedName);
        }
      }
    }
    
    // Check for company suffixes
    if (COMPANY_SUFFIXES.has(word) && i > 0) {
      // Look backwards for company name
      const companyWords: string[] = [words[i]];
      for (let j = i - 1; j >= 0; j--) {
        const w = words[j].toLowerCase();
        if (STOP_WORDS.has(w) || ENTITY_PREPOSITIONS.company.has(w)) break;
        companyWords.unshift(words[j]);
      }
      if (companyWords.length >= 1) {
        entities.companies.push(companyWords.join(" "));
      }
    }
  }
  
  // Also detect company names without prepositions (capitalized words or known company patterns)
  // This handles queries like "TechCorp" or "TechCorp Solutions"
  if (entities.companies.length === 0) {
    // Look for sequences of capitalized words or words ending in company suffixes
    const potentialCompanyWords: string[] = [];
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const lower = word.toLowerCase();
      
      // Skip if it's a stop word, role, or action keyword
      if (STOP_WORDS.has(lower)) {
        if (potentialCompanyWords.length > 0) {
          // End of potential company name
          if (potentialCompanyWords.length >= 1) {
            const companyName = potentialCompanyWords.join(" ");
            // Only add if it looks like a company (has suffix or is multi-word)
            if (COMPANY_SUFFIXES.has(potentialCompanyWords[potentialCompanyWords.length - 1].toLowerCase()) ||
                potentialCompanyWords.length >= 2) {
              entities.companies.push(companyName);
            }
          }
          potentialCompanyWords.length = 0;
        }
        continue;
      }
      
      if (ROLE_VOCABULARY.has(lower) || ACTION_KEYWORDS[lower]) {
        if (potentialCompanyWords.length > 0) {
          potentialCompanyWords.length = 0;
        }
        continue;
      }
      
      // If word starts with capital or has company suffix, it might be part of company name
      if (word[0] === word[0].toUpperCase() || COMPANY_SUFFIXES.has(lower)) {
        potentialCompanyWords.push(word);
      } else if (potentialCompanyWords.length > 0) {
        // Continue building if we're already in a company name
        potentialCompanyWords.push(word);
      }
    }
    
    // Handle remaining potential company words at end of query
    if (potentialCompanyWords.length >= 1) {
      const companyName = potentialCompanyWords.join(" ");
      if (COMPANY_SUFFIXES.has(potentialCompanyWords[potentialCompanyWords.length - 1].toLowerCase()) ||
          potentialCompanyWords.length >= 2) {
        entities.companies.push(companyName);
      }
    }
  }
  
  // Extract roles and departments from vocabulary (with synonym expansion)
  // First, check for multi-word role patterns (e.g., "ops director", "operations director")
  for (let i = 0; i < words.length - 1; i++) {
    const word1 = words[i].toLowerCase();
    const word2 = words[i + 1].toLowerCase();
    
    // Expand synonyms for first word
    const expanded1 = expandQueryTerms(word1);
    
    // Check if we have a department/role + title pattern
    for (const expanded of expanded1) {
      const expandedLower = expanded.toLowerCase();
      // Check if first word is a department and second is a role/title
      const depts = ["ops", "operations", "hr", "human resources", "sales", "marketing", "engineering", "dev", "finance", "legal", "support", "it", "tech", "product", "design", "research", "admin"];
      // Handle both singular and plural titles
      const titleBase = word2.replace(/s$/, ""); // Remove trailing 's' for plural
      const titles = ["director", "manager", "lead", "head", "vp", "vice president", "president", "exec", "executive"];
      
      if (depts.includes(expandedLower) && (titles.includes(word2) || titles.includes(titleBase))) {
        // Found a pattern like "ops director" or "operations directors"
        const rolePhrase = `${expanded} ${words[i + 1]}`;
        if (!entities.roles.includes(rolePhrase)) {
          entities.roles.push(rolePhrase);
        }
        // Also add the department separately
        if (!entities.departments.includes(expandedLower)) {
          entities.departments.push(expandedLower);
        }
        // Mark both words as processed to avoid duplicate extraction
        break;
      }
    }
  }
  
  // Then extract individual roles and departments
  for (const word of words) {
    const lower = word.toLowerCase();
    
    // Skip if already part of a multi-word role
    const isPartOfMultiWord = entities.roles.some(r => r.toLowerCase().includes(lower));
    if (isPartOfMultiWord) continue;
    
    // Expand synonyms first
    const expanded = expandQueryTerms(lower);
    
    for (const term of expanded) {
      const termLower = term.toLowerCase();
      if (ROLE_VOCABULARY.has(termLower)) {
        // Classify as role or department
        const depts = ["hr", "human resources", "people ops", "sales", "business development", "bd", "revenue",
                       "marketing", "growth", "demand gen", "engineering", "dev", "development", "software",
                       "finance", "accounting", "fpa", "fp&a", "legal", 
                       "operations", "ops", "support", "it", "information technology", "tech", "product", "design", 
                       "research", "admin", "administration"];
        if (depts.includes(termLower)) {
          if (!entities.departments.includes(termLower)) {
            entities.departments.push(termLower);
          }
        } else {
          if (!entities.roles.includes(termLower)) {
            entities.roles.push(termLower);
          }
        }
      }
    }
  }
  
  // Track entity relationships for multi-entity queries (e.g., "engineers at Google")
  // This helps understand that "engineers" and "Google" are related
  const entityRelationships: Array<{ type1: string; value1: string; type2: string; value2: string; proximity: number }> = [];
  
  // Use semantic verbs to extract entities and track relationships
  const queryText = words.join(" ").toLowerCase();
  for (const [verb, mapping] of Object.entries(SEMANTIC_VERB_MAP)) {
    if (queryText.includes(verb)) {
      // Find what comes after the verb
      const verbIndex = queryText.indexOf(verb);
      const beforeVerb = queryText.substring(0, verbIndex);
      const afterVerb = queryText.substring(verbIndex + verb.length).trim();
      const afterWords = afterVerb.split(/\s+/).slice(0, 3); // Take up to 3 words
      
      if (afterWords.length > 0) {
        const entityValue = afterWords.join(" ");
        
        // Check if there's an entity before the verb (e.g., "engineers at Google")
        const beforeWords = beforeVerb.trim().split(/\s+/).slice(-2); // Last 2 words before verb
        let relatedEntity: { type: string; value: string } | null = null;
        
        if (beforeWords.length > 0) {
          const beforeText = beforeWords.join(" ").toLowerCase();
          // Check if it's a role
          for (const role of entities.roles) {
            if (beforeText.includes(role.toLowerCase())) {
              relatedEntity = { type: "role", value: role };
              break;
            }
          }
          // Check if it's a department
          if (!relatedEntity) {
            for (const dept of entities.departments) {
              if (beforeText.includes(dept.toLowerCase())) {
                relatedEntity = { type: "department", value: dept };
                break;
              }
            }
          }
        }
        
        // Apply fuzzy matching for known entities if needed
        if (mapping.entityType === "companies") {
          if (!entities.companies.includes(entityValue)) {
            entities.companies.push(entityValue);
          }
          // Track relationship if we found a related entity
          if (relatedEntity) {
            entityRelationships.push({
              type1: relatedEntity.type,
              value1: relatedEntity.value,
              type2: "company",
              value2: entityValue,
              proximity: 1,
            });
          }
        } else if (mapping.entityType === "departments") {
          const expanded = expandQueryTerms(entityValue);
          for (const term of expanded) {
            if (!entities.departments.includes(term.toLowerCase())) {
              entities.departments.push(term.toLowerCase());
            }
          }
        } else if (mapping.entityType === "roles") {
          const expanded = expandQueryTerms(entityValue);
          for (const term of expanded) {
            if (!entities.roles.includes(term.toLowerCase())) {
              entities.roles.push(term.toLowerCase());
            }
          }
        } else if (mapping.entityType === "locations") {
          if (!entities.locations.includes(entityValue)) {
            entities.locations.push(entityValue);
          }
          // Track relationship (e.g., "sales in San Francisco")
          if (relatedEntity) {
            entityRelationships.push({
              type1: relatedEntity.type,
              value1: relatedEntity.value,
              type2: "location",
              value2: entityValue,
              proximity: 1,
            });
          }
        } else if (mapping.entityType === "relationships") {
          // Don't extract relationships if the value looks like a company (has "at" or company suffix)
          // This prevents "know at quantum solutions" from being extracted as a relationship
          const entityValueLower = entityValue.toLowerCase();
          const hasCompanyPreposition = entityValueLower.includes(" at ") || entityValueLower.startsWith("at ");
          const hasCompanySuffix = entityValueLower.split(/\s+/).some(w => COMPANY_SUFFIXES.has(w));
          
          // Only add as relationship if it doesn't look like a company
          if (!hasCompanyPreposition && !hasCompanySuffix) {
            if (!entities.relationships.includes(entityValue)) {
              entities.relationships.push(entityValue);
            }
          }
        }
      }
    }
  }
  
  // Also detect proximity-based relationships (entities near each other)
  // Pattern: "engineers at Google in SF" → role + company + location
  for (let i = 0; i < words.length - 1; i++) {
    const word = words[i].toLowerCase();
    const nextWord = words[i + 1]?.toLowerCase();
    
    // Check for "X at Y" or "X in Y" patterns
    if ((ENTITY_PREPOSITIONS.company.has(word) || ENTITY_PREPOSITIONS.location.has(word)) && nextWord) {
      // Look backwards for a role/department
      for (let j = i - 1; j >= 0 && j >= i - 3; j--) {
        const prevWord = words[j].toLowerCase();
        if (ROLE_VOCABULARY.has(prevWord)) {
          const roleOrDept = prevWord;
          const companyOrLocation = words.slice(i + 1, i + 4).join(" ").toLowerCase();
          
          if (ENTITY_PREPOSITIONS.company.has(word)) {
            if (!entities.companies.includes(companyOrLocation)) {
              entities.companies.push(companyOrLocation);
            }
            entityRelationships.push({
              type1: entities.roles.includes(roleOrDept) ? "role" : "department",
              value1: roleOrDept,
              type2: "company",
              value2: companyOrLocation,
              proximity: i - j,
            });
          } else if (ENTITY_PREPOSITIONS.location.has(word)) {
            if (!entities.locations.includes(companyOrLocation)) {
              entities.locations.push(companyOrLocation);
            }
            entityRelationships.push({
              type1: entities.roles.includes(roleOrDept) ? "role" : "department",
              value1: roleOrDept,
              type2: "location",
              value2: companyOrLocation,
              proximity: i - j,
            });
          }
          break;
        }
      }
    }
  }
  
  // Extract potential names (capitalized words not matching other entities)
  // This is a heuristic - proper nouns that aren't roles/companies
  const potentialNames: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const lower = word.toLowerCase();
    
    // Skip stop words, roles, and already extracted entities
    if (STOP_WORDS.has(lower)) continue;
    if (ROLE_VOCABULARY.has(lower)) continue;
    if (entities.companies.some(c => c.toLowerCase().includes(lower))) continue;
    if (ENTITY_PREPOSITIONS.company.has(lower)) continue;
    if (ACTION_KEYWORDS[lower]) continue;
    
    // Check if looks like a proper noun (starts with capital or all lower in context of a name)
    // For lowercase queries, include non-stop-word tokens as potential name parts
    if (word.length >= 2 && !COMPANY_SUFFIXES.has(lower)) {
      potentialNames.push(word);
    }
  }
  
  // Group potential names (consecutive non-stop words could be full name)
  if (potentialNames.length > 0) {
    // Simple heuristic: treat consecutive potential name words as a single name
    entities.names = potentialNames.slice(0, 3); // Max 3 name parts
  }
  
  // Extract businesses (e.g., "who do I know at mcdonalds")
  // Pattern: "at [business name]" - typically single word or short phrase
  for (let i = 0; i < words.length; i++) {
    const word = words[i].toLowerCase();
    const nextWord = words[i + 1]?.toLowerCase();
    
    // Pattern: "at [business]" - business names are usually 1-2 words
    if (ENTITY_PREPOSITIONS.business.has(word) && nextWord) {
      // Check if this looks like a business (not a company with suffix, not a location)
      const businessWords: string[] = [];
      for (let j = i + 1; j < words.length && j < i + 3; j++) { // Max 2 words for business
        const w = words[j];
        const wLower = w.toLowerCase();
        
        // Stop if we hit a stop word (but allow first word)
        if (j > i + 1 && STOP_WORDS.has(wLower)) break;
        
        // Stop if we hit a company suffix (this is probably a company, not a business)
        if (COMPANY_SUFFIXES.has(wLower)) break;
        
        businessWords.push(w);
      }
      
      if (businessWords.length > 0) {
        const businessName = businessWords.join(" ");
        // Only add if it doesn't look like a location (common location words)
        const commonLocationWords = ["san", "francisco", "new", "york", "los", "angeles", "chicago", "boston", "seattle"];
        const isLocation = commonLocationWords.some(loc => businessName.toLowerCase().includes(loc));
        
        if (!isLocation && !entities.companies.includes(businessName)) {
          entities.businesses.push(businessName);
        }
      }
    }
  }
  
  // Extract relationships
  entities.relationships = extractRelationships(words);
  
  // Extract locations
  entities.locations = extractLocations(words);
  
  return entities;
}

/**
 * Extract time range from query (with comparative support)
 */
function extractTimeRange(query: string): TimeRange | undefined {
  const normalized = normalizeQuery(query);
  
  // Check for comparative patterns first (e.g., "more than 30 days ago")
  const comparativePatterns = [
    { regex: /more\s+than\s+(\d+)\s+days?\s+ago/i, operator: "more than" as const },
    { regex: /less\s+than\s+(\d+)\s+days?\s+ago/i, operator: "less than" as const },
    { regex: /over\s+(\d+)\s+days?\s+ago/i, operator: "more than" as const },
    { regex: /within\s+(\d+)\s+days?/i, operator: "less than" as const },
  ];
  
  for (const { regex, operator } of comparativePatterns) {
    const match = normalized.match(regex);
    if (match && match[1]) {
      const days = parseInt(match[1], 10);
      const end = new Date();
      const start = new Date();
      
      if (operator === "more than") {
        // More than X days ago = before (now - X days)
        start.setTime(0); // Beginning of time
        end.setDate(end.getDate() - days);
        end.setHours(23, 59, 59, 999);
      } else if (operator === "less than") {
        // Less than X days ago = within last X days
        start.setDate(end.getDate() - days);
        start.setHours(0, 0, 0, 0);
      }
      
      return { start, end };
    }
  }
  
  // Check for relative time expressions
  if (normalized.includes("recently")) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 7); // Last 7 days
    return { start, end };
  }
  
  if (normalized.includes("a while ago") || normalized.includes("awhile ago")) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30); // More than 30 days ago
    return { start, end };
  }
  
  // FIRST: Check for combined patterns like "last [day] [time-of-day]" (e.g., "last friday night")
  // This must come before individual day/time-of-day checks
  const dayNamesPattern = DAY_NAMES.join("|");
  const timeOfDayKeys = Object.keys(TIME_OF_DAY).join("|");
  
  // Pattern: "last [day] [time-of-day]" (e.g., "last friday night", "last monday morning")
  const lastDayTimePattern = new RegExp(
    `last\\s+(${dayNamesPattern})\\s+(${timeOfDayKeys})`,
    "i"
  );
  const lastDayTimeMatch = normalized.match(lastDayTimePattern);
  
  if (lastDayTimeMatch) {
    const dayName = lastDayTimeMatch[1].toLowerCase();
    const timeOfDay = lastDayTimeMatch[2].toLowerCase();
    const dayIndex = DAY_NAMES.findIndex(d => d.toLowerCase() === dayName);
    const timeRange = TIME_OF_DAY[timeOfDay as keyof typeof TIME_OF_DAY];
    
    if (dayIndex !== -1 && timeRange) {
      const end = new Date();
      const start = new Date();
      const today = end.getDay();
      const targetDay = dayIndex;
      
      // Calculate days to subtract to get to the most recent occurrence of that day
      let daysDiff = today - targetDay;
      if (daysDiff < 0) daysDiff += 7; // If target day is in the future, go to last week
      if (daysDiff === 0) daysDiff = 7; // If today is the target day, go to last week
      
      start.setDate(end.getDate() - daysDiff);
      start.setHours(timeRange.start, 0, 0, 0);
      
      // Handle night time range (9pm - 5am spans midnight)
      if (timeRange.end < timeRange.start) {
        // Night: 21:00 - 05:00 (next day)
        end.setDate(start.getDate() + 1);
        end.setHours(timeRange.end, 0, 0, 0);
      } else if (timeRange.end === 24) {
        end.setDate(start.getDate());
        end.setHours(23, 59, 59, 999);
      } else {
        end.setDate(start.getDate());
        end.setHours(timeRange.end, 0, 0, 0);
      }
      
      return { start, end };
    }
  }
  
  // Check for time-of-day patterns combined with "today", "yesterday", or "this"
  // Pattern: "this morning", "yesterday afternoon", "today night", etc.
  const timeOfDayPattern2 = new RegExp(
    `(this|today|yesterday)\\s+(${Object.keys(TIME_OF_DAY).join("|")})`,
    "i"
  );
  const timeOfDayMatch = normalized.match(timeOfDayPattern2);
  
  if (timeOfDayMatch) {
    const dayRef = timeOfDayMatch[1].toLowerCase();
    const timeOfDay = timeOfDayMatch[2].toLowerCase();
    const timeRange = TIME_OF_DAY[timeOfDay as keyof typeof TIME_OF_DAY];
    
    if (timeRange) {
      const end = new Date();
      const start = new Date();
      
      // Set the date based on day reference
      if (dayRef === "yesterday") {
        start.setDate(end.getDate() - 1);
        end.setDate(end.getDate() - 1);
      } else {
        // "this" or "today" - use today
        start.setDate(end.getDate());
        end.setDate(end.getDate());
      }
      
      // Set hours based on time of day
      start.setHours(timeRange.start, 0, 0, 0);
      
      // Handle night time range (9pm - 5am spans midnight)
      if (timeRange.end < timeRange.start) {
        // Night: 21:00 - 05:00 (next day)
        end.setDate(end.getDate() + 1);
        end.setHours(timeRange.end, 0, 0, 0);
      } else if (timeRange.end === 24) {
        end.setHours(23, 59, 59, 999);
      } else {
        end.setHours(timeRange.end, 0, 0, 0);
      }
      
      return { start, end };
    }
  }
  
  // Check for standalone time-of-day words (assume "today" if not specified)
  // Only match if no day reference was found above
  if (!timeOfDayMatch) {
    // Check if query contains a time-of-day word without a preceding day reference
    const timeOfDayWords = Object.keys(TIME_OF_DAY).join("|");
    const standalonePattern = new RegExp(
      `\\b(${timeOfDayWords})\\b`,
      "i"
    );
    const standaloneMatch = normalized.match(standalonePattern);
    
    if (standaloneMatch) {
      // Verify there's no day reference before the time-of-day word
      const matchIndex = normalized.indexOf(standaloneMatch[0]);
      const beforeMatch = normalized.substring(0, matchIndex);
      const hasDayRefBefore = /\b(this|today|yesterday|last)\s*$/i.test(beforeMatch.trim());
      
      if (!hasDayRefBefore) {
        const timeOfDay = standaloneMatch[1].toLowerCase();
        const timeRange = TIME_OF_DAY[timeOfDay as keyof typeof TIME_OF_DAY];
        
        if (timeRange) {
          const end = new Date();
          const start = new Date();
          
          // Default to today
          start.setHours(timeRange.start, 0, 0, 0);
          
          if (timeRange.end === 24) {
            end.setHours(23, 59, 59, 999);
          } else {
            end.setHours(timeRange.end, 0, 0, 0);
          }
          
          return { start, end };
        }
      }
    }
  }
  
  // Check for time patterns
  for (const [pattern, getRange] of Object.entries(TIME_PATTERNS)) {
    if (normalized.includes(pattern)) {
      return getRange();
    }
  }
  
  // Check for day names (Monday, Tuesday, etc.)
  // Skip if we already matched a combined pattern above
  if (!lastDayTimeMatch) {
    for (let i = 0; i < DAY_NAMES.length; i++) {
      const dayName = DAY_NAMES[i];
      if (normalized.includes(dayName)) {
        const end = new Date();
        const start = new Date();
        const today = end.getDay();
        const targetDay = i;
        
        // Calculate days to subtract to get to the most recent occurrence of that day
        let daysDiff = today - targetDay;
        if (daysDiff < 0) daysDiff += 7; // If target day is in the future, go to last week
        if (daysDiff === 0 && normalized.includes("last")) {
          daysDiff = 7; // "last Monday" means previous Monday
        }
        
        start.setDate(end.getDate() - daysDiff);
        start.setHours(0, 0, 0, 0);
        end.setDate(start.getDate());
        end.setHours(23, 59, 59, 999);
        
        return { start, end };
      }
    }
  }
  
  // Check for month names (March, April, etc.)
  for (let i = 0; i < MONTH_NAMES.length; i++) {
    const monthName = MONTH_NAMES[i];
    if (normalized.includes(monthName)) {
      const end = new Date();
      const start = new Date();
      const currentYear = end.getFullYear();
      
      // Check if "last" is mentioned (last March = previous year's March)
      const isLastYear = normalized.includes("last");
      const year = isLastYear ? currentYear - 1 : currentYear;
      
      start.setFullYear(year, i, 1);
      start.setHours(0, 0, 0, 0);
      
      // Get last day of month
      end.setFullYear(year, i + 1, 0);
      end.setHours(23, 59, 59, 999);
      
      return { start, end };
    }
  }
  
  // Check for "last X days/weeks/months"
  const lastMatch = normalized.match(/last\s+(\d+)\s+(day|days|week|weeks|month|months|year|years)/);
  if (lastMatch) {
    const amount = parseInt(lastMatch[1], 10);
    const unit = lastMatch[2];
    const end = new Date();
    const start = new Date();
    
    if (unit.startsWith("day")) {
      start.setDate(end.getDate() - amount);
    } else if (unit.startsWith("week")) {
      start.setDate(end.getDate() - (amount * 7));
    } else if (unit.startsWith("month")) {
      start.setMonth(end.getMonth() - amount);
    } else if (unit.startsWith("year")) {
      start.setFullYear(end.getFullYear() - amount);
    }
    
    return { start, end };
  }
  
  // Check for "in the last X days" pattern
  const inLastMatch = normalized.match(/in\s+the\s+last\s+(\d+)\s+(day|days|week|weeks|month|months)/);
  if (inLastMatch) {
    const amount = parseInt(inLastMatch[1], 10);
    const unit = inLastMatch[2];
    const end = new Date();
    const start = new Date();
    
    if (unit.startsWith("day")) {
      start.setDate(end.getDate() - amount);
    } else if (unit.startsWith("week")) {
      start.setDate(end.getDate() - (amount * 7));
    } else if (unit.startsWith("month")) {
      start.setMonth(end.getMonth() - amount);
    }
    
    return { start, end };
  }
  
  return undefined;
}

/**
 * Extract interaction time range (when interaction happened, not when contact was created)
 */
function extractInteractionTimeRange(query: string): TimeRange | undefined {
  const normalized = normalizeQuery(query);
  
  // Check for patterns like "emailed last week", "called yesterday", "met this morning"
  const interactionPatterns = [
    /(email|call|meet|talk|contact).*?(last|this|yesterday|today|morning|afternoon|evening|night)/i,
    /(last|this|yesterday|today|morning|afternoon|evening|night).*?(email|call|meet|talk|contact)/i,
  ];
  
  for (const pattern of interactionPatterns) {
    if (pattern.test(normalized)) {
      // Extract the time part and parse it
      return extractTimeRange(query);
    }
  }
  
  return undefined;
}

/**
 * Generate human-readable interpretation of the query
 */
function generateInterpretation(parsed: Omit<ParsedQuery, "interpretation">): string {
  const parts: string[] = [];
  
  if (parsed.timeRange) {
    const start = parsed.timeRange.start;
    const end = parsed.timeRange.end;
    const isSameDay = start.toDateString() === end.toDateString();
    
    if (isSameDay) {
      const hours = start.getHours();
      const endHours = end.getHours();
      if (hours === 0 && endHours === 23) {
        parts.push(`added on ${start.toLocaleDateString()}`);
      } else {
        parts.push(`added ${start.toLocaleDateString()} ${hours}:00-${endHours}:00`);
      }
    } else {
      parts.push(`added between ${start.toLocaleDateString()} and ${end.toLocaleDateString()}`);
    }
  }
  
  if (parsed.interactionTimeRange) {
    parts.push(`interacted ${parsed.interactionTimeRange.start.toLocaleDateString()}`);
  }
  
  if (parsed.interactionType) {
    parts.push(`via ${parsed.interactionType}`);
  }
  
  if (parsed.entities.companies.length > 0) {
    parts.push(`from ${parsed.entities.companies.join(", ")}`);
  }
  
  if (parsed.entities.locations.length > 0) {
    parts.push(`in ${parsed.entities.locations.join(", ")}`);
  }
  
  if (parsed.entities.relationships.length > 0) {
    parts.push(`who are ${parsed.entities.relationships.join(", ")}`);
  }
  
  if (parsed.entities.roles.length > 0) {
    parts.push(`with role ${parsed.entities.roles.join(", ")}`);
  }
  
  if (parsed.needsFollowUp) {
    parts.push("needing follow-up");
  }
  
  if (parsed.responsibility) {
    const resp = parsed.responsibility;
    const responsibility = RESPONSIBILITIES[resp.responsibilityId];
    const domainName = responsibility?.domain.toUpperCase() || resp.responsibilityId;
    parts.push(`responsible for "${resp.matchedAlias}" (${domainName})`);
  } else {
    // Check if there was a responsibility phrase but no match (fallback case)
    const responsibilityPatterns: Array<{ pattern: RegExp; phraseIndex: number }> = [
      { pattern: /who\s+(handles|manages|owns)\s+(.+)/i, phraseIndex: 2 },
      { pattern: /who\s+is\s+responsible\s+for\s+(.+)/i, phraseIndex: 1 },
      { pattern: /point\s+of\s+contact\s+for\s+(.+)/i, phraseIndex: 1 },
      { pattern: /who\s+do\s+i\s+talk\s+to\s+about\s+(.+)/i, phraseIndex: 1 },
    ];
    
    const normalized = normalizeQuery(parsed.originalQuery);
    for (const { pattern, phraseIndex } of responsibilityPatterns) {
      const match = normalized.match(pattern);
      if (match && match[phraseIndex]) {
        const phrase = match[phraseIndex].trim();
        // If we have keywords from this phrase but no responsibility match, indicate fallback
        if (parsed.keywords.some(k => phrase.toLowerCase().includes(k))) {
          parts.push(`(no predefined responsibility found — showing keyword matches for "${phrase}")`);
        }
        break;
      }
    }
  }
  
  // Only show keywords if we don't have specific entity filters
  // This prevents confusing interpretations like "with role ops directors, containing 'know ops operations directors'"
  const hasEntityFilters = parsed.entities.companies.length > 0 || 
                          parsed.entities.roles.length > 0 || 
                          parsed.entities.departments.length > 0 ||
                          parsed.entities.locations.length > 0 ||
                          parsed.entities.names.length > 0;
  
  if (parsed.keywords.length > 0 && !hasEntityFilters) {
    // Only show keywords if they're meaningful (not query structure words)
    const meaningfulKeywords = parsed.keywords.filter(k => k.length >= 3);
    if (meaningfulKeywords.length > 0) {
      parts.push(`containing "${meaningfulKeywords.join(" ")}"`);
    }
  }
  
  if (parts.length === 0) {
    return "Searching all contacts";
  }
  
  return `Searching contacts ${parts.join(", ")}`;
}

/**
 * Extract meaningful keywords from query
 * Excludes query structure words, entities already extracted, and stop words
 */
function extractKeywords(words: string[]): string[] {
  // Extended list of query structure words to filter out
  const queryStructureWords = new Set([
    "know", "knows", "knew", "known", "knowing",
    "do", "does", "did", "done", "doing",
    "i", "you", "we", "they", "he", "she", "it",
    "any", "anyone", "someone", "somebody", "anybody",
    "who", "what", "where", "when", "why", "how",
    "is", "are", "was", "were", "been", "being",
    "have", "has", "had", "having",
    "can", "could", "should", "would", "will", "shall",
    "find", "finds", "found", "finding",
    "show", "shows", "showed", "shown", "showing",
    "get", "gets", "got", "getting",
    "search", "searches", "searched", "searching",
    "look", "looks", "looked", "looking",
    "tell", "tells", "told", "telling",
    "see", "sees", "saw", "seen", "seeing",
  ]);
  
  return words
    .map(w => w.toLowerCase())
    .filter(w => {
      if (w.length < 2) return false;
      if (STOP_WORDS.has(w)) return false;
      if (queryStructureWords.has(w)) return false;
      if (ACTION_KEYWORDS[w]) return false;
      if (ENTITY_PREPOSITIONS.company.has(w)) return false;
      if (ENTITY_PREPOSITIONS.location.has(w)) return false;
      // Filter out time-related words
      if (["last", "this", "week", "month", "year", "today", "yesterday", "recent"].includes(w)) return false;
      // Filter out time-of-day words (they're handled by time range extraction)
      if (Object.keys(TIME_OF_DAY).includes(w)) return false;
      // Filter out day and month names
      if (DAY_NAMES.includes(w) || MONTH_NAMES.includes(w)) return false;
      // Filter out interaction keywords
      if (Object.values(INTERACTION_KEYWORDS).some(keywords => keywords.includes(w))) return false;
      // Filter out relationship keywords
      if (Object.values(RELATIONSHIP_KEYWORDS).some(keywords => keywords.includes(w))) return false;
      return true;
    });
}

/**
 * Extract company from natural language question patterns
 * This runs FIRST and handles common question patterns explicitly
 * Uses the ORIGINAL query (not normalized) to preserve structure
 */
function extractCompanyFromQuestionPatterns(query: string): string | null {
  console.log('[SEARCH DEBUG] extractCompanyFromQuestionPatterns - Input query:', query);
  
  // Try multiple specific patterns in order of specificity
  
  // Pattern 1: "who do I know at [company]" - most specific
  // Improved regex to capture company names including suffixes like "inc", "llc", etc.
  let match = query.match(/who\s+(?:do|does|did)\s+(?:i|you|we|they)\s+know\s+(?:at|from|@)\s+([^?]+?)(?:\s*\?|$)/i);
  console.log('[SEARCH DEBUG] Pattern 1 match:', match);
  if (match && match[1]) {
    console.log('[SEARCH DEBUG] Pattern 1 captured:', match[1]);
    const company = cleanCompanyName(match[1]);
    console.log('[SEARCH DEBUG] Pattern 1 cleaned company:', company);
    if (company) return company;
  }
  
  // Pattern 1b: More specific pattern that handles "at tech solutions inc" better
  match = query.match(/who\s+(?:do|does|did)\s+(?:i|you|we|they)\s+know\s+(?:at|from|@)\s+([a-zA-Z0-9]+(?:\s+[a-zA-Z0-9]+)*(?:\s+(?:inc|llc|ltd|corp|company|co)\.?)?)(?:\s*\?|$)/i);
  console.log('[SEARCH DEBUG] Pattern 1b match:', match);
  if (match && match[1]) {
    console.log('[SEARCH DEBUG] Pattern 1b captured:', match[1]);
    const company = cleanCompanyName(match[1]);
    console.log('[SEARCH DEBUG] Pattern 1b cleaned company:', company);
    if (company) return company;
  }
  
  // Pattern 2: "who do I know at [company]?" - alternative word order
  match = query.match(/who\s+(?:do|does|did)\s+(?:i|you|we|they)\s+know\s+(?:at|from|@)\s+([^?]+)/i);
  console.log('[SEARCH DEBUG] Pattern 2 match:', match);
  if (match && match[1]) {
    console.log('[SEARCH DEBUG] Pattern 2 captured:', match[1]);
    const company = cleanCompanyName(match[1]);
    console.log('[SEARCH DEBUG] Pattern 2 cleaned company:', company);
    if (company) return company;
  }
  
  // Pattern 3: "who works at [company]"
  match = query.match(/who\s+(?:works?|work)\s+(?:at|for|@)\s+([^?]+?)(?:\s*\?|$)/i);
  console.log('[SEARCH DEBUG] Pattern 3 match:', match);
  if (match && match[1]) {
    const company = cleanCompanyName(match[1]);
    if (company) return company;
  }
  
  // Pattern 4: "who is at [company]"
  match = query.match(/who\s+(?:is|are)\s+(?:at|from|@)\s+([^?]+?)(?:\s*\?|$)/i);
  console.log('[SEARCH DEBUG] Pattern 4 match:', match);
  if (match && match[1]) {
    const company = cleanCompanyName(match[1]);
    if (company) return company;
  }
  
  // Pattern 5: Generic "at [company]" - find "at" and extract what follows
  // This is a fallback that should catch most cases
  // Look for "at" as a word boundary (not part of another word)
  // Improved regex to capture multi-word company names including suffixes
  const atMatch = query.match(/\b(at|from|@)\s+([^?]+?)(?:\s*\?|$)/i);
  console.log('[SEARCH DEBUG] Pattern 5 (generic at) match:', atMatch);
  if (atMatch && atMatch[2]) {
    console.log('[SEARCH DEBUG] Pattern 5 captured:', atMatch[2]);
    const company = cleanCompanyName(atMatch[2]);
    console.log('[SEARCH DEBUG] Pattern 5 cleaned company:', company);
    if (company) return company;
  }
  
  // Pattern 5b: More specific "at [company]" with better word boundary handling
  // This handles "at tech solutions inc" more reliably
  const atMatch2 = query.match(/(?:^|\s)(?:at|from|@)\s+([a-zA-Z0-9]+(?:\s+[a-zA-Z0-9]+)*(?:\s+(?:inc|llc|ltd|corp|company|co))?\.?)(?:\s*\?|$)/i);
  console.log('[SEARCH DEBUG] Pattern 5b (enhanced at) match:', atMatch2);
  if (atMatch2 && atMatch2[1]) {
    console.log('[SEARCH DEBUG] Pattern 5b captured:', atMatch2[1]);
    const company = cleanCompanyName(atMatch2[1]);
    console.log('[SEARCH DEBUG] Pattern 5b cleaned company:', company);
    if (company) return company;
  }
  
  // Pattern 6: "at [company]" at start or with word boundary
  match = query.match(/(?:^|\s)(?:at|from|@)\s+([a-zA-Z0-9]+(?:\s+[a-zA-Z0-9]+)*?)(?:\s*\?|$)/i);
  console.log('[SEARCH DEBUG] Pattern 6 match:', match);
  if (match && match[1]) {
    const company = cleanCompanyName(match[1]);
    if (company) return company;
  }
  
  console.log('[SEARCH DEBUG] extractCompanyFromQuestionPatterns - No company found');
  return null;
}

/**
 * Clean and validate company name extracted from query
 */
function cleanCompanyName(rawCompany: string): string | null {
  console.log('[SEARCH DEBUG] cleanCompanyName - Input:', rawCompany);
  if (!rawCompany) return null;
  
  // Remove trailing punctuation
  let cleaned = rawCompany.trim().replace(/[?!.,;:]+$/, "").trim();
  console.log('[SEARCH DEBUG] cleanCompanyName - After punctuation removal:', cleaned);
  if (!cleaned) return null;
  
  // Split into words and filter
  const words = cleaned.split(/\s+/);
  console.log('[SEARCH DEBUG] cleanCompanyName - Split words:', words);
  const filtered: string[] = [];
  
  for (const word of words) {
    const wLower = word.toLowerCase();
    
    // Always keep company suffixes
    if (COMPANY_SUFFIXES.has(wLower)) {
      console.log('[SEARCH DEBUG] cleanCompanyName - Keeping suffix:', word);
      filtered.push(word);
      continue;
    }
    
    // Filter out query structure words
    const skipWords = new Set([
      "who", "what", "where", "when", "why", "how",
      "do", "does", "did", "is", "are", "was", "were",
      "i", "you", "we", "they", "he", "she", "it",
      "know", "knows", "knew", "known",
      "works", "work", "worked", "working",
      "at", "from", "for", "the", "a", "an"
    ]);
    
    if (skipWords.has(wLower)) {
      console.log('[SEARCH DEBUG] cleanCompanyName - Skipping query word:', word);
      continue; // Skip this word
    }
    
    // Filter out action keywords
    if (ACTION_KEYWORDS[wLower]) {
      console.log('[SEARCH DEBUG] cleanCompanyName - Skipping action word:', word);
      continue; // Skip action words
    }
    
    // Keep everything else (likely part of company name)
    // Note: "solutions", "technologies", etc. are in COMPANY_SUFFIXES but they're also valid company name words
    // So we keep them here - they'll be handled properly in matching
    console.log('[SEARCH DEBUG] cleanCompanyName - Keeping word:', word);
    filtered.push(word);
  }
  
  console.log('[SEARCH DEBUG] cleanCompanyName - Filtered words:', filtered);
  if (filtered.length === 0) return null;
  
  const result = filtered.join(" ").trim();
  console.log('[SEARCH DEBUG] cleanCompanyName - Final result:', result);
  
  // Final validation: make sure we have at least one meaningful word (not just suffixes)
  const meaningfulWords = filtered.filter(w => {
    const wLower = w.toLowerCase();
    // Count as meaningful if it's not just a company suffix
    // But allow suffixes as part of the name (e.g., "Tech Solutions Inc" is valid)
    return w.length >= 2;
  });
  
  if (meaningfulWords.length === 0) {
    console.log('[SEARCH DEBUG] cleanCompanyName - No meaningful words, returning null');
    return null;
  }
  
  return result || null;
}

/**
 * Parse search query into structured, deterministic result
 */
export function parseSearchQuery(query: string): ParsedQuery {
  // Detect email/phone in query first
  const emailOrPhone = detectEmailOrPhone(query);
  
  const normalized = normalizeQuery(query);
  const words = normalized.split(" ").filter(Boolean);
  
  // Detect action
  const { action, remainingWords } = detectAction(words);
  
  // Determine intent (enhanced with question classification)
  let intent: IntentType = "find";
  if (action) {
    intent = "action";
  } else if (isQuestion(query)) {
    intent = "question";
    const questionType = classifyQuestionType(query);
    // Use question intent to guide entity extraction
  }
  
  // PRIORITY 1: Extract company from natural language question patterns FIRST
  // This handles "who do I know at X" patterns explicitly before any other logic
  console.log('[SEARCH DEBUG] parseSearchQuery - Starting parse for query:', query);
  console.log('[SEARCH DEBUG] parseSearchQuery - Normalized:', normalized);
  console.log('[SEARCH DEBUG] parseSearchQuery - Words:', words);
  console.log('[SEARCH DEBUG] parseSearchQuery - Remaining words:', remainingWords);
  
  const questionCompany = extractCompanyFromQuestionPatterns(query);
  console.log('[SEARCH DEBUG] parseSearchQuery - Question company extracted:', questionCompany);
  
  // Extract entities from remaining words (with semantic verb hints)
  const entities = extractEntities(remainingWords);
  console.log('[SEARCH DEBUG] parseSearchQuery - Entities extracted:', {
    companies: entities.companies,
    roles: entities.roles,
    names: entities.names,
    locations: entities.locations
  });
  
  // If we extracted a company from question patterns, add it (highest priority)
  if (questionCompany && !entities.companies.includes(questionCompany)) {
    console.log('[SEARCH DEBUG] parseSearchQuery - Adding question company to entities');
    entities.companies.unshift(questionCompany); // Add to front to prioritize
  }
  console.log('[SEARCH DEBUG] parseSearchQuery - Final companies:', entities.companies);
  
  // Special case: If still no company was found and query contains "at [words]", try direct extraction
  // This handles queries like "who do I know at quantum solutions?" where the question structure
  // might prevent normal extraction
  // Also try extracting from the full query text, not just remaining words
  if (entities.companies.length === 0) {
    // Try extracting from the full normalized query
    const fullQueryCompany = extractCompanyFromQuestionPatterns(normalized);
    if (fullQueryCompany && !entities.companies.includes(fullQueryCompany)) {
      entities.companies.unshift(fullQueryCompany);
    }
  }
  
  // Final fallback: If still no company found, try one more time with the original query
  if (entities.companies.length === 0) {
    // Look for "at" in the full normalized query (not just remainingWords)
    const allWords = normalized.split(" ").filter(Boolean);
    const atIndex = allWords.findIndex(w => ENTITY_PREPOSITIONS.company.has(w.toLowerCase()));
    if (atIndex >= 0 && atIndex < allWords.length - 1) {
      // Extract words after "at"
      const companyWords: string[] = [];
      for (let j = atIndex + 1; j < allWords.length; j++) {
        const w = allWords[j];
        const wLower = w.toLowerCase();
        // Stop on significant stop words (but allow "the", "a", "an")
        // Don't stop on question words or query structure words
        const questionWords = ["who", "what", "where", "when", "why", "how"];
        const queryStructureWords = ["know", "do", "does", "did", "i", "you", "we", "they"];
        if (STOP_WORDS.has(wLower) && j > atIndex + 1 && companyWords.length > 0) {
          if (wLower !== "the" && wLower !== "a" && wLower !== "an" && 
              !questionWords.includes(wLower) && !queryStructureWords.includes(wLower)) {
            break;
          }
        }
        companyWords.push(w);
        // If we hit a company suffix, include it and stop
        if (COMPANY_SUFFIXES.has(wLower)) break;
      }
      if (companyWords.length > 0) {
        const companyName = companyWords.join(" ").replace(/[?!.,;:]+$/, "").trim();
        if (companyName && !entities.companies.includes(companyName)) {
          entities.companies.push(companyName);
        }
      }
    }
  }
  
  // Apply entity disambiguation for ambiguous entities
  for (let i = 0; i < entities.names.length; i++) {
    const name = entities.names[i];
    const context = {
      before: i > 0 ? remainingWords[i - 1] : undefined,
      after: i < remainingWords.length - 1 ? remainingWords[i + 1] : undefined,
      query: normalized,
    };
    const disambiguation = disambiguateEntity(name, context);
    
    // If disambiguation suggests it's not a name, move it to appropriate entity type
    if (disambiguation.type === "company" && disambiguation.confidence > 0.5) {
      entities.companies.push(name);
      entities.names.splice(i, 1);
      i--;
    } else if (disambiguation.type === "role" && disambiguation.confidence > 0.5) {
      entities.roles.push(name);
      entities.names.splice(i, 1);
      i--;
    }
  }
  
  // Fallback: If no company was extracted but query contains "at [words]", try to extract it
  // This handles cases where the extraction might have missed the company
  // Use regex pattern matching as a more robust fallback
  // Also check the ORIGINAL query (before normalization) in case normalization removed something
  if (entities.companies.length === 0) {
    // First, try the original query with a simple pattern
    const originalAtMatch = query.match(/(?:^|\s)(?:at|from|@)\s+([^?]+?)(?:\s*\?|$)/i);
    if (originalAtMatch && originalAtMatch[1]) {
      const potentialCompany = originalAtMatch[1].trim();
      // Remove trailing punctuation
      const cleaned = potentialCompany.replace(/[?!.,;:]+$/, "").trim();
      if (cleaned) {
        // Split and filter - be more permissive here
        const companyWords = cleaned.split(/\s+/).filter(w => {
          const wLower = w.toLowerCase();
          if (!wLower) return false;
          // Keep company suffixes
          if (COMPANY_SUFFIXES.has(wLower)) return true;
          // Filter out obvious stop words but be lenient
          const obviousStopWords = ["who", "what", "where", "when", "why", "how", "do", "does", "did", "i", "know", "you", "we", "they"];
          if (obviousStopWords.includes(wLower)) return false;
          // Keep everything else
          return true;
        });
        if (companyWords.length > 0) {
          const companyName = companyWords.join(" ").trim();
          if (companyName && !entities.companies.includes(companyName)) {
            entities.companies.push(companyName);
          }
        }
      }
    }
    // Pattern: "at [company name]" - match "at" followed by words
    // Try multiple patterns to catch different cases
    const atCompanyPatterns = [
      // Pattern 1: "at [words]" at end of query (with or without question mark)
      /(?:^|\s)(?:at|from|@)\s+([a-z0-9\s]+?)(?:\s*\?|$)/i,
      // Pattern 2: "at [words]" anywhere in query
      /(?:^|\s)(?:at|from|@)\s+([a-z0-9\s]+?)(?=\s|$)/i,
      // Pattern 3: More permissive - just "at" followed by non-stop words
      /(?:^|\s)(?:at|from|@)\s+((?:[a-z0-9]+(?:\s+[a-z0-9]+)*))/i,
    ];
    
    for (const pattern of atCompanyPatterns) {
      const match = normalized.match(pattern);
      if (match && match[1]) {
        const potentialCompany = match[1].trim();
        // Remove trailing question marks and punctuation
        const cleaned = potentialCompany.replace(/[?!.,;:]+$/, "").trim();
        
        if (cleaned) {
          // Split into words and filter out stop words (but keep company suffixes)
          const companyWords = cleaned.split(/\s+/).filter(w => {
            const wLower = w.toLowerCase();
            // Remove empty strings
            if (!wLower) return false;
            // Keep company suffixes
            if (COMPANY_SUFFIXES.has(wLower)) return true;
            // Filter out stop words (except allow "the", "a", "an")
            if (STOP_WORDS.has(wLower) && wLower !== "the" && wLower !== "a" && wLower !== "an") {
              return false;
            }
            // Filter out question words
            const questionWords = ["who", "what", "where", "when", "why", "how", "do", "does", "did", "i", "know"];
            if (questionWords.includes(wLower)) return false;
            // Filter out action words
            if (ACTION_KEYWORDS[wLower]) return false;
            return true;
          });
          
          if (companyWords.length > 0) {
            const companyName = companyWords.join(" ").trim();
            if (companyName && !entities.companies.includes(companyName)) {
              entities.companies.push(companyName);
              break; // Found a company, stop trying other patterns
            }
          }
        }
      }
    }
    
    // Also try the word-by-word approach as additional fallback
    let atIndex = remainingWords.findIndex(w => ENTITY_PREPOSITIONS.company.has(w.toLowerCase()));
    let wordsToSearch = remainingWords;
    
    // If not found in remainingWords, check all words (in case "at" was in the original query)
    if (atIndex === -1) {
      const allWords = normalized.split(" ").filter(Boolean);
      atIndex = allWords.findIndex(w => ENTITY_PREPOSITIONS.company.has(w.toLowerCase()));
      wordsToSearch = allWords;
    }
    
    if (atIndex >= 0 && atIndex < wordsToSearch.length - 1 && entities.companies.length === 0) {
      // Extract words after "at"
      const companyWords: string[] = [];
      for (let j = atIndex + 1; j < wordsToSearch.length; j++) {
        const w = wordsToSearch[j];
        const wLower = w.toLowerCase();
        // Stop on significant stop words (but allow "the", "a", "an")
        // Also don't stop on question marks or other punctuation that might be at the end
        const questionWords = ["who", "what", "where", "when", "why", "how"];
        if (STOP_WORDS.has(wLower) && j > atIndex + 1 && companyWords.length > 0) {
          if (wLower !== "the" && wLower !== "a" && wLower !== "an" && !questionWords.includes(wLower)) {
            break;
          }
        }
        companyWords.push(w);
        // If we hit a company suffix, include it and stop
        if (COMPANY_SUFFIXES.has(wLower)) break;
      }
      if (companyWords.length > 0) {
        const companyName = companyWords.join(" ");
        // Remove any trailing punctuation
        const cleanedName = companyName.replace(/[?!.,;:]+$/, "").trim();
        if (cleanedName && !entities.companies.includes(cleanedName)) {
          entities.companies.push(cleanedName);
        }
      }
    }
  }
  
  // Extract negated entities
  const negatedEntities = extractNegations(remainingWords);
  
  // Extract keywords (NO synonym expansion - only use for text search)
  // Synonym expansion should only be used for entity extraction, not keyword matching
  const rawKeywords = extractKeywords(remainingWords);
  
  // Filter out keywords that are already extracted as entities
  // This prevents duplicate matching and over-filtering
  const keywords: string[] = [];
  for (const keyword of rawKeywords) {
    const keywordLower = keyword.toLowerCase();
    
    // Skip if already extracted as an entity
    const isEntity = 
      entities.names.some(n => n.toLowerCase().includes(keywordLower) || keywordLower.includes(n.toLowerCase())) ||
      entities.companies.some(c => c.toLowerCase().includes(keywordLower) || keywordLower.includes(c.toLowerCase())) ||
      entities.roles.some(r => r.toLowerCase().includes(keywordLower) || keywordLower.includes(r.toLowerCase())) ||
      entities.departments.some(d => d.toLowerCase().includes(keywordLower) || keywordLower.includes(d.toLowerCase())) ||
      entities.locations.some(l => l.toLowerCase().includes(keywordLower) || keywordLower.includes(l.toLowerCase()));
    
    if (!isEntity) {
      keywords.push(keyword);
    }
  }
  
  // Remove duplicates and keep original order
  const uniqueKeywords = Array.from(new Set(keywords));
  
  // Extract time range if present (for creation date)
  const timeRange = extractTimeRange(query);
  
  // Extract comparative filters
  const comparativeFilters = extractComparativeFilters(query);
  
  // Extract interaction type
  let interactionType = extractInteractionType(query);
  
  // Extract interaction time range
  let interactionTimeRange = extractInteractionTimeRange(query);
  
  // Check if query contains "add" or "added" - indicates creation date search
  const hasAddKeyword = normalized.includes("add") || normalized.includes("added");
  
  // If query has "add"/"added" and a time range, prioritize creation date over interaction date
  // This handles queries like "who did I add today?" vs "who did I meet today?"
  // When "add" is present, we want creation date, not interaction date
  if (hasAddKeyword && timeRange) {
    // Clear interaction filters - user is asking about when contacts were added, not when they interacted
    interactionType = null;
    interactionTimeRange = undefined;
  } else if (interactionType && timeRange && !hasAddKeyword) {
    // If query has interaction keywords and time range but no "add"/"added",
    // it's ambiguous. Default to creation date since that's what we're tracking.
    // This handles "who did I meet today?" - treat as "who did I add today?"
    interactionType = null;
    interactionTimeRange = undefined;
  }
  
  // Extract needs follow-up
  const needsFollowUp = extractNeedsFollowUp(query);
  
  // Determine search type for OpenStreetMap lookup
  // If query has businesses, it's a business search
  // If query has locations, it's a location search
  // If both, it's "both"
  let searchType: "business" | "location" | "both" | undefined;
  const hasBusinesses = entities.businesses.length > 0;
  const hasLocations = entities.locations.length > 0;
  
  if (hasBusinesses && hasLocations) {
    searchType = "both";
  } else if (hasBusinesses) {
    searchType = "business";
  } else if (hasLocations) {
    searchType = "location";
  }
  
  // Extract responsibility
  const responsibilityResult = extractResponsibility(query);
  const responsibility = responsibilityResult.match;
  const responsibilityPhrase = responsibilityResult.phrase;
  
  // If responsibility is found, expand its filters into entities
  if (responsibility) {
    // Add responsibility departments to entities
    if (responsibility.filters.departments) {
      for (const dept of responsibility.filters.departments) {
        if (!entities.departments.includes(dept)) {
          entities.departments.push(dept);
        }
      }
    }
    
    // Add responsibility roles to entities
    if (responsibility.filters.roles) {
      for (const role of responsibility.filters.roles) {
        if (!entities.roles.includes(role)) {
          entities.roles.push(role);
        }
      }
    }
    
    // Add responsibility tags to keywords for fallback search
    if (responsibility.filters.tags) {
      for (const tag of responsibility.filters.tags) {
        if (!uniqueKeywords.includes(tag)) {
          uniqueKeywords.push(tag);
        }
      }
    }
  } else if (responsibilityPhrase) {
    // Fallback: if responsibility phrase detected but no match, add to keywords for text search
    const normalizedPhrase = normalizeResponsibilityPhrase(responsibilityPhrase);
    const phraseTokens = normalizedPhrase.split(/\s+/).filter(t => t.length >= 2);
    for (const token of phraseTokens) {
      if (!uniqueKeywords.includes(token)) {
        uniqueKeywords.push(token);
      }
    }
  }
  
  // Build search terms (unique, meaningful terms for text search)
  // Only include keywords - entities are handled as filters, not search terms
  // This prevents over-filtering when entities are already extracted
  const searchTerms = uniqueKeywords.filter(t => t.length >= 2);
  
  const parsed: Omit<ParsedQuery, "interpretation"> = {
    intent,
    action,
    entities,
    negatedEntities,
    keywords: uniqueKeywords,
    filters: {},
    originalQuery: query,
    searchTerms,
    searchType,
    timeRange,
    interactionType,
    interactionTimeRange,
    needsFollowUp,
    responsibility: responsibility || null,
    comparativeFilters,
  };
  
  // Generate interpretation
  const interpretation = generateInterpretation(parsed);
  
  return {
    ...parsed,
    interpretation,
  };
}

/**
 * Get search term from query (action-aware)
 */
export function getSearchTerm(query: string): { action: ActionType; searchTerm: string } {
  const parsed = parseSearchQuery(query);
  
  return {
    action: parsed.action,
    searchTerm: parsed.action ? 
      parsed.searchTerms.join(" ") : 
      query.trim()
  };
}

/**
 * Convert ParsedQuery to SearchQuery (canonical schema)
 */
function convertToSearchQuery(parsed: ParsedQuery): SearchQuery {
  // Map intent
  let intent: SearchIntent = "search_contacts";
  if (parsed.intent === "question" && parsed.entities.relationships.length > 0) {
    intent = "relationship_lookup";
  } else if (parsed.timeRange && !parsed.entities.companies.length && !parsed.entities.roles.length) {
    intent = "list_recent";
  }

  // Map filters
  const filters: SearchQuery["filters"] = {};

  // Map company
  if (parsed.entities.companies.length > 0) {
    filters.company = parsed.entities.companies[0]; // Take first company
  }

  // Map job_title (from roles)
  if (parsed.entities.roles.length > 0) {
    filters.job_title = parsed.entities.roles[0]; // Take first role
  }

  // Map name
  if (parsed.entities.names.length > 0) {
    filters.name = parsed.entities.names[0]; // Take first name
  }

  // Map location
  if (parsed.entities.locations.length > 0) {
    filters.location = parsed.entities.locations[0]; // Take first location
  }

  // Map relationship_type
  if (parsed.entities.relationships.length > 0) {
    const rel = parsed.entities.relationships[0].toLowerCase();
    if (rel === "client" || rel === "clients") {
      filters.relationship_type = "client";
    } else if (rel === "vendor" || rel === "vendors") {
      filters.relationship_type = "vendor";
    } else if (rel.includes("met") || rel.includes("meet")) {
      filters.relationship_type = "met";
    } else if (rel.includes("work") || rel.includes("colleague")) {
      filters.relationship_type = "worked_with";
    }
  }

  // Map date_range
  if (parsed.timeRange) {
    filters.date_range = {
      from: parsed.timeRange.start.toISOString(),
      to: parsed.timeRange.end.toISOString(),
    };
  }

  // Map tags (from keywords that look like tags)
  if (parsed.keywords.length > 0) {
    // Filter keywords that might be tags (short, capitalized, or common tag patterns)
    const potentialTags = parsed.keywords.filter(
      (k) => k.length >= 2 && k.length <= 20
    );
    if (potentialTags.length > 0) {
      filters.tags = potentialTags.slice(0, 5); // Limit to 5 tags
    }
  }

  // Map introduced_by (if found in query)
  // This would need additional parsing logic - for now, leave undefined

  // Set confidence (deterministic parse always has high confidence)
  const confidence = 0.7; // Base confidence for deterministic parse
  // Boost confidence if we extracted structured entities
  const hasStructuredFilters =
    filters.company ||
    filters.job_title ||
    filters.relationship_type ||
    filters.date_range;
  const finalConfidence = hasStructuredFilters ? Math.min(0.9, confidence + 0.1) : confidence;

  // Generate explanation
  const explanation = parsed.interpretation || "Deterministic query parsing";

  return {
    intent,
    filters,
    confidence: finalConfidence,
    explanation,
  };
}

/**
 * Parse search query into canonical SearchQuery schema
 * This is the new primary function that outputs the canonical schema
 */
export function parseSearchQueryToSchema(query: string): SearchQuery {
  // First parse using existing deterministic parser
  const parsed = parseSearchQuery(query);
  
  // Convert to canonical schema
  return convertToSearchQuery(parsed);
}
