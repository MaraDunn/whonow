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
}

export type ContactOwnershipFilter = "all" | "personal" | "shared";
