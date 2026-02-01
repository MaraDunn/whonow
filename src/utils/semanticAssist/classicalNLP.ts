/**
 * Classical NLP Query Enhancement
 * Zero-dependency, deterministic semantic understanding
 * 
 * Features:
 * - Synonym expansion
 * - Fuzzy matching
 * - Intent classification
 * - Responsibility inference
 * - No models, no downloads, instant response
 */

import { SearchQuery } from "@/types/searchQuery";
import { isDebugMode } from "@/utils/ai";
import { devLog } from "@/lib/devLog";

/**
 * Comprehensive synonym maps for contact search
 */
const SYNONYMS = {
  // Design & Creative
  logo: ['designer', 'graphic designer', 'brand designer', 'visual designer', 'creative director', 'design', 'branding', 'graphics'],
  design: ['designer', 'creative', 'ux', 'ui', 'visual', 'graphic'],
  branding: ['brand', 'designer', 'marketing', 'creative'],
  
  // Development & Engineering
  code: ['developer', 'engineer', 'programmer', 'software', 'tech'],
  developer: ['engineer', 'programmer', 'coder', 'software engineer'],
  engineer: ['developer', 'technical', 'software', 'engineering'],
  tech: ['technical', 'technology', 'engineering', 'developer'],
  
  // Business & Finance
  money: ['finance', 'accounting', 'financial', 'investment', 'budget'],
  finance: ['financial', 'accounting', 'money', 'investment', 'fintech'],
  sales: ['business development', 'account executive', 'revenue', 'selling'],
  
  // Marketing & Growth
  marketing: ['growth', 'advertising', 'promotion', 'outreach', 'campaigns'],
  social: ['social media', 'community', 'content', 'engagement'],
  content: ['writing', 'copywriting', 'editorial', 'blog', 'articles'],
  
  // HR & People
  hiring: ['recruiting', 'recruitment', 'talent', 'hr', 'human resources'],
  recruiting: ['hiring', 'talent acquisition', 'recruitment', 'hr'],
  
  // Operations & Management
  operations: ['ops', 'logistics', 'operational', 'process'],
  legal: ['lawyer', 'attorney', 'counsel', 'compliance', 'contracts'],
  
  // Time-related synonyms
  recently: ['recent', 'lately', 'just', 'new'],
  week: ['weekly', '7 days', 'last week', 'this week'],
  month: ['monthly', '30 days', 'last month', 'this month'],
  
  // Actions
  make: ['create', 'build', 'develop', 'produce', 'design'],
  build: ['create', 'make', 'develop', 'construct'],
  create: ['make', 'build', 'design', 'develop'],
  help: ['assist', 'support', 'aid', 'advise'],
};

/**
 * Responsibility keywords - map actions/needs to responsibilities
 */
const RESPONSIBILITY_KEYWORDS = {
  // Design
  'RESP_DESIGN': ['logo', 'brand', 'visual', 'graphic', 'design', 'designer', 'creative', 'ui', 'ux', 'mockup', 'prototype', 'illustration'],
  
  // Development
  'RESP_ENGINEERING': ['code', 'develop', 'engineer', 'program', 'software', 'app', 'website', 'technical', 'backend', 'frontend', 'fullstack'],
  
  // Marketing
  'RESP_MARKETING': ['market', 'advertise', 'promote', 'campaign', 'growth', 'seo', 'sem', 'ads'],
  
  // Sales
  'RESP_SALES': ['sell', 'sales', 'deal', 'client', 'customer', 'revenue', 'close'],
  
  // Finance
  'RESP_FINANCE': ['finance', 'money', 'budget', 'accounting', 'financial', 'investment', 'fund'],
  
  // HR
  'RESP_HR_RECRUITING': ['hire', 'recruit', 'talent', 'interview', 'candidate', 'onboard'],
  
  // Legal
  'RESP_LEGAL': ['legal', 'lawyer', 'attorney', 'contract', 'compliance', 'law'],
  
  // Operations
  'RESP_OPERATIONS': ['operations', 'logistics', 'process', 'workflow', 'efficiency'],
  
  // Content
  'RESP_CONTENT': ['write', 'content', 'blog', 'article', 'copy', 'editorial', 'writer'],
  
  // Social Media
  'RESP_SOCIAL_MEDIA': ['social media', 'twitter', 'linkedin', 'instagram', 'facebook', 'community', 'engagement'],
};

/**
 * Common question patterns to extract intent
 */
const QUESTION_PATTERNS = {
  who_can: /who (?:can|could|would|might|should|is able to|are able to|'s able to|'re able to)\s+(.+)/i,
  who_does: /who (?:does|do|did|knows how to|know how to)\s+(.+)/i,
  find_person: /(?:find|get me|show me|need)\s+(?:someone|a person|people)\s+(?:who|that|to)\s+(.+)/i,
  capability: /(?:make|create|build|do|help with|assist with)\s+(.+)/i,
};

/**
 * Expand query with synonyms
 */
function expandSynonyms(query: string): string[] {
  const words = query.toLowerCase().split(/\s+/);
  const expanded = new Set<string>([query.toLowerCase()]);
  
  words.forEach(word => {
    // Add the word itself
    expanded.add(word);
    
    // Add synonyms if they exist
    const synonymList = SYNONYMS[word as keyof typeof SYNONYMS];
    if (synonymList) {
      synonymList.forEach(syn => expanded.add(syn));
    }
  });
  
  return Array.from(expanded);
}

