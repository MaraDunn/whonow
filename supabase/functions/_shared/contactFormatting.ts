/**
 * Shared contact formatting utilities for Edge Functions.
 * Use for consistent name/phone formatting and to avoid duplication across
 * parse-contact-pdf and scan-business-card.
 */

export function formatName(name: string): string {
  if (!name || typeof name !== "string") return "";
  const trimmed = name.trim();
  if (!trimmed) return "";

  const lowerParticles = new Set([
    "von",
    "van",
    "de",
    "del",
    "della",
    "der",
    "di",
    "du",
    "la",
    "le",
    "lo",
  ]);
  const specialPrefixes: Record<string, string> = {
    mc: "Mc",
    mac: "Mac",
    "o'": "O'",
  };

  return trimmed
    .split(/\s+/)
    .map((word, wordIndex) => {
      if (word.includes("-")) {
        return word
          .split("-")
          .map((part, i) =>
            capitalizeWord(
              part,
              wordIndex === 0 && i === 0,
              lowerParticles,
              specialPrefixes
            )
          )
          .join("-");
      }
      return capitalizeWord(word, wordIndex === 0, lowerParticles, specialPrefixes);
    })
    .join(" ");
}

export function capitalizeWord(
  word: string,
  isFirst: boolean,
  lowerParticles: Set<string>,
  specialPrefixes: Record<string, string>
): string {
  if (!word) return "";
  const lower = word.toLowerCase();
  if (!isFirst && lowerParticles.has(lower)) return lower;
  for (const [prefix, replacement] of Object.entries(specialPrefixes)) {
    if (lower.startsWith(prefix) && lower.length > prefix.length) {
      const rest = lower.slice(prefix.length);
      return (
        replacement +
        rest.charAt(0).toUpperCase() +
        rest.slice(1).toLowerCase()
      );
    }
  }
  const apostropheIndex = word.indexOf("'");
  if (apostropheIndex > 0 && apostropheIndex < word.length - 1) {
    const before = word.slice(0, apostropheIndex);
    const after = word.slice(apostropheIndex + 1);
    return (
      before.charAt(0).toUpperCase() +
      before.slice(1).toLowerCase() +
      "'" +
      after.charAt(0).toUpperCase() +
      after.slice(1).toLowerCase()
    );
  }
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function formatPhoneNumber(phone: string): string {
  if (!phone || typeof phone !== "string") return "";
  const trimmed = phone.trim();
  if (!trimmed) return "";

  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return trimmed;

  if (digits.length === 10) {
    return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length >= 8 && (hasPlus || digits.length > 10)) {
    let countryCode: string;
    let rest: string;
    if (digits.length <= 11) {
      countryCode = digits.slice(
        0,
        digits.length > 10 ? digits.length - 10 : 1
      );
      rest = digits.slice(countryCode.length);
    } else {
      countryCode = digits.slice(0, Math.min(3, digits.length - 9));
      rest = digits.slice(countryCode.length);
    }
    const groups: string[] = [];
    for (let i = 0; i < rest.length; i += 3) {
      groups.push(rest.slice(i, Math.min(i + 3, rest.length)));
    }
    return `+${countryCode} ${groups.join(" ")}`;
  }
  return trimmed;
}
