import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import type { Contact } from "@/types/contact";
import { computeHealthScore } from "@/utils/relationshipHealth";

const INSIGHT_COLS =
  "id, name, email, phone, company, role, avatar, tags, is_client, is_shared, created_at, last_contacted_at, follow_up_date, folder_id";

interface InsightRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  avatar: string | null;
  tags: string[] | null;
  is_client: boolean | null;
  is_shared: boolean | null;
  created_at: string;
  last_contacted_at: string | null;
  follow_up_date: string | null;
  folder_id: string | null;
}

function mapRow(r: InsightRow): Contact {
  return {
    id: r.id,
    name: r.name,
    email: r.email || "",
    phone: r.phone || "",
    company: r.company || "",
    role: r.role || "",
    avatar: r.avatar || undefined,
    tags: r.tags || [],
    isClient: r.is_client || false,
    isShared: r.is_shared || false,
    createdAt: r.created_at,
    lastContactedAt: r.last_contacted_at || undefined,
    followUpDate: r.follow_up_date || undefined,
    folderId: r.folder_id || undefined,
  };
}

export function useOrgAddedContacts(from: Date, to: Date) {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const companyId = profile?.companyId;

  return useQuery({
    queryKey: ["org-insight-contacts", "added", companyId, from.toISOString(), to.toISOString()],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("contacts")
        .select(INSIGHT_COLS)
        .eq("company_id", companyId)
        .eq("is_shared", true)
        .is("deleted_at", null)
        .not("tags", "cs", '{"my-profile"}')
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString())
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data as InsightRow[]).map(mapRow);
    },
    enabled: !!companyId,
    staleTime: 60_000,
  });
}

export function useOrgContactedContacts(from: Date, to: Date) {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const companyId = profile?.companyId;

  return useQuery({
    queryKey: ["org-insight-contacts", "contacted", companyId, from.toISOString(), to.toISOString()],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("contacts")
        .select(INSIGHT_COLS)
        .eq("company_id", companyId)
        .eq("is_shared", true)
        .is("deleted_at", null)
        .not("tags", "cs", '{"my-profile"}')
        .gte("last_contacted_at", from.toISOString())
        .lte("last_contacted_at", to.toISOString())
        .order("last_contacted_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data as InsightRow[]).map(mapRow);
    },
    enabled: !!companyId,
    staleTime: 60_000,
  });
}

export function useOrgStaleContacts(reminderInterval: number) {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const companyId = profile?.companyId;

  return useQuery({
    queryKey: ["org-insight-contacts", "stale", companyId, reminderInterval],
    queryFn: async () => {
      if (!companyId) return [];
      const threshold = new Date(
        Date.now() - reminderInterval * 86_400_000
      ).toISOString();
      const { data, error } = await supabase
        .from("contacts")
        .select(INSIGHT_COLS)
        .eq("company_id", companyId)
        .eq("is_shared", true)
        .is("deleted_at", null)
        .not("tags", "cs", '{"my-profile"}')
        .or(`last_contacted_at.is.null,last_contacted_at.lte.${threshold}`)
        .order("last_contacted_at", { ascending: true, nullsFirst: true })
        .limit(500);
      if (error) throw error;
      return (data as InsightRow[]).map(mapRow);
    },
    enabled: !!companyId,
    staleTime: 60_000,
  });
}

export interface OrgContactedRatioData {
  totalShared: number;
  contactedShared: number;
  uncontactedShared: number;
  ratio: number;
}

export function useOrgContactedRatioData() {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const companyId = profile?.companyId;

  return useQuery<OrgContactedRatioData>({
    queryKey: ["org-insight-contacts", "contacted-ratio", companyId],
    queryFn: async () => {
      if (!companyId) throw new Error("No company");
      const [totalRes, contactedRes] = await Promise.all([
        supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("is_shared", true)
          .is("deleted_at", null)
          .not("tags", "cs", '{"my-profile"}'),
        supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("is_shared", true)
          .is("deleted_at", null)
          .not("tags", "cs", '{"my-profile"}')
          .not("last_contacted_at", "is", null),
      ]);
      const totalShared = totalRes.count ?? 0;
      const contactedShared = contactedRes.count ?? 0;
      return {
        totalShared,
        contactedShared,
        uncontactedShared: totalShared - contactedShared,
        ratio: totalShared > 0 ? contactedShared / totalShared : 0,
      };
    },
    enabled: !!companyId,
    staleTime: 60_000,
  });
}

export interface OrgSharedRatioData {
  totalCount: number;
  sharedCount: number;
  ratio: number;
}

export function useOrgSharedRatioData(from: Date, to: Date) {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const companyId = profile?.companyId;

  return useQuery<OrgSharedRatioData>({
    queryKey: ["org-insight-contacts", "shared-ratio", companyId, from.toISOString(), to.toISOString()],
    queryFn: async () => {
      if (!companyId) throw new Error("No company");
      const [allRes, sharedRes] = await Promise.all([
        supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .is("deleted_at", null)
          .not("tags", "cs", '{"my-profile"}')
          .gte("created_at", from.toISOString())
          .lte("created_at", to.toISOString()),
        supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("is_shared", true)
          .is("deleted_at", null)
          .not("tags", "cs", '{"my-profile"}')
          .gte("created_at", from.toISOString())
          .lte("created_at", to.toISOString()),
      ]);
      const totalCount = allRes.count ?? 0;
      const sharedCount = sharedRes.count ?? 0;
      return {
        totalCount,
        sharedCount,
        ratio: totalCount > 0 ? sharedCount / totalCount : 0,
      };
    },
    enabled: !!companyId,
    staleTime: 60_000,
  });
}

