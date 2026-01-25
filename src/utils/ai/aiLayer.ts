/**
 * AI Layer Abstraction
 * Single entry point for all AI functionality with safety guarantees
 * 
 * Key Principles:
 * - Never throws errors, always returns fallback
 * - Respects user preferences (opt-in/opt-out)
 * - Implements circuit breaker pattern
 * - Timeout enforcement
 * - Comprehensive monitoring
 * 
 * This layer sits between the UI and the underlying AI models, ensuring
 * that the deterministic search always works regardless of AI state.
 */

import { SearchQuery } from "@/types/searchQuery";
import { getAIConfig, isQueryParsingEnabled } from "./aiConfig";
import { trackQuery, shouldTripCircuitBreaker, resetCircuitBreaker, updateModelStatus } from "./aiMonitor";
import { semanticAssistUnified } from "../semanticAssist/unifiedLLMAdapter";
import { parseSearchQueryToSchema } from "../searchQueryParser";

export interface AIMetadata {
  aiUsed: boolean;
  fallbackReason?: string;
  confidence: number;
  latencyMs: number;
  modelLoaded: boolean;
  source: 'ai' | 'deterministic' | 'hybrid';
}

export interface AIEnhancement {
  enhanced: SearchQuery | null;
  metadata: AIMetadata;
}

// Circuit breaker state
let circuitBreakerTripped = false;
let lastCircuitBreakerCheck = Date.now();
const CIRCUIT_BREAKER_RESET_INTERVAL = 60000; // 1 minute

/**
 * Check and potentially reset circuit breaker
 */
function checkCircuitBreaker(): boolean {
  const config = getAIConfig();
  const now = Date.now();
  
  // Reset circuit breaker after interval
  if (circuitBreakerTripped && now - lastCircuitBreakerCheck > CIRCUIT_BREAKER_RESET_INTERVAL) {
    console.log('[AI Layer] Circuit breaker reset after cooldown');
    circuitBreakerTripped = false;
    resetCircuitBreaker();
  }
  
  // Check if should trip
  if (shouldTripCircuitBreaker(config.performance.maxConsecutiveFailures)) {
    if (!circuitBreakerTripped) {
      console.warn('[AI Layer] Circuit breaker tripped - too many consecutive failures');
      circuitBreakerTripped = true;
      lastCircuitBreakerCheck = now;
    }
    return true;
  }
  
  return false;
}

/**
 * Enhance query with AI (main entry point)
 * 
 * This function NEVER throws. It always returns a valid result, falling back
 * to deterministic parsing if anything goes wrong.
 */
export async function enhanceQuery(
  query: string,
  deterministicQuery: SearchQuery
): Promise<AIEnhancement> {
  const startTime = Date.now();
  const config = getAIConfig();
  
  // Pre-flight checks
  
  // 1. Check if AI is enabled at all
  if (!config.features.enableAI) {
    return createFallbackResult(
      deterministicQuery,
      'AI disabled by configuration',
      startTime
    );
  }
  
  // 2. Check if query parsing is enabled
  if (!isQueryParsingEnabled()) {
    return createFallbackResult(
      deterministicQuery,
      'Semantic query parsing not enabled (user opt-in required)',
      startTime
    );
  }
  
  // 3. Check circuit breaker
  if (checkCircuitBreaker()) {
    return createFallbackResult(
      deterministicQuery,
      'Circuit breaker tripped (too many recent failures)',
      startTime
    );
  }
  
  // 4. Validate input
  if (!query || query.trim().length === 0) {
    return createFallbackResult(
      deterministicQuery,
      'Empty query',
      startTime
    );
  }
  
  // Attempt AI enhancement with timeout
  try {
    const timeoutMs = config.performance.queryParsingTimeoutMs;
    const enhancementPromise = attemptAIEnhancement(query, deterministicQuery);
    const timeoutPromise = new Promise<AIEnhancement>((resolve) => {
      setTimeout(() => {
        resolve(createFallbackResult(
          deterministicQuery,
          `AI timeout after ${timeoutMs}ms`,
          startTime
        ));
      }, timeoutMs);
    });
    
    const result = await Promise.race([enhancementPromise, timeoutPromise]);
    
    // Track the result
    await trackQuery(query, {
      aiUsed: result.metadata.aiUsed,
      confidence: result.metadata.confidence,
      latencyMs: result.metadata.latencyMs,
      fallbackReason: result.metadata.fallbackReason,
    });
    
    return result;
  } catch (error: any) {
    console.warn('[AI Layer] Unexpected error during enhancement:', error);
    
    const result = createFallbackResult(
      deterministicQuery,
      `Unexpected error: ${error.message || 'Unknown'}`,
      startTime
    );
    
    await trackQuery(query, {
      aiUsed: false,
      confidence: 0,
      latencyMs: Date.now() - startTime,
      fallbackReason: result.metadata.fallbackReason,
      error: error.message,
    });
    
    return result;
  }
}

