# WhoNow NLP Search System Assessment

**Document Version:** 1.0  
**Assessment Date:** 2025-02-07  
**Scope:** Offline, non-LLM natural language search for smart contact book

---

## Executive Summary

WhoNow uses a **rule-based, deterministic** NLP pipeline. The primary flow is:

```
User Query → parseSearchQueryToSchema() → SearchQuery → smart_search_contacts RPC → Results
```

The system has **strong foundations** (responsibility aliases, time patterns, role vocabulary) but **critical gaps** in entity extraction, synonym usage, and multi-intent handling. Most improvements require **dictionary expansion** and **pipeline refinement**—no external APIs or LLMs.

---

# PHASE 1: CURRENT STATE ANALYSIS

## 1.1 Inventory of Language Assets

### 1.1.1 Keyword Dictionaries

| Asset | Location | Size / Notes |
|-------|----------|--------------|
| **ACTION_KEYWORDS** | `searchQueryParser.ts` | 14 entries: email, mail, call, phone, text, sms, dm, "reach out", "direct message" |
| **ROLE_VOCABULARY** | `searchQueryParser.ts` | ~45 terms: departments (hr, sales, marketing, engineering, etc.) + titles (ceo, vp, pm, director, etc.) |
| **QUESTION_STARTERS** | `searchQueryParser.ts` | ~25 terms: who, what, find, show, "i need", "i want", etc. |
| **STOP_WORDS** | `searchQueryParser.ts` | ~60 terms (excludes "add"/"added" for creation-date detection) |
| **RELATIONSHIP_KEYWORDS** | `searchQueryParser.ts` | 8 categories: client, prospect, vendor, investor, friend, colleague, partner, contact |
| **INTERACTION_KEYWORDS** | `searchQueryParser.ts` | 4 types: email (7 variants), call (8), meeting (8), text (4) |
| **NEGATION_KEYWORDS** | `searchQueryParser.ts` | 9 terms: not, except, excluding, without, no, never, etc. |
| **COMPANY_SUFFIXES** | `searchQueryParser.ts` | 18 terms: inc, llc, ltd, corp, solutions, technologies, etc. |

### 1.1.2 Synonym Lists

| Asset | Location | Coverage |
|-------|----------|----------|
| **SYNONYM_MAP** | `searchQueryParser.ts` | ~80 entries: role (ceo, vp, pm, hr), department (engineering, sales, ops), location (sf, nyc, la, dc) |
| **ABBREVIATION_MAP** | `searchQueryParser.ts` | 12 entries: ceo, cto, vp, pm, hr, it, bd, sf, nyc, la, dc |
| **LOCATION_SYNONYMS** | `searchQueryParser.ts` | 7 cities: san francisco, new york, la, washington, chicago, boston, seattle, austin |

### 1.1.3 Phrase Maps

| Asset | Location | Coverage |
|-------|----------|----------|
| **TIME_PATTERNS** | `searchQueryParser.ts` | 12 phrases: "last week", "this week", "last month", "yesterday", "today", "recent", "earlier this week", "in the last X days/weeks/months" |
| **RESPONSIBILITY_ALIASES** | `responsibilityAliases.ts` | **846 phrases** → 17 responsibility IDs (design, engineering, marketing, sales, finance, content, social media, ops, legal, hr, it security, it support, billing, leads, events, contracts, recruiting) |
| **extractNeedsFollowUp** | `searchQueryParser.ts` | 10 patterns: "need to follow up", "haven't talked", "havent contacted", "not contacted", etc. |
| **extractCompanyFromQuestionPatterns** | `searchQueryParser.ts` | 6 regex patterns: "who do I know at X", "who works at X", "who is at X", "at X" |

### 1.1.4 Entity Labels & Semantic Verbs

| Asset | Location | Purpose |
|-------|----------|---------|
| **ENTITY_PREPOSITIONS** | `searchQueryParser.ts` | company: at, from, with, @; location: in, at, from, near; role: as, works |
| **SEMANTIC_VERB_MAP** | `searchQueryParser.ts` | handles, works at, manages, based in, knows, met → entity type hints |
| **RELATIONSHIP_KEYWORDS** | `searchQueryParser.ts` | client, prospect, vendor, investor, friend, colleague, partner |

