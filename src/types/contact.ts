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
  createdAt?: string; // Timestamp when contact was added (hidden from UI, used for time-based searches)
}

export type ContactOwnershipFilter = "all" | "personal" | "shared";
