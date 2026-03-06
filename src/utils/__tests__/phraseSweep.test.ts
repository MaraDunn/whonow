import { describe, it, expect } from "vitest";
import { parseSearchQueryToSchema } from "../searchQueryParser";

type SweepCase = {
  query: string;
  expectedJobTitle: string | null;
  expectedCompany: string | null;
};

const CASES: SweepCase[] = [
  { query: "contract writing", expectedJobTitle: "legal", expectedCompany: null },
  { query: "legal counsel", expectedJobTitle: "legal", expectedCompany: null },
  { query: "someone for marketing", expectedJobTitle: "marketing", expectedCompany: null },
  { query: "it help", expectedJobTitle: "it", expectedCompany: null },
  { query: "sales contact", expectedJobTitle: "sales", expectedCompany: null },
  { query: "I need help with a contract", expectedJobTitle: "legal", expectedCompany: null },
  { query: "content writing", expectedJobTitle: "content", expectedCompany: null },
];

describe("Smart Search phrase sweep", () => {
  for (const c of CASES) {
    it(`parses "${c.query}"`, () => {
      const parsed = parseSearchQueryToSchema(c.query);
      expect(parsed.filters.job_title ?? null).toBe(c.expectedJobTitle);
      expect(parsed.filters.company ?? null).toBe(c.expectedCompany);
    });
  }
});