### 1.1.5 Scoring & Weighting

| Component | Location | Logic |
|-----------|----------|-------|
| **contactSearchEngine** | `contactSearchEngine.ts` | FIELD_WEIGHTS: name=10, role=8, tags=7, address=6, company=4, email/phone=2; MIN_SCORE_THRESHOLD=2.0 |
| **smart_search_contacts** | SQL migration | `ts_rank(search_vector, plainto_tsquery(semantic_hint))` for FTS; no explicit weights |

### 1.1.6 Hard-coded Heuristics

- **Role plural matching** in `contactSearchEngine.roleMatches()`: designers↔designer, engineers↔engineer, ops↔operations
- **Company suffix normalization**: inc/inc./incorporated → inc; llc/l.l.c. → llc
- **Responsibility disambiguation**: longest alias match + RESPONSIBILITIES.priority
- **Time parse order**: combined patterns (day + time-of-day) before standalone patterns
- **add vs interaction**: "add"/"added" → creation date; "call"/"email"/"meet" → interaction date

---

## 1.2 Supported Query Types

| Type | Supported | Example Queries | Notes |
|------|-----------|-----------------|-------|
| **Role-based** | ✅ | "product manager", "vp of sales", "who can make a logo?" | Via ROLE_VOCABULARY, responsibility aliases |
| **Relationship-based** | Partial | "clients", "former clients", "people I met last month" | Tags + isClient; "former" not handled |
| **Status-based** | Partial | "never contacted", "need to follow up" | needsFollowUp patterns; "never contacted" partially via last_contacted filter |
| **Company search** | Partial | "who do I know at Acme?", "contacts at tech solutions inc" | extractCompanyFromQuestionPatterns; **not used by parseSearchQueryToSchema** |
| **Temporal / activity** | ✅ | "who did I add last week?", "who did I call yesterday?" | TIME_PATTERNS, extractTimeRange, extractInteractionTimeRange |
| **Location** | ✅ | "contacts in San Francisco" | LOCATION_SYNONYMS; RPC filters city/state |
| **Multi-intent** | ❌ | "designers I emailed but never followed up with" | No compound filter composition |

---

## 1.3 Failure Modes & Bottlenecks

### 1.3.1 Critical: parseSearchQueryToSchema vs parseSearchQuery

**Issue:** The primary search path (`useSmartSearch` → `parseSearchQueryToSchema`) does **not** use the full `parseSearchQuery` pipeline. As a result:

- **Company extraction** ("who do I know at Acme?") is **not** applied. The query goes to `semantic_hint` (FTS) only.
- **Role extraction** ("product managers at Acme") — roles come from responsibility matching, not entity extraction.
- **Negation** — negated entities (e.g., "not from Acme") are not extracted.

**Impact:** Queries like "who do I know at quantum solutions?" may return weak results because company is not passed as a structured filter.

### 1.3.2 Partial Matches, Weak Results

- **"Head of Growth"** → Not in ROLE_VOCABULARY; "growth" may match marketing, but "Head of" is not normalized.
- **"pinged" / "slacked" / "reached out"** → Not in INTERACTION_KEYWORDS; only "emailed", "called", "met", "texted".
- **"designers I never followed up with"** → needsFollowUp + responsibility could work, but "designers" must match responsibility; "never followed up" is not explicitly parsed.

### 1.3.3 Natural Phrasing Not Supported

- **"people I met a while ago"** — "a while ago" not in TIME_PATTERNS.
- **"recently added"** — "recent" exists; "recently" may not be normalized.
- **"probably a client"** — Fuzzy qualifiers ignored.
- **"someone who handles billing"** — Responsibility phrase; "handles billing" may match RESP_FINANCE_BILLING via "billing", but "handles" is in SEMANTIC_VERB_MAP.

### 1.3.4 Vocabulary Gaps

