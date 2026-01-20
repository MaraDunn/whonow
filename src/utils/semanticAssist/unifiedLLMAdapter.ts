/**
 * Unified LLM Query Parser Adapter
 * Works across all platforms (desktop, browser, mobile, PWA)
 * Uses @xenova/transformers with small text-generation models
 */

import { SearchQuery } from "@/types/searchQuery";
import { getLLMConfig, isLLMParsingEnabled } from "@/utils/llmConfig";
import {
  getCachedParsedQuery,
  cacheParsedQuery,
  isModelLoadFailed,
  markModelLoadFailed,
} from "./modelCache";

let llmModel: any = null;
let modelLoading: Promise<any> | null = null;
let modelLoadFailed = false; // Track if model loading has permanently failed (in-memory cache)

/**
 * Get the currently loaded LLM model instance (if available)
 * Allows other modules to reuse the same model instance
 */
export function getLoadedModel(): any {
  return llmModel;
}

/**
 * Check if model is currently loading
 */
export function isModelLoading(): boolean {
  return modelLoading !== null;
}

/**
 * Ensure the model is loaded (trigger loading if not already loaded)
 * Returns the model instance or null if loading fails
 */
export async function ensureModelLoaded(): Promise<any> {
  return await loadLLMModel();
}

/**
 * List of alternative models to try if primary fails
 * Ordered by preference (smallest/fastest first)
 */
const FALLBACK_MODELS = [
  "Xenova/LaMini-Flan-T5-78M", // Smallest, ~30MB
  "Xenova/flan-t5-small", // Instruction-tuned, ~150MB
  "Xenova/t5-base", // Larger but more capable, ~450MB
];

/**
 * Check if error indicates model repository is inaccessible
 */
function isModelInaccessibleError(error: any): boolean {
  const message = error?.message || "";
  return (
    message.includes("Unexpected token") ||
    message.includes("<!doctype") ||
    message.includes("404") ||
    message.includes("not found") ||
    message.includes("CORS") ||
    message.includes("NetworkError")
  );
}

/**
 * Load LLM model (lazy load on first use)
 * Tries multiple models with fallback logic
 */
