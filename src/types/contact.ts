export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  role: string;
  avatar?: string;
  tags: string[];
  description?: string;
  folderId?: string;
  isShared?: boolean;
  ownerId?: string;
  lastContactedAt?: string;
  isClient?: boolean;
  /** When set, contact is associated with this company (e.g. shared/org). Used to show "Internal" badge when it matches the user's company. */
  companyId?: string;
  createdAt?: string; // Timestamp when contact was added (hidden from UI, used for time-based searches)
  address?: string; // Full address string
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  latitude?: number; // For location-based searches
  longitude?: number; // For location-based searches
  businessName?: string; // Business name at this address (from OpenStreetMap lookup)
  businessType?: string; // Business type/category (e.g., "restaurant", "retail", "office")
  followUpDate?: string; // ISO date string (YYYY-MM-DD) for manual follow-up tracking
  reminderIntervalOverride?: number; // Per-contact override (days) for reminder interval
  /** Days between preferred contacts; defaults to 30. Only used for isClient contacts. */
  preferredContactIntervalDays?: number;
  /** Multiplier applied to the raw health score; defaults to 1.0. Only used for isClient contacts. */
  clientWeight?: number;
  /** Computed health score 0–100. Only populated for isClient contacts. */
  relationshipHealthScore?: number;
  /** Human-readable label derived from relationshipHealthScore. */
  relationshipHealthStatus?: "Healthy" | "At Risk" | "Cold";
}

export type ContactOwnershipFilter = "all" | "personal" | "shared";
