/**
 * Deterministic Search Query Parser
 * Rule-based natural language query parsing - NO AI/LLM
 */

export type ActionType = "email" | "call" | "text" | null;
export type IntentType = "find" | "action" | "filter" | "question";

export interface ParsedQuery {
  intent: IntentType;
  action: ActionType;
  entities: {
    names: string[];
    companies: string[];
    roles: string[];
    departments: string[];
  };
  keywords: string[];
  filters: Record<string, string>;
  originalQuery: string;
  searchTerms: string[];
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
  "someone", "anyone", "person", "people", "contact", "contacts", "me", "help"
]);

// Prepositions that indicate entity relationships
const ENTITY_PREPOSITIONS = {
  company: new Set(["at", "from", "with", "@"]),
  role: new Set(["as", "works"]),
  department: new Set(["in", "handles", "does"]),
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
 * Extract entities from query using rule-based patterns
 */
function extractEntities(words: string[]): ParsedQuery["entities"] {
  const entities: ParsedQuery["entities"] = {
    names: [],
    companies: [],
    roles: [],
    departments: [],
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
      if (companyWords.length > 1) {
        entities.companies.push(companyWords.join(" "));
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
  
  return entities;
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
  
  // Build search terms (unique, meaningful terms for text search)
  const searchTerms = [...new Set([
    ...keywords,
    ...entities.names.map(n => n.toLowerCase()),
    ...entities.roles,
    ...entities.departments,
    ...entities.companies.map(c => c.toLowerCase()),
  ])].filter(t => t.length >= 2);
  
  return {
    intent,
    action,
    entities,
    keywords,
    filters: {},
    originalQuery: query,
    searchTerms,
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
