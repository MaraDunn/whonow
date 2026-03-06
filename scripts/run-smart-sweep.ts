import { parseSearchQueryToSchema } from "../src/utils/searchQueryParser";
import { RESPONSIBILITY_ALIASES } from "../src/data/responsibilityAliases";
import { SMART_SWEEP_GUARDRAILS } from "./smartSweepConfig";
import { performance } from "node:perf_hooks";

type SweepPhrase = {
  query: string;
};

const PHRASE_POOL: SweepPhrase[] = [
  // Corporate / knowledge-work
  { query: "contract writing" },
  { query: "legal counsel" },
  { query: "someone for marketing" },
  { query: "marketing person" },
  { query: "sales contact" },
  { query: "it help" },
  { query: "content writing" },
  { query: "recruiter" },
  { query: "account executive" },
  { query: "product manager" },
  { query: "software engineer" },
  { query: "graphic designer" },
  { query: "finance manager" },
  { query: "operations manager" },
  { query: "general counsel" },
  { query: "paralegal" },
  { query: "copywriter" },
  { query: "event coordinator" },
  { query: "community manager" },
  { query: "help desk" },
  // Trades / field / service
  { query: "breeder" },
  { query: "delivery driver" },
  { query: "dog groomer" },
  { query: "plumber" },
  { query: "electrician" },
  { query: "mechanic" },
  { query: "nanny" },
  { query: "tutor" },
  { query: "real estate agent" },
  { query: "photographer" },
  { query: "videographer" },
  { query: "farrier" },
  { query: "veterinarian" },
  { query: "chef" },
  { query: "bartender" },
  { query: "carpenter" },
  { query: "personal trainer" },
  { query: "massage therapist" },
  { query: "landscaper" },
  { query: "house cleaner" },
  // Expanded public / healthcare / logistics
  { query: "paramedic" },
  { query: "social worker" },
  { query: "notary" },
  { query: "welder" },
  { query: "dispatcher" },
  { query: "security guard" },
  { query: "caretaker" },
  { query: "caregiver" },
  { query: "pharmacist" },
  { query: "dentist" },
  { query: "hygienist" },
  { query: "optometrist" },
  { query: "chiropractor" },
  { query: "physical therapist" },
  { query: "occupational therapist" },
  { query: "speech therapist" },
  { query: "truck driver" },
  { query: "forklift operator" },
  { query: "warehouse associate" },
  { query: "inventory specialist" },
  { query: "janitor" },
  { query: "custodian" },
  { query: "window cleaner" },
  { query: "pool technician" },
  { query: "hvac technician" },
  { query: "roofer" },
  { query: "painter" },
  { query: "tile installer" },
  { query: "locksmith" },
  { query: "tow truck driver" },
  { query: "auto detailer" },
  { query: "dog walker" },
  { query: "pet sitter" },
  { query: "vet tech" },
  { query: "horse trainer" },
  { query: "stable manager" },
  { query: "florist" },
  { query: "baker" },
  { query: "barista" },
  { query: "server" },
  { query: "host" },
  { query: "line cook" },
  { query: "pastry chef" },
  { query: "butcher" },
  { query: "tailor" },
  { query: "seamstress" },
  { query: "hair stylist" },
  { query: "barber" },
  { query: "esthetician" },
  { query: "nail technician" },
  { query: "makeup artist" },
  { query: "wedding planner" },
  { query: "event planner" },
  { query: "dj" },
  { query: "music teacher" },
  { query: "driving instructor" },
  { query: "translator" },
  { query: "interpreter" },
  { query: "bookkeeper" },
  { query: "tax preparer" },
];

const TOTAL_PASSES = Number(process.env.PASSES ?? "5000");
const BATCH_SIZE = Number(process.env.BATCH_SIZE ?? "20");
const PROGRESS_EVERY = Number(process.env.PROGRESS_EVERY ?? "100");
const BASELINE_P95_OVERRIDE = process.env.BASELINE_P95_MS ? Number(process.env.BASELINE_P95_MS) : null;
const BASELINE_MAX_OVERRIDE = process.env.BASELINE_MAX_MS ? Number(process.env.BASELINE_MAX_MS) : null;

if (Number.isNaN(TOTAL_PASSES) || TOTAL_PASSES < 1) {
  throw new Error(`Invalid PASSES value: ${process.env.PASSES}`);
}

if (Number.isNaN(BATCH_SIZE) || BATCH_SIZE < 1 || BATCH_SIZE > PHRASE_POOL.length) {
  throw new Error(`Invalid BATCH_SIZE value: ${process.env.BATCH_SIZE}`);
}

