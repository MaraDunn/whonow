import { describe, it, expect } from "vitest";
import { parseSearchQueryToSchema } from "../searchQueryParser";

const EXPANDED_ROLE_PHRASES = [
  "breeder",
  "delivery driver",
  "dog groomer",
  "plumber",
  "electrician",
  "mechanic",
  "nanny",
  "tutor",
  "real estate agent",
  "photographer",
  "videographer",
  "farrier",
  "veterinarian",
  "chef",
  "bartender",
  "carpenter",
  "personal trainer",
  "massage therapist",
  "landscaper",
  "house cleaner",
];

describe("Smart Search expanded role sweep", () => {
  for (const phrase of EXPANDED_ROLE_PHRASES) {
    it(`parses "${phrase}" into structured filters`, () => {
      const parsed = parseSearchQueryToSchema(phrase);

      // Broader role coverage should produce a structured role filter,
      // not semantic-only free-text search.
      expect(parsed.filters.job_title).toBeTruthy();
      expect(parsed.filters.company).toBeUndefined();
    });
  }
});
