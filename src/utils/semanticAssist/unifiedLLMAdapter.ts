/**
 * Unified Semantic Query Enhancement
 * Classical NLP approach - no models, no downloads
 * 
 * Features:
 * - Synonym expansion
 * - Responsibility inference
 * - Intent classification
 * - 0MB, instant, deterministic
 */

import { SearchQuery } from "@/types/searchQuery";
import { getAIConfig, isQueryParsingEnabled, isDebugMode } from "@/utils/ai";
import {
  getCachedParsedQuery,
  cacheParsedQuery,
} from "./modelCache";
import { enhanceQueryWithClassicalNLP } from "./classicalNLP";
import { devLog } from "@/lib/devLog";

/**
 * Main entry point - semantic assist with classical NLP
 */
export async function semanticAssistUnified(
  query: string,
  fallback: SearchQuery
): Promise<SearchQuery> {
  try {
    // Check if AI is enabled
    if (!isQueryParsingEnabled()) {
      if (isDebugMode()) {
        devLog('[Semantic] Query enhancement not enabled');
      }
      return fallback;
    }
    
    if (isDebugMode()) {
      devLog('[Semantic] Processing query:', query);
    }

    // Check cache first
    const cached = await getCachedParsedQuery(query);
    if (cached) {
      if (isDebugMode()) {
        devLog('[Semantic] Using cached result');
      }
      return cached;
    }

    // Enhance with classical NLP
    const enhanced = enhanceQueryWithClassicalNLP(query, fallback);

    // Cache result
    if (enhanced !== fallback) {
      await cacheParsedQuery(query, enhanced);
    }

    if (isDebugMode()) {
      devLog('[Semantic] Enhanced query:', enhanced);
    }

    return enhanced;
  } catch (error) {
    if (isDebugMode()) {
      console.error('[Semantic] Enhancement failed:', error);
    }
    return fallback;
  }
}