| Category | Missing Terms |
|----------|---------------|
| **Verbs (contact)** | pinged, reached out, slacked, dmed, messaged, connected with, touched base |
| **Role titles** | Head of X, Growth Lead, RevOps, DevRel, Solutions Architect |
| **Temporal** | a while ago, recently, last quarter, q4, ages ago, ages |
| **Relationship** | former client, ex-client, warm intro, cold contact |
| **Status** | ghosted, no response, never replied, dropped off |

### 1.3.5 Stale / Duplicated Code

- **supabase/functions/parse-search-query/index.ts**: Minimal parser with smaller ROLE_VOCABULARY and ACTION_KEYWORDS. Not used by primary flow.
- **contactSearchEngine.ts**: Deprecated; has bug (`searchQuery` vs `parsedQuery`); embeddings disabled.

---

# PHASE 2: LANGUAGE GAP MAPPING

## 2.1 By Query Type

### 2.1.1 Role-Based Searches

| Canonical | Currently Supported | Missing Alternatives |
|-----------|---------------------|----------------------|
| product manager | pm, product manager, project manager | pproduct lead, PM |
| VP of sales | vp, vice president, sales | head of sales, sales lead, rev ops |
| designer | designer, designers, design | UX designer, product designer, visual designer |
| engineer | engineer, developer, dev, swe | software engineer, eng, tech lead |
| Head of X | (partial via "head") | Growth Lead, Head of Marketing, etc. |

### 2.1.2 Relationship-Based Searches

| Canonical | Currently Supported | Missing Alternatives |
|-----------|---------------------|----------------------|
| client | client, clients, customer | former client, ex-client, current client |
| colleague | colleague, coworker, teammate | worked with, used to work with |
| met | met, meet, meeting | connected with, was introduced to, intro |

### 2.1.3 Interaction / Contact Verbs

| Canonical | Currently Supported | Missing Alternatives |
|-----------|---------------------|----------------------|
| email | email, emailed, mail, mailed, message, sent | pinged, reached out, wrote, dropped a line |
| call | call, called, phone, phoned, dial, ring | gave a call, gave them a ring |
| text | text, texted, sms, messaged | dmed, slacked, whatsapped |
| meet | meet, met, meeting, intro | connected, had a call, had a meeting |

### 2.1.4 Temporal Expressions

| Canonical | Currently Supported | Missing Alternatives |
|-----------|---------------------|----------------------|
| last week | last week, this week | past week, previous week |
| recently | recent | recently, lately, of late |
| a while ago | — | a while ago, ages ago, long time ago |
| last quarter | — | last quarter, q4, q1 |
| yesterday | yesterday, today | the other day |

### 2.1.5 Follow-Up / Status

| Canonical | Currently Supported | Missing Alternatives |
|-----------|---------------------|----------------------|
| need follow up | need to follow up, need follow up, should follow up | need to reach out, overdue to contact |
| haven't talked | haven't talked, haven't contacted | ghosted, no response, never replied, fell through the cracks |

---

## 2.2 Gap Categories

| Category | Examples |
|----------|----------|
| **Synonym expansion** | emailed → reached out, pinged, wrote; called → gave a ring |
| **Role normalization** | Head of Growth → growth, marketing; RevOps → sales, operations |
| **Relationship soft language** | knows → colleague; worked with → colleague; introduced by → met |
| **Temporal expressions** | recently, a while ago, last quarter, q4 |
| **Fuzzy qualifiers** | probably, mostly, kind of → (Tier 3: soft signals, never hard filters) |

---

# PHASE 3: DICTIONARY EXPANSION STRATEGY

## 3.1 Proposed Dictionary Schema

```ts
interface DictionaryEntry {
  canonical: string;           // Primary term for indexing
  synonyms: string[];          // Alternate forms
  pos?: "noun" | "verb" | "adj" | "phrase";
  entityType?: "role" | "department" | "relationship" | "action" | "temporal";
  weight?: number;             // 0-1, for ranking boost (optional)
  conflicts?: string[];        // Terms that should NOT match when this is intended
}
```

## 3.2 Tiered Expansion Plan

### Tier 1: High-Confidence Synonyms (Safe, Deterministic)

Add to existing maps without changing behavior. One-to-one mapping.

