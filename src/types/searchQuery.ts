/**
 * Canonical SearchQuery Schema
 * Single source of truth for all platforms (Desktop, Mobile, Browser, PWA)
 */

export type SearchIntent = "search_contacts" | "list_recent" | "relationship_lookup";

export interface DateRange {
  from: string; // ISO date string
  to: string;   // ISO date string
}

export type RelationshipType = "met" | "worked_with" | "client" | "vendor";

export interface SearchQueryFilters {
  name?: string;
  company?: string;
  job_title?: string;
  introduced_by?: string;
  relationship_type?: RelationshipType;
  date_range?: DateRange;
  /** When set, filter by last_contacted_at (e.g. "who did I call last week") */
  interaction_date_range?: DateRange;
  location?: string;
  tags?: string[];
}

export interface SearchQuery {
  intent: SearchIntent;
  filters: SearchQueryFilters;
  semantic_hint?: string;  // For ranking/interpretation only, never for filtering
  confidence: number;      // 0.0-1.0
  explanation: string;     // Human-readable reasoning
}
