/**
 * LLM-based Contact Text Parser
 * Uses the same unified LLM infrastructure as search query parsing
 * Falls back to deterministic parsing if LLM fails
 */

import { ParsedContactData } from "./contactTextParser";
import { getLLMConfig, isLLMParsingEnabled } from "./llmConfig";
import {
  getCachedParsedContact,
  cacheParsedContact,
  isModelLoadFailed,
  markModelLoadFailed,
} from "./contactLLMCache";
import { devLog } from "@/lib/devLog";

let llmModel: any = null;
let modelLoading: Promise<any> | null = null;
let modelLoadFailed = false;
let hasRetriedThisSession = false; // Track if we've retried loading this session

/**
 * List of alternative models to try if primary fails
 * Same models as used for search query parsing
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
 * Reuses the same model instance as search parsing if available
 */
async function loadLLMModel(): Promise<any> {
  if (llmModel) return llmModel;
  
  // FIRST: Try to reuse model from search parser if it's already loaded
  // This is the key fix - if search parser successfully loaded the model, reuse it!
  try {
    devLog("[Contact LLM] Checking if search parser has model available...");
    const searchAdapter = await import("./semanticAssist/unifiedLLMAdapter");
    
    // Check if model is already loaded
    const searchModel = searchAdapter.getLoadedModel();
    if (searchModel) {
      devLog("[Contact LLM] ✓ Found loaded model from search parser, reusing it!");
      llmModel = searchModel;
      return llmModel;
    }
    
    devLog("[Contact LLM] Search parser model not loaded yet");
    
    // If search parser is currently loading, wait for it to complete
    if (searchAdapter.isModelLoading()) {
      devLog("[Contact LLM] Search parser is loading model, waiting to reuse it...");
      // Wait for the search parser's loading to complete (with timeout)
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max wait
      while (attempts < maxAttempts && searchAdapter.isModelLoading()) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
        const model = searchAdapter.getLoadedModel();
        if (model) {
          devLog("[Contact LLM] ✓ Reusing model instance from search parser (after wait)");
          llmModel = model;
          return llmModel;
        }
      }
      devLog("[Contact LLM] Search parser finished loading, checking for model again...");
      const finalModel = searchAdapter.getLoadedModel();
      if (finalModel) {
        devLog("[Contact LLM] ✓ Found model after search parser finished loading!");
        llmModel = finalModel;
        return llmModel;
      }
    }
    
    // Try to trigger search parser's model loading
    devLog("[Contact LLM] Attempting to trigger search parser model loading...");
    try {
      const triggeredModel = await searchAdapter.ensureModelLoaded();
      if (triggeredModel) {
        devLog("[Contact LLM] ✓ Successfully triggered and reused search parser model!");
        llmModel = triggeredModel;
        return llmModel;
      } else {
        devLog("[Contact LLM] Search parser model loading failed or not available");
      }
    } catch (triggerError) {
      devLog("[Contact LLM] Could not trigger search parser model loading:", triggerError);
    }
    
    devLog("[Contact LLM] Search parser model not available, will load our own");
  } catch (error) {
    devLog("[Contact LLM] Could not access search parser:", error);
    // Continue to load our own model
  }
  
  // Only check failure state if we couldn't reuse the search parser's model
  // Check persistent failure state (IndexedDB)
  const persistentFailure = await isModelLoadFailed();
  if (persistentFailure && hasRetriedThisSession) {
    devLog("[Contact LLM] Model loading previously failed (persistent) and already retried this session, skipping");
    modelLoadFailed = true;
    return null;
  }
  
  // Allow one retry per session even if it previously failed
  if (persistentFailure && !hasRetriedThisSession) {
    devLog("[Contact LLM] Model loading previously failed, but allowing one retry this session");
    hasRetriedThisSession = true;
  }
  
  if (modelLoadFailed && hasRetriedThisSession) {
    devLog("[Contact LLM] Model loading failed this session, skipping retry");
    return null;
  }
  if (modelLoading) return modelLoading;

  modelLoading = (async () => {
    try {
      const config = getLLMConfig();
      // DEPRECATED: This file is replaced by unifiedLLMAdapter.ts using ONNX Runtime
      // TODO: Remove this file once unifiedLLMAdapter is stable
      console.warn("[LLM Parser] This module is deprecated - use unifiedLLMAdapter instead");
      return null;
      
      // const transformersModule = await import("@xenova/transformers");
      // const { pipeline } = transformersModule;
      
      // Set model cache location if needed
      if (transformersModule.env) {
        transformersModule.env.allowRemoteModels = true;
        transformersModule.env.useBrowserCache = true;
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

      devLog(`[Contact LLM] Loading model: ${config.modelName}`);
      
      // List of models to try (primary + fallbacks, avoiding duplicates)
      const modelsToTry = [
        config.modelName,
        ...FALLBACK_MODELS.filter(m => m !== config.modelName)
      ];
      
      for (const modelName of modelsToTry) {
        devLog(`[Contact LLM] Attempting to load: ${modelName}`);
        
        // Try quantized first (smaller, faster)
        try {
          llmModel = await pipeline(
            "text2text-generation",
            modelName,
            {
              quantized: true,
            }
          );
          devLog(`[Contact LLM] Successfully loaded quantized model: ${modelName}`);
          if (modelName !== config.modelName) {
            devLog(`[Contact LLM] Note: Using fallback model ${modelName} instead of ${config.modelName}`);
          }
          return llmModel;
        } catch (quantizedError: any) {
          // Check if this is an accessibility issue (HTML response, 404, etc.)
          if (isModelInaccessibleError(quantizedError)) {
            console.warn(`[Contact LLM] Model ${modelName} is not accessible (quantized):`, quantizedError.message);
            // Try non-quantized version
            try {
              llmModel = await pipeline(
                "text2text-generation",
                modelName,
                {
                  quantized: false,
                }
              );
              devLog(`[Contact LLM] Successfully loaded non-quantized model: ${modelName}`);
              if (modelName !== config.modelName) {
                devLog(`[Contact LLM] Note: Using fallback model ${modelName} instead of ${config.modelName}`);
              }
              return llmModel;
            } catch (nonQuantizedError: any) {
              console.warn(`[Contact LLM] Model ${modelName} is not accessible (non-quantized):`, nonQuantizedError.message);
              continue;
            }
          } else {
            console.warn(`[Contact LLM] Model ${modelName} failed (quantized):`, quantizedError.message);
            continue;
          }
        }
      }
      
      // All models failed
      console.warn("[Contact LLM] All model loading attempts failed. This is expected if:");
      console.warn("  - Models are not available in your environment");
      console.warn("  - Network/CORS restrictions prevent model downloads");
      console.warn("  - Browser doesn't support the required features");
      devLog("[Contact LLM] Using deterministic parsing instead. This works well for most contact formats.");
      modelLoadFailed = true;
      await markModelLoadFailed();
      return null;
    } catch (error: any) {
      console.error("Failed to load LLM model for contact parsing:", error);
      if (error.message) {
        if (isModelInaccessibleError(error)) {
          devLog("[Contact LLM] Model repository not accessible (this is normal in some environments).");
          devLog("[Contact LLM] Using deterministic parsing instead - works well for most contact formats.");
          modelLoadFailed = true;
          await markModelLoadFailed();
        }
      }
      return null;
    } finally {
      modelLoading = null;
    }
  })();

  return modelLoading;
}

