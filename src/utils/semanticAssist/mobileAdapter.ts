/**
 * Mobile Semantic Assist Adapter
 * Uses unified LLM adapter for AI-powered query parsing
 * Same AI-powered experience as desktop and browser
 */

import { SearchQuery } from "@/types/searchQuery";
import { semanticAssistUnified } from "./unifiedLLMAdapter";

/**
 * Semantic assist for mobile platform
 * Uses unified LLM adapter (optimized for mobile with lazy loading and caching)
 */
export async function semanticAssistMobile(
  query: string,
  deterministicQuery: SearchQuery
): Promise<SearchQuery | null> {
  try {
    // Use unified LLM adapter (same as desktop/browser)
    // The unified adapter handles lazy loading and caching automatically
    const enhanced = await semanticAssistUnified(query, deterministicQuery);
    
    if (enhanced) {
      return enhanced;
    }

    // Fallback to deterministic query
    return deterministicQuery;
  } catch (error) {
    console.warn("Mobile semantic assist failed:", error);
    return deterministicQuery;
  }
}