if (BASELINE_P95_OVERRIDE !== null && Number.isNaN(BASELINE_P95_OVERRIDE)) {
  throw new Error(`Invalid BASELINE_P95_MS value: ${process.env.BASELINE_P95_MS}`);
}

if (BASELINE_MAX_OVERRIDE !== null && Number.isNaN(BASELINE_MAX_OVERRIDE)) {
  throw new Error(`Invalid BASELINE_MAX_MS value: ${process.env.BASELINE_MAX_MS}`);
}

function mulberry32(seed: number): () => number {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickUniqueBatch(pass: number, size: number): SweepPhrase[] {
  const random = mulberry32(pass * 9973 + 17);
  const pool = [...PHRASE_POOL];
  const out: SweepPhrase[] = [];
  while (out.length < size) {
    const idx = Math.floor(random() * pool.length);
    out.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return out;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function computeAliasStats() {
  const aliases = Object.keys(RESPONSIBILITY_ALIASES);
  const totalTokens = aliases.reduce((acc, alias) => acc + alias.trim().split(/\s+/).filter(Boolean).length, 0);
  const avgAliasTokens = aliases.length ? totalTokens / aliases.length : 0;
  return {
    aliasCount: aliases.length,
    avgAliasTokens,
  };
}

function enforceLexiconBudgets(pass: number) {
  const { aliasCount, avgAliasTokens } = computeAliasStats();
  if (aliasCount > SMART_SWEEP_GUARDRAILS.budgets.maxAliases) {
    throw new Error(
      `Lexicon budget exceeded on pass ${pass}: aliasCount=${aliasCount} > maxAliases=${SMART_SWEEP_GUARDRAILS.budgets.maxAliases}`
    );
  }
  if (avgAliasTokens > SMART_SWEEP_GUARDRAILS.budgets.maxAvgAliasTokens) {
    throw new Error(
      `Lexicon budget exceeded on pass ${pass}: avgAliasTokens=${avgAliasTokens.toFixed(2)} > maxAvgAliasTokens=${SMART_SWEEP_GUARDRAILS.budgets.maxAvgAliasTokens}`
    );
  }
}

function runPrePassBenchmark(pass: number, baselineP95: number | null, baselineMax: number | null) {
  // Warm cache/JIT path to reduce noise from first invocation in a pass.
  for (const query of SMART_SWEEP_GUARDRAILS.benchmarkQueries) {
    parseSearchQueryToSchema(query);
  }

  const timings: number[] = [];
  for (const query of SMART_SWEEP_GUARDRAILS.benchmarkQueries) {
    const t0 = performance.now();
    parseSearchQueryToSchema(query);
    timings.push(performance.now() - t0);
  }

  const p95 = percentile(timings, 95);
  const max = Math.max(...timings, 0);
  const p50 = percentile(timings, 50);

  if (p95 > SMART_SWEEP_GUARDRAILS.thresholds.p95AbsoluteMs) {
    throw new Error(
      `Performance guardrail failed on pass ${pass}: p95=${p95.toFixed(2)}ms > ${SMART_SWEEP_GUARDRAILS.thresholds.p95AbsoluteMs}ms`
    );
  }

  if (max > SMART_SWEEP_GUARDRAILS.thresholds.maxAbsoluteMs) {
    throw new Error(
      `Performance guardrail failed on pass ${pass}: max=${max.toFixed(2)}ms > ${SMART_SWEEP_GUARDRAILS.thresholds.maxAbsoluteMs}ms`
    );
  }

  if (baselineP95 !== null) {
    const p95Budget = baselineP95 * (1 + SMART_SWEEP_GUARDRAILS.thresholds.p95RegressionPct / 100);
    if (p95 > p95Budget) {
      throw new Error(
        `Performance regression on pass ${pass}: p95=${p95.toFixed(2)}ms > budget=${p95Budget.toFixed(2)}ms (baseline=${baselineP95.toFixed(2)}ms)`
      );
    }
  }

  if (baselineMax !== null) {
    const maxBudget = baselineMax * (1 + SMART_SWEEP_GUARDRAILS.thresholds.maxRegressionPct / 100);
    if (max > maxBudget) {
      throw new Error(
        `Performance regression on pass ${pass}: max=${max.toFixed(2)}ms > budget=${maxBudget.toFixed(2)}ms (baseline=${baselineMax.toFixed(2)}ms)`
      );
    }
  }

  return { p50, p95, max };
}

const started = Date.now();
let totalChecks = 0;
let totalPassed = 0;
let maxBatchMs = 0;
let maxP95Ms = 0;
let maxSingleQueryMs = 0;
let totalCandidateCount = 0;
let totalFallbackCount = 0;
let baselineP95 = BASELINE_P95_OVERRIDE;
let baselineMax = BASELINE_MAX_OVERRIDE;

for (let pass = 1; pass <= TOTAL_PASSES; pass++) {
  // Guardrail runs before every pass to ensure no performance quality regressions.
  try {
    enforceLexiconBudgets(pass);
    const bench = runPrePassBenchmark(pass, baselineP95, baselineMax);
    if (baselineP95 === null) baselineP95 = bench.p95;
    if (baselineMax === null) baselineMax = bench.max;
    maxP95Ms = Math.max(maxP95Ms, bench.p95);
    maxSingleQueryMs = Math.max(maxSingleQueryMs, bench.max);
  } catch (error) {
    console.error("SWEEP PERFORMANCE FAILURE");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  const batchStart = Date.now();
  const batch = pickUniqueBatch(pass, BATCH_SIZE);
  let passCount = 0;
  let passCandidateCount = 0;
  let passFallbackCount = 0;

  for (const item of batch) {
    const parsed = parseSearchQueryToSchema(item.query);
    const ok = Boolean(parsed.filters.job_title) && !parsed.filters.company;
    const candidateCount = parsed.diagnostics?.candidate_count ?? 0;
    const usedFallback = parsed.diagnostics?.used_fallback ?? false;
    passCandidateCount += candidateCount;
    if (usedFallback) passFallbackCount++;

    if (!ok) {
      console.error("SWEEP FAILURE");
      console.error(JSON.stringify({
        pass,
        query: item.query,
        parsedFilters: parsed.filters,
        semanticHint: parsed.semantic_hint ?? null,
        diagnostics: parsed.diagnostics ?? null,
      }, null, 2));
      process.exit(1);
    }
    passCount++;
  }

  const batchMs = Date.now() - batchStart;
  if (batchMs > maxBatchMs) maxBatchMs = batchMs;
  totalChecks += batch.length;
  totalPassed += passCount;
  totalCandidateCount += passCandidateCount;
  totalFallbackCount += passFallbackCount;

  const candidateAvg = batch.length ? passCandidateCount / batch.length : 0;
  const fallbackRatePct = batch.length ? (passFallbackCount / batch.length) * 100 : 0;

  if (candidateAvg > SMART_SWEEP_GUARDRAILS.budgets.maxCandidateAvg) {
    console.error("SWEEP METRICS FAILURE");
    console.error(
      `Pass ${pass}: candidate_count_avg=${candidateAvg.toFixed(2)} exceeded ${SMART_SWEEP_GUARDRAILS.budgets.maxCandidateAvg}`
    );
    process.exit(1);
  }

  if (fallbackRatePct > SMART_SWEEP_GUARDRAILS.budgets.maxFallbackRatePct) {
    console.error("SWEEP METRICS FAILURE");
    console.error(
      `Pass ${pass}: fallback_rate=${fallbackRatePct.toFixed(2)}% exceeded ${SMART_SWEEP_GUARDRAILS.budgets.maxFallbackRatePct}%`
    );
    process.exit(1);
  }

  if (pass % PROGRESS_EVERY === 0 || pass === 1 || pass === TOTAL_PASSES) {
    console.log(
      `[Sweep] pass ${pass}/${TOTAL_PASSES}: ${passCount}/${batch.length} ` +
      `(elapsed=${Date.now() - started}ms, maxBatch=${maxBatchMs}ms, p95Max=${maxP95Ms.toFixed(2)}ms, fallbackRate=${fallbackRatePct.toFixed(1)}%)`
    );
  }
}

const elapsedMs = Date.now() - started;
const globalCandidateAvg = totalChecks ? totalCandidateCount / totalChecks : 0;
const globalFallbackRatePct = totalChecks ? (totalFallbackCount / totalChecks) * 100 : 0;
console.log(
  `[Sweep] COMPLETE: ${TOTAL_PASSES} passes, ${totalPassed}/${totalChecks} checks passed, ` +
  `elapsed=${elapsedMs}ms, avgPerPass=${(elapsedMs / TOTAL_PASSES).toFixed(2)}ms, maxBatch=${maxBatchMs}ms, ` +
  `p95Max=${maxP95Ms.toFixed(2)}ms, maxSingleQuery=${maxSingleQueryMs.toFixed(2)}ms, ` +
  `candidateAvg=${globalCandidateAvg.toFixed(2)}, fallbackRate=${globalFallbackRatePct.toFixed(2)}%`
);
