export interface SweepGuardrailConfig {
  benchmarkQueries: string[];
  thresholds: {
    p95AbsoluteMs: number;
    maxAbsoluteMs: number;
    p95RegressionPct: number;
    maxRegressionPct: number;
  };
  budgets: {
    maxAliases: number;
    maxAvgAliasTokens: number;
    maxCandidateAvg: number;
    maxFallbackRatePct: number;
  };
}

export const SMART_SWEEP_GUARDRAILS: SweepGuardrailConfig = {
  benchmarkQueries: [
    "legal counsel",
    "contract writing",
    "I need help with a contract",
    "sales contact",
    "someone for marketing",
    "it help",
    "who did i call last week",
    "who do i know at acme",
    "find me a designer",
    "find me an engineer",
    "content writing",
    "hr person",
    "operations manager",
    "product manager",
    "account executive",
    "software engineer",
    "plumber",
    "electrician",
    "delivery driver",
    "dog groomer",
    "vet tech",
    "paramedic",
    "social worker",
    "security guard",
    "nanny",
    "tutor",
    "real estate agent",
    "photographer",
    "chef",
    "bartender",
    "landscaper",
    "house cleaner",
    "window cleaner",
    "pool technician",
    "hvac technician",
    "locksmith",
    "translator",
    "interpreter",
    "bookkeeper",
    "tax preparer",
    "wedding planner",
    "event planner",
    "music teacher",
    "driving instructor",
    "dentist",
    "pharmacist",
    "physical therapist",
    "occupational therapist",
    "speech therapist",
    "forklift operator",
  ],
  thresholds: {
    p95AbsoluteMs: 12,
    maxAbsoluteMs: 30,
    p95RegressionPct: 20,
    maxRegressionPct: 25,
  },
  budgets: {
    maxAliases: 2500,
    maxAvgAliasTokens: 4.5,
    maxCandidateAvg: 20,
    maxFallbackRatePct: 95,
  },
};

