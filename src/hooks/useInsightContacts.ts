import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Contact } from "@/types/contact";
import { computeHealthScore } from "@/utils/relationshipHealth";

const INSIGHT_COLS =
  "id, name, email, phone, company, role, avatar, tags, is_client, created_at, last_contacted_at, follow_up_date, folder_id";

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
    createdAt: r.created_at,
    lastContactedAt: r.last_contacted_at || undefined,
    followUpDate: r.follow_up_date || undefined,
    folderId: r.folder_id || undefined,
  };
}

export function useAddedContacts(from: Date, to: Date) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["insight-contacts", "added", user?.id, from.toISOString(), to.toISOString()],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("contacts")
        .select(INSIGHT_COLS)
        .eq("owner_id", user.id)
        .is("deleted_at", null)
        .not("tags", "cs", '{"my-profile"}')
        .eq("is_client", true)
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString())
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data as InsightRow[]).map(mapRow);
    },
    enabled: !!user,
    staleTime: 60_000,
  });
}

export function useContactedContacts(from: Date, to: Date) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["insight-contacts", "contacted", user?.id, from.toISOString(), to.toISOString()],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("contacts")
        .select(INSIGHT_COLS)
        .eq("owner_id", user.id)
        .is("deleted_at", null)
        .not("tags", "cs", '{"my-profile"}')
        .eq("is_client", true)
        .gte("last_contacted_at", from.toISOString())
        .lte("last_contacted_at", to.toISOString())
        .order("last_contacted_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data as InsightRow[]).map(mapRow);
    },
    enabled: !!user,
    staleTime: 60_000,
  });
}

export function useStaleContacts(reminderInterval: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["insight-contacts", "stale", user?.id, reminderInterval],
    queryFn: async () => {
      if (!user?.id) return [];
      const threshold = new Date(
        Date.now() - reminderInterval * 86_400_000
      ).toISOString();
      const { data, error } = await supabase
        .from("contacts")
        .select(INSIGHT_COLS)
        .eq("owner_id", user.id)
        .is("deleted_at", null)
        .not("tags", "cs", '{"my-profile"}')
        .eq("is_client", true)
        .or(`last_contacted_at.is.null,last_contacted_at.lte.${threshold}`)
        .order("last_contacted_at", { ascending: true, nullsFirst: true })
        .limit(500);
      if (error) throw error;
      return (data as InsightRow[]).map(mapRow);
    },
    enabled: !!user,
    staleTime: 60_000,
  });
}

export interface ContactedRatioData {
  totalClients: number;
  contactedClients: number;
  uncontactedClients: number;
  ratio: number; // contacted / total
}

export function useContactedRatioData() {
  const { user } = useAuth();
  return useQuery<ContactedRatioData>({
    queryKey: ["insight-contacts", "contacted-ratio", user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");
      const [totalRes, contactedRes] = await Promise.all([
        supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", user.id)
          .is("deleted_at", null)
          .not("tags", "cs", '{"my-profile"}')
          .eq("is_client", true),
        supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", user.id)
          .is("deleted_at", null)
          .not("tags", "cs", '{"my-profile"}')
          .eq("is_client", true)
          .not("last_contacted_at", "is", null),
      ]);
      const totalClients = totalRes.count ?? 0;
      const contactedClients = contactedRes.count ?? 0;
      return {
        totalClients,
        contactedClients,
        uncontactedClients: totalClients - contactedClients,
        ratio: totalClients > 0 ? contactedClients / totalClients : 0,
      };
    },
    enabled: !!user,
    staleTime: 60_000,
  });
}

export interface ClientRatioData {
  totalCount: number;
  clientCount: number;
  ratio: number;
}

export function useClientRatioData(from: Date, to: Date) {
  const { user } = useAuth();
  return useQuery<ClientRatioData>({
    queryKey: ["insight-contacts", "client-ratio", user?.id, from.toISOString(), to.toISOString()],
    queryFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");
      const [allRes, clientRes] = await Promise.all([
        supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", user.id)
          .is("deleted_at", null)
          .not("tags", "cs", '{"my-profile"}')
          .gte("created_at", from.toISOString())
          .lte("created_at", to.toISOString()),
        supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", user.id)
          .is("deleted_at", null)
          .not("tags", "cs", '{"my-profile"}')
          .eq("is_client", true)
          .gte("created_at", from.toISOString())
          .lte("created_at", to.toISOString()),
      ]);
      const totalCount = allRes.count ?? 0;
      const clientCount = clientRes.count ?? 0;
      return {
        totalCount,
        clientCount,
        ratio: totalCount > 0 ? clientCount / totalCount : 0,
      };
    },
    enabled: !!user,
    staleTime: 60_000,
  });
}

