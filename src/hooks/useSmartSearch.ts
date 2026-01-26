import { useState, useMemo, useEffect, useRef } from "react";
import { Contact } from "@/types/contact";
import { parseSearchQuery, ActionType, parseSearchQueryToSchema } from "@/utils/searchQueryParser";
import { enhanceQuery, type AIMetadata } from "@/utils/ai";
import { SearchQuery } from "@/types/searchQuery";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export type { ActionType };

interface SmartSearchResult {
  contacts: Contact[];
  action: ActionType;
  searchTerm: string;
  isLoading: boolean;
  aiIntent: string | null;
  interpretation: string | null;
  aiMetadata?: AIMetadata;
}

const MAX_RESULTS = 10;

/** Map a contacts table row from search_contacts RPC to Contact */
function mapSearchRowToContact(row: Record<string, unknown>): Contact {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    phone: String(row.phone ?? ""),
    company: String(row.company ?? ""),
    role: String(row.role ?? ""),
    description: row.description != null ? String(row.description) : undefined,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    avatar: row.avatar != null ? String(row.avatar) : undefined,
    folderId: row.folder_id != null ? String(row.folder_id) : undefined,
    createdAt: row.created_at != null ? String(row.created_at) : undefined,
    address: row.address != null ? String(row.address) : undefined,
    city: row.city != null ? String(row.city) : undefined,
    state: row.state != null ? String(row.state) : undefined,
    zipCode: row.zip_code != null ? String(row.zip_code) : undefined,
    country: row.country != null ? String(row.country) : undefined,
    latitude: typeof row.latitude === "number" ? row.latitude : undefined,
    longitude: typeof row.longitude === "number" ? row.longitude : undefined,
    businessName: row.business_name != null ? String(row.business_name) : undefined,
    businessType: row.business_type != null ? String(row.business_type) : undefined,
  };
}

export type UseSmartSearchOptions = { totalCount?: number };

/**
 * Universal smart search: Always uses server-side smart_search_contacts RPC.
 * Works consistently for 10 contacts or 10,000+ contacts.
 * Supports: responsibility matching, time filters, text search, location.
 */
export function useSmartSearch(
  contacts: Contact[],
  query: string,
  options?: UseSmartSearchOptions
): SmartSearchResult {
  const { user } = useAuth();
  const [finalQuery, setFinalQuery] = useState<SearchQuery | null>(null);
  const [searchResults, setSearchResults] = useState<Contact[]>([]);
  const [aiMetadata, setAiMetadata] = useState<AIMetadata | undefined>(undefined);
  const [isSearching, setIsSearching] = useState(false);
  const abortController = useRef<AbortController | null>(null);
  const hasActiveQuery = query.trim().length > 0;

  useEffect(() => {
    // Cancel previous request
    if (abortController.current) {
      abortController.current.abort();
    }

    if (!hasActiveQuery) {
      // When query is cleared, reset search state but don't manage contacts
      // The effectiveContacts computed value will return the contacts prop directly
      setSearchResults([]);
      setIsSearching(false);
      setFinalQuery(null);
      setAiMetadata(undefined);
      return;
    }

    if (!user?.id) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    // Create new abort controller
    const controller = new AbortController();
    abortController.current = controller;

    setIsSearching(true);

    // STEP 1: Parse query into structured filters
    const deterministicQuery = parseSearchQueryToSchema(query);
    
    // STEP 2: Execute server-side smart search
    const performSearch = async () => {
      try {
        // Build params object, only including non-null values (except _user_id and _limit which are required)
        const searchParams: Record<string, any> = {
          _user_id: user.id,
          _limit: MAX_RESULTS,
        };
        
        // Only add optional parameters if they have values
        if (deterministicQuery.filters.job_title) {
          searchParams._job_title = deterministicQuery.filters.job_title;
        }
        if (deterministicQuery.filters.date_range?.from) {
          searchParams._date_range_from = deterministicQuery.filters.date_range.from;
        }
        if (deterministicQuery.filters.date_range?.to) {
          searchParams._date_range_to = deterministicQuery.filters.date_range.to;
        }
        if (deterministicQuery.filters.name) {
          searchParams._name = deterministicQuery.filters.name;
        }
        if (deterministicQuery.filters.company) {
          searchParams._company = deterministicQuery.filters.company;
        }
        // NOTE: Don't send tags from responsibility matches - they're metadata, not user filters
        // Only send tags if explicitly searched for (not from responsibility extraction)
        if (deterministicQuery.filters.tags?.length && !deterministicQuery.filters.job_title) {
          searchParams._tags = deterministicQuery.filters.tags;
        }
        if (deterministicQuery.filters.location) {
          searchParams._location = deterministicQuery.filters.location;
        }
        if (deterministicQuery.filters.relationship_type) {
          searchParams._relationship_type = deterministicQuery.filters.relationship_type;
        }
        // Only use semantic_hint for text search if we don't have structured filters
        // (Responsibility queries use job_title, not text matching)
        if ((deterministicQuery.semantic_hint || query) && !deterministicQuery.filters.job_title) {
          searchParams._semantic_hint = deterministicQuery.semantic_hint || query;
        }
        
        const { data, error } = await supabase.rpc("smart_search_contacts", searchParams);

        if (controller.signal.aborted) return;

        if (error) {
          console.error("[useSmartSearch] smart_search_contacts RPC error:", error);
          setSearchResults([]);
          setIsSearching(false);
          return;
        }

        const results = (data ?? []).map((row: Record<string, unknown>) => mapSearchRowToContact(row));
        setSearchResults(results);
        setFinalQuery(deterministicQuery);
        setIsSearching(false);

        // STEP 3: Run AI enhancement for interpretation/display only
        // (Results already returned, this is just for showing user what we understood)
        try {
          const enhancement = await enhanceQuery(query, deterministicQuery);
          if (controller.signal.aborted) return;
          setAiMetadata(enhancement.metadata);
          const queryToUse = enhancement.metadata.aiUsed && enhancement.enhanced ? enhancement.enhanced : deterministicQuery;
          setFinalQuery(queryToUse);
        } catch (err) {
          if (!controller.signal.aborted) {
            console.warn("[useSmartSearch] AI enhancement error:", err);
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error("[useSmartSearch] Search failed:", err);
          setSearchResults([]);
          setIsSearching(false);
        }
      }
    };

    performSearch();
    return () => {
      controller.abort();
    };
  }, [query, user?.id, hasActiveQuery]);

  // When there's no search query, ALWAYS return the input contacts directly
  // When there is a query, return the search results
  // This ensures clearing the search immediately shows the full list without state sync issues
  const effectiveContacts = useMemo(() => {
    const result = hasActiveQuery ? searchResults : contacts;
    console.log('[useSmartSearch] effectiveContacts:', 
      'hasQuery:', hasActiveQuery,
      'searchResults:', searchResults.length,
      'contacts:', contacts.length,
      'returning:', result.length
    );
    return result;
  }, [hasActiveQuery, searchResults, contacts]);

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
    contacts: effectiveContacts,
    action: legacyParsed?.action || null,
    searchTerm,
    isLoading: isSearching,
    aiIntent: finalQuery?.intent || null,
    interpretation: finalQuery?.explanation || null,
    aiMetadata, // Expose AI metadata for debugging
  };
}
