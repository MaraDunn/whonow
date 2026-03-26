import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useReminderSettings } from "@/hooks/useReminderSettings";
import { computeHealthScore } from "@/utils/relationshipHealth";

interface HealthInputRow {
  id: string;
  created_at?: string | null;
  last_contacted_at: string | null;
  follow_up_date: string | null;
  reminder_interval_override: number | null;
  preferred_contact_interval_days: number | null;
  client_weight: number | null;
}

export interface MonthlyBucket {
  month: string; // "YYYY-MM"
  count: number; // average health score (0-100) for that month
}

export interface TopContactedEntry {
  id: string;
  name: string;
  avatar: string | null;
  count: number;
}

export interface RelationshipMetrics {
  addedThisMonth: number;
  contactedThisMonth: number;
  staleCount: number;
  clientRatio: number; // 0–1
  totalActive: number;
  contactedCount: number;
  uncontactedCount: number;
  monthlyGrowth: MonthlyBucket[];
  topContacted: TopContactedEntry[];
  avgHealthScore: number;
  healthyCount: number;
  atRiskCount: number;
  coldCount: number;
}

export const useRelationshipInsights = (reminderInterval: number = 30) => {
  const { user } = useAuth();
  const { contactInterval } = useReminderSettings();

  return useQuery<RelationshipMetrics>({
    queryKey: ["relationship-insights", "v3", user?.id, reminderInterval, contactInterval],
    queryFn: async (): Promise<RelationshipMetrics> => {
      if (!user?.id) throw new Error("Not authenticated");

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const staleThreshold = new Date(now.getTime() - reminderInterval * 86_400_000).toISOString();
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 86_400_000).toISOString();

      // Run all queries in parallel
      const [addedRes, contactedRes, staleRes, clientsRes, totalRes, clientsContactedRes, healthClientsRes, activityRes] =
        await Promise.all([
          // Clients added this month
          supabase
            .from("contacts")
            .select("id", { count: "exact", head: true })
            .eq("owner_id", user.id)
            .is("deleted_at", null)
            .not("tags", "cs", '{"my-profile"}')
            .eq("is_client", true)
            .gte("created_at", monthStart),

          // Clients contacted this month
          supabase
            .from("contacts")
            .select("id", { count: "exact", head: true })
            .eq("owner_id", user.id)
            .is("deleted_at", null)
            .not("tags", "cs", '{"my-profile"}')
            .eq("is_client", true)
            .gte("last_contacted_at", monthStart),

          // Stale clients (not contacted within reminder interval)
          supabase
            .from("contacts")
            .select("id", { count: "exact", head: true })
            .eq("owner_id", user.id)
            .is("deleted_at", null)
            .not("tags", "cs", '{"my-profile"}')
            .eq("is_client", true)
            .or(`last_contacted_at.is.null,last_contacted_at.lte.${staleThreshold}`),

          // Total client count
          supabase
            .from("contacts")
            .select("id", { count: "exact", head: true })
            .eq("owner_id", user.id)
            .is("deleted_at", null)
            .not("tags", "cs", '{"my-profile"}')
            .eq("is_client", true),

          // Total active contacts (all, for ratio denominator)
          supabase
            .from("contacts")
            .select("id", { count: "exact", head: true })
            .eq("owner_id", user.id)
            .is("deleted_at", null)
            .not("tags", "cs", '{"my-profile"}'),

          // Clients with at least one contact (last_contacted_at is set)
          supabase
            .from("contacts")
            .select("id", { count: "exact", head: true })
            .eq("owner_id", user.id)
            .is("deleted_at", null)
            .not("tags", "cs", '{"my-profile"}')
            .eq("is_client", true)
            .not("last_contacted_at", "is", null),

          // Health score inputs via RPC to avoid PostgREST schema cache issues
          supabase
            .rpc("list_contacts_slim", {
              _user_id: user.id,
              _client_only: true,
              _limit: 1000,
            }),

          // Activity counts per contact in last 90 days for frequency scoring
          supabase
            .from("activity_log")
            .select("contact_id")
            .eq("activity_type", "contacted")
            .gte("created_at", ninetyDaysAgo),
        ]);

      const totalActive = totalRes.count ?? 0;
      const clientsTotal = clientsRes.count ?? 0;
      const contactedCount = clientsContactedRes.count ?? 0;
      const uncontactedCount = clientsTotal - contactedCount;

      // Build a map of contact_id → interaction count in last 90 days
      const interactionCounts: Record<string, number> = {};
      for (const row of activityRes.data ?? []) {
        interactionCounts[row.contact_id] = (interactionCounts[row.contact_id] ?? 0) + 1;
      }
      // Compute aggregate health score from client data
      const healthClients = (healthClientsRes.data ?? []) as HealthInputRow[];
      let healthyCount = 0;
      let atRiskCount = 0;
      let coldCount = 0;
      let scoreSum = 0;
      for (const c of healthClients) {
        const { score, status } = computeHealthScore(
          {
            lastContactedAt: c.last_contacted_at || undefined,
            followUpDate: c.follow_up_date || undefined,
            reminderIntervalOverride: c.reminder_interval_override || undefined,
            preferredContactIntervalDays: c.preferred_contact_interval_days || undefined,
            clientWeight: c.client_weight || undefined,
          },
          interactionCounts[c.id] ?? 0,
          now,
          { defaultIntervalDays: contactInterval }
        );
        scoreSum += score;
        if (status === "Healthy") healthyCount++;
        else if (status === "At Risk") atRiskCount++;
        else coldCount++;
      }
      const avgHealthScore = healthClients.length > 0 ? Math.round(scoreSum / healthClients.length) : 0;

      // Build monthly average health score buckets for last 6 months.
      const monthlyGrowth: MonthlyBucket[] = [];
      for (let i = 5; i >= 0; i--) {
        const monthStartDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEndDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
        const monthKey = `${monthStartDate.getFullYear()}-${String(monthStartDate.getMonth() + 1).padStart(2, "0")}`;
        let monthScoreSum = 0;
        let monthCount = 0;

        for (const c of healthClients) {
          const hasExistedByMonthEnd =
            !c.created_at || monthEndDate >= new Date(c.created_at);
          if (!hasExistedByMonthEnd) continue;

          const { score } = computeHealthScore(
            {
              lastContactedAt: c.last_contacted_at || undefined,
              followUpDate: c.follow_up_date || undefined,
              reminderIntervalOverride: c.reminder_interval_override || undefined,
              preferredContactIntervalDays: c.preferred_contact_interval_days || undefined,
              clientWeight: c.client_weight || undefined,
            },
            // Historical monthly trend uses recency-based health.
            0,
            monthEndDate,
            { defaultIntervalDays: contactInterval }
          );
          monthScoreSum += score;
          monthCount++;
        }

        monthlyGrowth.push({
          month: monthKey,
          count: monthCount > 0 ? Math.round(monthScoreSum / monthCount) : 0,
        });
      }

      return {
        addedThisMonth: addedRes.count ?? 0,
        contactedThisMonth: contactedRes.count ?? 0,
        staleCount: staleRes.count ?? 0,
        clientRatio: totalActive > 0 ? clientsTotal / totalActive : 0,
        totalActive,
        contactedCount,
        uncontactedCount,
        monthlyGrowth,
        topContacted: [],
        avgHealthScore,
        healthyCount,
        atRiskCount,
        coldCount,
      };
    },
    enabled: !!user,
    staleTime: 60_000,
  });
};
