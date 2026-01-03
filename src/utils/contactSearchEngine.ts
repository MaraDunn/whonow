/**
 * Deterministic Contact Search Engine
 * Weighted full-text search with indexing - NO AI/LLM
 */

import { Contact } from "@/types/contact";
import { ParsedQuery } from "./searchQueryParser";

// Field weights for scoring
const FIELD_WEIGHTS = {
  name: 10,       // Highest priority
  role: 8,
  tags: 7,
  description: 5,
  company: 4,
  email: 2,
  phone: 2,
};

// Minimum score threshold for results
const MIN_SCORE_THRESHOLD = 5; // Increased for better precision
const MAX_RESULTS = 10; // Reduced from 15 to show fewer, more relevant results

interface ScoredContact {
  contact: Contact;
  score: number;
  matchedFields: string[];
  matchedTerms: string[];
}

interface SearchIndex {
  contacts: Contact[];
  nameTokens: Map<string, Set<string>>;      // token -> contactIds
  companyTokens: Map<string, Set<string>>;
  roleTokens: Map<string, Set<string>>;
  tagTokens: Map<string, Set<string>>;
  descriptionTokens: Map<string, Set<string>>;
  allTokens: Map<string, Set<string>>;       // All text combined
}

/**
 * Tokenize text into searchable terms
 */
function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter(t => t.length >= 2);
}

/**
 * Generate trigrams for fuzzy matching
 */
function generateTrigrams(text: string): string[] {
  const normalized = text.toLowerCase();
  const trigrams: string[] = [];
  for (let i = 0; i <= normalized.length - 3; i++) {
    trigrams.push(normalized.slice(i, i + 3));
  }
  return trigrams;
}

/**
 * Check if term matches with prefix
 */
function prefixMatch(token: string, searchTerm: string): boolean {
  return token.startsWith(searchTerm) || searchTerm.startsWith(token);
}

/**
 * Check if strings are similar (fuzzy match using trigrams)
 */
function fuzzyMatch(text: string, searchTerm: string): boolean {
  if (text.length < 3 || searchTerm.length < 3) {
    return text.includes(searchTerm) || searchTerm.includes(text);
  }
  
  const textTrigrams = new Set(generateTrigrams(text));
  const searchTrigrams = generateTrigrams(searchTerm);
  
  let matches = 0;
  for (const tri of searchTrigrams) {
    if (textTrigrams.has(tri)) matches++;
  }
  
  // Require at least 50% trigram overlap for fuzzy match
  return matches >= searchTrigrams.length * 0.5;
}

/**
 * Check if company name matches with word boundaries
 * Returns true if the search company matches the contact company at word boundaries
 */
function companyMatches(contactCompany: string, searchCompany: string): boolean {
  if (!contactCompany || !searchCompany) return false;
  
  const contactLower = contactCompany.toLowerCase().trim();
  const searchLower = searchCompany.toLowerCase().trim();
  
  // Exact match
  if (contactLower === searchLower) return true;
  
  // Word boundary match - check if all words in search company appear in contact company
  const searchWords = searchLower.split(/\s+/).filter(w => w.length >= 2);
  const contactWords = new Set(contactLower.split(/\s+/));
  
  // All search words must be present in contact company
  const allWordsMatch = searchWords.every(word => {
    // Check for exact word match
    if (contactWords.has(word)) return true;
    // Check if word is a prefix of any contact word (e.g., "tech" matches "technologies")
    return Array.from(contactWords).some(cw => cw.startsWith(word) || word.startsWith(cw));
  });
  
  if (allWordsMatch) return true;
  
  // Check if contact company starts with search company (e.g., "TechCorp" matches "TechCorp Solutions")
  if (contactLower.startsWith(searchLower)) return true;
  
  // Check if search company starts with contact company (e.g., "TechCorp Solutions" matches "TechCorp")
  if (searchLower.startsWith(contactLower)) return true;
  
  return false;
}

/**
 * Check if role matches with word boundaries
 * Returns true if the search role matches the contact role at word boundaries
 */
function roleMatches(contactRole: string, searchRole: string): boolean {
  if (!contactRole || !searchRole) return false;
  
  const contactLower = contactRole.toLowerCase().trim();
  const searchLower = searchRole.toLowerCase().trim();
  
  // Exact match
  if (contactLower === searchLower) return true;
  
  // Word boundary match - check if all words in search role appear in contact role
  const searchWords = searchLower.split(/\s+/).filter(w => w.length >= 2);
  const contactWords = new Set(contactLower.split(/\s+/));
  
  // All search words must be present in contact role
  const allWordsMatch = searchWords.every(word => {
    // Check for exact word match
    if (contactWords.has(word)) return true;
    // Check if word is a prefix of any contact word (e.g., "engineer" matches "engineering")
    return Array.from(contactWords).some(cw => cw.startsWith(word) || word.startsWith(cw));
  });
  
  if (allWordsMatch) return true;
  
  // Check if contact role starts with search role (e.g., "Software" matches "Software Engineer")
  if (contactLower.startsWith(searchLower)) return true;
  
  // Check if search role starts with contact role (e.g., "Software Engineer" matches "Software")
  if (searchLower.startsWith(contactLower)) return true;
  
  return false;
}

