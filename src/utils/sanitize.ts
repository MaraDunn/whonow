/**
 * Client-side input sanitization utilities
 * 
 * These utilities provide defense-in-depth validation
 * alongside server-side validation.
 */

/**
 * Sanitize a string by escaping HTML entities
 * Prevents XSS when displaying user-provided content
 */
export function escapeHtml(input: string): string {
  if (typeof input !== "string") return "";
  
  const escapeMap: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
    "/": "&#x2F;",
    "`": "&#x60;",
    "=": "&#x3D;",
  };
  
  return input.replace(/[&<>"'`=\/]/g, (char) => escapeMap[char] || char);
}

/**
 * Validate and sanitize an email address
 * Returns null if invalid
 */
export function sanitizeEmail(email: string): string | null {
  if (typeof email !== "string") return null;
  
  const trimmed = email.trim().toLowerCase();
  
  // Basic email regex - more permissive than RFC 5322 but catches obvious issues
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(trimmed) || trimmed.length > 254) {
    return null;
  }
  
  return trimmed;
}

/**
 * Validate and sanitize a phone number
 * Returns cleaned phone number or null if invalid
 */
export function sanitizePhone(phone: string): string | null {
  if (typeof phone !== "string") return null;
  
  // Remove all non-digit characters except + at the start
  const cleaned = phone.trim();
  
  // Basic validation: should contain digits and common phone characters
  const phoneRegex = /^[\d\s\-\(\)\+\.]{7,25}$/;
  
  if (!phoneRegex.test(cleaned)) {
    return null;
  }
  
  return cleaned;
}

/**
 * Sanitize a name field
 * Removes potentially dangerous characters while preserving unicode names
 */
export function sanitizeName(name: string, maxLength = 100): string {
  if (typeof name !== "string") return "";
  
  return name
    .trim()
    .slice(0, maxLength)
    // Remove control characters and HTML-like patterns
    .replace(/[\x00-\x1F\x7F]/g, "")
    .replace(/<[^>]*>/g, "")
    .trim();
}

/**
 * Sanitize a general text field (description, notes, etc.)
 */
export function sanitizeText(text: string, maxLength = 2000): string {
  if (typeof text !== "string") return "";
  
  return text
    .trim()
    .slice(0, maxLength)
    // Remove control characters except newlines and tabs
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    // Remove HTML script tags
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .trim();
}

/**
 * Sanitize a URL
 * Returns null if the URL is invalid or potentially dangerous
 */
export function sanitizeUrl(url: string): string | null {
  if (typeof url !== "string") return null;
  
  const trimmed = url.trim();
  
  // Only allow http and https protocols
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return null;
  }
  
  try {
    const parsed = new URL(trimmed);
    // Block javascript: and data: URLs that might sneak through
    if (parsed.protocol === "javascript:" || parsed.protocol === "data:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Sanitize tags array
 * Cleans each tag and removes duplicates/empty values
 */
export function sanitizeTags(tags: string[], maxTags = 50, maxTagLength = 50): string[] {
  if (!Array.isArray(tags)) return [];
  
  const seen = new Set<string>();
  const result: string[] = [];
  
  for (const tag of tags.slice(0, maxTags)) {
    if (typeof tag !== "string") continue;
    
    const cleaned = tag
      .trim()
      .toLowerCase()
      .slice(0, maxTagLength)
      .replace(/[<>"']/g, "");
    
    if (cleaned.length > 0 && !seen.has(cleaned)) {
      seen.add(cleaned);
      result.push(cleaned);
    }
  }
  
  return result;
}

/**
 * Validate contact data before submission
 * Returns an object with validation results
 */
export interface ContactValidation {
  isValid: boolean;
  errors: Record<string, string>;
  sanitized: {
    name: string;
    email: string;
    phone: string;
    company: string;
    role: string;
    description: string;
    tags: string[];
  };
}

export function validateContactData(data: {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  role?: string;
  description?: string;
  tags?: string[];
}): ContactValidation {
  const errors: Record<string, string> = {};
  
  // Name is required
  const name = sanitizeName(data.name || "");
  if (!name) {
    errors.name = "Name is required";
  }
  
  // Email validation (optional)
  let email = "";
  if (data.email?.trim()) {
    const sanitizedEmail = sanitizeEmail(data.email);
    if (sanitizedEmail) {
      email = sanitizedEmail;
    } else {
      errors.email = "Invalid email address";
    }
  }
  
  // Phone validation (optional)
  let phone = "";
  if (data.phone?.trim()) {
    const sanitizedPhone = sanitizePhone(data.phone);
    if (sanitizedPhone) {
      phone = sanitizedPhone;
    } else {
      errors.phone = "Invalid phone number";
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitized: {
      name,
      email,
      phone,
      company: sanitizeName(data.company || "", 200),
      role: sanitizeName(data.role || "", 200),
      description: sanitizeText(data.description || ""),
      tags: sanitizeTags(data.tags || []),
    },
  };
}
