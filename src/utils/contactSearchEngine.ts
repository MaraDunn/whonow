/**
 * Deterministic Contact Search Engine
 * Weighted full-text search with indexing + semantic similarity
 * 
 * @deprecated This client-side search engine is no longer used by default.
 * All search now goes through the server-side smart_search_contacts RPC for consistent
 * performance at any scale. This file is kept for potential future offline functionality.
 * See: supabase/migrations/20260128000002_smart_search_contacts.sql
 */

import { Contact } from "@/types/contact";
import { ParsedQuery } from "./searchQueryParser";
import { SearchQuery } from "@/types/searchQuery";
import { getContactEmbedding, getContactEmbeddings } from "./contactEmbeddings";
import { RESPONSIBILITIES } from "@/data/responsibilities";
import { devLog } from "@/lib/devLog";

// Field weights for scoring
const FIELD_WEIGHTS = {
  name: 10,       // Highest priority
  role: 8,
  businessName: 8, // Business name (same weight as role)
  tags: 7,
  description: 5,
  company: 4,
  email: 2,
  phone: 2,
  address: 6,     // Address fields for location searches
  city: 5,
  state: 4,
  country: 3,
  businessType: 3, // Business type (lower weight)
};

// Maximum results to return
const MAX_RESULTS = 10; // Reduced from 15 to show fewer, more relevant results

// Minimum score threshold for search results
// Contacts must score at least this to be included (prevents irrelevant results)
const MIN_SCORE_THRESHOLD = 2.0; // Require meaningful match, not just filter pass

