/**
 * Browser/PWA Semantic Assist Adapter
 * Uses unified LLM adapter for query parsing
 * Same AI-powered experience as desktop
 */

import { SearchQuery } from "@/types/searchQuery";
import { semanticAssistUnified } from "./unifiedLLMAdapter";

/**
 * Semantic assist for browser/PWA platform
 * Uses unified LLM adapter for AI-powered query parsing
 */
export async function semanticAssistBrowser(
  query: string,
  deterministicQuery: SearchQuery
): Promise<SearchQuery | null> {
  try {
    // Use unified LLM adapter (same as desktop)
    const enhanced = await semanticAssistUnified(query, deterministicQuery);
    
    if (enhanced) {
      return enhanced;
    }

    // Fallback to deterministic query
    return deterministicQuery;
  } catch (error) {
    console.warn("Browser semantic assist failed:", error);
    return deterministicQuery;
  }
}
