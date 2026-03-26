import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface MessageTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

type DbTemplate = {
  id: string;
  owner_id: string;
  name: string;
  subject: string | null;
  body: string;
  created_at: string;
  updated_at: string;
};

function mapDb(row: DbTemplate): MessageTemplate {
  return {
    id: row.id,
    name: row.name,
    subject: row.subject ?? "",
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const QUERY_KEY = (userId: string | undefined) => [
  "message-templates",
  userId,
];

export function useMessageTemplates() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // ── Fetch ──────────────────────────────────────────────────────
  const { data: templates = [] } = useQuery<MessageTemplate[]>({
    queryKey: QUERY_KEY(user?.id),
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("message_templates")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as DbTemplate[]).map(mapDb);
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  // ── Add ────────────────────────────────────────────────────────
  const addMutation = useMutation({
    mutationFn: async ({
      name,
      subject,
      body,
    }: {
      name: string;
      subject: string;
      body: string;
    }): Promise<MessageTemplate> => {
      if (!user?.id) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("message_templates")
        .insert({ owner_id: user.id, name: name.trim(), subject, body })
        .select()
        .single();
      if (error) throw error;
      return mapDb(data as DbTemplate);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY(user?.id) });
    },
    onError: (error: Error) => {
      toast.error("Failed to save template: " + error.message);
    },
  });

  const addTemplate = useCallback(
    (name: string, subject: string, body: string) => {
      addMutation.mutate({ name, subject, body });
    },
    [addMutation]
  );

  // ── Update ─────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      changes,
    }: {
      id: string;
      changes: Partial<Pick<MessageTemplate, "name" | "subject" | "body">>;
    }) => {
      const { error } = await supabase
        .from("message_templates")
        .update({
          ...(changes.name !== undefined && { name: changes.name.trim() }),
          ...(changes.subject !== undefined && { subject: changes.subject }),
          ...(changes.body !== undefined && { body: changes.body }),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY(user?.id) });
    },
    onError: (error: Error) => {
      toast.error("Failed to update template: " + error.message);
    },
  });

  const updateTemplate = useCallback(
    (
      id: string,
      changes: Partial<Pick<MessageTemplate, "name" | "subject" | "body">>
    ) => {
      updateMutation.mutate({ id, changes });
    },
    [updateMutation]
  );

  // ── Delete ─────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("message_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY(user?.id) });
    },
    onError: (error: Error) => {
      toast.error("Failed to delete template: " + error.message);
    },
  });

  const deleteTemplate = useCallback(
    (id: string) => {
      deleteMutation.mutate(id);
    },
    [deleteMutation]
  );

  return { templates, addTemplate, updateTemplate, deleteTemplate };
}
