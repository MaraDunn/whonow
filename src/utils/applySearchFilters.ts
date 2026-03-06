/**
 * Apply saved SearchQuery filters to a contact list (client-side).
 * Used by smart folders to filter current and future contacts without a server round-trip.
 * Logic mirrors smart_search_contacts RPC (structured filters only; no FTS/semantic).
 */

import type { Contact } from "@/types/contact";
import type { SearchQueryFilters } from "@/types/searchQuery";

function inDateRange(
  value: string | undefined,
  from: string | undefined,
  to: string | undefined
): boolean {
  if (!from && !to) return true;
  if (!value) return false;
  const t = new Date(value).getTime();
  const fromT = from ? new Date(from).getTime() : -Infinity;
  const toT = to ? new Date(to).getTime() : Infinity;
  return t >= fromT && t <= toT;
}

/**
 * Returns true if the contact matches all non-empty filter criteria.
 */
export function contactMatchesFilters(
  contact: Contact,
  filters: SearchQueryFilters | null | undefined
): boolean {
  if (!filters || typeof filters !== "object") return true;

  if (filters.name?.trim()) {
    const name = (contact.name ?? "").toLowerCase();
    const term = filters.name.trim().toLowerCase();
    if (!name.includes(term)) return false;
  }

  if (filters.company?.trim()) {
    const company = (contact.company ?? "").toLowerCase();
    const term = filters.company.trim().toLowerCase();
    if (!company.includes(term)) return false;
  }

  if (filters.job_title?.trim()) {
    const role = (contact.role ?? "").toLowerCase();
    const company = (contact.company ?? "").toLowerCase();
    const tags = contact.tags ?? [];
    const term = filters.job_title.trim().toLowerCase();
    const termSingular = term.endsWith("s") ? term.slice(0, -1) : term;
    const matchesTerm = (s: string) => s.includes(term) || (termSingular.length >= 3 && s.includes(termSingular));
    const inRole = matchesTerm(role);
    const inCompany = matchesTerm(company);
    const inTags = tags.some(
      (t) => (t && (t.toLowerCase().includes(term) || t.toLowerCase() === term || (termSingular.length >= 3 && t.toLowerCase().includes(termSingular))))
    );
    if (!inRole && !inCompany && !inTags) return false;
  }

  if (filters.tags?.length) {
    const contactTags = new Set((contact.tags ?? []).map((t) => t.toLowerCase()));
    const hasAny = filters.tags.some(
      (t) => contactTags.has(t.toLowerCase()) || [...contactTags].some((ct) => ct.includes(t.toLowerCase()))
    );
    if (!hasAny) return false;
  }

  if (filters.date_range?.from || filters.date_range?.to) {
    if (!inDateRange(contact.createdAt, filters.date_range.from, filters.date_range.to)) return false;
  }

  if (filters.interaction_date_range?.from || filters.interaction_date_range?.to) {
    if (
      !inDateRange(
        contact.lastContactedAt,
        filters.interaction_date_range.from,
        filters.interaction_date_range.to
      )
    )
      return false;
  }

  if (filters.location?.trim()) {
    const city = (contact.city ?? "").toLowerCase();
    const state = (contact.state ?? "").toLowerCase();
    const address = (contact.address ?? "").toLowerCase();
    const country = (contact.country ?? "").toLowerCase();
    const term = filters.location.trim().toLowerCase();
    // Normalize so "San Francisco, CA" matches contact with city "San Francisco" + state "CA"
    const normalize = (s: string) => s.replace(/[,]+/g, " ").replace(/\s+/g, " ").trim();
    const contactLocation = normalize([city, state, address, country].filter(Boolean).join(" "));
    const termNorm = normalize(term);
    const matchesLocation =
      city.includes(term) ||
      state.includes(term) ||
      address.includes(term) ||
      country.includes(term) ||
      (termNorm.length > 0 && contactLocation.includes(termNorm));
    if (!matchesLocation) return false;
  }

  if (filters.relationship_type) {
    if (filters.relationship_type === "client" && !contact.isClient) return false;
    if (filters.relationship_type === "vendor") {
      // No is_vendor on Contact; treat as "not client" for simplicity or skip
      // For now we only support client; extend if we add vendor flag
    }
  }

  return true;
}

/**
 * Filter an array of contacts by saved search criteria.
 */
export function applySearchFiltersToContacts(
  contacts: Contact[],
  filters: SearchQueryFilters | null | undefined
): Contact[] {
  if (!filters || typeof filters !== "object") return contacts;
  return contacts.filter((c) => contactMatchesFilters(c, filters));
}
