/**
 * Query Merge & Confidence Gate (Enhanced)
 * Merges deterministic and semantic queries with conflict detection and detailed logging
 */

import { SearchQuery, SearchQueryFilters } from "@/types/searchQuery";
import { isDebugMode } from "@/utils/ai";

export interface MergeDecisions {
  conflictsDetected: string[];
  semanticFieldsUsed: string[];
  confidenceGate: 'passed' | 'failed';
  deterministicPreserved: string[];
  locationRemoved: boolean;
}

export interface MergeResult {
  merged: SearchQuery;
  decisions: MergeDecisions;
}

/**
 * Merge deterministic and semantic queries (enhanced with metadata)
 * Deterministic fields always win, semantic only fills gaps
 */
export function mergeQueries(
  deterministic: SearchQuery,
  semantic?: SearchQuery | null
): SearchQuery {
  const result = mergeQueriesWithMetadata(deterministic, semantic);
  
  // Log merge decisions in debug mode
  if (isDebugMode() && semantic) {
    console.log('[Merge] Merge decisions:', result.decisions);
  }
  
  return result.merged;
}

/**
 * Merge queries with detailed metadata
 */
export function mergeQueriesWithMetadata(
  deterministic: SearchQuery,
  semantic?: SearchQuery | null
): MergeResult {
  const decisions: MergeDecisions = {
    conflictsDetected: [],
    semanticFieldsUsed: [],
    confidenceGate: 'passed',
    deterministicPreserved: [],
    locationRemoved: false,
  };
  
  if (!semantic) {
    return {
      merged: deterministic,
      decisions: {
        ...decisions,
        confidenceGate: 'failed',
      },
    };
  }

  // Deterministic fields always win
  const merged: SearchQuery = {
    ...deterministic,
    semantic_hint: semantic.semantic_hint || deterministic.semantic_hint,
  };
  
  // Track if semantic_hint was used
  if (semantic.semantic_hint && !deterministic.semantic_hint) {
    decisions.semanticFieldsUsed.push('semantic_hint');
  }

  // Reject semantic output if confidence decreases
  if (semantic.confidence < deterministic.confidence) {
    decisions.confidenceGate = 'failed';
    
    if (isDebugMode()) {
      console.log(`[Merge] Confidence gate failed: ${semantic.confidence} < ${deterministic.confidence}`);
    }
    
    return { merged, decisions };
  }

  // Check for field conflicts
  const conflicts = detectConflicts(deterministic.filters, semantic.filters);
  if (conflicts.length > 0) {
    decisions.conflictsDetected = conflicts;
    
    if (isDebugMode()) {
      console.log(`[Merge] Conflicts detected in fields: ${conflicts.join(', ')}`);
    }
    
    // Keep deterministic filters, but allow semantic_hint
    return { merged, decisions };
  }

  // Merge filters: deterministic takes precedence
  const deterministicKeys = Object.keys(deterministic.filters).filter(
    key => deterministic.filters[key as keyof SearchQueryFilters] !== undefined
  );
  const semanticKeys = Object.keys(semantic.filters).filter(
    key => semantic.filters[key as keyof SearchQueryFilters] !== undefined
  );
  
  // Track which deterministic fields were preserved
  decisions.deterministicPreserved = deterministicKeys;
  
  // Start with semantic filters, then override with deterministic
  merged.filters = {
    ...semantic.filters,
    ...deterministic.filters, // Deterministic overrides semantic
  };
  
  // Track which semantic fields were actually used (not overridden)
  semanticKeys.forEach(key => {
    if (!deterministicKeys.includes(key)) {
      decisions.semanticFieldsUsed.push(key);
    }
  });
  
  // Remove location from semantic if deterministic doesn't have it
  // This prevents LLM from inferring locations that weren't in the query
  if (!deterministic.filters.location && semantic.filters.location) {
    delete merged.filters.location;
    decisions.locationRemoved = true;
    
    if (isDebugMode()) {
      console.log('[Merge] Removed semantic location (not in deterministic query)');
    }
  }

  // Use higher confidence
  merged.confidence = Math.max(deterministic.confidence, semantic.confidence);

  // Combine explanations
  if (semantic.explanation && semantic.explanation !== deterministic.explanation) {
    merged.explanation = `${deterministic.explanation} ${semantic.explanation}`.trim();
  }

  // Final validation: Ensure deterministic fields weren't overridden
  for (const key of deterministicKeys) {
    const filterKey = key as keyof SearchQueryFilters;
    if (merged.filters[filterKey] !== deterministic.filters[filterKey]) {
      console.error(`[Merge] ERROR: Deterministic field "${key}" was overridden!`);
      // Force restore deterministic value
      merged.filters[filterKey] = deterministic.filters[filterKey];
    }
  }

  return { merged, decisions };
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
