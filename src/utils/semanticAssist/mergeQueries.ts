/**
 * Query Merge & Confidence Gate
 * Merges deterministic and semantic queries with conflict detection
 */

import { SearchQuery, SearchQueryFilters } from "@/types/searchQuery";

/**
 * Merge deterministic and semantic queries
 * Deterministic fields always win, semantic only fills gaps
 */
export function mergeQueries(
  deterministic: SearchQuery,
  semantic?: SearchQuery | null
): SearchQuery {
  if (!semantic) return deterministic;

  // Deterministic fields always win
  const merged: SearchQuery = {
    ...deterministic,
    semantic_hint: semantic.semantic_hint || deterministic.semantic_hint,
  };

  // Reject semantic output if confidence decreases
  if (semantic.confidence < deterministic.confidence) {
    return merged; // Keep deterministic, but allow semantic_hint
  }

  // Check for field conflicts
  const conflicts = detectConflicts(deterministic.filters, semantic.filters);
  if (conflicts.length > 0) {
    // Keep deterministic filters, but allow semantic_hint
    return merged;
  }

  // Only fill missing fields from semantic (don't override deterministic)
  merged.filters = {
    ...semantic.filters,
    ...deterministic.filters, // Deterministic overrides semantic
  };

  // Use higher confidence
  merged.confidence = Math.max(deterministic.confidence, semantic.confidence);

  // Combine explanations
  if (semantic.explanation && semantic.explanation !== deterministic.explanation) {
    merged.explanation = `${deterministic.explanation} ${semantic.explanation}`.trim();
  }

  return merged;
}

/**
 * Detect conflicts between deterministic and semantic filters
 */
function detectConflicts(
  deterministic: SearchQueryFilters,
  semantic: SearchQueryFilters
): string[] {
  const conflicts: string[] = [];

  // Check for conflicting company values
  if (
    deterministic.company &&
    semantic.company &&
    deterministic.company.toLowerCase().trim() !== semantic.company.toLowerCase().trim()
  ) {
    conflicts.push("company");
  }

  // Check for conflicting job_title values
  if (
    deterministic.job_title &&
    semantic.job_title &&
    deterministic.job_title.toLowerCase().trim() !== semantic.job_title.toLowerCase().trim()
  ) {
    conflicts.push("job_title");
  }

  // Check for conflicting name values
  if (
    deterministic.name &&
    semantic.name &&
    deterministic.name.toLowerCase().trim() !== semantic.name.toLowerCase().trim()
  ) {
    conflicts.push("name");
  }

  // Check for conflicting location values
  if (
    deterministic.location &&
    semantic.location &&
    deterministic.location.toLowerCase().trim() !== semantic.location.toLowerCase().trim()
  ) {
    conflicts.push("location");
  }

  // Check for conflicting relationship_type values
  if (
    deterministic.relationship_type &&
    semantic.relationship_type &&
    deterministic.relationship_type !== semantic.relationship_type
  ) {
    conflicts.push("relationship_type");
  }

  // Check for conflicting date_range values (if both exist and don't overlap)
  if (deterministic.date_range && semantic.date_range) {
    const detFrom = new Date(deterministic.date_range.from);
    const detTo = new Date(deterministic.date_range.to);
    const semFrom = new Date(semantic.date_range.from);
    const semTo = new Date(semantic.date_range.to);

    // If ranges don't overlap at all, it's a conflict
    if (detTo < semFrom || semTo < detFrom) {
      conflicts.push("date_range");
    }
  }

  return conflicts;
}