/**
 * Attempt AI enhancement (internal)
 */
async function attemptAIEnhancement(
  query: string,
  deterministicQuery: SearchQuery
): Promise<AIEnhancement> {
  const startTime = Date.now();
  const config = getAIConfig();
  
  try {
    // Call semantic assist (unified adapter handles model loading)
    const enhanced = await semanticAssistUnified(query, deterministicQuery);
    
    if (!enhanced) {
      return createFallbackResult(
        deterministicQuery,
        'Semantic assist returned null',
        startTime
      );
    }
    
    // Check confidence threshold
    if (enhanced.confidence < config.performance.minConfidenceThreshold) {
      return createFallbackResult(
        deterministicQuery,
        `Low confidence (${enhanced.confidence.toFixed(2)} < ${config.performance.minConfidenceThreshold})`,
        startTime
      );
    }
    
    // Success!
    updateModelStatus('t5', true);
    
    return {
      enhanced,
      metadata: {
        aiUsed: true,
        confidence: enhanced.confidence,
        latencyMs: Date.now() - startTime,
        modelLoaded: true,
        source: 'ai',
      },
    };
  } catch (error: any) {
    console.warn('[AI Layer] AI enhancement failed:', error);
    updateModelStatus('t5', false);
    
    return createFallbackResult(
      deterministicQuery,
      `AI enhancement error: ${error.message || 'Unknown'}`,
      startTime
    );
  }
}

/**
 * Create fallback result (deterministic only)
 */
function createFallbackResult(
  deterministicQuery: SearchQuery,
  reason: string,
  startTime: number
): AIEnhancement {
  return {
    enhanced: deterministicQuery,
    metadata: {
      aiUsed: false,
      fallbackReason: reason,
      confidence: deterministicQuery.confidence,
      latencyMs: Date.now() - startTime,
      modelLoaded: false,
      source: 'deterministic',
    },
  };
}

/**
 * Quick check if AI enhancement is available
 * (Used by UI to show/hide AI features)
 */
export function isAIAvailable(): boolean {
  const config = getAIConfig();
  return config.features.enableAI && 
         isQueryParsingEnabled() &&
         !checkCircuitBreaker();
}

/**
 * Get AI status for debugging
 */
export function getAIStatus(): {
  available: boolean;
  circuitBreakerTripped: boolean;
  queryParsingEnabled: boolean;
  semanticRankingEnabled: boolean;
  platform: string;
} {
  const config = getAIConfig();
  
  return {
    available: isAIAvailable(),
    circuitBreakerTripped: checkCircuitBreaker(),
    queryParsingEnabled: isQueryParsingEnabled(),
    semanticRankingEnabled: config.features.enableSemanticRanking,
    platform: config.platform,
  };
}

/**
 * Manually reset circuit breaker (for debugging)
 */
export function forceResetCircuitBreaker(): void {
  circuitBreakerTripped = false;
  resetCircuitBreaker();
  console.log('[AI Layer] Circuit breaker manually reset');
}
