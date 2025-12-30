import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Contact } from "@/types/contact";
import { supabase } from "@/integrations/supabase/client";

export type ActionType = "email" | "call" | "text" | null;

interface SmartSearchResult {
  contacts: Contact[];
  action: ActionType;
  searchTerm: string;
  isLoading: boolean;
  aiIntent: string | null;
}

const ACTION_KEYWORDS: Record<string, ActionType> = {
  email: "email",
  mail: "email",
  message: "email",
  call: "call",
  phone: "call",
  ring: "call",
  text: "text",
  sms: "text",
};

const QUESTION_STARTERS = [
  "who", "what", "where", "which", "find", "show", "get", 
  "search", "look", "can", "do", "does", "is", "are", "help"
];

function isQuestion(query: string): boolean {
  const lowerQuery = query.toLowerCase().trim();
  
  // Check if it starts with a question word
  if (QUESTION_STARTERS.some(starter => lowerQuery.startsWith(starter + " "))) {
    return true;
  }
  
  // Check if it ends with a question mark
  if (lowerQuery.endsWith("?")) {
    return true;
  }
  
  // Check for patterns like "someone who", "anyone who"
  if (lowerQuery.includes("someone") || lowerQuery.includes("anyone")) {
    return true;
  }
  
  return false;
}

// Require ALL search terms to match (AND logic) with minimum score threshold
function basicSearch(contacts: Contact[], searchTerms: string[]): Contact[] {
  if (searchTerms.length === 0) return [];
  
  const scoredContacts = contacts.map((contact) => {
    const fields = {
      name: (contact.name || "").toLowerCase(),
      email: (contact.email || "").toLowerCase(),
      phone: (contact.phone || "").toLowerCase(),
      company: (contact.company || "").toLowerCase(),
      role: (contact.role || "").toLowerCase(),
      description: (contact.description || "").toLowerCase(),
      tags: contact.tags.join(" ").toLowerCase(),
    };
    
    const allText = Object.values(fields).join(" ");
    
    let score = 0;
    let matchedTerms = 0;
    
    for (const term of searchTerms) {
      let termMatched = false;
      
      // Exact match in name = highest priority
      if (fields.name.includes(term)) { score += 10; termMatched = true; }
      // Match in role = high priority
      if (fields.role.includes(term)) { score += 8; termMatched = true; }
      // Match in tags = high priority
      if (fields.tags.includes(term)) { score += 7; termMatched = true; }
      // Match in description = medium priority
      if (fields.description.includes(term)) { score += 5; termMatched = true; }
      // Match in company = medium priority
      if (fields.company.includes(term)) { score += 4; termMatched = true; }
      // Match anywhere (only count if not already matched above)
      if (!termMatched && allText.includes(term)) { score += 1; termMatched = true; }
      
      if (termMatched) matchedTerms++;
    }
    
    // Require ALL terms to match for multi-term searches, or primary term for single
    const requiredMatches = searchTerms.length === 1 ? 1 : Math.ceil(searchTerms.length * 0.8);
    const passesThreshold = matchedTerms >= requiredMatches && score >= 4;
    
    return { contact, score, passesThreshold };
  });
  
  // Return only contacts that pass the threshold, sorted by score, max 15
  return scoredContacts
    .filter(({ passesThreshold }) => passesThreshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, 15)
    .map(({ contact }) => contact);
}

