import { useState, useMemo, useEffect, useRef } from "react";
import { Contact } from "@/types/contact";
import { parseSearchQuery, ActionType, parseSearchQueryToSchema } from "@/utils/searchQueryParser";
import { enhanceQuery, type AIMetadata } from "@/utils/ai";
import { SearchQuery } from "@/types/searchQuery";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { devLog } from "@/lib/devLog";

export type { ActionType };

interface SmartSearchResult {
  contacts: Contact[];
  action: ActionType;
  searchTerm: string;
  isLoading: boolean;
  aiIntent: string | null;
  interpretation: string | null;
  understoodFilters: SearchQuery["filters"] | null;
  /** Display label for role-like searches (e.g. "designer" instead of "design"). */
  understoodRoleLabel: string | null;
  isTruncated: boolean;
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
    lastContactedAt: row.last_contacted_at != null ? String(row.last_contacted_at) : undefined,
    isClient: row.is_client === true,
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

export type UseSmartSearchOptions = { totalCount?: number; contactMarkedVersion?: number };

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
  const contactMarkedVersion = options?.contactMarkedVersion ?? 0;
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
        if (deterministicQuery.filters.interaction_date_range?.from) {
          searchParams._last_contacted_from = deterministicQuery.filters.interaction_date_range.from;
        }
        if (deterministicQuery.filters.interaction_date_range?.to) {
          searchParams._last_contacted_to = deterministicQuery.filters.interaction_date_range.to;
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
        // Always pass semantic_hint for ranking (FTS is ranking-only now, doesn't filter)
        // This provides a relevance fallback when structured filters are too strict
        if (deterministicQuery.semantic_hint) {
          searchParams._semantic_hint = deterministicQuery.semantic_hint;
        }
        
        // Pass all params in function order (some PostgREST setups require this)
        const rpcParams = {
          _user_id: user.id,
          _job_title: searchParams._job_title ?? null,
          _date_range_from: searchParams._date_range_from ?? null,
          _date_range_to: searchParams._date_range_to ?? null,
          _last_contacted_from: searchParams._last_contacted_from ?? null,
          _last_contacted_to: searchParams._last_contacted_to ?? null,
          _name: searchParams._name ?? null,
          _company: searchParams._company ?? null,
          _tags: searchParams._tags ?? null,
          _location: searchParams._location ?? null,
          _relationship_type: searchParams._relationship_type ?? null,
          _semantic_hint: searchParams._semantic_hint ?? null,
          _limit: searchParams._limit ?? MAX_RESULTS,
        };

        devLog("[useSmartSearch] RPC params:", JSON.stringify({
          ...rpcParams,
          _last_contacted_from: rpcParams._last_contacted_from,
          _last_contacted_to: rpcParams._last_contacted_to,
        }));

        const { data, error } = await supabase.rpc("smart_search_contacts", rpcParams);

        if (controller.signal.aborted) return;

        if (error) {
          console.error("[useSmartSearch] smart_search_contacts RPC error:", error);
          setSearchResults([]);
          setIsSearching(false);
          return;
        }

        let results = (data ?? []).map((row: Record<string, unknown>) => mapSearchRowToContact(row));
        devLog("[useSmartSearch] RPC returned", results.length, "results", rpcParams._last_contacted_from ? "(interaction-date filter)" : "");

        // Diagnostic: if interaction-date search returns 0, check if any contacts have last_contacted_at
        if (
          results.length === 0 &&
          rpcParams._last_contacted_from &&
          rpcParams._last_contacted_to
        ) {
          const { data: wideData } = await supabase.rpc("smart_search_contacts", {
            ...rpcParams,
            _last_contacted_from: "1970-01-01T00:00:00.000Z",
            _last_contacted_to: "2099-12-31T23:59:59.999Z",
          });
          const wideCount = (wideData ?? []).length;
          if (wideCount > 0) {
            console.warn(
              "[useSmartSearch] Interaction-date query returned 0 but",
              wideCount,
              "contacts have last_contacted_at set (outside date range). Check date range calculation."
            );
          } else {
            console.warn(
              "[useSmartSearch] No contacts have last_contacted_at set. Mark contacts as contacted to use 'who did I call' searches."
            );
          }
        }

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
  }, [query, user?.id, hasActiveQuery, contactMarkedVersion]);

  // Update search results when contacts change (for optimistic updates)
  useEffect(() => {
    if (hasActiveQuery && Array.isArray(searchResults) && searchResults.length > 0 && Array.isArray(contacts)) {
      // Create a map of updated contacts for quick lookup
      const contactsMap = new Map(contacts.map(c => [c.id, c]));
      
      // Update any contacts in search results that have been updated in the base contacts
      const updatedSearchResults = searchResults.map(resultContact => {
        if (!resultContact || !resultContact.id) return resultContact;
        const updatedContact = contactsMap.get(resultContact.id);
        // If contact exists in base contacts, merge any updates (especially isClient)
        if (updatedContact) {
          return { ...resultContact, ...updatedContact };
        }
        return resultContact;
      });
      
      // Only update if there are actual changes
      const hasChanges = updatedSearchResults.some((contact, index) => {
        const original = searchResults[index];
        return !original || contact?.isClient !== original?.isClient;
      });
      
      if (hasChanges) {
        setSearchResults(updatedSearchResults);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts, hasActiveQuery]);

  // When there's no search query, ALWAYS return the input contacts directly
  // When there is a query, return the search results
  // This ensures clearing the search immediately shows the full list without state sync issues
  const effectiveContacts = useMemo(() => {
    const result = hasActiveQuery ? searchResults : contacts;
    devLog('[useSmartSearch] effectiveContacts:', 
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
    understoodFilters: finalQuery?.filters ?? null,
    understoodRoleLabel: legacyParsed?.responsibility?.filters?.roles?.[0] ?? finalQuery?.filters?.job_title ?? null,
    isTruncated: hasActiveQuery ? searchResults.length >= MAX_RESULTS : false,
    aiMetadata, // Expose AI metadata for debugging
  };
}
