import { Contact } from "@/types/contact";

/** CSV column order; same for single-contact and mass export. */
const CSV_HEADERS = [
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
] as const;

/** Escape a cell per RFC 4180: wrap in quotes if contains comma, newline, or "; double any " inside. */
function escapeCsvCell(value: string): string {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes("\n") || s.includes("\r") || s.includes('"')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/** Map one contact to an array of cell values in CSV column order. */
export function contactToCsvRow(contact: Contact): string[] {
  return [
    escapeCsvCell(contact.name ?? ""),
    escapeCsvCell(contact.email ?? ""),
    escapeCsvCell(contact.phone ?? ""),
    escapeCsvCell(contact.company ?? ""),
    escapeCsvCell(contact.role ?? ""),
    escapeCsvCell(Array.isArray(contact.tags) ? contact.tags.join(";") : ""),
    escapeCsvCell(contact.description ?? ""),
    escapeCsvCell(contact.address ?? ""),
    escapeCsvCell(contact.city ?? ""),
    escapeCsvCell(contact.state ?? ""),
    escapeCsvCell(contact.zipCode ?? ""),
    escapeCsvCell(contact.country ?? ""),
    escapeCsvCell(contact.lastContactedAt ?? ""),
    escapeCsvCell(contact.isClient === true ? "true" : "false"),
  ];
}

/** Build full CSV string: BOM + header row + one row per contact. */
export function contactsToCsv(contacts: Contact[]): string {
  const BOM = "\uFEFF";
  const headerRow = CSV_HEADERS.join(",");
  const dataRows = contacts.map((c) => contactToCsvRow(c).join(","));
  return BOM + headerRow + "\n" + dataRows.join("\n");
}

/** Trigger browser download of a CSV string as a file. */
export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Sanitize a contact name for use as a filename (strip/replace invalid chars). */
export function sanitizeFilenameForContact(name: string): string {
  const sanitized = (name ?? "").replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").trim() || "contact";
  return sanitized.slice(0, 100);
}