async function loadLLMModel(): Promise<any> {
  if (llmModel) return llmModel;
  
  // Check persistent failure state (IndexedDB)
  const persistentFailure = await isModelLoadFailed();
  if (persistentFailure) {
    console.log("[LLM] Model loading previously failed (persistent), skipping retry");
    modelLoadFailed = true;
    return null;
  }
  
  if (modelLoadFailed) {
    console.log("[LLM] Model loading previously failed (session), skipping retry");
    return null;
  }
  if (modelLoading) return modelLoading;

  modelLoading = (async () => {
    try {
      const config = getLLMConfig();
      // Import transformers - use dynamic import to avoid issues
      const transformersModule = await import("@xenova/transformers");
      const { pipeline } = transformersModule;
      
      // Set model cache location if needed
      if (transformersModule.env) {
        // Use browser's Cache API for model storage
        transformersModule.env.allowRemoteModels = true;
        transformersModule.env.useBrowserCache = true;
        // Set WASM paths if needed (defaults to CDN)
        if (!transformersModule.env.backends) {
          transformersModule.env.backends = {};
        }
        if (!transformersModule.env.backends.onnx) {
          transformersModule.env.backends.onnx = {};
        }
        if (!transformersModule.env.backends.onnx.wasm) {
          transformersModule.env.backends.onnx.wasm = {};
        }
      }

      console.log(`[LLM] Loading model: ${config.modelName}`);
      console.log(`[LLM] Transformers version:`, transformersModule.version);
      
      // List of models to try (primary + fallbacks, avoiding duplicates)
      const modelsToTry = [
        config.modelName,
        ...FALLBACK_MODELS.filter(m => m !== config.modelName)
      ];
      
      for (const modelName of modelsToTry) {
        console.log(`[LLM] Attempting to load: ${modelName}`);
        
        // Try quantized first (smaller, faster)
        try {
          llmModel = await pipeline(
            "text2text-generation",
            modelName,
            {
              quantized: true,
            }
          );
          console.log(`[LLM] Successfully loaded quantized model: ${modelName}`);
          if (modelName !== config.modelName) {
            console.log(`[LLM] Note: Using fallback model ${modelName} instead of ${config.modelName}`);
          }
          return llmModel;
        } catch (quantizedError: any) {
          // Check if this is an accessibility issue (HTML response, 404, etc.)
          if (isModelInaccessibleError(quantizedError)) {
            console.warn(`[LLM] Model ${modelName} is not accessible (quantized):`, quantizedError.message);
            // Try non-quantized version
            try {
              llmModel = await pipeline(
                "text2text-generation",
                modelName,
                {
                  quantized: false,
                }
              );
              console.log(`[LLM] Successfully loaded non-quantized model: ${modelName}`);
              if (modelName !== config.modelName) {
                console.log(`[LLM] Note: Using fallback model ${modelName} instead of ${config.modelName}`);
              }
              return llmModel;
            } catch (nonQuantizedError: any) {
              console.warn(`[LLM] Model ${modelName} is not accessible (non-quantized):`, nonQuantizedError.message);
              // Continue to next model
              continue;
            }
          } else {
            // Different error (not accessibility), log and continue
            console.warn(`[LLM] Model ${modelName} failed (quantized):`, quantizedError.message);
            continue;
          }
        }
      }
      
      // All models failed
      console.error("[LLM] All model loading attempts failed. Disabling LLM parsing.");
      modelLoadFailed = true;
      // Persist failure state to IndexedDB to prevent retries across page reloads
      await markModelLoadFailed();
      return null;
    } catch (error: any) {
      console.error("Failed to load LLM model, search will use fallback parsing:", error);
      // Log more details about the error
      if (error.message) {
        console.error("Error message:", error.message);
        
        // Check if error is related to JSON parsing (HTML response)
        if (isModelInaccessibleError(error)) {
          console.error("[LLM] Model repository is not accessible. This usually means:");
          console.error("  1. The model repository doesn't exist or isn't accessible");
          console.error("  2. There's a CORS issue");
          console.error("  3. The model files aren't in ONNX format");
          console.error("  4. Network connectivity issues");
          console.error("  Falling back to deterministic parsing.");
          modelLoadFailed = true;
          // Persist failure state to IndexedDB
          await markModelLoadFailed();
        }
      }
      if (error.stack) {
        console.error("Error stack:", error.stack);
      }
      // Don't throw - return null so fallback can work
      return null;
    } finally {
      modelLoading = null;
    }
  })();

  return modelLoading;
}

/**
 * Generate structured prompt for query parsing
 */
function generateStructuredPrompt(query: string): string {
  return `You are a search query parser for a contact management system. Extract structured information from the user's natural language query.

Query: "${query}"

Extract the following information:
- Intent: What is the user trying to do? (search_contacts, list_recent, relationship_lookup)
- Filters: Extract any entities mentioned:
  * name: Person's name
  * company: Company name
  * job_title: Job title or role (e.g., "engineer", "designer", "manager")
  * location: Location (city, state, country)
  * tags: Any relevant tags or keywords
- Semantic hint: The main search terms for ranking (usually the original query or key terms)
- Confidence: How certain you are (0.0-1.0)
- Explanation: A brief human-readable explanation

Return ONLY valid JSON matching this exact schema:
{
  "intent": "search_contacts" | "list_recent" | "relationship_lookup",
  "filters": {
    "name": string (optional),
    "company": string (optional),
    "job_title": string (optional),
    "location": string (optional),
    "tags": string[] (optional)
  },
  "semantic_hint": string,
  "confidence": number (0.0-1.0),
  "explanation": string
}

Important: Return ONLY the JSON object, no markdown, no code blocks, no other text.`;
}

/**
 * Extract JSON from LLM response
 * Handles cases where LLM adds extra text or markdown
 */
function extractJSONFromResponse(response: string): any | null {
  try {
    // Try to find JSON object in response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    const jsonStr = jsonMatch[0];
    return JSON.parse(jsonStr);
  } catch (error) {
    console.warn("Failed to extract JSON from LLM response:", error);
    return null;
  }
}

/**
 * Validate SearchQuery schema
 */
