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
  const detailed = matchResponsibilityDetailed(phrase, index);
  if (!detailed) return null;
  return {
    responsibilityId: detailed.responsibilityId,
    matchedAlias: detailed.matchedAlias,
  };
}

export interface ResponsibilityMatchDetailed {
  responsibilityId: string;
  matchedAlias: string;
  source: "exact" | "indexed";
  candidateCount: number;
  confidenceBand: "high" | "medium";
}

export function matchResponsibilityDetailed(
  phrase: string,
  index: Map<string, Set<string>>
): ResponsibilityMatchDetailed | null {
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
        source: "exact",
        candidateCount: 1,
        confidenceBand: "high",
      };
    }
  }
  
  // If no exact match, use candidates from index
  const candidates = findCandidateResponsibilities(phrase, index);
  
  if (candidates.size === 0) {
    return null;
  }
  
  // Disambiguation: choose the best alias for the actual query, then highest-scoring responsibility.
  // This avoids picking a candidate just because it has a very long alias unrelated to the phrase.
  let bestMatch: { responsibilityId: string; matchedAlias: string; priority: number; score: number } | null = null;
  const queryTokenSet = new Set(tokens);
  
  for (const candidateId of candidates) {
    const responsibility = RESPONSIBILITIES[candidateId];
    if (!responsibility) continue;
    
    // Find the best alias for this candidate against the current phrase.
    let bestAlias = "";
    let bestAliasScore = -1;

    for (const [alias, id] of Object.entries(RESPONSIBILITY_ALIASES)) {
      if (id !== candidateId) continue;

      const normalizedAlias = normalizeResponsibilityPhrase(alias);
      const aliasTokens = tokenize(normalizedAlias);
      if (aliasTokens.length === 0) continue;

      let overlap = 0;
      for (const token of aliasTokens) {
        if (queryTokenSet.has(token)) overlap++;
      }
      if (overlap === 0) continue;

      const phraseContainsAlias = normalized.includes(normalizedAlias) ? 1 : 0;
      const aliasContainsPhrase = normalizedAlias.includes(normalized) ? 1 : 0;
      const coverage = overlap / Math.max(queryTokenSet.size, 1);
      const precision = overlap / aliasTokens.length;
      const score =
        phraseContainsAlias * 100 +
        aliasContainsPhrase * 50 +
        coverage * 20 +
        precision * 10 +
        aliasTokens.length * 0.1;

      if (score > bestAliasScore) {
        bestAliasScore = score;
        bestAlias = normalizedAlias;
      }
    }
    
    // If no overlapping alias was found, fall back to normalized phrase scoring.
    const candidateScore = (bestAliasScore >= 0 ? bestAliasScore : 0) + responsibility.priority / 100;

    if (
      !bestMatch ||
      candidateScore > bestMatch.score ||
      (candidateScore === bestMatch.score && responsibility.priority > bestMatch.priority)
    ) {
      bestMatch = {
        responsibilityId: candidateId,
        matchedAlias: bestAlias || normalized,
        priority: responsibility.priority,
        score: candidateScore,
      };
    }
  }
  
  return bestMatch
    ? {
        responsibilityId: bestMatch.responsibilityId,
        matchedAlias: bestMatch.matchedAlias,
        source: "indexed",
        candidateCount: candidates.size,
        confidenceBand: candidates.size <= 3 ? "high" : "medium",
      }
    : null;
}

