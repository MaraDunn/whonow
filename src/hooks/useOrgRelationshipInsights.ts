import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
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

export interface OrgMonthlyBucket {
  month: string; // "YYYY-MM"
  count: number; // average health score (0-100) for that month
}

export interface OrgRelationshipMetrics {
  addedThisMonth: number;
  contactedThisMonth: number;
  staleCount: number;
  sharedRatio: number; // 0–1: shared / total in company
  totalActive: number;
  contactedCount: number;
  uncontactedCount: number;
  monthlyGrowth: OrgMonthlyBucket[];
  topContacted: [];
  avgHealthScore: number;
  healthyCount: number;
  atRiskCount: number;
  coldCount: number;
}

export const useOrgRelationshipInsights = (reminderInterval: number = 30) => {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const { contactInterval } = useReminderSettings();
  const companyId = profile?.companyId;

  return useQuery<OrgRelationshipMetrics>({
    queryKey: ["org-relationship-insights", "v2", companyId, reminderInterval, contactInterval],
    queryFn: async (): Promise<OrgRelationshipMetrics> => {
      if (!user?.id || !companyId) throw new Error("Not authenticated or no company");

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const staleThreshold = new Date(now.getTime() - reminderInterval * 86_400_000).toISOString();
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 86_400_000).toISOString();

      const [addedRes, contactedRes, staleRes, sharedRes, totalRes, sharedContactedRes, healthSharedRes, activityRes] =
        await Promise.all([
          // Shared contacts added this month
          supabase
            .from("contacts")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId)
            .eq("is_shared", true)
            .is("deleted_at", null)
            .not("tags", "cs", '{"my-profile"}')
            .gte("created_at", monthStart),

          // Shared contacts contacted this month
          supabase
            .from("contacts")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId)
            .eq("is_shared", true)
            .is("deleted_at", null)
            .not("tags", "cs", '{"my-profile"}')
            .gte("last_contacted_at", monthStart),

          // Stale shared contacts (not contacted within reminder interval)
          supabase
            .from("contacts")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId)
            .eq("is_shared", true)
            .is("deleted_at", null)
            .not("tags", "cs", '{"my-profile"}')
            .or(`last_contacted_at.is.null,last_contacted_at.lte.${staleThreshold}`),

          // Total shared contact count
          supabase
            .from("contacts")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId)
            .eq("is_shared", true)
            .is("deleted_at", null)
            .not("tags", "cs", '{"my-profile"}'),

          // Total active contacts in company (for ratio denominator)
          supabase
            .from("contacts")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId)
            .is("deleted_at", null)
            .not("tags", "cs", '{"my-profile"}'),

          // Shared contacts with at least one contact (last_contacted_at is set)
          supabase
            .from("contacts")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId)
            .eq("is_shared", true)
            .is("deleted_at", null)
            .not("tags", "cs", '{"my-profile"}')
            .not("last_contacted_at", "is", null),

          // Health score inputs via RPC (shared contacts only)
          supabase
            .rpc("list_contacts_slim", {
              _user_id: user.id,
              _client_only: false,
              _ownership_filter: "shared",
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
      const sharedTotal = sharedRes.count ?? 0;
      const contactedCount = sharedContactedRes.count ?? 0;
      const uncontactedCount = sharedTotal - contactedCount;

      const interactionCounts: Record<string, number> = {};
      for (const row of activityRes.data ?? []) {
        interactionCounts[row.contact_id] = (interactionCounts[row.contact_id] ?? 0) + 1;
      }

      const healthShared = (healthSharedRes.data ?? []) as HealthInputRow[];
      let healthyCount = 0;
      let atRiskCount = 0;
      let coldCount = 0;
      let scoreSum = 0;
      for (const c of healthShared) {
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
      const avgHealthScore = healthShared.length > 0 ? Math.round(scoreSum / healthShared.length) : 0;

      const monthlyGrowth: OrgMonthlyBucket[] = [];
      for (let i = 5; i >= 0; i--) {
        const monthStartDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEndDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
        const monthKey = `${monthStartDate.getFullYear()}-${String(monthStartDate.getMonth() + 1).padStart(2, "0")}`;
        let monthScoreSum = 0;
        let monthCount = 0;

        for (const c of healthShared) {
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
        sharedRatio: totalActive > 0 ? sharedTotal / totalActive : 0,
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
    enabled: !!user && !!companyId,
    staleTime: 60_000,
  });
};
