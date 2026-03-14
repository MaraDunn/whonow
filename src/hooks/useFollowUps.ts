import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useInsertActivity } from "@/hooks/useActivityLog";
import type { Contact } from "@/types/contact";

/** Returns contacts where follow_up_date is today or in the past. */
export function getNeedsFollowUp(contacts: Contact[]): Contact[] {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  return contacts.filter(
    (c) => c.followUpDate && c.followUpDate <= today
  );
}

/** Returns true if follow_up_date is strictly before today (overdue). */
export function isOverdue(followUpDate: string | undefined): boolean {
  if (!followUpDate) return false;
  const today = new Date().toISOString().split("T")[0];
  return followUpDate < today;
}

export type SetFollowUpDateOptions = {
  onAfterSet?: (contactId: string, date: string, contactName: string) => void;
};

export const useSetFollowUpDate = (options?: SetFollowUpDateOptions) => {
  const queryClient = useQueryClient();
  const insertActivity = useInsertActivity();

  return useMutation({
    mutationFn: async ({
      id,
      date,
    }: {
      id: string;
      date: string | null;
      contactName?: string;
    }) => {
      const { error } = await supabase
        .from("contacts")
        .update({ follow_up_date: date })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      if (variables.date) {
        insertActivity({
          contactId: variables.id,
          activityType: "follow_up_set",
          metadata: { date: variables.date },
        });
        options?.onAfterSet?.(variables.id, variables.date, variables.contactName ?? "Contact");
      }
    },
    onError: (error) => {
      toast.error("Failed to set follow-up date: " + error.message);
    },
  });
};

export type SnoozeFollowUpOptions = {
  onAfterSnooze?: (contactId: string, newDate: string, contactName: string) => void;
};

export const useSnoozeFollowUp = (options?: SnoozeFollowUpOptions) => {
  const queryClient = useQueryClient();
  const insertActivity = useInsertActivity();

  return useMutation({
    mutationFn: async ({ id, days }: { id: string; days: number; contactName?: string }) => {
      // Calculate new date: max(today, current follow_up_date) + days
      const base = new Date();
      base.setDate(base.getDate() + days);
      const newDate = base.toISOString().split("T")[0];

      const { error } = await supabase
        .from("contacts")
        .update({ follow_up_date: newDate })
        .eq("id", id);
      if (error) throw error;
      return newDate;
    },
    onSuccess: (newDate, variables) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      insertActivity({
        contactId: variables.id,
        activityType: "follow_up_set",
        metadata: { date: newDate, snoozed: true },
      });
      toast.success(`Follow-up snoozed to ${newDate}`);
      options?.onAfterSnooze?.(variables.id, newDate, variables.contactName ?? "Contact");
    },
    onError: (error) => {
      toast.error("Failed to snooze follow-up: " + error.message);
    },
  });
};

export type BulkSetFollowUpDateOptions = {
  onAfterSet?: (contactId: string, date: string, contactName: string) => void;
};

export const useBulkSetFollowUpDate = (options?: BulkSetFollowUpDateOptions) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      ids,
      date,
    }: {
      ids: string[];
      date: string;
      contactNames?: Record<string, string>;
    }) => {
      const batchSize = 50;
      let successCount = 0;
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from("contacts")
          .update({ follow_up_date: date })
          .in("id", batch)
          .select("id");
        if (error) throw error;
        successCount += data?.length ?? 0;
      }
      return { updated: successCount, total: ids.length };
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success(
        `Follow-up date set for ${result.updated} contact${result.updated !== 1 ? "s" : ""}`
      );
      if (options?.onAfterSet && variables.date) {
        variables.ids.forEach((id) => {
          options.onAfterSet!(id, variables.date, variables.contactNames?.[id] ?? "Contact");
        });
      }
    },
    onError: (error) => {
      toast.error("Failed to set follow-up dates: " + error.message);
    },
  });
};
