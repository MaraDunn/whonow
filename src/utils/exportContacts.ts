import type { Contact } from "@/types/contact";
import type { SupabaseClient } from "@supabase/supabase-js";

/** CSV column headers for contact export (backup-friendly). */
const CSV_HEADERS = [
  "id",
  "name",
  "email",
  "phone",
  "company",
  "role",
  "tags",
  "description",
  "address",
  "city",
  "state",
  "zipCode",
  "country",
  "lastContactedAt",
  "isClient",
  "createdAt",
];

function escapeCsvCell(value: string): string {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes("\n") || s.includes("\r") || s.includes('"')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function contactToCsvRow(c: Contact): string[] {
  return [
    escapeCsvCell(c.id ?? ""),
    escapeCsvCell(c.name ?? ""),
    escapeCsvCell(c.email ?? ""),
    escapeCsvCell(c.phone ?? ""),
    escapeCsvCell(c.company ?? ""),
    escapeCsvCell(c.role ?? ""),
    escapeCsvCell(Array.isArray(c.tags) ? c.tags.join(";") : ""),
    escapeCsvCell(c.description ?? ""),
    escapeCsvCell(c.address ?? ""),
    escapeCsvCell(c.city ?? ""),
    escapeCsvCell(c.state ?? ""),
    escapeCsvCell(c.zipCode ?? ""),
    escapeCsvCell(c.country ?? ""),
    escapeCsvCell(c.lastContactedAt ?? ""),
    escapeCsvCell(c.isClient === true ? "true" : "false"),
    escapeCsvCell(c.createdAt ?? ""),
  ];
}

/**
 * Convert an array of contacts to a CSV string (with BOM for Excel).
 */
export function contactsToCsv(contacts: Contact[]): string {
  const BOM = "\uFEFF";
  const headerRow = CSV_HEADERS.join(",");
  const dataRows = contacts.map((c) => contactToCsvRow(c).join(","));
  return BOM + headerRow + "\n" + dataRows.join("\n");
}

/** Row shape returned by list_contacts_slim (slim = subset of columns). */
type SlimContactRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  avatar: string | null;
  folder_id: string | null;
  tags: string[] | null;
  created_at: string;
  is_shared: boolean | null;
  owner_id: string | null;
  last_contacted_at: string | null;
  is_client: boolean | null;
  company_id: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
};

function mapSlimToContact(row: SlimContactRow): Contact {
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? "",
    phone: row.phone ?? "",
    company: row.company ?? "",
    role: row.role ?? "",
    tags: row.tags ?? [],
    avatar: row.avatar ?? undefined,
    folderId: row.folder_id ?? undefined,
    isShared: row.is_shared ?? false,
    ownerId: row.owner_id ?? undefined,
    lastContactedAt: row.last_contacted_at ?? undefined,
    isClient: row.is_client ?? false,
    companyId: row.company_id ?? undefined,
    createdAt: row.created_at,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    address: row.address ?? undefined,
  };
}

/**
 * Fetch all active contacts for the current user via list_contacts_slim (paginated).
 * Excludes "my-profile" tag. Use for backup export.
 */
export async function fetchAllContactsForExport(
  supabase: SupabaseClient,
  userId: string
): Promise<Contact[]> {
  const all: Contact[] = [];
  const pageSize = 500;
  let cursor: { created_at: string; id: string } | null = null;

  while (true) {
    const { data, error } = await supabase.rpc("list_contacts_slim", {
      _user_id: userId,
      _cursor_created_at: cursor?.created_at ?? null,
      _cursor_id: cursor?.id ?? null,
      _limit: pageSize,
      _folder_id: null,
      _client_only: false,
      _ownership_filter: "all",
    });

    if (error) throw error;

    const rows = (data ?? []) as SlimContactRow[];
    for (const row of rows) {
      const contact = mapSlimToContact(row);
      if (!contact.tags?.includes("my-profile")) {
        all.push(contact);
      }
    }

    if (rows.length < pageSize) break;
    const last = rows[rows.length - 1];
    if (!last?.created_at || !last?.id) break;
    cursor = { created_at: last.created_at, id: last.id };
  }

  return all;
}

/**
 * Trigger a file download in the browser.
 */
export function downloadCsvFile(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
