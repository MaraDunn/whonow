import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Contact } from "@/types/contact";

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
