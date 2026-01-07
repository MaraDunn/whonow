/**
 * Context Analysis Utilities for Contact Text Parsing
 * Rule-based semantic analysis without AI/LLM
 */

export interface TextSpan {
  text: string;
  start: number;
  end: number;
}

export interface ContextWindow {
  before: string[];
  target: string;
  after: string[];
  position: number;
}

export type SemanticTag = 
  | "PERSON" 
  | "ROLE" 
  | "COMPANY" 
  | "ACTION" 
  | "DESCRIPTION" 
  | "COMPANY_INDICATOR" 
  | "DESCRIPTION_INDICATOR"
  | "UNKNOWN";

export interface TaggedWord {
  word: string;
  tag: SemanticTag;
  position: number;
  confidence: number;
}

/**
 * Get a context window around a specific position in text
 */
export function getContextWindow(
  text: string,
  position: number,
  windowSize: number = 3
): ContextWindow {
  const words = text.split(/\s+/);
  let currentPos = 0;
  let targetIndex = -1;
  
  // Find which word index corresponds to the position
  for (let i = 0; i < words.length; i++) {
    const wordStart = currentPos;
    const wordEnd = currentPos + words[i].length;
    
    if (position >= wordStart && position <= wordEnd) {
      targetIndex = i;
      break;
    }
    
    currentPos = wordEnd + 1; // +1 for space
  }
  
  if (targetIndex === -1) {
    return {
      before: [],
      target: "",
      after: [],
      position: -1
    };
  }
  
  const beforeStart = Math.max(0, targetIndex - windowSize);
  const afterEnd = Math.min(words.length, targetIndex + windowSize + 1);
  
  return {
    before: words.slice(beforeStart, targetIndex),
    target: words[targetIndex],
    after: words.slice(targetIndex + 1, afterEnd),
    position: targetIndex
  };
}

/**
 * Detect phrase boundaries in text
 * Returns array of text spans representing semantic chunks
 */
export function detectPhraseBoundaries(text: string): TextSpan[] {
  const spans: TextSpan[] = [];
  
  // Boundary markers (in order of priority)
  const strongBoundaries = /[.!?;]/g;
  const mediumBoundaries = /[,]/g;
  const weakBoundaries = /\b(and|or|but|at|for|from|with|works?|handles?|manages?|leads?)\b/gi;
  
  // Split by strong boundaries first
  const strongSplits = text.split(strongBoundaries);
  let currentPos = 0;
  
  for (const segment of strongSplits) {
    if (segment.trim().length === 0) continue;
    
    // Further split by medium boundaries
    const mediumSplits = segment.split(mediumBoundaries);
    
    for (const subSegment of mediumSplits) {
      const trimmed = subSegment.trim();
      if (trimmed.length > 0) {
        // Find actual position in original text
        const start = text.indexOf(trimmed, currentPos);
        if (start !== -1) {
          spans.push({
            text: trimmed,
            start: start,
            end: start + trimmed.length
          });
          currentPos = start + trimmed.length;
        }
      }
    }
  }
  
  // If no boundaries found, return whole text as one span
  if (spans.length === 0) {
    spans.push({
      text: text.trim(),
      start: 0,
      end: text.length
    });
  }
  
  return spans;
}

/**
 * Analyze the semantic context of a phrase
 * Returns what type of information the phrase likely contains
 */
export function analyzePhrasePurpose(phrase: string, previousContext?: string[]): SemanticTag[] {
  const phraseLower = phrase.toLowerCase();
  const tags: SemanticTag[] = [];
  
  // Check for company indicators
  if (/\b(at|for|from|@)\s+[a-z]/i.test(phrase)) {
    tags.push("COMPANY_INDICATOR");
  }
  
  // Check for description indicators
  if (/\b(handles?|manages?|leads?|works?\s+(?:on|with)|responsible\s+for|does)\b/i.test(phrase)) {
    tags.push("DESCRIPTION_INDICATOR");
  }
  
  // Check for action verbs (description content)
  if (/\b(handles?|manages?|leads?|coordinates?|oversees?|develops?|creates?|maintains?)\b/i.test(phrase)) {
    tags.push("ACTION");
  }
  
  // Check for role indicators
  const rolePattern = /\b(ceo|cto|cfo|vp|manager|director|lead|engineer|designer|developer|analyst|coordinator|specialist|consultant)\b/i;
  if (rolePattern.test(phrase)) {
    tags.push("ROLE");
  }
  
  // Check for company suffixes
  if (/\b(inc|llc|ltd|corp|corporation|company|international|industries|technologies|tech|solutions|group)\b/i.test(phrase)) {
    tags.push("COMPANY");
  }
  
  // If at the beginning and has capitalized words, likely a person name
  if (!previousContext || previousContext.length === 0) {
    if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/.test(phrase)) {
      tags.push("PERSON");
    }
  }
  
  if (tags.length === 0) {
    tags.push("UNKNOWN");
  }
  
  return tags;
}