function validateSearchQuery(obj: any): obj is SearchQuery {
  if (!obj || typeof obj !== "object") return false;
  
  // Validate intent
  if (!["search_contacts", "list_recent", "relationship_lookup"].includes(obj.intent)) {
    return false;
  }
  
  // Validate filters
  if (!obj.filters || typeof obj.filters !== "object") return false;
  
  // Validate confidence
  if (typeof obj.confidence !== "number" || obj.confidence < 0 || obj.confidence > 1) {
    return false;
  }
  
  // Validate explanation
  if (typeof obj.explanation !== "string") return false;
  
  // Validate optional filter fields
  const filters = obj.filters;
  if (filters.name !== undefined && typeof filters.name !== "string") return false;
  if (filters.company !== undefined && typeof filters.company !== "string") return false;
  if (filters.job_title !== undefined && typeof filters.job_title !== "string") return false;
  if (filters.location !== undefined && typeof filters.location !== "string") return false;
  if (filters.tags !== undefined && !Array.isArray(filters.tags)) return false;
  
  return true;
}

/**
 * Parse query with LLM
 * Main function for unified LLM-based query parsing
 */
export async function parseQueryWithLLM(
  query: string
): Promise<SearchQuery | null> {
  // Check if LLM parsing is enabled
  if (!isLLMParsingEnabled()) {
    return null;
  }

  // Check cache first
  const cached = await getCachedParsedQuery(query);
  if (cached) {
    return cached;
  }

  try {
    // Load model
    const model = await loadLLMModel();
    if (!model) {
      return null;
    }

    // Generate prompt
    const prompt = generateStructuredPrompt(query);

    // Call LLM with timeout
    const config = getLLMConfig();
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), config.timeoutMs);
    });

    const llmPromise = (async () => {
      try {
        // For T5 models, use text2text-generation pipeline
        // Adjust parameters based on model type
        const result = await model(prompt, {
          max_length: 256, // Limit output length for faster inference
          max_new_tokens: 128, // Alternative to max_length
          temperature: 0.1, // Low temperature for deterministic output
          do_sample: false, // Deterministic generation
          num_beams: 1, // Faster inference (greedy search)
        });

        // Extract text from result (T5 models return object with generated_text property)
        // Handle both array and object responses
        let responseText = "";
        if (Array.isArray(result) && result.length > 0) {
          responseText = result[0]?.generated_text || result[0]?.text || "";
        } else if (result && typeof result === "object") {
          responseText = result.generated_text || result.text || JSON.stringify(result);
        } else if (typeof result === "string") {
          responseText = result;
        }
        
        if (!responseText) {
          console.warn("[LLM] Empty response from model:", result);
          return null;
        }
        
        // Extract JSON from response
        const parsed = extractJSONFromResponse(responseText);
        if (!parsed) {
          return null;
        }

        // Validate schema
        if (!validateSearchQuery(parsed)) {
          console.warn("LLM response failed schema validation:", parsed);
          return null;
        }

        // Cache the result
        await cacheParsedQuery(query, parsed);

        return parsed;
      } catch (error) {
        console.warn("LLM inference failed:", error);
        return null;
      }
    })();

    const result = await Promise.race([llmPromise, timeoutPromise]);
    return result;
  } catch (error) {
    console.warn("Failed to parse query with LLM:", error);
    return null;
  }
}

/**
 * Semantic assist using unified LLM adapter
 * This is the main entry point for all platforms
 */
export async function semanticAssistUnified(
  query: string,
  deterministicQuery: SearchQuery | null
): Promise<SearchQuery | null> {
  try {
    // Try LLM parsing first
    const llmQuery = await parseQueryWithLLM(query);
    
    if (llmQuery) {
      return llmQuery;
    }

    // Fallback to deterministic query if provided
    if (deterministicQuery) {
      return deterministicQuery;
    }

    // Last resort: create minimal query from original
    return {
      intent: "search_contacts",
      filters: {},
      semantic_hint: query,
      confidence: 0.5,
      explanation: `Searching for: ${query}`,
    };
  } catch (error) {
    console.warn("Unified semantic assist failed:", error);
    return deterministicQuery || null;
  }
}
