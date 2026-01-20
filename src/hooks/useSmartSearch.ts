import { useState, useMemo, useEffect, useRef } from "react";
import { Contact } from "@/types/contact";
import { parseSearchQuery, ActionType, parseSearchQueryToSchema } from "@/utils/searchQueryParser";
import { searchWithParsedQuery, searchContacts, executeSearchQuery } from "@/utils/contactSearchEngine";
import { semanticAssist } from "@/utils/semanticAssist";
import { SearchQuery } from "@/types/searchQuery";

export type { ActionType };

interface SmartSearchResult {
  contacts: Contact[];
  action: ActionType;
  searchTerm: string;
  isLoading: boolean;
  aiIntent: string | null;
  interpretation: string | null; // Human-readable interpretation of the query
}

const MAX_RESULTS = 10;

/**
 * Smart search hook with LLM-first approach
 * LLM parsing → search execution → results
 */
export function useSmartSearch(contacts: Contact[], query: string): SmartSearchResult {
  const [finalQuery, setFinalQuery] = useState<SearchQuery | null>(null);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const abortController = useRef<AbortController | null>(null);

  // LLM-first approach: Parse query with LLM, fallback to minimal deterministic
  useEffect(() => {
    // Cancel previous request
    if (abortController.current) {
      abortController.current.abort();
    }

    if (!query.trim()) {
      setFilteredContacts(contacts);
      setIsEnhancing(false);
      setIsSearching(false);
      setFinalQuery(null);
      return;
    }

    // Create new abort controller
    const controller = new AbortController();
    abortController.current = controller;

    setIsEnhancing(true);
    setIsSearching(true);

    // Step 1: Get minimal deterministic query (for time ranges, responsibilities)
    const deterministicQuery = parseSearchQueryToSchema(query);

    // Step 2: Apply semantic assist (LLM parsing)
    semanticAssist(query, deterministicQuery)
      .then((enhanced) => {
        if (controller.signal.aborted) return;
        
        setFinalQuery(enhanced);
        setIsEnhancing(false);

        // Step 3: Execute search with enhanced query
        return executeSearchQuery(contacts, enhanced, { 
          maxResults: MAX_RESULTS,
          originalQuery: query
        });
      })
      .then((results) => {
        if (controller.signal.aborted) return;
        
        setFilteredContacts(results.length > 0 ? results : contacts.slice(0, MAX_RESULTS));
        setIsSearching(false);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        
        console.warn("Search failed:", error);
        // Fallback to basic search
        const fallbackTerms = query.toLowerCase().split(/\s+/).filter(t => t.length >= 2);
        const fallbackResults = searchContacts(contacts, fallbackTerms, { maxResults: MAX_RESULTS });
        setFilteredContacts(fallbackResults);
        setIsEnhancing(false);
        setIsSearching(false);
      });

    return () => {
      controller.abort();
    };
  }, [contacts, query]);

  // Build search term and extract action
  const searchTerm = useMemo(() => {
    if (!query.trim()) return "";
    return query.trim();
  }, [query]);

  // Extract action from legacy parser for backward compatibility
  const legacyParsed = useMemo(() => {
    if (!query.trim()) return null;
    return parseSearchQuery(query);
  }, [query]);

  return {
    contacts: filteredContacts,
    action: legacyParsed?.action || null,
    searchTerm,
    isLoading: isEnhancing || isSearching,
    aiIntent: finalQuery?.intent || null,
    interpretation: finalQuery?.explanation || null,
  };
}