export function useSmartSearch(contacts: Contact[], query: string): SmartSearchResult {
  const [isLoading, setIsLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{
    matchingNames: string[];
    intent: string;
    keywords: string[];
  } | null>(null);
  const lastQueryRef = useRef<string>("");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Parse action keywords first
  const { action, searchTerm } = useMemo(() => {
    if (!query.trim()) {
      return { action: null, searchTerm: "" };
    }

    const words = query.toLowerCase().split(" ").filter(Boolean);
    const firstWord = words[0];
    const detectedAction = ACTION_KEYWORDS[firstWord] || null;
    
    return {
      action: detectedAction,
      searchTerm: detectedAction ? words.slice(1).join(" ") : query
    };
  }, [query]);

  // Determine if we should use AI
  const shouldUseAI = useMemo(() => {
    if (!searchTerm.trim()) return false;
    return isQuestion(searchTerm);
  }, [searchTerm]);

  // AI search function with confidence filtering
  const performAISearch = useCallback(async (searchQuery: string, contactList: Contact[]) => {
    try {
      setIsLoading(true);
      
      // Sanitize query - prevent prompt injection
      const sanitizedQuery = searchQuery.slice(0, 500).trim();
      
      const { data, error } = await supabase.functions.invoke('parse-search-query', {
        body: { 
          query: sanitizedQuery,
          // SECURITY: Only send necessary fields, minimize PII exposure to AI
          contacts: contactList.map(c => ({
            name: c.name,
            role: c.role || '',
            company: c.company || '',
            description: (c.description || '').slice(0, 200), // Limit description length
            tags: (c.tags || []).slice(0, 10) // Limit tags
            // Intentionally exclude: email, phone, avatar
          }))
        }
      });

      if (error) {
        console.error('AI search error:', error);
        return null;
      }

      // Filter out low confidence results - fall back to keyword search instead
      const confidence = data.confidence || 'low';
      if (confidence === 'low') {
        console.log('AI confidence low, falling back to keyword search');
        return {
          matchingNames: [],
          intent: data.intent || '',
          keywords: data.keywords || [],
          confidence: 'low'
        };
      }

      return {
        matchingNames: data.matchingContactNames || [],
        intent: data.intent || '',
        keywords: data.keywords || [],
        confidence
      };
    } catch (err) {
      console.error('AI search failed:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced AI search effect
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!shouldUseAI || !searchTerm.trim()) {
      setAiResult(null);
      setIsLoading(false);
      return;
    }

    // Don't re-fetch if query hasn't changed meaningfully
    if (lastQueryRef.current === searchTerm) {
      return;
    }

    setIsLoading(true);
    
    debounceRef.current = setTimeout(async () => {
      lastQueryRef.current = searchTerm;
      const result = await performAISearch(searchTerm, contacts);
      setAiResult(result);
    }, 500); // 500ms debounce

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchTerm, shouldUseAI, contacts, performAISearch]);

  // Compute filtered contacts with strict matching and result limits
  const filteredContacts = useMemo(() => {
    if (!query.trim()) {
      return contacts;
    }

    const MAX_RESULTS = 15;

    // If AI returned matching names with good confidence, use STRICT exact matching
    if (aiResult?.matchingNames && aiResult.matchingNames.length > 0) {
      const aiMatches = contacts.filter(c => 
        aiResult.matchingNames.some(name => {
          const contactName = c.name.toLowerCase().trim();
          const matchName = name.toLowerCase().trim();
          // STRICT: Only exact match or the AI name is contained in contact name
          return contactName === matchName || contactName.startsWith(matchName + " ") || contactName.endsWith(" " + matchName);
        })
      );
      
      if (aiMatches.length > 0) {
        return aiMatches.slice(0, MAX_RESULTS);
      }
    }

    // If AI returned keywords (even with low confidence), use them for basic search
    if (aiResult?.keywords && aiResult.keywords.length > 0) {
      const keywordResults = basicSearch(contacts, aiResult.keywords.map(k => k.toLowerCase()));
      if (keywordResults.length > 0) {
        return keywordResults.slice(0, MAX_RESULTS);
      }
    }

    // Fall back to basic search with the search term
    const searchTerms = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
    if (searchTerms.length === 0 && action) {
      return contacts;
    }
    
    return basicSearch(contacts, searchTerms).slice(0, MAX_RESULTS);
  }, [contacts, query, searchTerm, action, aiResult]);

  return {
    contacts: filteredContacts,
    action,
    searchTerm,
    isLoading,
    aiIntent: aiResult?.intent || null
  };
}