export interface MonthlyChartBucket {
  month: string;
  label: string;
  contactsAdded: number;
  clientsAdded: number;
  contacted: number;
  followUpsSet: number;
}

export interface HealthScoreData {
  avgScore: number;
  healthyCount: number;
  atRiskCount: number;
  coldCount: number;
  totalClients: number;
  contacts: Array<Contact & { relationshipHealthScore: number; relationshipHealthStatus: "Healthy" | "At Risk" | "Cold" }>;
}

interface HealthClientRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  avatar: string | null;
  tags: string[] | null;
  is_client: boolean | null;
  created_at: string;
  last_contacted_at: string | null;
  follow_up_date: string | null;
  folder_id: string | null;
  preferred_contact_interval_days: number | null;
  client_weight: number | null;
}

export function useHealthScoreData() {
  const { user } = useAuth();
  return useQuery<HealthScoreData>({
    queryKey: ["insight-contacts", "health-score", "v2", user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");
      const now = new Date();
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 86_400_000).toISOString();

      // Use the RPC to get preferred_contact_interval_days and client_weight
      // (direct table select fails when those columns aren't in the PostgREST schema cache)
      const [{ data, error }, { data: activityData, error: activityError }] = await Promise.all([
        supabase
          .rpc("list_contacts_slim", {
            _user_id: user.id,
            _client_only: true,
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

      // Build a map of contact_id → interaction count in last 90 days
      const interactionCounts: Record<string, number> = {};
      for (const row of activityData ?? []) {
        interactionCounts[row.contact_id] = (interactionCounts[row.contact_id] ?? 0) + 1;
      }

      const contacts = (data as HealthClientRow[]).map((r) => {
        const contact: Contact = {
          id: r.id,
          name: r.name,
          email: r.email || "",
          phone: r.phone || "",
          company: r.company || "",
          role: r.role || "",
          avatar: r.avatar || undefined,
          tags: r.tags || [],
          isClient: true,
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

      const totalClients = contacts.length;
      const avgScore =
        totalClients > 0
          ? Math.round(contacts.reduce((sum, c) => sum + c.relationshipHealthScore, 0) / totalClients)
          : 0;
      const healthyCount = contacts.filter((c) => c.relationshipHealthStatus === "Healthy").length;
      const atRiskCount = contacts.filter((c) => c.relationshipHealthStatus === "At Risk").length;
      const coldCount = contacts.filter((c) => c.relationshipHealthStatus === "Cold").length;

      return { avgScore, healthyCount, atRiskCount, coldCount, totalClients, contacts };
    },
    enabled: !!user,
    staleTime: 60_000,
  });
}

export function useExpandedChartData(months: number = 6) {
  const { user } = useAuth();
  return useQuery<MonthlyChartBucket[]>({
    queryKey: ["insight-expanded-chart", user?.id, months],
    queryFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
      const monthNames = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
      ];

      const [addedRes, activityRes] = await Promise.all([
        supabase
          .from("contacts")
          .select("created_at, is_client")
          .eq("owner_id", user.id)
          .is("deleted_at", null)
          .not("tags", "cs", '{"my-profile"}')
          .eq("is_client", true)
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

      const buckets: Record<string, MonthlyChartBucket> = {};
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        buckets[key] = {
          month: key,
          label: monthNames[d.getMonth()],
          contactsAdded: 0,
          clientsAdded: 0,
          contacted: 0,
          followUpsSet: 0,
        };
      }

      for (const row of addedRes.data ?? []) {
        const key = (row.created_at as string).slice(0, 7);
        if (key in buckets) {
          buckets[key].contactsAdded++;
          if (row.is_client) buckets[key].clientsAdded++;
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
    enabled: !!user,
    staleTime: 120_000,
  });
}