| Map | Additions |
|-----|-----------|
| INTERACTION_KEYWORDS.email | reached out, pinged, wrote, dropped a line |
| INTERACTION_KEYWORDS.call | gave a call, gave them a ring |
| INTERACTION_KEYWORDS.text | dmed, slacked, messaged (if not duplicate) |
| INTERACTION_KEYWORDS.meeting | connected, had a call, had a meeting, intro'd |
| SYNONYM_MAP (roles) | "head of growth" → ["growth", "marketing"], "revops" → ["sales", "operations"] |
| TIME_PATTERNS | "recently" → same as "recent", "a while ago" → 30 days, "last quarter" → 90 days |

### Tier 2: Context-Dependent Expansions

Require phrase context. E.g., "former client" → relationship=client + status=former (if we add status).

| Expansion | Condition | Mapping |
|-----------|-----------|---------|
| "former" + relationship | "former client" | client + exclude recent? (complex) |
| "ex-" prefix | "ex-client" | client |
| "never" + contact verb | "never contacted" | last_contacted_at IS NULL |

### Tier 3: Soft Language (Weighted Signals, Never Hard Filters)

| Term | Action |
|------|--------|
| probably, mostly, kind of | Ignore for filtering; optionally log for UX |
| may have, might be | Same |

## 3.3 What NOT to Expand

- **Company names** — User-specific; do not add to static dictionary.
- **Ambiguous abbreviations** — e.g., "PM" could be product manager or project manager; keep context-dependent.
- **Overly broad terms** — "contact" as relationship is too generic; avoid expanding to "person".
- **Non-deterministic mappings** — No ML-based synonyms; all expansions must be explicit.

---

# PHASE 4: QUERY NORMALIZATION PIPELINE

## 4.1 Preprocessing Pipeline Design

```
1. Tokenization     → split on whitespace, normalize unicode
2. Canonicalization → lowercase, trim, remove trailing punctuation
3. Synonym folding  → replace alternates with canonical (use SYNONYM_MAP, ABBREVIATION_MAP)
4. Phrase collapse  → "last week" → single token or range; "reach out" → "email" or "call" (context)
5. Noise removal    → strip STOP_WORDS from keyword extraction (not from pattern matching)
```

## 4.2 Explainable Transformations

| Transformation | Input | Output | Rationale |
|----------------|-------|--------|-----------|
| Verb normalization | "pinged" | "email" | INTERACTION_KEYWORDS expansion |
| Role normalization | "Head of Growth" | "growth" + "marketing" | SYNONYM_MAP / ROLE_VOCABULARY |
| Relationship inference | "worked with" | "colleague" | RELATIONSHIP_KEYWORDS |
| Temporal softening | "a while ago" | last 30 days | TIME_PATTERNS addition |

## 4.3 Integration Points

| File | Function | Change |
|------|----------|--------|
| `searchQueryParser.ts` | `normalizeQuery()` | Add optional synonym folding step |
| `searchQueryParser.ts` | `INTERACTION_KEYWORDS` | Expand with Tier 1 synonyms |
| `searchQueryParser.ts` | `TIME_PATTERNS` | Add "recently", "a while ago", "last quarter" |
| `searchQueryParser.ts` | `parseSearchQueryToSchema()` | **Call parseSearchQuery first**, then map entities to SearchQuery filters (company, role, etc.) |
| `responsibilityAliases.ts` | — | Add "never followed up", "ghosted" → appropriate responsibility or new "needs outreach" tag |

---

# PHASE 5: VALIDATION & SAFETY

## 5.1 Test Cases

### Before/After Query-Result Comparisons

| Query | Expected Behavior | Regression Check |
|-------|-------------------|------------------|
| "who do I know at Acme?" | Filters by company=Acme | Yes |
| "product managers" | Filters by job_title containing "product" or "manager" | Yes |
| "who did I call last week?" | Filters by last_contacted in last 7 days | Yes |
| "designers I need to follow up with" | Responsibility=design + needsFollowUp | Yes |

### Edge Cases

| Query | Expected |
|-------|----------|
| "" | Return all contacts |
| "asdfgh" | No results or fallback |
| "not from Acme" | Exclude company=Acme (if negation supported) |
| "pm" | Ambiguous; prefer product/project manager context |

