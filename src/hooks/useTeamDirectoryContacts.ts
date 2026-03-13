import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Contact } from "@/types/contact";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";

type DbProfile = {
  id: string;
  company_id: string | null;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  role: string | null;
  avatar_url: string | null;
  description: string | null;
  is_visible_in_directory: boolean | null;
  created_at: string;
  updated_at: string;
};

export type UseTeamDirectoryContactsOptions = {
  /** When false, do not fetch until user opens directory (reduces initial load). */
  shouldLoad?: boolean;
};

export const useTeamDirectoryContacts = (options?: UseTeamDirectoryContactsOptions) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const shouldLoad = options?.shouldLoad ?? false;

  // Fetch profiles only when directory is visible or a team folder is selected (lazy load).
  const { data: teamContacts = [], isLoading, refetch } = useQuery({
    queryKey: ["team-directory-contacts", profile?.companyId],
    queryFn: async () => {
      if (!profile?.companyId) return [];

      // Get company name
      const { data: companyData } = await supabase
        .from("companies")
        .select("name")
        .eq("id", profile.companyId)
        .single();

      // Get all company members with their profile data
      const { data: companyMembers, error: membersError } = await supabase
        .from("profiles")
        .select("*")
        .eq("company_id", profile.companyId);

      if (membersError) throw membersError;
      if (!companyMembers || companyMembers.length === 0) return [];

      // Map profiles to Contact format for display
      const result: Contact[] = (companyMembers as DbProfile[]).map((member) => ({
        id: member.id,
        name: member.full_name || member.email || "No name",
        email: member.email || "",
        phone: member.phone || "",
        company: companyData?.name || "",
        role: member.role || "",
        description: member.description || "",
        tags: [],
        avatar: member.avatar_url || undefined,
        ownerId: member.id,
        isShared: true,
      }));

      // Sort by name
      return result.sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!profile?.companyId && shouldLoad,
  });

  // Set up real-time subscription for profile updates
  useEffect(() => {
    if (!profile?.companyId) return;

    const channel = supabase
      .channel(`team-directory-contacts-${profile.companyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `company_id=eq.${profile.companyId}`,
        },
        () => {
          // Invalidate the query to refresh the team directory when any profile in the company changes
          queryClient.invalidateQueries({
            queryKey: ["team-directory-contacts", profile.companyId],
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.companyId, queryClient]);

  return {
    teamContacts,
    isLoading,
    refetch,
  };
};

