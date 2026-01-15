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
  interpretation: string | null; // Human-readable interpretation of the query
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

    // Check if we have filters (company, role, etc.) even if searchTerms is empty
    const hasFilters = parsedQuery.entities.companies.length > 0 ||
                      parsedQuery.entities.roles.length > 0 ||
                      parsedQuery.entities.businesses.length > 0 ||
                      parsedQuery.entities.locations.length > 0 ||
                      parsedQuery.entities.relationships.length > 0 ||
                      !!parsedQuery.timeRange ||
                      !!parsedQuery.interactionType ||
                      !!parsedQuery.interactionTimeRange ||
                      parsedQuery.needsFollowUp === true ||
                      !!parsedQuery.responsibility;

    // If no meaningful search terms extracted, but we have filters, still use search engine
    if (parsedQuery.searchTerms.length === 0) {
      if (hasFilters) {
        // Use search engine to apply filters even without search terms
        return searchWithParsedQuery(contacts, parsedQuery, { maxResults: MAX_RESULTS });
      }
      return parsedQuery.action ? contacts : contacts.slice(0, MAX_RESULTS);
    }

    // Use deterministic search engine
    const results = searchWithParsedQuery(contacts, parsedQuery, { maxResults: MAX_RESULTS });
    
    // If no results from parsed query, try basic search on original terms
    // BUT only if we don't have filters (filters should be respected)
    if (results.length === 0 && !hasFilters) {
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
    interpretation: parsedQuery?.interpretation || null, // Query interpretation
  };
}
