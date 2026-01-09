import { Contact } from "@/types/contact";

/**
 * Merges two contacts intelligently
 * - Keeps the primary contact's ID and created_at (older contact)
 * - Merges tags (deduplicates)
 * - Preserves non-empty fields (prefers primary, falls back to secondary)
 * - Combines descriptions if both exist
 * 
 * @param primary The contact to keep as primary (usually the older one)
 * @param secondary The contact to merge into primary
 * @returns A merged contact with primary's ID and created_at
 */
export function mergeContacts(primary: Contact, secondary: Contact | Omit<Contact, "id">): Omit<Contact, "id"> & { id: string; createdAt?: string } {
  // Determine which contact is older (if both have createdAt)
  const primaryDate = primary.createdAt ? new Date(primary.createdAt).getTime() : Infinity;
  const secondaryDate = secondary.createdAt ? new Date(secondary.createdAt).getTime() : Infinity;
  
  // Use the older contact as the base (keep its ID and created_at)
  const base = primaryDate <= secondaryDate ? primary : (secondary as Contact);
  const other = primaryDate <= secondaryDate ? secondary : primary;
  
  // Merge tags - combine and deduplicate
  const allTags = [
    ...(base.tags || []),
    ...(other.tags || [])
  ];
  const mergedTags = Array.from(new Set(allTags.map(tag => tag.toLowerCase())));

  // Merge descriptions
  let mergedDescription: string | undefined;
  if (base.description && other.description) {
    // Combine with separator if both exist
    if (base.description.trim() === other.description.trim()) {
      mergedDescription = base.description;
    } else {
      mergedDescription = `${base.description.trim()}\n\n${other.description.trim()}`;
    }
  } else {
    mergedDescription = base.description || other.description;
  }

  // Field priority: prefer non-empty fields from base, fallback to other
  const merged: Omit<Contact, "id"> & { id: string; createdAt?: string } = {
    id: base.id,
    name: base.name || other.name || '',
    email: base.email || other.email || '',
    phone: base.phone || other.phone || '',
    company: base.company || other.company || '',
    role: base.role || other.role || '',
    tags: mergedTags,
    description: mergedDescription,
    avatar: base.avatar || other.avatar,
    folderId: base.folderId || other.folderId,
    isShared: base.isShared ?? other.isShared ?? false,
    ownerId: base.ownerId || other.ownerId,
    lastContactedAt: base.lastContactedAt || other.lastContactedAt,
    isClient: base.isClient ?? other.isClient ?? false,
    createdAt: base.createdAt || other.createdAt,
    address: base.address || other.address,
    city: base.city || other.city,
    state: base.state || other.state,
    zipCode: base.zipCode || other.zipCode,
    country: base.country || other.country,
    latitude: base.latitude ?? other.latitude,
    longitude: base.longitude ?? other.longitude,
    businessName: base.businessName || other.businessName,
    businessType: base.businessType || other.businessType,
  };

  return merged;
}

/**
 * Preview what a merged contact would look like
 * Returns a summary of what fields will be merged/kept
 */
export function previewMerge(primary: Contact, secondary: Contact | Omit<Contact, "id">): {
  willKeep: string[];
  willAdd: string[];
  willMerge: string[];
} {
  const willKeep: string[] = [];
  const willAdd: string[] = [];
  const willMerge: string[] = [];

  // Name
  if (primary.name && secondary.name) {
    if (primary.name === secondary.name) {
      willKeep.push('name');
    } else {
      willMerge.push('name');
    }
  } else if (primary.name) {
    willKeep.push('name');
  } else if (secondary.name) {
    willAdd.push('name');
  }

  // Email
  if (primary.email && secondary.email) {
    if (primary.email === secondary.email) {
      willKeep.push('email');
    } else {
      willMerge.push('email');
    }
  } else if (primary.email) {
    willKeep.push('email');
  } else if (secondary.email) {
    willAdd.push('email');
  }

  // Phone
  if (primary.phone && secondary.phone) {
    if (primary.phone === secondary.phone) {
      willKeep.push('phone');
    } else {
      willMerge.push('phone');
    }
  } else if (primary.phone) {
    willKeep.push('phone');
  } else if (secondary.phone) {
    willAdd.push('phone');
  }

  // Company
  if (primary.company && secondary.company) {
    if (primary.company === secondary.company) {
      willKeep.push('company');
    } else {
      willMerge.push('company');
    }
  } else if (primary.company) {
    willKeep.push('company');
  } else if (secondary.company) {
    willAdd.push('company');
  }

  // Role
  if (primary.role && secondary.role) {
    if (primary.role === secondary.role) {
      willKeep.push('role');
    } else {
      willMerge.push('role');
    }
  } else if (primary.role) {
    willKeep.push('role');
  } else if (secondary.role) {
    willAdd.push('role');
  }

  // Tags - always merge
  if ((primary.tags && primary.tags.length > 0) || (secondary.tags && secondary.tags.length > 0)) {
    willMerge.push('tags');
  }

  // Description
  if (primary.description && secondary.description) {
    willMerge.push('description');
  } else if (primary.description) {
    willKeep.push('description');
  } else if (secondary.description) {
    willAdd.push('description');
  }

  return { willKeep, willAdd, willMerge };
}

