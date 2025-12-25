// Stop words to filter out from keyword extraction
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
  "handles", "works", "manages", "leads", "runs", "does", "responsible"
]);

// Minimum word length for keywords
const MIN_KEYWORD_LENGTH = 3;

/**
 * Extract meaningful keywords from text
 */
function extractKeywordsFromText(text: string): string[] {
  if (!text) return [];
  
  // Normalize and split into words
  const words = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ") // Remove special chars except hyphens
    .split(/\s+/)
    .filter(word => 
      word.length >= MIN_KEYWORD_LENGTH && 
      !STOP_WORDS.has(word) &&
      !/^\d+$/.test(word) // Exclude pure numbers
    );
  
  return words;
}

/**
 * Extract keywords from role/title
 * e.g., "Senior Marketing Manager" → ["senior", "marketing", "manager"]
 */
export function extractRoleKeywords(role: string): string[] {
  return extractKeywordsFromText(role);
}

/**
 * Extract keywords from company name
 * e.g., "Acme Technologies Inc" → ["acme", "technologies"]
 */
export function extractCompanyKeywords(company: string): string[] {
  const suffixes = new Set(["inc", "llc", "ltd", "corp", "corporation", "company", "co", "group"]);
  return extractKeywordsFromText(company).filter(word => !suffixes.has(word));
}

/**
 * Extract keywords from description
 * e.g., "Handles all marketing campaigns and brand strategy" → ["marketing", "campaigns", "brand", "strategy"]
 */
export function extractDescriptionKeywords(description: string): string[] {
  return extractKeywordsFromText(description);
}

/**
 * Generate auto-keywords from contact data
 * Returns unique, deduplicated keywords merged with existing manual tags
 */
export function generateAutoKeywords(
  role?: string,
  company?: string,
  description?: string,
  existingTags: string[] = []
): { autoKeywords: string[]; allKeywords: string[] } {
  const roleKeywords = extractRoleKeywords(role || "");
  const companyKeywords = extractCompanyKeywords(company || "");
  const descriptionKeywords = extractDescriptionKeywords(description || "");
  
  // Combine and deduplicate
  const autoKeywordsSet = new Set([
    ...roleKeywords,
    ...companyKeywords,
    ...descriptionKeywords
  ]);
  
  // Remove any that are already in existing tags
  const existingTagsLower = new Set(existingTags.map(t => t.toLowerCase()));
  const autoKeywords = Array.from(autoKeywordsSet)
    .filter(kw => !existingTagsLower.has(kw))
    .slice(0, 8); // Limit to 8 auto-keywords
  
  // Merge with existing tags for full keyword list
  const allKeywords = [...existingTags, ...autoKeywords];
  
  return { autoKeywords, allKeywords };
}
