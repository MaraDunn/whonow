import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type ActivityType =
  | "client_toggled"
  | "contacted"
  | "follow_up_set"
  | "note_added"
  | "internal_toggled";

export interface ActivityLogEntry {
  id: string;
  contactId: string;
  activityType: ActivityType;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

type DbActivityLog = {
  id: string;
  contact_id: string;
  activity_type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const mapDbToEntry = (row: DbActivityLog): ActivityLogEntry => ({
  id: row.id,
  contactId: row.contact_id,
  activityType: row.activity_type as ActivityType,
  metadata: row.metadata,
  createdAt: row.created_at,
});

export const useActivityLog = (contactId: string | null | undefined) => {
  const { user } = useAuth();

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["activity-log", contactId],
    queryFn: async () => {
      if (!contactId) return [];
      const { data, error } = await supabase
        .from("activity_log")
        .select("*")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data as DbActivityLog[]).map(mapDbToEntry);
    },
    enabled: !!user && !!contactId,
    staleTime: 30_000,
  });

  return { entries, isLoading };
};

export const useInsertActivity = () => {
  const queryClient = useQueryClient();

  return ({
    contactId,
    activityType,
    metadata,
  }: {
    contactId: string;
    activityType: ActivityType;
    metadata?: Record<string, unknown>;
  }) => {
    supabase
      .from("activity_log")
      .insert({
        contact_id: contactId,
        activity_type: activityType,
        metadata: metadata ?? null,
      })
      .then(({ error }) => {
        if (!error) {
          queryClient.invalidateQueries({
            queryKey: ["activity-log", contactId],
          });
        }
        // Silently ignore errors — activity logging must never break primary actions
      });
  };
};