### Regression Tests

- Existing tests in `searchIntegrity.test.ts` must pass.
- Add tests for new synonym expansions.
- Add tests for parseSearchQuery → parseSearchQueryToSchema integration (if merged).

## 5.2 Logging & Metrics

| Metric | Purpose |
|--------|---------|
| Unmatched token tracking | Log tokens that did not match any dictionary; feed expansion backlog |
| Low-confidence match detection | When semantic_hint used but no structured filters; indicate fallback |
| Dictionary growth effectiveness | A/B or before/after: recall@10 for sample query set |

---

# FINAL OUTPUT

## Audit Summary

| Dimension | Status | Notes |
|-----------|--------|-------|
| **Coverage** | Moderate | Responsibility aliases strong; entity extraction underused |
| **Determinism** | Good | Rule-based; no LLM in primary path |
| **Offline** | Yes | All logic client + Supabase SQL |
| **Explainability** | Good | interpretation/explanations generated |
| **Main bottleneck** | parseSearchQueryToSchema not using full parse | Company/role not passed as filters |

## Prioritized Expansion Roadmap

1. **P0 — Fix parseSearchQueryToSchema**  
   Use `parseSearchQuery()` output to populate `filters.company`, `filters.job_title`, `filters.relationship_type` instead of relying only on responsibility + semantic_hint.

2. **P1 — Tier 1 synonym expansion**  
   Add interaction verbs (pinged, reached out, dmed), temporal phrases (recently, a while ago, last quarter), role normalizations (Head of X, RevOps).

3. **P2 — Follow-up phrase expansion**  
   Add "ghosted", "no response", "never replied" to needsFollowUp patterns.

4. **P3 — Relationship soft language**  
   Add "worked with" → colleague, "introduced by" → met.

5. **P4 — Consolidate & deprecate**  
   Remove or update stale `parse-search-query` edge function; fix `contactSearchEngine` bug.

## Example Dictionary Entries (Copy-Paste Ready)

```ts
// INTERACTION_KEYWORDS expansion
const INTERACTION_KEYWORDS = {
  email: ["email", "emailed", "mail", "mailed", "message", "messaged", "sent", "pinged", "reached out", "wrote"],
  call: ["call", "called", "phone", "phoned", "ring", "rang", "dial", "dialed", "gave a call"],
  meeting: ["meet", "met", "meeting", "met with", "saw", "see", "introduction", "intro", "connected", "had a meeting"],
  text: ["text", "texted", "sms", "messaged", "dmed", "slacked"],
};

// TIME_PATTERNS additions
"recently": () => { const end = new Date(); const start = new Date(); start.setDate(end.getDate() - 7); return { start, end }; },
"a while ago": () => { const end = new Date(); const start = new Date(); start.setDate(end.getDate() - 30); return { start, end }; },
"last quarter": () => { const end = new Date(); const start = new Date(); start.setMonth(end.getMonth() - 3); return { start, end }; },

// extractNeedsFollowUp additions
"ghosted", "no response", "never replied", "never got back", "fell through the cracks",
```

## Code-Level Integration Points

| File | Function / Area | Change |
|------|-----------------|--------|
| `src/utils/searchQueryParser.ts` | `parseSearchQueryToSchema` | Invoke `parseSearchQuery`, map `entities.companies[0]` → `filters.company`, `entities.roles[0]` → `filters.job_title`, etc. |
| `src/utils/searchQueryParser.ts` | `INTERACTION_KEYWORDS` | Add Tier 1 synonyms |
| `src/utils/searchQueryParser.ts` | `TIME_PATTERNS` | Add recently, a while ago, last quarter |
| `src/utils/searchQueryParser.ts` | `extractNeedsFollowUp` | Add ghosted, no response, never replied |
| `src/data/responsibilityAliases.ts` | — | Add role variants: "head of growth", "revops" (if not duplicate) |

## Constraints Reminder

- **Do NOT** introduce: external APIs, generative models, large model downloads, non-deterministic ranking.
- **Do** optimize for: recall, user trust, MVP robustness.

---

*End of assessment.*