/**
 * Build search index from contacts
 */
export function buildSearchIndex(contacts: Contact[]): SearchIndex {
  const index: SearchIndex = {
    contacts,
    nameTokens: new Map(),
    companyTokens: new Map(),
    roleTokens: new Map(),
    tagTokens: new Map(),
    descriptionTokens: new Map(),
    allTokens: new Map(),
  };
  
  const addToIndex = (indexMap: Map<string, Set<string>>, token: string, contactId: string) => {
    if (!indexMap.has(token)) {
      indexMap.set(token, new Set());
    }
    indexMap.get(token)!.add(contactId);
  };
  
  for (const contact of contacts) {
    const id = contact.id;
    
    // Index name
    for (const token of tokenize(contact.name)) {
      addToIndex(index.nameTokens, token, id);
      addToIndex(index.allTokens, token, id);
    }
    
    // Index company
    for (const token of tokenize(contact.company || "")) {
      addToIndex(index.companyTokens, token, id);
      addToIndex(index.allTokens, token, id);
    }
    
    // Index role
    for (const token of tokenize(contact.role || "")) {
      addToIndex(index.roleTokens, token, id);
      addToIndex(index.allTokens, token, id);
    }
    
    // Index tags
    for (const tag of contact.tags || []) {
      for (const token of tokenize(tag)) {
        addToIndex(index.tagTokens, token, id);
        addToIndex(index.allTokens, token, id);
      }
    }
    
    // Index description
    for (const token of tokenize(contact.description || "")) {
      addToIndex(index.descriptionTokens, token, id);
      addToIndex(index.allTokens, token, id);
    }
    
    // Index email (partial - username part)
    const emailParts = (contact.email || "").split("@")[0];
    for (const token of tokenize(emailParts)) {
      addToIndex(index.allTokens, token, id);
    }
  }
  
  return index;
}

/**
 * Score a single contact against search terms
 */
function scoreContact(
  contact: Contact, 
  searchTerms: string[],
  exactTerms: string[] = []
): ScoredContact {
  const result: ScoredContact = {
    contact,
    score: 0,
    matchedFields: [],
    matchedTerms: [],
  };
  
  if (searchTerms.length === 0) return result;
  
  const fields = {
    name: (contact.name || "").toLowerCase(),
    role: (contact.role || "").toLowerCase(),
    tags: (contact.tags || []).join(" ").toLowerCase(),
    description: (contact.description || "").toLowerCase(),
    company: (contact.company || "").toLowerCase(),
    email: (contact.email || "").toLowerCase(),
    phone: (contact.phone || "").replace(/\D/g, ""),
  };
  
  const allText = Object.values(fields).join(" ");
  
  for (const term of searchTerms) {
    const termLower = term.toLowerCase();
    let matched = false;
    
    // Score by field with weights
    for (const [fieldName, fieldValue] of Object.entries(fields)) {
      if (!fieldValue) continue;
      
      const weight = FIELD_WEIGHTS[fieldName as keyof typeof FIELD_WEIGHTS] || 1;
      
      // Exact match in field
      if (fieldValue.includes(termLower)) {
        result.score += weight;
        matched = true;
        if (!result.matchedFields.includes(fieldName)) {
          result.matchedFields.push(fieldName);
        }
        
        // Bonus for exact word match (not just substring)
        const tokens = tokenize(fieldValue);
        if (tokens.some(t => t === termLower)) {
          result.score += weight * 0.5;
        }
        
        // Bonus for name starting with search term
        if (fieldName === "name" && fieldValue.startsWith(termLower)) {
          result.score += 5;
        }
      }
      // Prefix match
      else if (tokenize(fieldValue).some(t => prefixMatch(t, termLower))) {
        result.score += weight * 0.7;
        matched = true;
        if (!result.matchedFields.includes(fieldName)) {
          result.matchedFields.push(fieldName);
        }
      }
    }
    
    // Fuzzy match in all text (lower score)
    if (!matched && term.length >= 4 && fuzzyMatch(allText, termLower)) {
      result.score += 1;
      matched = true;
    }
    
    if (matched) {
      result.matchedTerms.push(term);
    }
  }
  
  // Require minimum term matching for multi-term queries
  if (searchTerms.length > 1) {
    const requiredMatches = Math.ceil(searchTerms.length * 0.6);
    if (result.matchedTerms.length < requiredMatches) {
      result.score = 0; // Fail threshold
    }
  }
  
  return result;
}

/**
 * Search contacts using deterministic weighted scoring
 */
