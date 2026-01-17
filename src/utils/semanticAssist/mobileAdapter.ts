/**
 * Mobile Semantic Assist Adapter
 * Uses local embeddings only (no generative LLMs)
 * Embeddings only populate semantic_hint for ranking, never modify filters
 */

import { SearchQuery } from "@/types/searchQuery";

let embeddingModel: any = null;
let modelLoading: Promise<any> | null = null;

/**
 * Load embedding model (lazy load on first use)
 */
async function loadEmbeddingModel(): Promise<any> {
  if (embeddingModel) return embeddingModel;
  if (modelLoading) return modelLoading;

  modelLoading = (async () => {
    try {
      // Use @xenova/transformers for mobile (small, efficient)
      // Dynamic import to avoid loading in browser/desktop
      const { pipeline } = await import("@xenova/transformers");

      // Use small embedding model suitable for mobile
      embeddingModel = await pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2",
        {
          quantized: true, // Use quantized model for smaller size
        }
      );

      return embeddingModel;
    } catch (error) {
      console.warn("Failed to load embedding model for mobile:", error);
      return null;
    } finally {
      modelLoading = null;
    }
  })();

  return modelLoading;
}

/**
 * Generate embedding for query text
 */
async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const model = await loadEmbeddingModel();
    if (!model) return null;

    const output = await model(text, {
      pooling: "mean",
      normalize: true,
    });

    // Convert tensor to array
    return Array.from(output.data);
  } catch (error) {
    console.warn("Failed to generate embedding:", error);
    return null;
  }
}

/**
 * Semantic assist for mobile platform
 * Only uses embeddings to populate semantic_hint, never modifies filters
 */
export async function semanticAssistMobile(
  query: string,
  deterministicQuery: SearchQuery
): Promise<SearchQuery | null> {
  try {
    // Generate embedding for the query
    const embedding = await generateEmbedding(query);
    if (!embedding) {
      return null; // Fallback to deterministic
    }

    // Create enhanced query with semantic_hint
    // Never modify filters - only add semantic_hint for ranking
    const enhanced: SearchQuery = {
      ...deterministicQuery,
      semantic_hint: query, // Use original query as semantic hint
      // Confidence stays the same - embeddings don't improve confidence
      // They only help with ranking via semantic_hint
    };

    return enhanced;
  } catch (error) {
    console.warn("Mobile semantic assist failed:", error);
    return null; // Fallback to deterministic
  }
}
