import { describe, it, expect } from "vitest";
import { parseSearchQueryToSchema } from "../searchQueryParser";

describe("Search parser ambiguity fixtures", () => {
  it('keeps "vet tech" as a role signal, not company', () => {
    const parsed = parseSearchQueryToSchema("vet tech");
    expect(parsed.filters.company).toBeUndefined();
    expect(parsed.filters.job_title).toBeTruthy();
  });

  it('maps "contract" to legal role and avoids company noise', () => {
    const parsed = parseSearchQueryToSchema("contract");
    expect(parsed.filters.company).toBeUndefined();
    expect(parsed.filters.job_title).toBe("legal");
  });

  it('maps "legal" to legal role and avoids company noise', () => {
    const parsed = parseSearchQueryToSchema("legal");
    expect(parsed.filters.company).toBeUndefined();
    expect(parsed.filters.job_title).toBe("legal");
  });

  it('maps "sales contact" to sales without singularization bug', () => {
    const parsed = parseSearchQueryToSchema("sales contact");
    expect(parsed.filters.company).toBeUndefined();
    expect(parsed.filters.job_title).toBe("sales");
  });
});

