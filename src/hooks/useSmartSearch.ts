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

function basicSearch(contacts: Contact[], searchTerms: string[]): Contact[] {
  // Score each contact based on how well they match
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
    for (const term of searchTerms) {
      // Exact match in name = highest priority
      if (fields.name.includes(term)) score += 10;
      // Match in role = high priority
      if (fields.role.includes(term)) score += 8;
      // Match in tags = high priority
      if (fields.tags.includes(term)) score += 7;
      // Match in description = medium priority
      if (fields.description.includes(term)) score += 5;
      // Match in company = medium priority
      if (fields.company.includes(term)) score += 4;
      // Match anywhere
      if (allText.includes(term)) score += 1;
    }
    
    return { contact, score };
  });
  
  // Return contacts with any match, sorted by score
  return scoredContacts
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
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

  // AI search function
  const performAISearch = useCallback(async (searchQuery: string, contactList: Contact[]) => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.functions.invoke('parse-search-query', {
        body: { 
          query: searchQuery,
          contacts: contactList.map(c => ({
            name: c.name,
            role: c.role,
            company: c.company,
            description: c.description,
            tags: c.tags
          }))
        }
      });

      if (error) {
        console.error('AI search error:', error);
        return null;
      }

      return {
        matchingNames: data.matchingContactNames || [],
        intent: data.intent || '',
        keywords: data.keywords || []
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

  // Compute filtered contacts
  const filteredContacts = useMemo(() => {
    if (!query.trim()) {
      return contacts;
    }

    // If AI returned matching names, use those with exact matching
    if (aiResult?.matchingNames && aiResult.matchingNames.length > 0) {
      const aiMatches = contacts.filter(c => 
        aiResult.matchingNames.some(name => {
          const contactName = c.name.toLowerCase().trim();
          const matchName = name.toLowerCase().trim();
          // Exact match or close enough
          return contactName === matchName || 
                 contactName.includes(matchName) ||
                 matchName.includes(contactName);
        })
      );
      
      // If AI found matches, return them; otherwise fall back to keyword search
      if (aiMatches.length > 0) {
        return aiMatches;
      }
    }

    // If AI returned keywords, combine with basic search
    if (aiResult?.keywords && aiResult.keywords.length > 0) {
      const keywordResults = basicSearch(contacts, aiResult.keywords.map(k => k.toLowerCase()));
      if (keywordResults.length > 0) {
        return keywordResults;
      }
    }

    // Fall back to basic search with the search term
    const searchTerms = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
    if (searchTerms.length === 0 && action) {
      return contacts; // Just action word, show all
    }
    
    return basicSearch(contacts, searchTerms);
  }, [contacts, query, searchTerm, action, aiResult]);

  return {
    contacts: filteredContacts,
    action,
    searchTerm,
    isLoading,
    aiIntent: aiResult?.intent || null
  };
}
