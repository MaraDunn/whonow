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
const MIN_SCORE_THRESHOLD = 3;
const MAX_RESULTS = 15;

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
  
  // Build search terms from parsed query
  const searchTerms = [
    ...parsedQuery.keywords,
    ...parsedQuery.entities.names,
    ...parsedQuery.entities.roles,
    ...parsedQuery.entities.departments,
    ...parsedQuery.entities.companies,
  ].filter(Boolean).map(t => t.toLowerCase());
  
  if (searchTerms.length === 0) {
    // Fall back to original query terms
    return searchContacts(contacts, parsedQuery.searchTerms, { maxResults });
  }
  
  // Score contacts
  const scored = contacts
    .map(contact => {
      const result = scoreContact(contact, searchTerms);
      
      // Boost for exact entity matches
      if (parsedQuery.entities.companies.length > 0) {
        const contactCompany = (contact.company || "").toLowerCase();
        for (const company of parsedQuery.entities.companies) {
          if (contactCompany.includes(company.toLowerCase())) {
            result.score += 15; // Strong boost for company match
          }
        }
      }
      
      if (parsedQuery.entities.departments.length > 0) {
        const contactRole = (contact.role || "").toLowerCase();
        const contactDesc = (contact.description || "").toLowerCase();
        for (const dept of parsedQuery.entities.departments) {
          if (contactRole.includes(dept) || contactDesc.includes(dept)) {
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