/**
 * Infer responsibilities from query (using ORIGINAL terms only, not expanded synonyms)
 */
function inferResponsibilities(query: string): string[] {
  const queryLower = query.toLowerCase();
  const words = queryLower.split(/\s+/).filter(w => w.length >= 3); // Original words only
  const responsibilities = new Set<string>();
  
  // Check each responsibility's keywords
  Object.entries(RESPONSIBILITY_KEYWORDS).forEach(([respId, keywords]) => {
    const matches = keywords.some(keyword => {
      // Only match substantial keywords (3+ characters)
      if (keyword.length < 3) return false;
      
      // Check if any original query word matches this keyword
      return words.some(word => {
        // Exact match or keyword is contained in word
        return word === keyword || word.includes(keyword) || keyword.includes(word);
      });
    });
    
    if (matches) {
      responsibilities.add(respId);
    }
  });
  
  if (isDebugMode() && responsibilities.size > 0) {
    devLog('[ClassicalNLP] Inferred responsibilities:', Array.from(responsibilities));
  }
  
  return Array.from(responsibilities);
}

/**
 * Extract capability/action from question patterns
 */
function extractCapability(query: string): string | null {
  for (const [patternName, regex] of Object.entries(QUESTION_PATTERNS)) {
    const match = query.match(regex);
    if (match && match[1]) {
      if (isDebugMode()) {
        devLog(`[ClassicalNLP] Matched pattern: ${patternName}, extracted: "${match[1]}"`);
      }
      return match[1].trim();
    }
  }
  return null;
}

/**
 * Calculate Levenshtein distance for fuzzy matching
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

/**
 * Fuzzy match - check if strings are similar
 */
function isFuzzyMatch(query: string, target: string, threshold: number = 0.8): boolean {
  const distance = levenshteinDistance(query.toLowerCase(), target.toLowerCase());
  const maxLength = Math.max(query.length, target.length);
  const similarity = 1 - (distance / maxLength);
  return similarity >= threshold;
}

/**
 * Enhance query with classical NLP
 */
export function enhanceQueryWithClassicalNLP(
  query: string,
  fallback: SearchQuery
): SearchQuery {
  try {
    if (isDebugMode()) {
      devLog('[ClassicalNLP] Processing query:', query);
    }
    
    // Start with fallback
    const enhanced: SearchQuery = {
      ...fallback,
      confidence: Math.max(fallback.confidence, 0.7), // Boost confidence
    };
    
    // Extract capability from question patterns
    const capability = extractCapability(query);
    if (capability) {
      // Expand capability with synonyms
      const expandedTerms = expandSynonyms(capability);
      
      if (isDebugMode()) {
        devLog('[ClassicalNLP] Capability:', capability);
        devLog('[ClassicalNLP] Expanded terms:', expandedTerms);
      }
      
      // Infer responsibilities
      const responsibilities = inferResponsibilities(capability);
      
      if (responsibilities.length > 0) {
        enhanced.filters.responsibilities = responsibilities;
        enhanced.confidence = 0.85; // High confidence
        enhanced.explanation = `Looking for contacts with skills: ${responsibilities.map(r => r.replace('RESP_', '').toLowerCase()).join(', ')}`;
        
        if (isDebugMode()) {
          devLog('[ClassicalNLP] Enhanced with responsibilities:', responsibilities);
        }
      }
    }
    
    // Expand search terms with synonyms
    if (enhanced.semantic_hint) {
      const originalTerms = enhanced.semantic_hint.toLowerCase().split(/\s+/);
      const expandedTerms = new Set(originalTerms);
      
      originalTerms.forEach(term => {
        const synonyms = SYNONYMS[term as keyof typeof SYNONYMS];
        if (synonyms) {
          synonyms.forEach(syn => expandedTerms.add(syn));
        }
      });
      
      // Update semantic hint with key expanded terms
      const keyTerms = Array.from(expandedTerms).slice(0, 10);
      enhanced.semantic_hint = keyTerms.join(' ');
      
      if (isDebugMode()) {
        devLog('[ClassicalNLP] Expanded semantic hint:', enhanced.semantic_hint);
      }
    }
    
    if (isDebugMode()) {
      devLog('[ClassicalNLP] Enhanced query:', enhanced);
    }
    
    return enhanced;
  } catch (error) {
    if (isDebugMode()) {
      console.error('[ClassicalNLP] Enhancement failed:', error);
    }
    return fallback;
  }
}

/**
 * Fuzzy match contact fields
 */
export function fuzzyMatchContact(query: string, contactText: string, threshold: number = 0.75): boolean {
  const queryWords = query.toLowerCase().split(/\s+/);
  const contactWords = contactText.toLowerCase().split(/\s+/);
  
  // Check if any query word fuzzy matches any contact word
  return queryWords.some(qWord => 
    contactWords.some(cWord => 
      qWord.length > 2 && cWord.length > 2 && isFuzzyMatch(qWord, cWord, threshold)
    )
  );
}
