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

const MAX_RESULTS = 10; // Reduced for better precision
const SEMANTIC_ASSIST_DEBOUNCE_MS = 300; // Debounce semantic assist for performance

/**
 * Debounce function for semantic assist
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Smart search hook with offline semantic assist
 * Uses deterministic parsing + platform-specific semantic assist
 * Includes performance optimizations: debouncing, memoization
 */
export function useSmartSearch(contacts: Contact[], query: string): SmartSearchResult {
  const [enhancedQuery, setEnhancedQuery] = useState<SearchQuery | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const semanticAssistAbortController = useRef<AbortController | null>(null);

  // Step 1: Deterministic parsing (always runs, synchronous)
  // Memoized for performance
  const deterministicQuery = useMemo(() => {
    if (!query.trim()) return null;
    return parseSearchQueryToSchema(query);
  }, [query]);

  // Debounce query for semantic assist (only for semantic assist, not deterministic parsing)
  const debouncedQuery = useDebounce(query, SEMANTIC_ASSIST_DEBOUNCE_MS);

  // Step 2: Semantic assist (platform-specific, async, optional)
  // Debounced to avoid excessive calls
  useEffect(() => {
    // Cancel previous semantic assist request
    if (semanticAssistAbortController.current) {
      semanticAssistAbortController.current.abort();
    }

    if (!deterministicQuery || !debouncedQuery.trim()) {
      setEnhancedQuery(null);
      setIsEnhancing(false);
      return;
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    semanticAssistAbortController.current = abortController;

    setIsEnhancing(true);
    
    // Apply semantic assist asynchronously with timeout
    const timeoutId = setTimeout(() => {
      semanticAssist(debouncedQuery, deterministicQuery)
        .then((enhanced) => {
          // Check if request was aborted
          if (abortController.signal.aborted) return;
          
          setEnhancedQuery(enhanced);
          setIsEnhancing(false);
        })
        .catch((error) => {
          // Ignore abort errors
          if (error.name === 'AbortError') return;
          
          console.warn("Semantic assist failed, using deterministic only:", error);
          if (!abortController.signal.aborted) {
            setEnhancedQuery(deterministicQuery);
            setIsEnhancing(false);
          }
        });
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [debouncedQuery, deterministicQuery]);

  // Step 3: Execute search with final query (deterministic or enhanced)
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchAbortController = useRef<AbortController | null>(null);

  useEffect(() => {
    // Cancel previous search if still running
    if (searchAbortController.current) {
      searchAbortController.current.abort();
    }

    if (!query.trim()) {
      setFilteredContacts(contacts);
      setIsSearching(false);
      return;
    }

    // Use deterministic query immediately - don't wait for enhanced query
    // Enhanced query can update results later if it completes
    const finalQuery = deterministicQuery;
    
    if (!finalQuery) {
      setFilteredContacts(contacts.slice(0, MAX_RESULTS));
      setIsSearching(false);
      return;
    }

    // Create abort controller for this search
    const abortController = new AbortController();
    searchAbortController.current = abortController;

    // Execute search immediately without waiting for enhanced query
    setIsSearching(true);
    
    // Execute search query - remove timeout race as it was causing incomplete results
    // Let the search complete properly, it should be fast enough for 1000+ contacts
    executeSearchQuery(contacts, finalQuery, { 
      maxResults: MAX_RESULTS,
      originalQuery: query
    })
      .then((results) => {
        if (abortController.signal.aborted) return;
        
        // Fallback: if no results and no filters, try basic search
        if (results.length === 0) {
          const hasFilters = !!(
            finalQuery.filters.company ||
            finalQuery.filters.job_title ||
            finalQuery.filters.name ||
            finalQuery.filters.location ||
            finalQuery.filters.relationship_type ||
            finalQuery.filters.date_range ||
            (finalQuery.filters.tags && finalQuery.filters.tags.length > 0)
          );

          if (!hasFilters) {
            const fallbackTerms = query.toLowerCase().split(/\s+/).filter(t => t.length >= 2);
            const fallbackResults = searchContacts(contacts, fallbackTerms, { maxResults: MAX_RESULTS });
            setFilteredContacts(fallbackResults);
          } else {
            setFilteredContacts(results);
          }
        } else {
          setFilteredContacts(results);
        }
        setIsSearching(false);
      })
      .catch((error) => {
        if (abortController.signal.aborted) return;
        
        console.warn("Search execution failed:", error);
        // Fallback to basic search on error
        const fallbackTerms = query.toLowerCase().split(/\s+/).filter(t => t.length >= 2);
        const fallbackResults = searchContacts(contacts, fallbackTerms, { maxResults: MAX_RESULTS });
        setFilteredContacts(fallbackResults);
        setIsSearching(false);
      });

    return () => {
      abortController.abort();
    };
  }, [contacts, query, deterministicQuery]);

  // Separate effect to update results when enhanced query completes
  useEffect(() => {
    if (!enhancedQuery || !query.trim() || enhancedQuery === deterministicQuery) {
      return;
    }

    // Update results with enhanced query scoring (better results)
    const abortController = new AbortController();
    
    executeSearchQuery(contacts, enhancedQuery, { 
      maxResults: MAX_RESULTS,
      originalQuery: query
    })
      .then((enhancedResults) => {
        if (abortController.signal.aborted) return;
        if (enhancedResults.length > 0) {
          setFilteredContacts(enhancedResults);
        }
      })
      .catch(() => {
        // Silently fail - we already have results from deterministic query
      });

    return () => {
      abortController.abort();
    };
  }, [contacts, query, enhancedQuery, deterministicQuery]);

  // Build search term
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
    isLoading: isEnhancing || isSearching, // Show loading while semantic assist or search is running
    aiIntent: deterministicQuery?.intent || null,
    interpretation: enhancedQuery?.explanation || deterministicQuery?.explanation || null,
  };
}
