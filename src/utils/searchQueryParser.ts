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
}

// Action keywords that trigger specific actions
const ACTION_KEYWORDS: Record<string, ActionType> = {
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

// Controlled vocabulary for roles/departments
const ROLE_VOCABULARY = new Set([
  // Departments
  "hr", "sales", "marketing", "engineering", "finance", "legal", "operations",
  "support", "customer service", "it", "tech", "product", "design", "research",
  "development", "accounting", "admin", "administration", "executive",
  // Titles
  "ceo", "cto", "cfo", "coo", "vp", "director", "manager", "lead", "senior",
  "junior", "intern", "associate", "analyst", "consultant", "specialist",
  "coordinator", "assistant", "executive", "founder", "partner", "president",
  "head", "chief", "officer", "developer", "engineer", "designer", "architect"
]);

// Company suffixes to identify company names
const COMPANY_SUFFIXES = new Set([
  "inc", "llc", "ltd", "corp", "corporation", "company", "co", "group",
  "holdings", "partners", "solutions", "technologies", "tech", "systems",
  "enterprises", "industries", "services", "consulting", "agency"
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

/**
 * Normalize query text
 */
function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .replace(/[?!.,;:]+$/g, "") // Remove trailing punctuation
    .replace(/\s+/g, " "); // Normalize whitespace
}

/**
 * Check if query is a question
 */
function isQuestion(query: string): boolean {
  const normalized = normalizeQuery(query);
  
  // Check question mark
  if (query.trim().endsWith("?")) return true;
  
  // Check question starters
  const firstWord = normalized.split(" ")[0];
  if (QUESTION_STARTERS.has(firstWord)) return true;
  
  // Check for "someone who" / "anyone who" patterns
  if (normalized.includes("someone") || normalized.includes("anyone")) {
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
 */
function extractLocations(words: string[]): string[] {
  const locations: string[] = [];
  const normalized = words.join(" ").toLowerCase();
  
  // Check for location synonyms
  for (const [canonical, synonyms] of Object.entries(LOCATION_SYNONYMS)) {
    for (const synonym of synonyms) {
      if (normalized.includes(synonym)) {
        if (!locations.includes(canonical)) {
          locations.push(canonical);
        }
        break;
      }
    }
  }
  
  // Check for location keywords (office, conference, etc.)
  for (const word of words) {
    const lower = word.toLowerCase();
    if (LOCATION_KEYWORDS.has(lower)) {
      if (!locations.includes(lower)) {
        locations.push(lower);
      }
    }
  }
  
  // Check for "in [Location]" or "at [Location]" patterns
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
        if (!locations.includes(location.toLowerCase())) {
          locations.push(location.toLowerCase());
        }
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
  for (let i = 0; i < words.length; i++) {
    const word = words[i].toLowerCase();
    const nextWord = words[i + 1]?.toLowerCase();
    
    // Pattern: "at Company" or "from Company"
    if (ENTITY_PREPOSITIONS.company.has(word) && nextWord) {
      // Capture potential multi-word company name
      const companyWords: string[] = [];
      for (let j = i + 1; j < words.length; j++) {
        const w = words[j];
        if (STOP_WORDS.has(w.toLowerCase()) && j > i + 1) break;
        companyWords.push(w);
        if (COMPANY_SUFFIXES.has(w.toLowerCase())) break;
      }
      if (companyWords.length > 0) {
        entities.companies.push(companyWords.join(" "));
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
  
  // Extract roles and departments from vocabulary
  for (const word of words) {
    const lower = word.toLowerCase();
    if (ROLE_VOCABULARY.has(lower)) {
      // Classify as role or department
      const depts = ["hr", "sales", "marketing", "engineering", "finance", "legal", 
                     "operations", "support", "it", "tech", "product", "design", 
                     "research", "development", "accounting", "admin", "administration"];
      if (depts.includes(lower)) {
        if (!entities.departments.includes(lower)) {
          entities.departments.push(lower);
        }
      } else {
        if (!entities.roles.includes(lower)) {
          entities.roles.push(lower);
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
 * Extract time range from query
 */
function extractTimeRange(query: string): TimeRange | undefined {
  const normalized = normalizeQuery(query);
  
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
  
  if (parsed.keywords.length > 0) {
    parts.push(`containing "${parsed.keywords.join(" ")}"`);
  }
  
  return parts.length > 0 ? `Searching contacts ${parts.join(", ")}` : "Searching all contacts";
}

/**
 * Extract meaningful keywords from query
 */
function extractKeywords(words: string[]): string[] {
  return words
    .map(w => w.toLowerCase())
    .filter(w => {
      if (w.length < 2) return false;
      if (STOP_WORDS.has(w)) return false;
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
 * Parse search query into structured, deterministic result
 */
export function parseSearchQuery(query: string): ParsedQuery {
  const normalized = normalizeQuery(query);
  const words = normalized.split(" ").filter(Boolean);
  
  // Detect action
  const { action, remainingWords } = detectAction(words);
  
  // Determine intent
  let intent: IntentType = "find";
  if (action) {
    intent = "action";
  } else if (isQuestion(query)) {
    intent = "question";
  }
  
  // Extract entities from remaining words
  const entities = extractEntities(remainingWords);
  
  // Extract keywords
  const keywords = extractKeywords(remainingWords);
  
  // Extract time range if present (for creation date)
  const timeRange = extractTimeRange(query);
  
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
        if (!keywords.includes(tag)) {
          keywords.push(tag);
        }
      }
    }
  } else if (responsibilityPhrase) {
    // Fallback: if responsibility phrase detected but no match, add to keywords for text search
    const normalizedPhrase = normalizeResponsibilityPhrase(responsibilityPhrase);
    const phraseTokens = normalizedPhrase.split(/\s+/).filter(t => t.length >= 2);
    for (const token of phraseTokens) {
      if (!keywords.includes(token)) {
        keywords.push(token);
      }
    }
  }
  
  // Build search terms (unique, meaningful terms for text search)
  const searchTerms = [...new Set([
    ...keywords,
    ...entities.names.map(n => n.toLowerCase()),
    ...entities.roles,
    ...entities.departments,
    // Don't include companies, locations, relationships in general search terms
    // They're handled as filters
  ])].filter(t => t.length >= 2);
  
  const parsed: Omit<ParsedQuery, "interpretation"> = {
    intent,
    action,
    entities,
    keywords,
    filters: {},
    originalQuery: query,
    searchTerms,
    searchType,
    timeRange,
    interactionType,
    interactionTimeRange,
    needsFollowUp,
    responsibility: responsibility || null,
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
