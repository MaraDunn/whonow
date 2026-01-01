/**
 * Format a name with proper capitalization
 * Handles: hyphenated names, apostrophes, particles (von, van, de, etc.), common patterns (McDonald, etc.)
 */
export function formatName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  
  const trimmed = name.trim();
  if (!trimmed) return '';
  
  // Particles that should remain lowercase (unless at start of name)
  const lowerParticles = new Set(['von', 'van', 'de', 'del', 'della', 'der', 'di', 'du', 'la', 'le', 'lo']);
  
  // Common patterns that need special handling (prefix -> replacement)
  const specialPrefixes: Record<string, string> = {
    'mc': 'Mc',
    'mac': 'Mac',
    "o'": "O'",
  };
  
  const words = trimmed.split(/\s+/);
  
  return words.map((word, wordIndex) => {
    // Handle hyphenated names
    if (word.includes('-')) {
      return word.split('-')
        .map((part, partIndex) => capitalizeWord(part, wordIndex === 0 && partIndex === 0, lowerParticles, specialPrefixes))
        .join('-');
    }
    
    return capitalizeWord(word, wordIndex === 0, lowerParticles, specialPrefixes);
  }).join(' ');
}

function capitalizeWord(
  word: string, 
  isFirst: boolean, 
  lowerParticles: Set<string>,
  specialPrefixes: Record<string, string>
): string {
  if (!word) return '';
  
  const lower = word.toLowerCase();
  
  // Check for particles (only lowercase if not first word)
  if (!isFirst && lowerParticles.has(lower)) {
    return lower;
  }
  
  // Check for special prefixes like Mc, Mac, O'
  for (const [prefix, replacement] of Object.entries(specialPrefixes)) {
    if (lower.startsWith(prefix) && lower.length > prefix.length) {
      const rest = lower.slice(prefix.length);
      return replacement + rest.charAt(0).toUpperCase() + rest.slice(1).toLowerCase();
    }
  }
  
  // Handle apostrophe in middle of word (e.g., O'Connor already handled, but D'Angelo)
  const apostropheIndex = word.indexOf("'");
  if (apostropheIndex > 0 && apostropheIndex < word.length - 1) {
    const before = word.slice(0, apostropheIndex);
    const after = word.slice(apostropheIndex + 1);
    return before.charAt(0).toUpperCase() + before.slice(1).toLowerCase() + 
           "'" + 
           after.charAt(0).toUpperCase() + after.slice(1).toLowerCase();
  }
  
  // Standard capitalization
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Format a phone number into a readable format
 * US/Canada: +1 (XXX) XXX-XXXX
 * International: +CC XXX XXX XXXX
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone || typeof phone !== 'string') return '';
  
  const trimmed = phone.trim();
  if (!trimmed) return '';
  
  // Extract only digits and leading +
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  
  if (!digits) return trimmed; // Return original if no digits found
  
  // US/Canada numbers (10 digits, or 11 starting with 1)
  if (digits.length === 10) {
    // Assume US number without country code
    const area = digits.slice(0, 3);
    const prefix = digits.slice(3, 6);
    const line = digits.slice(6);
    return `+1 (${area}) ${prefix}-${line}`;
  }
  
  if (digits.length === 11 && digits.startsWith('1')) {
    // US number with country code
    const area = digits.slice(1, 4);
    const prefix = digits.slice(4, 7);
    const line = digits.slice(7);
    return `+1 (${area}) ${prefix}-${line}`;
  }
  
  // International numbers - format as +CC XXX XXX XXXX or similar
  if (digits.length >= 8) {
    // Try to format intelligently based on length
    if (hasPlus || digits.length > 10) {
      // Likely has country code
      let countryCode: string;
      let rest: string;
      
      // Common country code lengths: 1 (US/CA), 2 (UK, FR, etc.), 3 (some countries)
      // If starts with 1, assume 1-digit country code (US/Canada)
      if (digits.startsWith('1') && digits.length === 11) {
        // Already handled above
        return formatPhoneNumber('+' + digits);
      } else if (digits.length <= 11) {
        // Assume 1-2 digit country code
        countryCode = digits.slice(0, digits.length > 10 ? digits.length - 10 : 1);
        rest = digits.slice(countryCode.length);
      } else {
        // Longer number, assume 2-3 digit country code
        countryCode = digits.slice(0, Math.min(3, digits.length - 9));
        rest = digits.slice(countryCode.length);
      }
      
      // Format the rest in groups of 3-4
      const groups: string[] = [];
      for (let i = 0; i < rest.length; i += 3) {
        groups.push(rest.slice(i, Math.min(i + 3, rest.length)));
      }
      
      return `+${countryCode} ${groups.join(' ')}`;
    }
  }
  
  // For shorter numbers or unrecognized formats, return cleaned version
  if (digits.length >= 7 && digits.length <= 10) {
    // Local number format: XXX-XXXX or XXX XXX XXXX
    if (digits.length === 7) {
      return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    }
    if (digits.length === 10) {
      // Already handled above, but just in case
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
  }
  
  // Return original if we can't format it
  return trimmed;
}

/**
 * Apply both name and phone formatting to a contact object
 */
export function formatContactFields(contact: { 
  name?: string; 
  phone?: string;
  [key: string]: unknown;
}): typeof contact {
  return {
    ...contact,
    name: contact.name ? formatName(contact.name) : contact.name,
    phone: contact.phone ? formatPhoneNumber(contact.phone) : contact.phone,
  };
}
