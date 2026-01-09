import { Contact } from "@/types/contact";

/**
 * Normalizes an email address for comparison
 * - Converts to lowercase
 * - Trims whitespace
 * - Returns empty string if email is null/undefined/empty
 */
export function normalizeEmail(email: string | null | undefined): string {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

/**
 * Normalizes a phone number for comparison
 * - Removes all non-digit characters
 * - Returns empty string if phone is null/undefined/empty
 */
export function normalizePhone(phone: string | null | undefined): string {
  if (!phone || typeof phone !== 'string') return '';
  return phone.replace(/\D/g, '');
}

/**
 * Checks if two contacts are duplicates based on email OR phone
 * Returns true if:
 * - Both have emails and normalized emails match, OR
 * - Both have phones and normalized phones match
 */
export function areContactsDuplicate(contact1: Contact | Omit<Contact, "id">, contact2: Contact): boolean {
  const email1 = normalizeEmail(contact1.email);
  const email2 = normalizeEmail(contact2.email);
  const phone1 = normalizePhone(contact1.phone);
  const phone2 = normalizePhone(contact2.phone);

  // Email match (both must have emails)
  if (email1 && email2 && email1 === email2) {
    return true;
  }

  // Phone match (both must have phones)
  if (phone1 && phone2 && phone1 === phone2) {
    return true;
  }

  return false;
}

/**
 * Finds duplicate contacts from a list of existing contacts
 * Returns an array of contacts that match the given contact by email OR phone
 */
export function findDuplicateContacts(
  contact: Omit<Contact, "id">,
  existingContacts: Contact[]
): Contact[] {
  return existingContacts.filter(existing => areContactsDuplicate(contact, existing));
}

/**
 * Calculates a similarity score between two contacts (0-1)
 * Higher score means more similar
 * Used for fuzzy matching in cleanup tools
 */
export function calculateSimilarity(contact1: Contact | Omit<Contact, "id">, contact2: Contact): number {
  let score = 0;
  let factors = 0;

  // Email similarity (exact match = 1.0, no match = 0)
  const email1 = normalizeEmail(contact1.email);
  const email2 = normalizeEmail(contact2.email);
  if (email1 && email2) {
    factors++;
    if (email1 === email2) {
      score += 1.0;
    }
  }

  // Phone similarity (exact match = 1.0, no match = 0)
  const phone1 = normalizePhone(contact1.phone);
  const phone2 = normalizePhone(contact2.phone);
  if (phone1 && phone2) {
    factors++;
    if (phone1 === phone2) {
      score += 1.0;
    }
  }

  // Name similarity (simple comparison - could be enhanced with fuzzy string matching)
  const name1 = contact1.name?.trim().toLowerCase() || '';
  const name2 = contact2.name?.trim().toLowerCase() || '';
  if (name1 && name2) {
    factors++;
    if (name1 === name2) {
      score += 0.5; // Name match is less important than email/phone
    } else if (name1.includes(name2) || name2.includes(name1)) {
      score += 0.25; // Partial name match
    }
  }

  // Company similarity
  const company1 = contact1.company?.trim().toLowerCase() || '';
  const company2 = contact2.company?.trim().toLowerCase() || '';
  if (company1 && company2) {
    factors++;
    if (company1 === company2) {
      score += 0.3; // Company match is less important
    }
  }

  // Normalize score by number of factors
  return factors > 0 ? score / factors : 0;
}

