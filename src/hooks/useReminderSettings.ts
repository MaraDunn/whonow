import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import type { Contact } from "@/types/contact";

const DEFAULT_INTERVAL = 30;
const DEFAULT_CONTACT_INTERVAL = 30;

export const useReminderSettings = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["reminder-settings", user?.id],
    queryFn: async () => {
      if (!user?.id) return { reminderInterval: DEFAULT_INTERVAL, contactInterval: DEFAULT_CONTACT_INTERVAL, addFollowUpsToCalendar: true };
      const { data, error } = await supabase
        .from("profiles")
        .select("default_reminder_interval, default_contact_interval, add_follow_ups_to_calendar")
        .eq("id", user.id)
        .single();
      if (error) return { reminderInterval: DEFAULT_INTERVAL, contactInterval: DEFAULT_CONTACT_INTERVAL, addFollowUpsToCalendar: true };
      return {
        reminderInterval: (data?.default_reminder_interval as number | null) ?? DEFAULT_INTERVAL,
        contactInterval: (data?.default_contact_interval as number | null) ?? DEFAULT_CONTACT_INTERVAL,
        addFollowUpsToCalendar: (data?.add_follow_ups_to_calendar as boolean | null) ?? true,
      };
    },
    enabled: !!user,
    staleTime: 300_000,
  });

  const reminderInterval = settings?.reminderInterval ?? DEFAULT_INTERVAL;
  const contactInterval = settings?.contactInterval ?? DEFAULT_CONTACT_INTERVAL;
  const addFollowUpsToCalendar = settings?.addFollowUpsToCalendar ?? true;

  const updateReminderInterval = useMutation({
    mutationFn: async (interval: number) => {
      if (!user?.id) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("profiles")
        .update({ default_reminder_interval: interval })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: (_, interval) => {
      queryClient.setQueryData(["reminder-settings", user?.id], (old: typeof settings) => ({
        ...old,
        reminderInterval: interval,
      }));
      queryClient.invalidateQueries({ queryKey: ["relationship-insights"] });
    },
    onError: (error) => {
      toast.error("Failed to update reminder interval: " + error.message);
    },
  });

  const updateContactInterval = useMutation({
    mutationFn: async (interval: number) => {
      if (!user?.id) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("profiles")
        .update({ default_contact_interval: interval })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: (_, interval) => {
      queryClient.setQueryData(["reminder-settings", user?.id], (old: typeof settings) => ({
        ...old,
        contactInterval: interval,
      }));
    },
    onError: (error) => {
      toast.error("Failed to update contact interval: " + error.message);
    },
  });

  const updateAddFollowUpsToCalendar = useMutation({
    mutationFn: async (value: boolean) => {
      if (!user?.id) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("profiles")
        .update({ add_follow_ups_to_calendar: value })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: (_, value) => {
      queryClient.setQueryData(["reminder-settings", user?.id], (old: typeof settings) => ({
        ...old,
        addFollowUpsToCalendar: value,
      }));
    },
    onError: (error) => {
      toast.error("Failed to update calendar preference: " + error.message);
    },
  });

  return {
    reminderInterval,
    contactInterval,
    addFollowUpsToCalendar,
    isLoading,
    updateInterval: updateReminderInterval.mutate,
    updateContactInterval: updateContactInterval.mutate,
    updateAddFollowUpsToCalendar: updateAddFollowUpsToCalendar.mutate,
  };
};

/** Pure helper — returns contacts not contacted within the given interval (days). */
export function getSuggestedFollowUps(
  contacts: Contact[],
  intervalDays: number
): Array<Contact & { daysSince: number }> {
  const now = Date.now();

  return contacts
    .filter((c) => {
      const effectiveInterval =
        (c.reminderIntervalOverride ?? intervalDays) * 86_400_000;
      if (c.lastContactedAt) {
        return now - new Date(c.lastContactedAt).getTime() > effectiveInterval;
      }
      // Never contacted — treat as stale
      return true;
    })
    .map((c) => ({
      ...c,
      daysSince: c.lastContactedAt
        ? Math.floor((now - new Date(c.lastContactedAt).getTime()) / 86_400_000)
        : Infinity,
    }))
    .sort((a, b) => b.daysSince - a.daysSince);
}