interface ScoredContact {
  contact: Contact;
  score: number;
  matchedFields: string[];
  matchedTerms: string[];
  semanticScore?: number; // Optional semantic similarity score (0-1)
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
 * Handles variations like "tech solutions inc" vs "Tech Solutions Inc" or "Tech Solutions, Inc."
 */
function companyMatches(contactCompany: string, searchCompany: string): boolean {
  if (!contactCompany || !searchCompany) return false;
  
  // Normalize: lowercase, trim, remove punctuation
  const normalize = (str: string): string => {
    return str
      .toLowerCase()
      .trim()
      .replace(/[.,;:!?]/g, '') // Remove punctuation
      .replace(/\s+/g, ' '); // Normalize whitespace
  };
  
  const contactLower = normalize(contactCompany);
  const searchLower = normalize(searchCompany);
  
  // Exact match after normalization
  if (contactLower === searchLower) return true;
  
  // Check if search company is contained in contact company (substring match)
  // This handles cases like "tech solutions inc" matching "Tech Solutions Inc" or "Tech Solutions, Inc."
  if (contactLower.includes(searchLower)) return true;
  
  // Also check reverse - contact in search (handles partial queries)
  if (searchLower.includes(contactLower)) return true;
  
  // Word boundary match - check if all significant words in search company appear in contact company
  const searchWords = searchLower.split(/\s+/).filter(w => w.length >= 2);
  if (searchWords.length === 0) return false;
  
  const contactWords = contactLower.split(/\s+/);
  const contactWordsSet = new Set(contactWords);
  
  // Normalize company suffixes for matching (inc, inc., incorporated all match)
  const normalizeSuffix = (word: string): string => {
    if (word === 'inc' || word === 'inc.' || word === 'incorporated') return 'inc';
    if (word === 'llc' || word === 'l.l.c.' || word === 'limited liability company') return 'llc';
    if (word === 'ltd' || word === 'ltd.' || word === 'limited') return 'ltd';
    if (word === 'corp' || word === 'corp.' || word === 'corporation') return 'corp';
    return word;
  };
  
  // All search words must be present in contact company (with suffix normalization)
  const allWordsMatch = searchWords.every(searchWord => {
    const normalizedSearch = normalizeSuffix(searchWord);
    
    // Check for exact word match
    if (contactWordsSet.has(searchWord)) return true;
    
    // Check normalized suffix match
    const hasNormalizedMatch = contactWords.some(cw => normalizeSuffix(cw) === normalizedSearch);
    if (hasNormalizedMatch) return true;
    
    // Check if word is a prefix/suffix of any contact word (e.g., "tech" matches "technologies")
    const matchesContactWord = contactWords.some(contactWord => {
      const normalizedContact = normalizeSuffix(contactWord);
      return contactWord.includes(searchWord) || 
             searchWord.includes(contactWord) ||
             normalizedContact.includes(normalizedSearch) ||
             normalizedSearch.includes(normalizedContact) ||
             contactWord.startsWith(searchWord) ||
             searchWord.startsWith(contactWord);
    });
    
    return matchesContactWord;
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
 * Handles plurals, synonyms, and word order variations
 */
function roleMatches(contactRole: string, searchRole: string): boolean {
  if (!contactRole || !searchRole) return false;
  
  const contactLower = contactRole.toLowerCase().trim();
  const searchLower = searchRole.toLowerCase().trim();
  
  // Exact match
  if (contactLower === searchLower) return true;
  
  // Normalize plurals and common variations
  const normalizeWord = (word: string): string => {
    // Remove trailing 's' for plural matching (but keep if it's part of the word like "ops")
    if (word.endsWith('s') && word.length > 3 && word !== 'ops') {
      return word.slice(0, -1);
    }
    return word;
  };
  
  // Word boundary match - check if all words in search role appear in contact role
  const searchWords = searchLower.split(/\s+/).filter(w => w.length >= 2);
  const contactWords = contactLower.split(/\s+/);
  const contactWordsSet = new Set(contactWords);
  const contactWordsNormalized = contactWords.map(normalizeWord);
  const contactWordsNormalizedSet = new Set(contactWordsNormalized);
  
  // All search words must be present in contact role (with normalization)
  const allWordsMatch = searchWords.every(searchWord => {
    const normalizedSearch = normalizeWord(searchWord);
    
    // Check for exact word match
    if (contactWordsSet.has(searchWord)) return true;
    if (contactWordsNormalizedSet.has(normalizedSearch)) return true;
    
    // Check if word is a prefix/suffix of any contact word (e.g., "engineer" matches "engineering")
    const matchesContactWord = contactWords.some(contactWord => {
      const normalizedContact = normalizeWord(contactWord);
      return contactWord.includes(searchWord) || 
             searchWord.includes(contactWord) ||
             normalizedContact.includes(normalizedSearch) ||
             normalizedSearch.includes(normalizedContact) ||
             contactWord.startsWith(searchWord) ||
             searchWord.startsWith(contactWord);
    });
    
    if (matchesContactWord) return true;
    
    // Check synonym expansion (e.g., "ops" should match "operations")
    if (searchWord === "ops" || searchWord === "op") {
      return contactWords.some(cw => 
        cw === "operations" || cw === "operation" || cw.startsWith("operat")
      );
    }
    
    // Check "management" -> "manager" matching
    if (searchWord === "management" || searchWord === "mgmt") {
      return contactWords.some(cw => 
        cw === "manager" || cw === "managers" || cw.includes("manager") || cw.includes("mgmt")
      );
    }
    
    // Check "manager" -> "management" matching
    if (searchWord === "manager" || searchWord === "mgr") {
      return contactWords.some(cw => 
        cw === "management" || cw.includes("manager") || cw.includes("mgmt")
      );
    }
    
    // Check plural/singular matching for common role words
    // "designers" should match "designer", "engineers" should match "engineer", etc.
    const rolePlurals: Record<string, string[]> = {
      "designers": ["designer", "design"],
      "designer": ["designers", "design"],
      "engineers": ["engineer", "engineering"],
      "engineer": ["engineers", "engineering"],
      "developers": ["developer", "dev", "development"],
      "developer": ["developers", "dev", "development"],
      "managers": ["manager", "management", "mgmt"],
      "directors": ["director", "dir"],
      "director": ["directors", "dir"],
    };
    
    if (rolePlurals[searchWord]) {
      const matches = rolePlurals[searchWord].some(plural => 
        contactWords.some(cw => cw === plural || cw.includes(plural) || plural.includes(cw))
      );
      if (matches) return true;
    }
    
    // Also check reverse - if contact word is in the plural map
    for (const [plural, singulars] of Object.entries(rolePlurals)) {
      if (contactWords.some(cw => cw === plural || cw.includes(plural))) {
        if (singulars.some(s => s === searchWord || searchWord.includes(s) || s.includes(searchWord))) {
          return true;
        }
      }
    }
    
    return false;
  });
  
  if (allWordsMatch) return true;
  
  // Check if contact role contains search role as substring (flexible matching)
  if (contactLower.includes(searchLower) || searchLower.includes(contactLower)) {
    // But require at least one significant word match (not just "of", "the", etc.)
    const significantWords = searchWords.filter(w => w.length >= 3);
    if (significantWords.length > 0) {
      const hasSignificantMatch = significantWords.some(sw => 
        contactLower.includes(sw) || contactWords.some(cw => cw.includes(sw) || sw.includes(cw))
      );
      if (hasSignificantMatch) return true;
    }
  }
  
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
    businessName: (contact.businessName || "").toLowerCase(),
    businessType: (contact.businessType || "").toLowerCase(),
    tags: (contact.tags || []).join(" ").toLowerCase(),
    description: (contact.description || "").toLowerCase(),
    company: (contact.company || "").toLowerCase(),
    email: (contact.email || "").toLowerCase(),
    phone: (contact.phone || "").replace(/\D/g, ""),
    address: (contact.address || "").toLowerCase(),
    city: (contact.city || "").toLowerCase(),
    state: (contact.state || "").toLowerCase(),
    country: (contact.country || "").toLowerCase(),
  };
  
  const allText = Object.values(fields).join(" ");
  
  for (const term of searchTerms) {
    const termLower = term.toLowerCase();
    let matched = false;
    
    // Special handling for email addresses (contains @)
    const isEmailSearch = termLower.includes("@");
    if (isEmailSearch && fields.email) {
      // Check for exact email match or partial email match
      if (fields.email === termLower) {
        // Exact email match - high score
        result.score += 10;
        matched = true;
        if (!result.matchedFields.includes("email")) {
          result.matchedFields.push("email");
        }
        result.matchedTerms.push(term);
        continue; // Skip to next term
      } else if (fields.email.includes(termLower)) {
        // Partial email match (e.g., search "john@" matches "john@example.com")
        result.score += 8;
        matched = true;
        if (!result.matchedFields.includes("email")) {
          result.matchedFields.push("email");
        }
        result.matchedTerms.push(term);
        continue; // Skip to next term
      } else {
        // Search term is email but contact email doesn't match exactly - check username part
        const searchUsername = termLower.split("@")[0];
        const contactUsername = fields.email.split("@")[0];
        if (contactUsername && contactUsername.includes(searchUsername)) {
          result.score += 6;
          matched = true;
          if (!result.matchedFields.includes("email")) {
            result.matchedFields.push("email");
          }
          result.matchedTerms.push(term);
          continue; // Skip to next term
        }
      }
    }
    
    // Also check if non-email search term matches email field (e.g., "john" matches "john@example.com")
    if (!isEmailSearch && fields.email && fields.email.includes(termLower)) {
      // Check if term matches username part of email (before @)
      const emailUsername = fields.email.split("@")[0];
      if (emailUsername && emailUsername.includes(termLower)) {
        // Bonus score for email username match
        result.score += 5;
        matched = true;
        if (!result.matchedFields.includes("email")) {
          result.matchedFields.push("email");
        }
      }
    }
    
    // Special handling for phone numbers - normalize search term to digits only
    const normalizedTerm = termLower.replace(/\D/g, "");
    const isPhoneSearch = normalizedTerm.length >= 3; // At least 3 digits to be considered a phone search
    if (isPhoneSearch && fields.phone) {
      const phoneWeight = FIELD_WEIGHTS.phone || 2;
      
      // Check if normalized search term appears anywhere in normalized phone
      if (fields.phone.includes(normalizedTerm)) {
        result.score += phoneWeight;
        matched = true;
        if (!result.matchedFields.includes("phone")) {
          result.matchedFields.push("phone");
        }
        
        // Bonus for longer matches (more digits matched)
        if (normalizedTerm.length >= 7) {
          result.score += phoneWeight * 0.5; // Extra bonus for 7+ digit matches
        }
        
        // Extra bonus if search term matches the end of the phone number (most common case)
        // This handles "814044" matching "3814044" or "8140443"
        if (fields.phone.endsWith(normalizedTerm)) {
          result.score += phoneWeight * 0.5;
        }
      }
    }
    
    // Score by field with weights
    for (const [fieldName, fieldValue] of Object.entries(fields)) {
      if (!fieldValue) continue;
      
      // Skip phone field in general loop - we handle it specially above
      if (fieldName === "phone") continue;
      
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
 * Compute cosine similarity between two embeddings
 * Both embeddings should be normalized (which they are from the model)
 */
function cosineSimilarity(embedding1: number[], embedding2: number[]): number {
  if (embedding1.length !== embedding2.length) {
    return 0;
  }

  let dotProduct = 0;
  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
  }

  // Since embeddings are normalized, cosine similarity is just the dot product
  // Clamp to [0, 1] range (though it should already be in that range)
  return Math.max(0, Math.min(1, dotProduct));
}

// Cache for query embedding model (shared instance)
let queryEmbeddingModel: any = null;
let queryModelLoading: Promise<any> | null = null;

/**
 * Load query embedding model (lazy, cached)
 */
async function loadQueryEmbeddingModel(): Promise<any> {
  if (queryEmbeddingModel) return queryEmbeddingModel;
  if (queryModelLoading) return queryModelLoading;

  queryModelLoading = (async () => {
    try {
      // TODO: Re-implement with ONNX Runtime after T5 query parser is working
      // const { pipeline } = await import("@xenova/transformers");
      // 
      // queryEmbeddingModel = await pipeline(
      //   "feature-extraction",
      //   "Xenova/all-MiniLM-L6-v2",
      //   {
      //     quantized: true,
      //   }
      // );

      devLog("[Embeddings] Temporarily disabled - using keyword search only");
      return null;
    } catch (error) {
      console.warn("Failed to load query embedding model:", error);
      return null;
    } finally {
      queryModelLoading = null;
    }
  })();

  return queryModelLoading;
}

/**
 * Generate query embedding from text
 * Uses cached model and checks query embedding cache from semantic assist
 */
async function generateQueryEmbedding(queryText: string): Promise<number[] | null> {
  try {
    // Check cache from semantic assist browser adapter first
    const { getCachedQueryEmbedding, cacheQueryEmbedding } = await import("@/utils/semanticAssist/browserCache");
    const cached = await getCachedQueryEmbedding(queryText);
    if (cached) {
      return cached;
    }

    // Load model (cached)
    const model = await loadQueryEmbeddingModel();
    if (!model) return null;

    const output = await model(queryText, {
      pooling: "mean",
      normalize: true,
    });

    // Convert tensor to number array
    const embedding = Array.from(output.data) as number[];

    // Cache the embedding
    await cacheQueryEmbedding(queryText, embedding);

    return embedding;
  } catch (error) {
    console.warn("Failed to generate query embedding:", error);
    return null;
  }
}

/**
 * Compute semantic similarity score between query and contact
 * Returns a score from 0 to 1 (1 = perfect match, 0 = no match)
 */
export async function semanticScore(
  queryText: string,
  contact: Contact
): Promise<number> {
  try {
    // Generate or get query embedding
    const queryEmbedding = await generateQueryEmbedding(queryText);
    if (!queryEmbedding) {
      return 0;
    }

    // Get contact embedding (with caching)
    const contactEmbedding = await getContactEmbedding(contact);
    if (!contactEmbedding) {
      return 0;
    }

    // Compute cosine similarity
    return cosineSimilarity(queryEmbedding, contactEmbedding);
  } catch (error) {
    console.warn("Failed to compute semantic score:", error);
    return 0;
  }
}

/**
 * Batch compute semantic scores for multiple contacts
 * More efficient than calling semanticScore individually
 */
export async function batchSemanticScores(
  queryText: string,
  contacts: Contact[]
): Promise<Map<string, number>> {
  const scores = new Map<string, number>();

  try {
    // Generate query embedding once
    const queryEmbedding = await generateQueryEmbedding(queryText);
    if (!queryEmbedding) {
      return scores; // Return empty map if query embedding fails
    }

    // Get all contact embeddings in batch
    const contactEmbeddings = await getContactEmbeddings(contacts);

    // Compute similarities
    for (const contact of contacts) {
      const contactEmbedding = contactEmbeddings.get(contact.id);
      if (contactEmbedding && Array.isArray(contactEmbedding)) {
        const similarity = cosineSimilarity(queryEmbedding, contactEmbedding as number[]);
        scores.set(contact.id, similarity);
      }
    }
  } catch (error) {
    console.warn("Failed to compute batch semantic scores:", error);
  }

  return scores;
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
  const { maxResults = MAX_RESULTS } = options;
  
  if (!searchTerms.length) return contacts.slice(0, maxResults);
  
  // For very short search terms (partial matches), use lower threshold
  const shortestTerm = Math.min(...searchTerms.map(t => t.length));
  // Check if query is numeric-only (likely a phone number search)
  const isNumericQuery = searchTerms.every(t => /^\d+$/.test(t));
  // Lower threshold for short queries OR numeric-only queries (phone searches)
  const adjustedMinScore = (shortestTerm <= 3 || isNumericQuery) 
    ? Math.max(1, minScore - 3) 
    : minScore;
  
  const scored = contacts
    .map(contact => scoreContact(contact, searchTerms))
    .filter(s => s.score >= adjustedMinScore)
    .sort((a, b) => b.score - a.score);
  
  devLog('[SEARCH DEBUG] searchWithParsedQuery - Scored contacts count:', scored.length);
  devLog('[SEARCH DEBUG] searchWithParsedQuery - Adjusted min score:', adjustedMinScore);
  devLog('[SEARCH DEBUG] searchWithParsedQuery - Top scored contacts:', scored.slice(0, 5).map(s => ({ 
    name: s.contact.name, 
    company: s.contact.company, 
    score: s.score,
    matchedFields: s.matchedFields 
  })));
  
  const results = scored.slice(0, maxResults).map(s => s.contact);
  devLog('[SEARCH DEBUG] searchWithParsedQuery - Final results count:', results.length);
  devLog('[SEARCH DEBUG] searchWithParsedQuery - Results:', results.map(c => ({ name: c.name, company: c.company })));
  return results;
}

/**
 * Search using parsed query structure
 */
export function searchWithParsedQuery(
  contacts: Contact[],
  parsedQuery: ParsedQuery,
  options: { maxResults?: number } = {}
): Contact[] {
  devLog('[SEARCH DEBUG] searchWithParsedQuery - Starting search');
  devLog('[SEARCH DEBUG] searchWithParsedQuery - Parsed query:', {
    companies: parsedQuery.entities.companies,
    roles: parsedQuery.entities.roles,
    keywords: parsedQuery.keywords,
    searchTerms: parsedQuery.searchTerms,
    originalQuery: parsedQuery.originalQuery
  });
  
  const { maxResults = MAX_RESULTS } = options;
  
  // Check which filters are active
  const hasCompanyFilter = parsedQuery.entities.companies.length > 0;
  const hasRoleFilter = parsedQuery.entities.roles.length > 0;
  const hasBusinessFilter = parsedQuery.entities.businesses.length > 0;
  const hasTimeFilter = !!parsedQuery.timeRange;
  const hasLocationFilter = parsedQuery.entities.locations.length > 0;
  const hasRelationshipFilter = parsedQuery.entities.relationships.length > 0;
  const hasInteractionFilter = !!parsedQuery.interactionType;
  const hasInteractionTimeFilter = !!parsedQuery.interactionTimeRange;
  const hasNeedsFollowUp = parsedQuery.needsFollowUp === true;
  const hasResponsibilityFilter = !!parsedQuery.responsibility;
  
  devLog('[SEARCH DEBUG] searchWithParsedQuery - Active filters:', {
    hasCompanyFilter,
    hasRoleFilter,
    hasBusinessFilter,
    hasTimeFilter,
    hasLocationFilter,
    hasRelationshipFilter,
    companies: parsedQuery.entities.companies
  });
  
  // Check for negated entities
  const hasNegatedCompanies = parsedQuery.negatedEntities.companies.length > 0;
  const hasNegatedRoles = parsedQuery.negatedEntities.roles.length > 0;
  const hasNegatedDepartments = parsedQuery.negatedEntities.departments.length > 0;
  const hasNegatedLocations = parsedQuery.negatedEntities.locations.length > 0;
  const hasNegatedRelationships = parsedQuery.negatedEntities.relationships.length > 0;
  const hasNegatedNames = parsedQuery.negatedEntities.names.length > 0;
  
  // Build search terms from parsed query (EXCLUDE structured entities - they're handled separately)
  let searchTerms = [
    ...parsedQuery.keywords,
    ...parsedQuery.entities.names,
    ...parsedQuery.entities.departments,
    // DON'T include companies, roles, locations, relationships in general search terms
  ].filter(Boolean).map(t => t.toLowerCase());
  
  // IMPORTANT: If we have responsibility filters, don't use keyword matching
  // The responsibility filter is precise and should be sufficient
  if (parsedQuery.responsibility) {
    devLog('[SEARCH DEBUG] Responsibility filter present, clearing keyword search terms');
    searchTerms = [];
  }
  
  devLog('[SEARCH DEBUG] searchWithParsedQuery - Search terms:', searchTerms);
  
  // No minimum score threshold - trust LLM-extracted filters
  
  const hasAnyFilter = hasCompanyFilter || hasRoleFilter || hasBusinessFilter || hasTimeFilter || 
                       hasLocationFilter || hasRelationshipFilter || hasInteractionFilter ||
                       hasInteractionTimeFilter || hasNeedsFollowUp || hasResponsibilityFilter;
  
  devLog('[SEARCH DEBUG] searchWithParsedQuery - hasAnyFilter:', hasAnyFilter, 'searchTerms.length:', searchTerms.length);
  
  if (searchTerms.length === 0 && !hasAnyFilter) {
    devLog('[SEARCH DEBUG] searchWithParsedQuery - No filters and no search terms, falling back');
    // Fall back to original query terms
    return searchContacts(contacts, parsedQuery.searchTerms, { maxResults });
  }
  
  // Score contacts
  const scored = contacts
    .map(contact => {
      // First, check time range filter - if time range is specified, require match
      if (parsedQuery.timeRange) {
        const contactCreatedAt = contact.createdAt;
        if (!contactCreatedAt || contactCreatedAt.trim() === '') {
          // If contact has no timestamp, exclude it from time-based searches
          return {
            contact,
            score: 0,
            matchedFields: [],
            matchedTerms: [],
          };
        }
        
        const createdAt = new Date(contactCreatedAt);
        
        // Check if date is valid
        if (isNaN(createdAt.getTime())) {
          // Invalid date - exclude from time-based searches
          return {
            contact,
            score: 0,
            matchedFields: [],
            matchedTerms: [],
          };
        }
        
        const { start, end } = parsedQuery.timeRange;
        
        // Check if contact was created within the time range
        // Use <= and >= to include exact boundary matches, and ensure we're comparing dates correctly
        // Normalize to start of day for date-only comparisons to avoid timezone issues
        const createdAtTime = createdAt.getTime();
        const startTime = start.getTime();
        const endTime = end.getTime();
        
        if (createdAtTime < startTime || createdAtTime > endTime) {
          return {
            contact,
            score: 0,
            matchedFields: [],
            matchedTerms: [],
          };
        }
      }
      
      // Handle comparative filters (e.g., "more than 30 days ago")
      if (parsedQuery.comparativeFilters?.timeRange) {
        const contactCreatedAt = contact.createdAt;
        if (!contactCreatedAt || contactCreatedAt.trim() === '') {
          // For "more than X days ago", contacts without timestamps might be included
          // For "less than X days ago", exclude contacts without timestamps
          if (parsedQuery.comparativeFilters.timeRange.operator === "less than" ||
              parsedQuery.comparativeFilters.timeRange.operator === "newer than") {
            return {
              contact,
              score: 0,
              matchedFields: [],
              matchedTerms: [],
            };
          }
        } else {
          const createdAt = new Date(contactCreatedAt);
          if (!isNaN(createdAt.getTime())) {
            const now = new Date();
            const daysDiff = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
            const threshold = parsedQuery.comparativeFilters.timeRange.days;
            const operator = parsedQuery.comparativeFilters.timeRange.operator;
            
            let matches = false;
            if (operator === "more than" || operator === "older than") {
              matches = daysDiff > threshold;
            } else if (operator === "less than" || operator === "newer than") {
              matches = daysDiff < threshold;
            }
            
            if (!matches) {
              return {
                contact,
                score: 0,
                matchedFields: [],
                matchedTerms: [],
              };
            }
          }
        }
      }
      
      // Check company filter - if company is specified, require match
      if (hasCompanyFilter) {
        const contactCompany = contact.company || "";
        const contactBusinessName = contact.businessName || "";
        const contactDescription = contact.description || "";
        
        // Check company in multiple fields
        const matchesCompany = parsedQuery.entities.companies.some(company => {
          return companyMatches(contactCompany, company) ||
                 (contactBusinessName && companyMatches(contactBusinessName, company)) ||
                 (contactDescription && companyMatches(contactDescription, company));
        });
        
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
      
      // Check business filter - search in business name AND address fields
      if (hasBusinessFilter) {
        const contactBusinessName = (contact.businessName || "").toLowerCase();
        const contactAddressText = [
          contact.address || "",
          contact.city || "",
          contact.state || "",
          contact.zipCode || "",
          contact.country || "",
        ].join(" ").toLowerCase();
        
        const matchesBusiness = parsedQuery.entities.businesses.some(business => {
          const businessLower = business.toLowerCase();
          // Check business name field
          const matchesBusinessName = contactBusinessName.includes(businessLower) || businessLower.includes(contactBusinessName);
          // Also check address fields (in case business is stored in address)
          const matchesAddress = contactAddressText.includes(businessLower);
          return matchesBusinessName || matchesAddress;
        });
        
        if (!matchesBusiness) {
          return {
            contact,
            score: 0,
            matchedFields: [],
            matchedTerms: [],
          };
        }
      }
      
      // Check location filter - search in address fields, description, and tags
      if (hasLocationFilter) {
        const contactLocationText = [
          contact.address || "",
          contact.city || "",
          contact.state || "",
          contact.country || "",
          contact.zipCode || "",
          contact.description || "",
          ...(contact.tags || []),
        ].join(" ").toLowerCase();
        
        const matchesLocation = parsedQuery.entities.locations.some(location => {
          const locationLower = location.toLowerCase();
          return contactLocationText.includes(locationLower);
        });
        
        if (!matchesLocation) {
          return {
            contact,
            score: 0,
            matchedFields: [],
            matchedTerms: [],
          };
        }
      }
      
      // Check relationship filter - search in tags and isClient field
      if (hasRelationshipFilter) {
        const contactTags = (contact.tags || []).map(t => t.toLowerCase());
        const isClient = contact.isClient || false;
        
        const matchesRelationship = parsedQuery.entities.relationships.some(rel => {
          if (rel === "client" && isClient) return true;
          return contactTags.includes(rel.toLowerCase());
        });
        
        if (!matchesRelationship) {
          return {
            contact,
            score: 0,
            matchedFields: [],
            matchedTerms: [],
          };
        }
      }
      
      // Check interaction type filter
      if (hasInteractionFilter && parsedQuery.interactionType) {
        // For now, we check if contact has been contacted (lastContactedAt exists)
        // In a full implementation, you'd check interaction logs
        if (!contact.lastContactedAt) {
          return {
            contact,
            score: 0,
            matchedFields: [],
            matchedTerms: [],
          };
        }
      }
      
      // Check interaction time range filter
      if (hasInteractionTimeFilter && parsedQuery.interactionTimeRange) {
        if (!contact.lastContactedAt) {
          return {
            contact,
            score: 0,
            matchedFields: [],
            matchedTerms: [],
          };
        }
        
        const lastContacted = new Date(contact.lastContactedAt);
        const { start, end } = parsedQuery.interactionTimeRange;
        
        if (lastContacted < start || lastContacted > end) {
          return {
            contact,
            score: 0,
            matchedFields: [],
            matchedTerms: [],
          };
        }
      }
      
      // Check needs follow-up filter
      if (hasNeedsFollowUp) {
        // If needs follow-up, contact should either:
        // 1. Have no lastContactedAt (never contacted)
        // 2. Have lastContactedAt older than 7 days (configurable)
        const followUpThreshold = 7; // days
        const now = new Date();
        
        if (contact.lastContactedAt) {
          const lastContacted = new Date(contact.lastContactedAt);
          const daysSinceContact = Math.floor((now.getTime() - lastContacted.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysSinceContact < followUpThreshold) {
            return {
              contact,
              score: 0,
              matchedFields: [],
              matchedTerms: [],
            };
          }
        }
        // If no lastContactedAt, it matches (needs follow-up)
      }
      
      // Check negated entities - exclude contacts that match negated criteria
      if (hasNegatedCompanies) {
        const contactCompany = contact.company || "";
        const matchesNegatedCompany = parsedQuery.negatedEntities.companies.some(company =>
          companyMatches(contactCompany, company)
        );
        if (matchesNegatedCompany) {
          return {
            contact,
            score: 0,
            matchedFields: [],
            matchedTerms: [],
          };
        }
      }
      
      if (hasNegatedRoles) {
        const contactRole = contact.role || "";
        const matchesNegatedRole = parsedQuery.negatedEntities.roles.some(role =>
          roleMatches(contactRole, role)
        );
        if (matchesNegatedRole) {
          return {
            contact,
            score: 0,
            matchedFields: [],
            matchedTerms: [],
          };
        }
      }
      
      if (hasNegatedRelationships) {
        const contactTags = (contact.tags || []).map(t => t.toLowerCase());
        const isClient = contact.isClient || false;
        const matchesNegatedRelationship = parsedQuery.negatedEntities.relationships.some(rel => {
          if (rel === "client" && isClient) return true;
          return contactTags.includes(rel.toLowerCase());
        });
        if (matchesNegatedRelationship) {
          return {
            contact,
            score: 0,
            matchedFields: [],
            matchedTerms: [],
          };
        }
      }
      
      if (hasNegatedNames) {
        const contactName = (contact.name || "").toLowerCase();
        const matchesNegatedName = parsedQuery.negatedEntities.names.some(name =>
          contactName.includes(name.toLowerCase())
        );
        if (matchesNegatedName) {
          return {
            contact,
            score: 0,
            matchedFields: [],
            matchedTerms: [],
          };
        }
      }
      
      // Check responsibility filter
      if (hasResponsibilityFilter && parsedQuery.responsibility) {
        const resp = parsedQuery.responsibility;
        let matchesResponsibility = false;
        
        // Apply OR logic within responsibility filters
        // Match departments OR roles OR tags
        
        // Check departments
        if (resp.filters.departments && resp.filters.departments.length > 0) {
          const contactRole = (contact.role || "").toLowerCase();
          const contactDesc = (contact.description || "").toLowerCase();
          for (const dept of resp.filters.departments) {
            if (contactRole.includes(dept.toLowerCase()) || 
                contactDesc.includes(dept.toLowerCase())) {
              matchesResponsibility = true;
              break;
            }
          }
        }
        
        // Check roles
        if (!matchesResponsibility && resp.filters.roles && resp.filters.roles.length > 0) {
          const contactRole = (contact.role || "").toLowerCase();
          for (const role of resp.filters.roles) {
            if (roleMatches(contactRole, role)) {
              matchesResponsibility = true;
              break;
            }
          }
        }
        
        // Check tags
        if (!matchesResponsibility && resp.filters.tags && resp.filters.tags.length > 0) {
          const contactTags = (contact.tags || []).map(t => t.toLowerCase());
          for (const tag of resp.filters.tags) {
            if (contactTags.includes(tag.toLowerCase())) {
              matchesResponsibility = true;
              break;
            }
          }
        }
        
        // Check explicit owner
        if (!matchesResponsibility && resp.filters.owner) {
          if (contact.ownerId === resp.filters.owner) {
            matchesResponsibility = true;
          }
        }
        
        // If responsibility filter is specified but contact doesn't match, exclude it
        if (!matchesResponsibility) {
          return {
            contact,
            score: 0,
            matchedFields: [],
            matchedTerms: [],
          };
        }
      }
      
      // Score against non-structured search terms
      const result = scoreContact(contact, searchTerms);
      
      // If contact passed time filter, give it a base score to ensure it's included
      // This ensures time-based queries return results even if search terms don't match
      // The search terms can boost the score further, but passing time filter is enough to include
      if (hasTimeFilter && result.score === 0) {
        result.score = 1; // Base score to include filtered contacts
        result.matchedFields.push("time");
      }
      
      // If we have filters but no search terms, give a base score to contacts that pass filters
      // This ensures filter-only queries (like "who do I know at company?") return results
      if (searchTerms.length === 0 && hasAnyFilter && result.score === 0) {
        // We'll add boosts for matching filters below, but give a base score here
        result.score = 1; // Small base score, filters will boost it
      }
      
      // Boost for exact company matches (only if company matches)
      // Check multiple fields: company, businessName, and description
      if (hasCompanyFilter) {
        const contactCompany = contact.company || "";
        const contactBusinessName = contact.businessName || "";
        const contactDescription = contact.description || "";
        
        devLog('[SEARCH DEBUG] Checking company match for contact:', contact.name);
        devLog('[SEARCH DEBUG] Contact fields - company:', contactCompany, 'businessName:', contactBusinessName, 'description:', contactDescription?.substring(0, 50));
        
        for (const company of parsedQuery.entities.companies) {
          devLog('[SEARCH DEBUG] Comparing search company:', company);
          
          // Check company field
          let matches = companyMatches(contactCompany, company);
          devLog('[SEARCH DEBUG] Company field match:', matches);
          
          // Check businessName field if company field doesn't match
          if (!matches && contactBusinessName) {
            matches = companyMatches(contactBusinessName, company);
            devLog('[SEARCH DEBUG] BusinessName field match:', matches);
          }
          
          // Check description field if still no match
          if (!matches && contactDescription) {
            matches = companyMatches(contactDescription, company);
            devLog('[SEARCH DEBUG] Description field match:', matches);
          }
          
          if (matches) {
            devLog('[SEARCH DEBUG] Company matched! Adding score boost. Current score:', result.score);
            result.score += 20; // Strong boost for company match
            if (!result.matchedFields.includes("company")) {
              result.matchedFields.push("company");
            }
            // Ensure company-matched contacts pass threshold even if searchTerms are empty
            // This handles queries like "Who do I know at quantum solutions?" where searchTerms might be empty
            if (result.score < adjustedMinScore) {
              result.score = Math.max(adjustedMinScore, result.score);
            }
            devLog('[SEARCH DEBUG] Final score after company match:', result.score, 'threshold:', adjustedMinScore);
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
      
      // Boost for business name matches (from parsed query entities)
      if (hasBusinessFilter) {
        const contactBusinessName = (contact.businessName || "").toLowerCase();
        const contactAddressText = [
          contact.address || "",
          contact.city || "",
          contact.state || "",
          contact.zipCode || "",
          contact.country || "",
        ].join(" ").toLowerCase();
        
        for (const business of parsedQuery.entities.businesses) {
          const businessLower = business.toLowerCase();
          // Check if business name matches
          const matchesBusinessName = contactBusinessName.includes(businessLower) || businessLower.includes(contactBusinessName);
          // Also check address fields
          const matchesAddress = contactAddressText.includes(businessLower);
          
          if (matchesBusinessName) {
            result.score += 20; // Strong boost for business name match (higher than role)
            if (!result.matchedFields.includes("businessName")) {
              result.matchedFields.push("businessName");
            }
            // Extra boost for exact match
            if (contactBusinessName === businessLower) {
              result.score += 5;
            }
          } else if (matchesAddress) {
            result.score += 15; // Good boost for address match
            if (!result.matchedFields.includes("address")) {
              result.matchedFields.push("address");
            }
          }
        }
      }
      
      // Also boost for business name in general search terms (fallback)
      if (contact.businessName && !hasBusinessFilter) {
        const contactBusinessName = (contact.businessName || "").toLowerCase();
        for (const term of searchTerms) {
          const termLower = term.toLowerCase();
          // Check if search term matches business name
          if (contactBusinessName.includes(termLower) || termLower.includes(contactBusinessName)) {
            result.score += 18; // Strong boost for business name match
            if (!result.matchedFields.includes("businessName")) {
              result.matchedFields.push("businessName");
            }
            // Extra boost for exact match
            if (contactBusinessName === termLower) {
              result.score += 5;
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
      
      // Boost for location matches
      if (hasLocationFilter) {
        const contactLocationText = [
          contact.address || "",
          contact.city || "",
          contact.state || "",
          contact.country || "",
          contact.zipCode || "",
          contact.description || "",
          ...(contact.tags || []),
        ].join(" ").toLowerCase();
        
        for (const location of parsedQuery.entities.locations) {
          const locationLower = location.toLowerCase();
          if (contactLocationText.includes(locationLower)) {
            // Higher boost for exact matches in address fields
            let boost = 12;
            if (contact.city?.toLowerCase().includes(locationLower)) {
              boost += 5; // Extra boost for city match
            }
            if (contact.state?.toLowerCase().includes(locationLower)) {
              boost += 3; // Extra boost for state match
            }
            if (contact.country?.toLowerCase().includes(locationLower)) {
              boost += 2; // Extra boost for country match
            }
            
            result.score += boost;
            if (!result.matchedFields.includes("location")) {
              result.matchedFields.push("location");
            }
          }
        }
      }
      
      // Boost for relationship matches
      if (hasRelationshipFilter) {
        result.score += 10; // Boost for relationship match
        if (!result.matchedFields.includes("relationship")) {
          result.matchedFields.push("relationship");
        }
      }
      
      // Boost for interaction matches
      if (hasInteractionFilter && contact.lastContactedAt) {
        result.score += 8; // Boost for interaction match
        if (!result.matchedFields.includes("interaction")) {
          result.matchedFields.push("interaction");
        }
      }
      
      // Boost for responsibility matches
      if (hasResponsibilityFilter && parsedQuery.responsibility) {
        result.score += 25; // Strong boost for responsibility match
        if (!result.matchedFields.includes("responsibility")) {
          result.matchedFields.push("responsibility");
        }
      }
      
      return result;
    })
    .filter(s => s.score >= adjustedMinScore)
    .sort((a, b) => b.score - a.score);
  
  devLog('[SEARCH DEBUG] searchWithParsedQuery - Scored contacts count:', scored.length);
  devLog('[SEARCH DEBUG] searchWithParsedQuery - Adjusted min score:', adjustedMinScore);
  devLog('[SEARCH DEBUG] searchWithParsedQuery - Top scored contacts:', scored.slice(0, 5).map(s => ({ 
    name: s.contact.name, 
    company: s.contact.company, 
    score: s.score,
    matchedFields: s.matchedFields 
  })));
  
  const results = scored.slice(0, maxResults).map(s => s.contact);
  devLog('[SEARCH DEBUG] searchWithParsedQuery - Final results count:', results.length);
  devLog('[SEARCH DEBUG] searchWithParsedQuery - Results:', results.map(c => ({ name: c.name, company: c.company })));
  return results;
}

/**
 * Quick search - simple keyword matching for typeahead
 */
export function quickSearch(contacts: Contact[], query: string): Contact[] {
  if (!query.trim()) return [];
  
  const terms = tokenize(query);
  return searchContacts(contacts, terms, { maxResults: 10, minScore: 2 });
}

/**
 * Execute search using canonical SearchQuery schema
 * This is the new primary execution function
 * Uses hybrid scoring: keyword matching (60%) + semantic similarity (40%)
 */
export async function executeSearchQuery(
  contacts: Contact[],
  searchQuery: SearchQuery,
  options: { maxResults?: number; originalQuery?: string } = {}
): Promise<Contact[]> {
  const { maxResults = MAX_RESULTS, originalQuery } = options;
  const { filters, semantic_hint } = searchQuery;
  
  devLog('[SEARCH DEBUG] executeSearchQuery - Starting search');
  devLog('[SEARCH DEBUG] executeSearchQuery - Contacts count:', contacts.length);
  devLog('[SEARCH DEBUG] executeSearchQuery - SearchQuery:', JSON.stringify(searchQuery, null, 2));
  
  // Early return if no contacts
  if (contacts.length === 0) {
    devLog('[SEARCH DEBUG] executeSearchQuery - No contacts provided');
    return [];
  }

  // Build search terms from filters and semantic hint
  const searchTerms: string[] = [];

  // Add name to search terms if present
  if (filters.name) {
    searchTerms.push(...tokenize(filters.name));
  }

  // Add tags to search terms if present
  if (filters.tags && filters.tags.length > 0) {
    searchTerms.push(...filters.tags.map(t => t.toLowerCase()));
  }

  // Add semantic_hint to search terms for ranking (not filtering)
  if (semantic_hint) {
    searchTerms.push(...tokenize(semantic_hint));
  }

  // IMPORTANT: If we have responsibility filters, don't use keyword matching
  // The responsibility filter is precise and should be sufficient
  if (filters.responsibilities && filters.responsibilities.length > 0) {
    devLog('[SEARCH DEBUG] Responsibility filter present, clearing keyword search terms');
    searchTerms.length = 0; // Clear the array
  }

  // Get query text for semantic matching (use originalQuery if provided, otherwise semantic_hint)
  const queryTextForSemantic = originalQuery || semantic_hint || "";

  // Compute semantic scores in batch (if we have query text and enough contacts to benefit)
  // Skip semantic scoring for very short queries or if we have too many contacts (performance)
  // Use timeout to prevent blocking UI for too long
  let semanticScores: Map<string, number> = new Map();
  const shouldUseSemantic = queryTextForSemantic.trim() && 
                            queryTextForSemantic.length >= 3 && // At least 3 characters
                            contacts.length <= 500 && // Reduced limit for better performance
                            contacts.length > 0; // Only if we have contacts
  
  if (shouldUseSemantic) {
    try {
      // Use Promise.race with reasonable timeout
      // Don't block for too long, but allow enough time for embeddings to load from cache
      const semanticPromise = batchSemanticScores(queryTextForSemantic, contacts);
      const timeoutPromise = new Promise<Map<string, number>>((resolve) => {
        setTimeout(() => resolve(new Map()), 1000); // 1s timeout - allow cached embeddings to load
      });
      
      semanticScores = await Promise.race([semanticPromise, timeoutPromise]);
    } catch (error) {
      console.warn("Semantic scoring failed, using keyword-only:", error);
    }
  }

  // PERFORMANCE: Filter contacts FIRST, then score only filtered contacts
  // This avoids processing all 1000+ contacts when we only need 10 results
  let filteredContacts = contacts;

  // Apply deterministic filters first to reduce dataset before scoring
  if (filters.company) {
    const searchCompany = filters.company.toLowerCase().trim();
    devLog('[SEARCH DEBUG] executeSearchQuery - Filtering by company:', searchCompany);
    const beforeFilter = filteredContacts.length;
    filteredContacts = filteredContacts.filter(contact => {
      const contactCompany = (contact.company || "").toLowerCase().trim();
      const matches = companyMatches(contactCompany, searchCompany);
      if (matches) {
        devLog('[SEARCH DEBUG] executeSearchQuery - Company match:', contactCompany, 'matches', searchCompany);
      }
      return matches;
    });
    devLog('[SEARCH DEBUG] executeSearchQuery - Company filter:', beforeFilter, '->', filteredContacts.length, 'contacts');
  }

  if (filters.job_title) {
    const searchRole = filters.job_title.toLowerCase();
    devLog('[SEARCH DEBUG] executeSearchQuery - Filtering by role:', searchRole);
    const beforeFilter = filteredContacts.length;
    filteredContacts = filteredContacts.filter(contact => {
      const contactRole = (contact.role || "").toLowerCase();
      // More flexible role matching - check if search role contains contact role or vice versa
      // This handles "ops directors" matching "Operations Director" or "Director of Operations"
      const roleMatchesResult = roleMatches(contactRole, searchRole);
      if (roleMatchesResult) {
        devLog('[SEARCH DEBUG] executeSearchQuery - Role match:', contactRole, 'matches', searchRole);
        return true;
      }
      
      // Also check if any word from search role appears in contact role
      const searchRoleWords = searchRole.split(/\s+/).filter(w => w.length >= 2);
      const contactRoleWords = contactRole.split(/\s+/);
      const hasMatchingWord = searchRoleWords.some(searchWord => 
        contactRoleWords.some(contactWord => 
          contactWord.includes(searchWord) || searchWord.includes(contactWord)
        )
      );
      if (hasMatchingWord) {
        devLog('[SEARCH DEBUG] executeSearchQuery - Role word match:', contactRole, 'contains word from', searchRole);
        return true;
      }
      return false;
    });
    devLog('[SEARCH DEBUG] executeSearchQuery - Role filter:', beforeFilter, '->', filteredContacts.length, 'contacts');
  }

  if (filters.name) {
    const searchName = filters.name.toLowerCase();
    filteredContacts = filteredContacts.filter(contact => {
      const contactName = (contact.name || "").toLowerCase();
      return contactName.includes(searchName);
    });
  }

  if (filters.location) {
    const searchLocation = filters.location.toLowerCase();
    filteredContacts = filteredContacts.filter(contact => {
      const contactLocation = [
        contact.address || "",
        contact.city || "",
        contact.state || "",
        contact.country || "",
      ].join(" ").toLowerCase();
      return contactLocation.includes(searchLocation);
    });
  }

  if (filters.relationship_type) {
    filteredContacts = filteredContacts.filter(contact => {
      const isClient = contact.isClient || false;
      const tags = (contact.tags || []).map(t => t.toLowerCase());
      
      if (filters.relationship_type === "client" && isClient) return true;
      if (filters.relationship_type === "vendor" && tags.includes("vendor")) return true;
      if (filters.relationship_type === "met" && tags.some(t => t.includes("met") || t.includes("meet"))) return true;
      if (filters.relationship_type === "worked_with" && tags.some(t => t.includes("work") || t.includes("colleague"))) return true;
      return false;
    });
  }

  if (filters.date_range) {
    const fromTime = new Date(filters.date_range.from).getTime();
    const toTime = new Date(filters.date_range.to).getTime();
    filteredContacts = filteredContacts.filter(contact => {
      const contactCreatedAt = contact.createdAt;
      if (!contactCreatedAt || contactCreatedAt.trim() === '') return false;
      const createdAt = new Date(contactCreatedAt);
      if (isNaN(createdAt.getTime())) return false;
      const createdAtTime = createdAt.getTime();
      return createdAtTime >= fromTime && createdAtTime <= toTime;
    });
  }

  if (filters.tags && filters.tags.length > 0) {
    const searchTags = filters.tags.map(t => t.toLowerCase());
    filteredContacts = filteredContacts.filter(contact => {
      const contactTags = (contact.tags || []).map(t => t.toLowerCase());
      return searchTags.some(tag => contactTags.includes(tag));
    });
  }

  // Filter by responsibilities
  if (filters.responsibilities && filters.responsibilities.length > 0) {
    devLog('[SEARCH DEBUG] Applying responsibility filter:', filters.responsibilities);
    filteredContacts = filteredContacts.filter(contact => {
      // Check each responsibility ID
      return filters.responsibilities!.some(respId => {
        const resp = RESPONSIBILITIES[respId];
        if (!resp) return false;
        
        let matches = false;
        
        // Check departments (role/description)
        if (resp.filters.departments && resp.filters.departments.length > 0) {
          const contactRole = (contact.role || "").toLowerCase();
          const contactDesc = (contact.description || "").toLowerCase();
          for (const dept of resp.filters.departments) {
            if (contactRole.includes(dept.toLowerCase()) || 
                contactDesc.includes(dept.toLowerCase())) {
              matches = true;
              break;
            }
          }
        }
        
        // Check roles
        if (!matches && resp.filters.roles && resp.filters.roles.length > 0) {
          const contactRole = (contact.role || "").toLowerCase();
          for (const role of resp.filters.roles) {
            if (contactRole.includes(role.toLowerCase())) {
              matches = true;
              break;
            }
          }
        }
        
        // Check tags
        if (!matches && resp.filters.tags && resp.filters.tags.length > 0) {
          const contactTags = (contact.tags || []).map(t => t.toLowerCase());
          for (const tag of resp.filters.tags) {
            if (contactTags.includes(tag.toLowerCase())) {
              matches = true;
              break;
            }
          }
        }
        
        return matches;
      });
    });
    devLog('[SEARCH DEBUG] After responsibility filter, contacts:', filteredContacts.length);
  }

  // Check if we have entity filters
  const hasEntityFilters = !!(filters.company || filters.job_title || filters.name || filters.location || filters.responsibilities);
  
  devLog('[SEARCH DEBUG] executeSearchQuery - After filtering:', {
    hasEntityFilters,
    searchTermsCount: searchTerms.length,
    filteredContactsCount: filteredContacts.length,
    originalContactsCount: contacts.length
  });
  
  // If we have entity filters but no search terms, we should return all filtered contacts
  // (they've already been filtered by the entity criteria)
  if (hasEntityFilters && searchTerms.length === 0) {
    devLog('[SEARCH DEBUG] executeSearchQuery - Entity filters only, no search terms. Filtered contacts:', filteredContacts.length);
    
    // CRITICAL: If entity filters resulted in 0 contacts, try more lenient matching
    if (filteredContacts.length === 0) {
      devLog('[SEARCH DEBUG] executeSearchQuery - Entity filters too strict, trying lenient matching');
      // Try lenient matching - check if any contact partially matches
      filteredContacts = contacts.filter(contact => {
        if (filters.company) {
          const contactCompany = (contact.company || "").toLowerCase();
          const searchCompany = filters.company.toLowerCase();
          if (contactCompany.includes(searchCompany) || searchCompany.includes(contactCompany)) {
            return true;
          }
        }
        if (filters.job_title) {
          const contactRole = (contact.role || "").toLowerCase();
          const searchRole = filters.job_title.toLowerCase();
          if (contactRole.includes(searchRole) || searchRole.includes(contactRole)) {
            return true;
          }
        }
        if (filters.name) {
          const contactName = (contact.name || "").toLowerCase();
          const searchName = filters.name.toLowerCase();
          if (contactName.includes(searchName)) {
            return true;
          }
        }
        if (filters.location) {
          const contactLocation = [
            contact.address || "",
            contact.city || "",
            contact.state || "",
            contact.country || "",
          ].join(" ").toLowerCase();
          const searchLocation = filters.location.toLowerCase();
          if (contactLocation.includes(searchLocation)) {
            return true;
          }
        }
        return false;
      });
      devLog('[SEARCH DEBUG] executeSearchQuery - After lenient matching:', filteredContacts.length, 'contacts');
    }
    
    // Return filtered contacts directly, sorted by semantic score if available
    if (semanticScores.size > 0) {
      return filteredContacts
        .map(contact => ({
          contact,
          semanticScore: semanticScores.get(contact.id) || 0
        }))
        .sort((a, b) => b.semanticScore - a.semanticScore)
        .slice(0, maxResults)
        .map(s => s.contact);
    }
    return filteredContacts.slice(0, maxResults);
  }

  // Now score only the filtered contacts (much smaller set)
  const scored = filteredContacts
    .map(contact => {
      // Score against search terms (keyword matching)
      const result = scoreContact(contact, searchTerms);
      const keywordScore = result.score;

      // Get semantic score (0-1)
      const semanticScoreValue = semanticScores.get(contact.id) || 0;
      result.semanticScore = semanticScoreValue;

      // Hybrid scoring: 60% keyword + 40% semantic
      // Normalize semantic score to keyword score range
      const SEMANTIC_SCORE_SCALE = 20; // Max semantic contribution
      const normalizedSemanticScore = semanticScoreValue * SEMANTIC_SCORE_SCALE;

      // Combine scores: 60% keyword, 40% semantic
      const KEYWORD_WEIGHT = 0.6;
      const SEMANTIC_WEIGHT = 0.4;
      
      result.score = (keywordScore * KEYWORD_WEIGHT) + (normalizedSemanticScore * SEMANTIC_WEIGHT);
      
      // If we have semantic score but no keyword score, still give some points
      // But require higher semantic similarity (0.4 instead of 0.3) to be more selective
      if (keywordScore === 0 && semanticScoreValue > 0.4) {
        result.score = Math.max(result.score, normalizedSemanticScore * 0.5);
      }
      
      // If we have entity filters and the contact passed the filter, give a small boost
      // But only if there's some actual match (keyword or semantic)
      // Don't give free points just for passing filters - require actual relevance
      if (hasEntityFilters && (keywordScore > 0 || semanticScoreValue > 0.3)) {
        // Small boost for matching entity filters (0.5 points)
        result.score += 0.5;
      }

      return result;
    })
    .filter(s => s.score >= MIN_SCORE_THRESHOLD) // Require meaningful match
    .sort((a, b) => {
      // Sort by score, but if scores are equal, prefer contacts with higher semantic scores
      if (Math.abs(a.score - b.score) < 0.1) {
        const aSemantic = a.semanticScore || 0;
        const bSemantic = b.semanticScore || 0;
        return bSemantic - aSemantic;
      }
      return b.score - a.score;
    });

  devLog('[SEARCH DEBUG] executeSearchQuery - Scored contacts:', scored.length, 'out of', filteredContacts.length, 'filtered');
  devLog('[SEARCH DEBUG] executeSearchQuery - Search terms:', searchTerms);
  devLog('[SEARCH DEBUG] executeSearchQuery - Entity filters:', { 
    company: filters.company, 
    job_title: filters.job_title, 
    name: filters.name, 
    location: filters.location 
  });

  // If we have entity filters but no scored results, try a more lenient threshold
  // But still require some minimum relevance (not just any filtered contact)
  if (scored.length === 0 && hasEntityFilters && filteredContacts.length > 0) {
    devLog('[SEARCH DEBUG] executeSearchQuery - No results with strict threshold, trying lenient scoring for filtered contacts');
    // Re-score with lower threshold, but still require some match
    const LENIENT_THRESHOLD = 0.5; // Much lower, but not zero
    const lenientScored = filteredContacts
      .map(contact => {
        const result = scoreContact(contact, searchTerms);
        const keywordScore = result.score;
        const semanticScoreValue = semanticScores.get(contact.id) || 0;
        result.semanticScore = semanticScoreValue;
        
        const SEMANTIC_SCORE_SCALE = 20;
        const normalizedSemanticScore = semanticScoreValue * SEMANTIC_SCORE_SCALE;
        const KEYWORD_WEIGHT = 0.6;
        const SEMANTIC_WEIGHT = 0.4;
        result.score = (keywordScore * KEYWORD_WEIGHT) + (normalizedSemanticScore * SEMANTIC_WEIGHT);
        
        // Give small boost for matching entity filters
        if (keywordScore > 0 || semanticScoreValue > 0.2) {
          result.score += 0.5;
        }
        
        return result;
      })
      .filter(s => s.score >= LENIENT_THRESHOLD)
      .sort((a, b) => {
        if (Math.abs(a.score - b.score) < 0.1) {
          return (b.semanticScore || 0) - (a.semanticScore || 0);
        }
        return b.score - a.score;
      });
    
    if (lenientScored.length > 0) {
      devLog('[SEARCH DEBUG] executeSearchQuery - Found', lenientScored.length, 'results with lenient threshold');
      return lenientScored.slice(0, maxResults).map(s => s.contact);
    }
  }

  // If we have no entity filters and no results, but we have search terms,
  // try a more lenient threshold (for plain language queries without entity extraction)
  if (scored.length === 0 && !hasEntityFilters && searchTerms.length > 0) {
    devLog('[SEARCH DEBUG] executeSearchQuery - No results with search terms, trying lenient threshold');
    const lenientScored = filteredContacts
      .map(contact => {
        const result = scoreContact(contact, searchTerms);
        const keywordScore = result.score;
        const semanticScoreValue = semanticScores.get(contact.id) || 0;
        result.semanticScore = semanticScoreValue;
        
        const SEMANTIC_SCORE_SCALE = 20;
        const normalizedSemanticScore = semanticScoreValue * SEMANTIC_SCORE_SCALE;
        const KEYWORD_WEIGHT = 0.6;
        const SEMANTIC_WEIGHT = 0.4;
        result.score = (keywordScore * KEYWORD_WEIGHT) + (normalizedSemanticScore * SEMANTIC_WEIGHT);
        
        // More lenient: accept semantic matches even with low keyword scores
        if (keywordScore === 0 && semanticScoreValue > 0.2) {
          result.score = Math.max(result.score, normalizedSemanticScore * 0.5);
        }
        
        return result;
      })
      .filter(s => s.score > 0) // Trust LLM - include any contacts with score > 0
      .sort((a, b) => {
        if (Math.abs(a.score - b.score) < 0.1) {
          return (b.semanticScore || 0) - (a.semanticScore || 0);
        }
        return b.score - a.score;
      });
    
    if (lenientScored.length > 0) {
      devLog('[SEARCH DEBUG] executeSearchQuery - Found', lenientScored.length, 'results with lenient threshold');
      return lenientScored.slice(0, maxResults).map(s => s.contact);
    }
  }

  // Return scored results, or if no results but we have search terms, return top filtered contacts
  if (scored.length > 0) {
    return scored.slice(0, maxResults).map(s => s.contact);
  }
  
  // Fallback: if we have search terms but no scored results, return filtered contacts sorted by semantic score
  if (searchTerms.length > 0 && filteredContacts.length > 0) {
    if (semanticScores.size > 0) {
      return filteredContacts
        .map(contact => ({
          contact,
          semanticScore: semanticScores.get(contact.id) || 0
        }))
        .sort((a, b) => b.semanticScore - a.semanticScore)
        .slice(0, maxResults)
        .map(s => s.contact);
    }
    return filteredContacts.slice(0, maxResults);
  }
  
  // Last resort: return empty array
  return [];
}