export function searchContacts(
  contacts: Contact[],
  searchTerms: string[],
  options: {
    maxResults?: number;
    minScore?: number;
  } = {}
): Contact[] {
  const { maxResults = MAX_RESULTS, minScore = MIN_SCORE_THRESHOLD } = options;
  
  if (!searchTerms.length) return contacts.slice(0, maxResults);
  
  const scored = contacts
    .map(contact => scoreContact(contact, searchTerms))
    .filter(s => s.score >= minScore)
    .sort((a, b) => b.score - a.score);
  
  return scored.slice(0, maxResults).map(s => s.contact);
}

/**
 * Search using parsed query structure
 */
export function searchWithParsedQuery(
  contacts: Contact[],
  parsedQuery: ParsedQuery,
  options: { maxResults?: number } = {}
): Contact[] {
  const { maxResults = MAX_RESULTS } = options;
  
  // If company, role, or time range is specified, we need strict filtering
  const hasCompanyFilter = parsedQuery.entities.companies.length > 0;
  const hasRoleFilter = parsedQuery.entities.roles.length > 0;
  const hasTimeFilter = !!parsedQuery.timeRange;
  
  // Build search terms from parsed query (EXCLUDE companies and roles - they're handled separately)
  const searchTerms = [
    ...parsedQuery.keywords,
    ...parsedQuery.entities.names,
    ...parsedQuery.entities.departments,
    // DON'T include companies or roles in general search terms - they're filtered separately
  ].filter(Boolean).map(t => t.toLowerCase());
  
  if (searchTerms.length === 0 && !hasCompanyFilter && !hasRoleFilter && !hasTimeFilter) {
    // Fall back to original query terms
    return searchContacts(contacts, parsedQuery.searchTerms, { maxResults });
  }
  
  // Score contacts
  const scored = contacts
    .map(contact => {
      // First, check time range filter - if time range is specified, require match
      if (parsedQuery.timeRange) {
        const contactCreatedAt = contact.createdAt;
        if (!contactCreatedAt) {
          // If contact has no timestamp, exclude it from time-based searches
          return {
            contact,
            score: 0,
            matchedFields: [],
            matchedTerms: [],
          };
        }
        
        const createdAt = new Date(contactCreatedAt);
        const { start, end } = parsedQuery.timeRange;
        
        // Check if contact was created within the time range
        if (createdAt < start || createdAt > end) {
          return {
            contact,
            score: 0,
            matchedFields: [],
            matchedTerms: [],
          };
        }
      }
      
      // Check company filter - if company is specified, require match
      if (hasCompanyFilter) {
        const contactCompany = contact.company || "";
        const matchesCompany = parsedQuery.entities.companies.some(company =>
          companyMatches(contactCompany, company)
        );
        
        // If company filter is specified but contact doesn't match, exclude it
        if (!matchesCompany) {
          return {
            contact,
            score: 0,
            matchedFields: [],
            matchedTerms: [],
          };
        }
      }
      
      // Check role filter - if role is specified, require match in role field only
      if (hasRoleFilter) {
        const contactRole = contact.role || "";
        const matchesRole = parsedQuery.entities.roles.some(role =>
          roleMatches(contactRole, role)
        );
        
        // If role filter is specified but contact doesn't match, exclude it
        if (!matchesRole) {
          return {
            contact,
            score: 0,
            matchedFields: [],
            matchedTerms: [],
          };
        }
      }
      
      // Score against non-company, non-role search terms
      const result = scoreContact(contact, searchTerms);
      
      // Boost for exact company matches (only if company matches)
      if (hasCompanyFilter) {
        const contactCompany = contact.company || "";
        for (const company of parsedQuery.entities.companies) {
          if (companyMatches(contactCompany, company)) {
            result.score += 20; // Strong boost for company match
            if (!result.matchedFields.includes("company")) {
              result.matchedFields.push("company");
            }
          }
        }
      }
      
      // Boost for exact role matches (only if role matches)
      if (hasRoleFilter) {
        const contactRole = contact.role || "";
        for (const role of parsedQuery.entities.roles) {
          if (roleMatches(contactRole, role)) {
            result.score += 15; // Strong boost for role match
            if (!result.matchedFields.includes("role")) {
              result.matchedFields.push("role");
            }
          }
        }
      }
      
      // Boost for department matches
      if (parsedQuery.entities.departments.length > 0) {
        const contactRole = (contact.role || "").toLowerCase();
        const contactDesc = (contact.description || "").toLowerCase();
        for (const dept of parsedQuery.entities.departments) {
          const deptLower = dept.toLowerCase();
          if (contactRole.includes(deptLower) || contactDesc.includes(deptLower)) {
            result.score += 10; // Boost for department match
          }
        }
      }
      
      return result;
    })
    .filter(s => s.score >= MIN_SCORE_THRESHOLD)
    .sort((a, b) => b.score - a.score);
  
  return scored.slice(0, maxResults).map(s => s.contact);
}

/**
 * Quick search - simple keyword matching for typeahead
 */
export function quickSearch(contacts: Contact[], query: string): Contact[] {
  if (!query.trim()) return [];
  
  const terms = tokenize(query);
  return searchContacts(contacts, terms, { maxResults: 10, minScore: 2 });
}
