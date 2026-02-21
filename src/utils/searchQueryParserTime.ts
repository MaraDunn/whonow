/**
 * Time-range parsing for search queries.
 * Extracted from searchQueryParser for maintainability.
 */

// Number words for time range parsing ("last two weeks", "in the last three days")
export const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  couple: 2, few: 3, half: 1,
};

export function parseTimeAmount(token: string): number | null {
  if (!token || typeof token !== "string") return null;
  const t = token.trim().toLowerCase();
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  const n = NUMBER_WORDS[t];
  return n !== undefined ? n : null;
}

// Time-of-day definitions (hour ranges)
export const TIME_OF_DAY = {
  morning: { start: 5, end: 12 },
  afternoon: { start: 12, end: 17 },
  evening: { start: 17, end: 21 },
  night: { start: 21, end: 5 },
  am: { start: 0, end: 12 },
  pm: { start: 12, end: 24 },
  noon: { start: 12, end: 13 },
  midnight: { start: 0, end: 1 },
} as const;

export interface TimeRangeResult {
  start: Date;
  end: Date;
}

// Time-based query patterns
export const TIME_PATTERNS: Record<string, () => TimeRangeResult> = {
  "earlier this week": () => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    const dayOfWeek = start.getDay();
    start.setDate(start.getDate() - dayOfWeek);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  },
  "last week": () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 7);
    return { start, end };
  },
  "this week": () => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    const dayOfWeek = start.getDay();
    start.setDate(start.getDate() - dayOfWeek);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  },
  "last month": () => {
    const end = new Date();
    const start = new Date();
    start.setMonth(end.getMonth() - 1);
    return { start, end };
  },
  "this month": () => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  },
  "last year": () => {
    const end = new Date();
    const start = new Date();
    start.setFullYear(end.getFullYear() - 1);
    return { start, end };
  },
  "this year": () => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  },
  "yesterday": () => {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - 1);
    return { start, end };
  },
  "today": () => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return { start, end };
  },
  "recent": () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 7);
    return { start, end };
  },
  "recently": () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 7);
    return { start, end };
  },
  "a while ago": () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    return { start, end };
  },
  "last quarter": () => {
    const end = new Date();
    const start = new Date();
    start.setMonth(end.getMonth() - 3);
    return { start, end };
  },
};
