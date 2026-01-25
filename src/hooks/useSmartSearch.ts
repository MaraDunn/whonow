import { useState, useMemo, useEffect, useRef } from "react";
import { Contact } from "@/types/contact";
import { parseSearchQuery, ActionType, parseSearchQueryToSchema } from "@/utils/searchQueryParser";
import { searchWithParsedQuery, searchContacts, executeSearchQuery } from "@/utils/contactSearchEngine";
import { enhanceQuery, type AIMetadata } from "@/utils/ai";
import { SearchQuery } from "@/types/searchQuery";

export type { ActionType };

interface SmartSearchResult {
  contacts: Contact[];
  action: ActionType;
  searchTerm: string;
  isLoading: boolean;
  aiIntent: string | null;
  interpretation: string | null;
  aiMetadata?: AIMetadata; // New: AI enhancement metadata
}

const MAX_RESULTS = 10;

/**
 * Smart search hook with deterministic-first approach
 * Deterministic parsing → deterministic search → AI enhancement (optional)
 * 
 * Key changes from previous version:
 * - Deterministic search ALWAYS runs first and completes
 * - AI enhancement is optional and additive
 * - AI failures never block or delay results
 * - Respects user preferences (opt-in/opt-out)
 */
export function useSmartSearch(contacts: Contact[], query: string): SmartSearchResult {
  const [finalQuery, setFinalQuery] = useState<SearchQuery | null>(null);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [aiMetadata, setAiMetadata] = useState<AIMetadata | undefined>(undefined);
  const [isSearching, setIsSearching] = useState(false);
  const abortController = useRef<AbortController | null>(null);

  useEffect(() => {
    // Cancel previous request
    if (abortController.current) {
      abortController.current.abort();
    }

    if (!query.trim()) {
      setFilteredContacts(contacts);
      setIsSearching(false);
      setFinalQuery(null);
      setAiMetadata(undefined);
      return;
    }

    // Create new abort controller
    const controller = new AbortController();
    abortController.current = controller;

    setIsSearching(true);

    // STEP 1: ALWAYS run deterministic parser (REQUIRED)
    const deterministicQuery = parseSearchQueryToSchema(query);
    
    // STEP 2: ALWAYS execute deterministic search first (REQUIRED)
    // This ensures results are IMMEDIATELY available
    const performSearch = async () => {
      const deterministicResults = await executeSearchQuery(contacts, deterministicQuery, { 
        maxResults: MAX_RESULTS,
        originalQuery: query
      });
      
      if (controller.signal.aborted) return;
      
      // Show deterministic results immediately
      setFilteredContacts(deterministicResults.length > 0 ? deterministicResults : contacts.slice(0, MAX_RESULTS));
      setFinalQuery(deterministicQuery);
      setIsSearching(false);

      // STEP 3: OPTIONALLY enhance with AI (ADDITIVE ONLY)
      // This runs in background without blocking the UI
      try {
        const enhancement = await enhanceQuery(query, deterministicQuery);
        
        if (controller.signal.aborted) return;
        
        // Store AI metadata for debugging/monitoring
        setAiMetadata(enhancement.metadata);
        
        // Only update if AI actually enhanced the query
        if (enhancement.metadata.aiUsed && enhancement.enhanced) {
          setFinalQuery(enhancement.enhanced);
          
          // Re-execute search with AI-enhanced query
          const enhancedResults = await executeSearchQuery(contacts, enhancement.enhanced, { 
            maxResults: MAX_RESULTS,
            originalQuery: query
          });
          
          if (controller.signal.aborted) return;
          
          // Update results if AI found better matches
          if (enhancedResults.length > 0) {
            setFilteredContacts(enhancedResults);
          }
        }
      } catch (error) {
        // This should never happen (enhanceQuery never throws),
        // but handle gracefully just in case
        if (controller.signal.aborted) return;
        console.warn("[useSmartSearch] Unexpected AI enhancement error:", error);
        // Keep deterministic results
      }
    };
    
    performSearch();

    return () => {
      controller.abort();
    };
  }, [contacts, query]);

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
    isLoading: isSearching,
    aiIntent: finalQuery?.intent || null,
    interpretation: finalQuery?.explanation || null,
    aiMetadata, // Expose AI metadata for debugging
  };
}
