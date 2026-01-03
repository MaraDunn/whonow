import { useState, useMemo } from "react";
import { Contact } from "@/types/contact";
import { parseSearchQuery, ActionType } from "@/utils/searchQueryParser";
import { searchWithParsedQuery, searchContacts } from "@/utils/contactSearchEngine";

export type { ActionType };

interface SmartSearchResult {
  contacts: Contact[];
  action: ActionType;
  searchTerm: string;
  isLoading: boolean;
  aiIntent: string | null;
}

const MAX_RESULTS = 10; // Reduced for better precision

/**
 * Deterministic smart search hook - NO AI/LLM
 * Uses rule-based query parsing and weighted full-text search
 */
export function useSmartSearch(contacts: Contact[], query: string): SmartSearchResult {
  // Parse query deterministically
  const parsedQuery = useMemo(() => {
    if (!query.trim()) return null;
    return parseSearchQuery(query);
  }, [query]);

  // Compute filtered contacts with deterministic search
  const filteredContacts = useMemo(() => {
    if (!query.trim()) {
      return contacts;
    }

    if (!parsedQuery) {
      return contacts.slice(0, MAX_RESULTS);
    }

    // If no meaningful search terms extracted, return all
    if (parsedQuery.searchTerms.length === 0) {
      return parsedQuery.action ? contacts : contacts.slice(0, MAX_RESULTS);
    }

    // Use deterministic search engine
    const results = searchWithParsedQuery(contacts, parsedQuery, { maxResults: MAX_RESULTS });
    
    // If no results from parsed query, try basic search on original terms
    if (results.length === 0) {
      const fallbackTerms = query.toLowerCase().split(/\s+/).filter(t => t.length >= 2);
      return searchContacts(contacts, fallbackTerms, { maxResults: MAX_RESULTS });
    }

    return results;
  }, [contacts, query, parsedQuery]);

  // Build search term (query without action prefix)
  const searchTerm = useMemo(() => {
    if (!parsedQuery) return query.trim();
    return parsedQuery.searchTerms.join(" ");
  }, [parsedQuery, query]);

  return {
    contacts: filteredContacts,
    action: parsedQuery?.action || null,
    searchTerm,
    isLoading: false, // No longer async - deterministic search is synchronous
    aiIntent: parsedQuery?.intent || null, // Now deterministic intent
  };
}