export interface OrgMonthlyChartBucket {
  month: string;
  label: string;
  contactsAdded: number;
  sharedAdded: number;
  contacted: number;
  followUpsSet: number;
}

export interface OrgHealthScoreData {
  avgScore: number;
  healthyCount: number;
  atRiskCount: number;
  coldCount: number;
  totalShared: number;
  contacts: Array<Contact & { relationshipHealthScore: number; relationshipHealthStatus: "Healthy" | "At Risk" | "Cold" }>;
}

interface HealthSharedRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  avatar: string | null;
  tags: string[] | null;
  is_client: boolean | null;
  is_shared: boolean | null;
  created_at: string;
  last_contacted_at: string | null;
  follow_up_date: string | null;
  folder_id: string | null;
  preferred_contact_interval_days: number | null;
  client_weight: number | null;
}

export function useOrgHealthScoreData() {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const companyId = profile?.companyId;

  return useQuery<OrgHealthScoreData>({
    queryKey: ["org-insight-contacts", "health-score", companyId],
    queryFn: async () => {
      if (!user?.id || !companyId) throw new Error("Not authenticated");
      const now = new Date();
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 86_400_000).toISOString();

      const [{ data, error }, { data: activityData, error: activityError }] = await Promise.all([
        supabase
          .rpc("list_contacts_slim", {
            _user_id: user.id,
            _client_only: false,
            _ownership_filter: "shared",
            _limit: 1000,
          }),
        supabase
          .from("activity_log")
          .select("contact_id")
          .eq("activity_type", "contacted")
          .gte("created_at", ninetyDaysAgo),
      ]);
      if (error) throw error;
      if (activityError) throw activityError;

      const interactionCounts: Record<string, number> = {};
      for (const row of activityData ?? []) {
        interactionCounts[row.contact_id] = (interactionCounts[row.contact_id] ?? 0) + 1;
      }

      const contacts = (data as HealthSharedRow[]).map((r) => {
        const contact: Contact = {
          id: r.id,
          name: r.name,
          email: r.email || "",
          phone: r.phone || "",
          company: r.company || "",
          role: r.role || "",
          avatar: r.avatar || undefined,
          tags: r.tags || [],
          isClient: r.is_client || false,
          isShared: true,
          createdAt: r.created_at,
          lastContactedAt: r.last_contacted_at || undefined,
          followUpDate: r.follow_up_date || undefined,
          folderId: r.folder_id || undefined,
          preferredContactIntervalDays: r.preferred_contact_interval_days ?? undefined,
          clientWeight: r.client_weight ?? undefined,
        };
        const { score, status } = computeHealthScore(contact, interactionCounts[r.id] ?? 0, now);
        return { ...contact, relationshipHealthScore: score, relationshipHealthStatus: status } as Contact & { relationshipHealthScore: number; relationshipHealthStatus: "Healthy" | "At Risk" | "Cold" };
      });

      const totalShared = contacts.length;
      const avgScore =
        totalShared > 0
          ? Math.round(contacts.reduce((sum, c) => sum + c.relationshipHealthScore, 0) / totalShared)
          : 0;
      const healthyCount = contacts.filter((c) => c.relationshipHealthStatus === "Healthy").length;
      const atRiskCount = contacts.filter((c) => c.relationshipHealthStatus === "At Risk").length;
      const coldCount = contacts.filter((c) => c.relationshipHealthStatus === "Cold").length;

      return { avgScore, healthyCount, atRiskCount, coldCount, totalShared, contacts };
    },
    enabled: !!user && !!companyId,
    staleTime: 60_000,
  });
}

export function useOrgExpandedChartData(months: number = 6) {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const companyId = profile?.companyId;

  return useQuery<OrgMonthlyChartBucket[]>({
    queryKey: ["org-insight-expanded-chart", companyId, months],
    queryFn: async () => {
      if (!companyId) throw new Error("No company");
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
      const monthNames = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
      ];

      const [addedRes, activityRes] = await Promise.all([
        supabase
          .from("contacts")
          .select("created_at, is_shared")
          .eq("company_id", companyId)
          .eq("is_shared", true)
          .is("deleted_at", null)
          .not("tags", "cs", '{"my-profile"}')
          .gte("created_at", start.toISOString())
          .order("created_at", { ascending: true }),
        supabase
          .from("activity_log")
          .select("activity_type, created_at")
          .gte("created_at", start.toISOString())
          .in("activity_type", ["contacted", "follow_up_set"])
          .order("created_at", { ascending: true }),
      ]);

      if (addedRes.error) throw addedRes.error;
      if (activityRes.error) throw activityRes.error;

      const buckets: Record<string, OrgMonthlyChartBucket> = {};
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        buckets[key] = {
          month: key,
          label: monthNames[d.getMonth()],
          contactsAdded: 0,
          sharedAdded: 0,
          contacted: 0,
          followUpsSet: 0,
        };
      }

      for (const row of addedRes.data ?? []) {
        const key = (row.created_at as string).slice(0, 7);
        if (key in buckets) {
          buckets[key].contactsAdded++;
          if (row.is_shared) buckets[key].sharedAdded++;
        }
      }

      for (const row of activityRes.data ?? []) {
        const key = (row.created_at as string).slice(0, 7);
        if (key in buckets) {
          if (row.activity_type === "contacted") buckets[key].contacted++;
          if (row.activity_type === "follow_up_set") buckets[key].followUpsSet++;
        }
      }

      return Object.values(buckets).sort((a, b) => a.month.localeCompare(b.month));
    },
    enabled: !!companyId,
    staleTime: 120_000,
  });
}
