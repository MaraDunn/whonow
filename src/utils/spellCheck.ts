/**
 * Levenshtein distance and word-level typo correction.
 *
 * Corrects misspelled words against a combined dictionary of general English
 * words and user-specific vocabulary (contact cities, companies, roles).
 * Operates on individual words so compound vocabulary entries like
 * "UX Designer" never replace a simpler term like "designers".
 */

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array(n + 1);
  let curr = new Array(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

/**
 * Correct typos in `input` by comparing each word against individual words
 * from `words` (a flat list, or multi-word entries that get split).
 *
 * - Only fixes genuine typos (close edit distance) and casing.
 * - Preserves the user's plural/singular form.
 * - Never replaces one valid word with a different one (e.g. "designers" will
 *   NOT become "UX Designer").
 *
 * Words later in the array take precedence for casing, so place contact
 * vocabulary after the general dictionary to get proper-noun capitalization.
 *
 * Returns the corrected string, or null if nothing changed.
 */
export function correctTypos(
  input: string,
  words: string[],
  threshold = 0.35
): string | null {
  if (!input.trim() || words.length === 0) return null;

  // Build word map: lowercase → preferred casing.
  // Later entries win so contact vocab (placed after dictionary) gets priority.
  const wordMap = new Map<string, string>();
  for (const entry of words) {
    for (const w of entry.split(/\s+/)) {
      if (w.length <= 1) continue;
      wordMap.set(w.toLowerCase(), w);
    }
  }

  // Bucket by length for fast fuzzy search against large dictionaries.
  const byLength = new Map<number, string[]>();
  for (const w of wordMap.values()) {
    const len = w.length;
    let bucket = byLength.get(len);
    if (!bucket) {
      bucket = [];
      byLength.set(len, bucket);
    }
    bucket.push(w);
  }

  const inputWords = input.split(/\s+/);
  let changed = false;
  const corrected: string[] = [];

  for (const word of inputWords) {
    if (word.length <= 1) {
      corrected.push(word);
      continue;
    }

    const lower = word.toLowerCase();

    // 1. Exact match (case-insensitive) → fix casing
    if (wordMap.has(lower)) {
      const preferred = wordMap.get(lower)!;
      corrected.push(preferred);
      if (preferred !== word) changed = true;
      continue;
    }

    // 2. Plural form whose singular root exists → fix casing, keep plural
    if (lower.endsWith("s") && lower.length > 3) {
      const singularLower = lower.slice(0, -1);
      if (wordMap.has(singularLower)) {
        const preferred = wordMap.get(singularLower)!;
        const result = preferred + word.slice(-1);
        corrected.push(result);
        if (result !== word) changed = true;
        continue;
      }
    }

    // 3. Fuzzy match (genuine typo).
    //    Only check words within a plausible length range for performance.
    let bestWord: string | null = null;
    let bestDist = Infinity;

    for (let len = Math.max(2, lower.length - 3); len <= lower.length + 3; len++) {
      const bucket = byLength.get(len);
      if (!bucket) continue;
      for (const candidate of bucket) {
        const dist = levenshtein(lower, candidate.toLowerCase());
        const maxLen = Math.max(lower.length, candidate.length);
        if (dist / maxLen < threshold && dist < bestDist) {
          bestDist = dist;
          bestWord = candidate;
        }
      }
    }

    if (bestWord) {
      // Preserve the user's trailing 's' when the typo was clearly plural
      if (lower.endsWith("s") && !bestWord.toLowerCase().endsWith("s")) {
        corrected.push(bestWord + "s");
      } else {
        corrected.push(bestWord);
      }
      changed = true;
    } else {
      corrected.push(word);
    }
  }

  return changed ? corrected.join(" ") : null;
}
