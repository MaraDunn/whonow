import { beforeAll, describe, expect, it } from "vitest";
import { performance } from "node:perf_hooks";
import { parseSearchQueryToSchema } from "../searchQueryParser";

const PERF_QUERIES = [
  "legal counsel",
  "contract writing",
  "someone for marketing",
  "sales contact",
  "it help",
  "content writing",
  "delivery driver",
  "plumber",
  "vet tech",
  "paramedic",
];

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

describe("Search parser performance guardrails", () => {
  beforeAll(() => {
    process.env.SUPPRESS_DEV_LOGS = "1";
  });

  it("keeps parser latency in healthy bounds for representative queries", () => {
    const timings: number[] = [];

    // Warmup to reduce first-run skew.
    for (let i = 0; i < 2; i++) {
      for (const q of PERF_QUERIES) {
        parseSearchQueryToSchema(q);
      }
    }

    for (let i = 0; i < 25; i++) {
      for (const query of PERF_QUERIES) {
        const t0 = performance.now();
        parseSearchQueryToSchema(query);
        timings.push(performance.now() - t0);
      }
    }

    const p95 = percentile(timings, 95);
    const max = Math.max(...timings);

    // Conservative test bounds to avoid CI noise while still catching regressions.
    expect(p95).toBeLessThan(20);
    expect(max).toBeLessThan(60);
  });

  it("emits diagnostics for match source and confidence band", () => {
    const parsed = parseSearchQueryToSchema("contract writing");
    expect(parsed.diagnostics).toBeDefined();
    expect(parsed.diagnostics?.match_source).toBeTruthy();
    expect(parsed.diagnostics?.confidence_band).toBeTruthy();
  });
});

