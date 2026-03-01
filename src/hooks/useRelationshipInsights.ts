import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { computeHealthScore } from "@/utils/relationshipHealth";

interface HealthInputRow {
  id: string;
  last_contacted_at: string | null;
  preferred_contact_interval_days: number | null;
  client_weight: number | null;
}

export interface MonthlyBucket {
  month: string; // "YYYY-MM"
  count: number;
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

  return useQuery<RelationshipMetrics>({
    queryKey: ["relationship-insights", "v2", user?.id, reminderInterval],
    queryFn: async (): Promise<RelationshipMetrics> => {
      if (!user?.id) throw new Error("Not authenticated");

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const staleThreshold = new Date(now.getTime() - reminderInterval * 86_400_000).toISOString();
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 86_400_000).toISOString();

      // Run all queries in parallel
      const [addedRes, contactedRes, staleRes, clientsRes, totalRes, growthRes, clientsContactedRes, healthClientsRes, activityRes] =
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

          // Monthly growth: clients created in last 6 months
          supabase
            .from("contacts")
            .select("created_at")
            .eq("owner_id", user.id)
            .is("deleted_at", null)
            .not("tags", "cs", '{"my-profile"}')
            .eq("is_client", true)
            .gte(
              "created_at",
              new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString()
            )
            .order("created_at", { ascending: true }),

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
            preferredContactIntervalDays: c.preferred_contact_interval_days || undefined,
            clientWeight: c.client_weight || undefined,
          },
          interactionCounts[c.id] ?? 0,
          now
        );
        scoreSum += score;
        if (status === "Healthy") healthyCount++;
        else if (status === "At Risk") atRiskCount++;
        else coldCount++;
      }
      const avgHealthScore = healthClients.length > 0 ? Math.round(scoreSum / healthClients.length) : 0;

      // Build monthly growth buckets from raw rows
      const bucketMap: Record<string, number> = {};
      // Pre-fill last 6 months with 0
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        bucketMap[key] = 0;
      }
      for (const row of growthRes.data ?? []) {
        const key = (row.created_at as string).slice(0, 7);
        if (key in bucketMap) bucketMap[key]++;
      }
      // Convert to cumulative totals for a growth line chart
      const months = Object.keys(bucketMap).sort();
      let running = 0;
      const monthlyGrowth: MonthlyBucket[] = months.map((month) => {
        running += bucketMap[month];
        return { month, count: running };
      });

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
