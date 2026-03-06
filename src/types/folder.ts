import type { SearchQueryFilters } from "./searchQuery";

export type DirectoryType = 'contacts' | 'clients' | 'team';

/** Stored filter for smart folders (saved search). Same shape as SearchQuery.filters. */
export type SmartFolderFilterCriteria = SearchQueryFilters | null;

export interface Folder {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  directoryType: DirectoryType;
  isOrganizationFolder?: boolean;
  ownerId?: string | null;
  companyId?: string | null;
  /** When true, folder is a saved search; contacts are filtered by saved search. */
  isSmartFolder?: boolean;
  /** For smart folders: saved search criteria (legacy/display). Prefer savedSearchQuery for running the search. */
  filterCriteria?: SmartFolderFilterCriteria;
  /** For smart folders: raw query string (e.g. "designers in San Francisco"). Run via smart_search_contacts when folder is opened. */
  savedSearchQuery?: string | null;
}
