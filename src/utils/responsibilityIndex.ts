/**
 * Reverse Token Index for Responsibility Matching
 * Maps tokens to candidate responsibility IDs for fast lookup
 */

import { RESPONSIBILITY_ALIASES } from "@/data/responsibilityAliases";
import { RESPONSIBILITIES } from "@/data/responsibilities";

/**
 * Tokenize text into words
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(t => t.length >= 2);
}

/**
 * Generate n-grams from tokens (1 to 5 tokens)
 */
function generateNGrams(tokens: string[]): string[] {
  const ngrams: string[] = [];
  const maxN = Math.min(5, tokens.length);
  
  for (let n = 1; n <= maxN; n++) {
    for (let i = 0; i <= tokens.length - n; i++) {
      ngrams.push(tokens.slice(i, i + n).join(" "));
    }
  }
  
  return ngrams;
}

/**
 * Build reverse token index
 * Maps each token to candidate responsibility IDs
 */
export function buildResponsibilityIndex(): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  
  // Index all aliases
  for (const [alias, responsibilityId] of Object.entries(RESPONSIBILITY_ALIASES)) {
    const tokens = tokenize(alias);
    
    for (const token of tokens) {
      if (!index.has(token)) {
        index.set(token, new Set());
      }
      index.get(token)!.add(responsibilityId);
    }
  }
  
  // Also index responsibility filter terms for fallback
  for (const [responsibilityId, responsibility] of Object.entries(RESPONSIBILITIES)) {
    const allTerms: string[] = [
      ...(responsibility.filters.departments || []),
      ...(responsibility.filters.roles || []),
      ...(responsibility.filters.tags || []),
    ];
    
    for (const term of allTerms) {
      const tokens = tokenize(term);
      for (const token of tokens) {
        if (!index.has(token)) {
          index.set(token, new Set());
        }
        index.get(token)!.add(responsibilityId);
      }
    }
  }
  
  return index;
}

/**
 * Normalize responsibility phrase
 */
export function normalizeResponsibilityPhrase(phrase: string): string {
  return phrase
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, " ") // Remove punctuation
    .replace(/\s+/g, " ") // Normalize whitespace
    .replace(/\b(the|a|an|about)\b/g, "") // Remove filler words
    .trim();
}

/**
 * Find candidate responsibility IDs using reverse index
 */
export function findCandidateResponsibilities(
  phrase: string,
  index: Map<string, Set<string>>
): Set<string> {
  const normalized = normalizeResponsibilityPhrase(phrase);
  const tokens = tokenize(normalized);
  const candidates = new Set<string>();
  
  // Collect all candidate IDs from tokens
  for (const token of tokens) {
    const tokenCandidates = index.get(token);
    if (tokenCandidates) {
      for (const candidateId of tokenCandidates) {
        candidates.add(candidateId);
      }
    }
  }
  
  return candidates;
}

/**
 * Match responsibility phrase to canonical ID
 * Returns the matched responsibility ID and alias, or null
 */
export function matchResponsibility(
  phrase: string,
  index: Map<string, Set<string>>
): { responsibilityId: string; matchedAlias: string } | null {
  const normalized = normalizeResponsibilityPhrase(phrase);
  const tokens = tokenize(normalized);
  
  // Generate n-grams (longest first)
  const ngrams = generateNGrams(tokens).reverse(); // Reverse to try longest first
  
  // Try exact alias matches first (longest first)
  for (const ngram of ngrams) {
    const normalizedNgram = normalizeResponsibilityPhrase(ngram);
    if (RESPONSIBILITY_ALIASES[normalizedNgram]) {
      return {
        responsibilityId: RESPONSIBILITY_ALIASES[normalizedNgram],
        matchedAlias: normalizedNgram,
      };
    }
  }
  
  // If no exact match, use candidates from index
  const candidates = findCandidateResponsibilities(phrase, index);
  
  if (candidates.size === 0) {
    return null;
  }
  
  // Disambiguation: longest match + highest priority
  let bestMatch: { responsibilityId: string; matchedAlias: string; priority: number } | null = null;
  
  for (const candidateId of candidates) {
    const responsibility = RESPONSIBILITIES[candidateId];
    if (!responsibility) continue;
    
    // Find the longest matching alias
    let longestAlias = "";
    for (const [alias, id] of Object.entries(RESPONSIBILITY_ALIASES)) {
      if (id === candidateId && alias.length > longestAlias.length) {
        longestAlias = alias;
      }
    }
    
    if (!bestMatch || 
        longestAlias.length > bestMatch.matchedAlias.length ||
        (longestAlias.length === bestMatch.matchedAlias.length && 
         responsibility.priority > bestMatch.priority)) {
      bestMatch = {
        responsibilityId: candidateId,
        matchedAlias: longestAlias || normalized,
        priority: responsibility.priority,
      };
    }
  }
  
  return bestMatch ? {
    responsibilityId: bestMatch.responsibilityId,
    matchedAlias: bestMatch.matchedAlias,
  } : null;
}

