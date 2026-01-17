/**
 * Semantic Assist Router
 * Routes to platform-specific semantic assist adapters
 */

import { SearchQuery } from "@/types/searchQuery";
import { detectPlatform } from "@/utils/platformDetection";
import { semanticAssistDesktop } from "./desktopAdapter";
import { semanticAssistMobile } from "./mobileAdapter";
import { semanticAssistBrowser } from "./browserAdapter";
import { mergeQueries } from "./mergeQueries";

/**
 * Apply semantic assist based on platform
 * Always falls back to deterministic if semantic assist fails
 */
export async function semanticAssist(
  query: string,
  deterministicQuery: SearchQuery
): Promise<SearchQuery> {
  const platform = detectPlatform();

  let enhanced: SearchQuery | null = null;

  try {
    switch (platform) {
      case "desktop":
        enhanced = await semanticAssistDesktop(query, deterministicQuery);
        break;
      case "mobile":
        enhanced = await semanticAssistMobile(query, deterministicQuery);
        break;
      case "browser":
      case "pwa":
        enhanced = await semanticAssistBrowser(query, deterministicQuery);
        break;
    }
  } catch (error) {
    // Semantic assist failed - fallback to deterministic
    console.warn("Semantic assist failed, using deterministic only:", error);
  }

  // Merge with confidence gating
  return mergeQueries(deterministicQuery, enhanced);
}
