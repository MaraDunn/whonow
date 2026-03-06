import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export interface ContactVocabulary {
  cities: string[];
  companies: string[];
  roles: string[];
}

/**
 * Fetches distinct city, company, and role values from the user's contacts.
 * Used for spell-check suggestions in the smart folder search query field.
 */
export function useContactVocabulary(): ContactVocabulary & { isLoading: boolean } {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["contactVocabulary", user?.id],
    queryFn: async (): Promise<ContactVocabulary> => {
      if (!user?.id) return { cities: [], companies: [], roles: [] };

      const [citiesRes, companiesRes, rolesRes] = await Promise.all([
        supabase
          .from("contacts")
          .select("city")
          .eq("owner_id", user.id)
          .not("city", "is", null)
          .is("deleted_at", null),
        supabase
          .from("contacts")
          .select("company")
          .eq("owner_id", user.id)
          .not("company", "is", null)
          .is("deleted_at", null),
        supabase
          .from("contacts")
          .select("role")
          .eq("owner_id", user.id)
          .not("role", "is", null)
          .is("deleted_at", null),
      ]);

      const unique = (rows: Record<string, string | null>[] | null, key: string): string[] => {
        if (!rows) return [];
        const set = new Set<string>();
        for (const row of rows) {
          const val = row[key];
          if (val && val.trim()) set.add(val.trim());
        }
        return Array.from(set);
      };

      return {
        cities: unique(citiesRes.data, "city"),
        companies: unique(companiesRes.data, "company"),
        roles: unique(rolesRes.data, "role"),
      };
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  return {
    cities: data?.cities ?? [],
    companies: data?.companies ?? [],
    roles: data?.roles ?? [],
    isLoading,
  };
}
