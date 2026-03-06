/**
 * Fetches contacts for a smart folder by running the same server-side search as the search bar.
 * Smart folders act as "bookmarked searches": we store the query string and run smart_search_contacts
 * when the folder is opened, so results match the primary search bar exactly.
 */

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Contact } from "@/types/contact";
import { parseSearchQueryToSchema } from "@/utils/searchQueryParser";

const SMART_FOLDER_LIMIT = 500;

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

function buildSearchRpcParams(
  userId: string,
  query: string,
  limit: number
): Record<string, unknown> {
  const deterministicQuery = parseSearchQueryToSchema(query);
  const f = deterministicQuery.filters;
  return {
    _user_id: userId,
    _job_title: f.job_title ?? null,
    _date_range_from: f.date_range?.from ?? null,
    _date_range_to: f.date_range?.to ?? null,
    _last_contacted_from: f.interaction_date_range?.from ?? null,
    _last_contacted_to: f.interaction_date_range?.to ?? null,
    _name: f.name ?? null,
    _company: f.company ?? null,
    _tags: f.tags ?? null,
    _location: f.location ?? null,
    _relationship_type: f.relationship_type ?? null,
    _semantic_hint: deterministicQuery.semantic_hint ?? null,
    _limit: limit,
  };
}

export function useSmartFolderContacts(savedQuery: string | null) {
  const { user } = useAuth();
  const query = savedQuery?.trim() || null;

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["smartFolderContacts", query, user?.id],
    queryFn: async (): Promise<Contact[]> => {
      if (!user?.id || !query) return [];
      const rpcParams = buildSearchRpcParams(user.id, query, SMART_FOLDER_LIMIT);
      const { data, error } = await supabase.rpc("smart_search_contacts", rpcParams);
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => mapSearchRowToContact(row));
    },
    enabled: !!user?.id && !!query,
    staleTime: 60_000,
  });

  return { contacts, isLoading };
}