/**
 * Generate structured prompt for contact extraction
 */
function generateContactExtractionPrompt(input: string): string {
  return `You are a contact information extractor. Extract structured contact data from the user's freeform text input.

Input text: "${input}"

Extract the following information:
- name: Person's full name (first and last name)
- email: Email address (if present)
- phone: Phone number (if present, format as +1 (XXX) XXX-XXXX for US numbers)
- company: Company or organization name
- role: Job title or role (e.g., "Marketing Manager", "Software Engineer")
- description: Any additional context or description about the person
- suggestedKeywords: Array of 3-8 relevant keywords/tags extracted from role, company, and description

Return ONLY valid JSON matching this exact schema:
{
  "name": string (required, empty string if not found),
  "email": string | null,
  "phone": string | null,
  "company": string | null,
  "role": string | null,
  "description": string | null,
  "suggestedKeywords": string[] (array of lowercase keywords, max 8)
}

Important rules:
- If name is not found, return empty string ""
- Extract email and phone exactly as written (format phone numbers properly)
- Extract company name without suffixes like "Inc.", "LLC", etc. unless they're part of the actual name
- Role should be the job title, not department
- Description should be any additional context about what they do or handle
- Keywords should be relevant terms from role, company, and description (lowercase, no duplicates)
- Return ONLY the JSON object, no markdown, no code blocks, no other text.`;
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
 * Validate ParsedContactData schema
 */
function validateParsedContact(obj: any): obj is ParsedContactData {
  if (!obj || typeof obj !== "object") return false;
  
  // Validate required fields
  if (typeof obj.name !== "string") return false;
  
  // Validate optional fields
  if (obj.email !== null && typeof obj.email !== "string") return false;
  if (obj.phone !== null && typeof obj.phone !== "string") return false;
  if (obj.company !== null && typeof obj.company !== "string") return false;
  if (obj.role !== null && typeof obj.role !== "string") return false;
  if (obj.description !== null && typeof obj.description !== "string") return false;
  if (!Array.isArray(obj.suggestedKeywords)) return false;
  
  // Validate keywords are strings
  if (!obj.suggestedKeywords.every((k: any) => typeof k === "string")) return false;
  
  return true;
}

/**
 * Parse contact text with LLM
 * Main function for LLM-based contact extraction
 */
export async function parseContactWithLLM(
  input: string
): Promise<ParsedContactData | null> {
  // Check if LLM parsing is enabled
  if (!isLLMParsingEnabled()) {
    return null;
  }

  const trimmedInput = input.trim();
  if (!trimmedInput) {
    return null;
  }

  // Check cache first
  const cached = await getCachedParsedContact(trimmedInput);
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
    const prompt = generateContactExtractionPrompt(trimmedInput);

    // Call LLM with timeout
    const config = getLLMConfig();
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), config.timeoutMs);
    });

    const llmPromise = (async () => {
      try {
        // For T5 models, use text2text-generation pipeline
        const result = await model(prompt, {
          max_length: 512, // Longer output for contact data
          max_new_tokens: 256,
          temperature: 0.1, // Low temperature for deterministic output
          do_sample: false, // Deterministic generation
          num_beams: 1, // Faster inference (greedy search)
        });

        // Extract text from result
        let responseText = "";
        if (Array.isArray(result) && result.length > 0) {
          responseText = result[0]?.generated_text || result[0]?.text || "";
        } else if (result && typeof result === "object") {
          responseText = result.generated_text || result.text || JSON.stringify(result);
        } else if (typeof result === "string") {
          responseText = result;
        }
        
        if (!responseText) {
          console.warn("[Contact LLM] Empty response from model:", result);
          return null;
        }
        
        // Extract JSON from response
        const parsed = extractJSONFromResponse(responseText);
        if (!parsed) {
          return null;
        }

        // Validate schema
        if (!validateParsedContact(parsed)) {
          console.warn("LLM response failed schema validation:", parsed);
          return null;
        }

        // Ensure name is not null (should be empty string if not found)
        if (parsed.name === null || parsed.name === undefined) {
          parsed.name = "";
        }

        // Ensure suggestedKeywords is an array
        if (!Array.isArray(parsed.suggestedKeywords)) {
          parsed.suggestedKeywords = [];
        }

        // Limit keywords to 8
        parsed.suggestedKeywords = parsed.suggestedKeywords.slice(0, 8);

        // Cache the result
        await cacheParsedContact(trimmedInput, parsed);

        return parsed;
      } catch (error) {
        console.warn("LLM inference failed for contact parsing:", error);
        return null;
      }
    })();

    const result = await Promise.race([llmPromise, timeoutPromise]);
    return result;
  } catch (error) {
    console.warn("Failed to parse contact with LLM:", error);
    return null;
  }
}