/**
 * Tag words in text with their semantic roles
 */
export function tagWords(text: string): TaggedWord[] {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const tagged: TaggedWord[] = [];
  
  // Company indicator words
  const companyIndicators = new Set(["at", "for", "from", "@"]);
  // Description indicator words  
  const descriptionIndicators = new Set(["handles", "manages", "leads", "works", "does", "coordinates", "oversees"]);
  // Role title words
  const roleTitles = new Set([
    "ceo", "cto", "cfo", "coo", "cmo", "vp", "president",
    "manager", "director", "lead", "head", "founder", "partner",
    "engineer", "developer", "designer", "analyst", "coordinator",
    "specialist", "consultant", "advisor", "architect"
  ]);
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const wordLower = word.toLowerCase();
    let tag: SemanticTag = "UNKNOWN";
    let confidence = 0.5;
    
    // Check for company indicators
    if (companyIndicators.has(wordLower)) {
      tag = "COMPANY_INDICATOR";
      confidence = 0.9;
    }
    // Check for description indicators
    else if (descriptionIndicators.has(wordLower)) {
      tag = "DESCRIPTION_INDICATOR";
      confidence = 0.9;
    }
    // Check for role titles
    else if (roleTitles.has(wordLower)) {
      tag = "ROLE";
      confidence = 0.8;
    }
    // Check if word follows company indicator (likely company name)
    else if (i > 0 && tagged[i - 1].tag === "COMPANY_INDICATOR") {
      tag = "COMPANY";
      confidence = 0.8;
    }
    // Check if word follows description indicator (likely description)
    else if (i > 0 && tagged[i - 1].tag === "DESCRIPTION_INDICATOR") {
      tag = "DESCRIPTION";
      confidence = 0.8;
    }
    // Check if capitalized at start (likely person name)
    else if (i < 3 && /^[A-Z][a-z]+$/.test(word)) {
      tag = "PERSON";
      confidence = 0.7;
    }
    
    tagged.push({
      word,
      tag,
      position: i,
      confidence
    });
  }
  
  return tagged;
}

/**
 * Determine if "works" in context means employment (company) or task (description)
 */
export function analyzeWorksContext(text: string, worksPosition: number): "COMPANY" | "DESCRIPTION" {
  const window = getContextWindow(text, worksPosition, 2);
  
  // Check the word after "works"
  if (window.after.length > 0) {
    const nextWord = window.after[0].toLowerCase();
    
    // "works for" → company
    if (nextWord === "for") {
      return "COMPANY";
    }
    
    // "works on/with/at" → description
    if (["on", "with", "at"].includes(nextWord)) {
      return "DESCRIPTION";
    }
  }
  
  // Default to description if ambiguous
  return "DESCRIPTION";
}

/**
 * Score a text span based on how well it matches expected criteria
 */
export function scoreMatch(
  text: string,
  criteria: {
    hasCapitalization?: boolean;
    hasCompanySuffix?: boolean;
    hasRoleTitle?: boolean;
    position?: "start" | "middle" | "end";
    length?: { min?: number; max?: number };
  }
): number {
  let score = 0;
  
  if (criteria.hasCapitalization !== undefined) {
    const hasCapital = /^[A-Z]/.test(text);
    score += hasCapital === criteria.hasCapitalization ? 1 : -1;
  }
  
  if (criteria.hasCompanySuffix !== undefined) {
    const hasSuffix = /\b(inc|llc|ltd|corp|international|technologies|solutions)\b/i.test(text);
    score += hasSuffix === criteria.hasCompanySuffix ? 2 : 0;
  }
  
  if (criteria.hasRoleTitle !== undefined) {
    const hasRole = /\b(ceo|manager|director|vp|engineer|designer)\b/i.test(text);
    score += hasRole === criteria.hasRoleTitle ? 2 : 0;
  }
  
  if (criteria.length) {
    const wordCount = text.split(/\s+/).length;
    if (criteria.length.min && wordCount >= criteria.length.min) score += 0.5;
    if (criteria.length.max && wordCount <= criteria.length.max) score += 0.5;
  }
  
  return score;
}

