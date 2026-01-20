/**
 * LLM Configuration
 * Model selection and performance settings for unified LLM query parsing
 */

export interface LLMConfig {
  modelName: string;
  maxModelSizeMB: number;
  timeoutMs: number;
  enableCaching: boolean;
  cacheTTLHours: number;
}

/**
 * Default configuration
 * Uses LaMini-Flan-T5-78M - smallest and most reliable for browser use
 */
export const DEFAULT_LLM_CONFIG: LLMConfig = {
  // Use LaMini-Flan-T5-78M - smallest (~30MB) and optimized for browser
  // Falls back to flan-t5-small or t5-small if this fails
  // Alternative models can be specified via VITE_LLM_MODEL env var
  // Note: Models must be converted to ONNX format and available in Xenova/ namespace
  modelName: "Xenova/LaMini-Flan-T5-78M",
  maxModelSizeMB: 100, // LaMini is ~30MB, but allow up to 100MB for fallbacks
  timeoutMs: 5000, // 5 second timeout for LLM inference
  enableCaching: true,
  cacheTTLHours: 24, // Cache parsed queries for 24 hours
};

/**
 * Get LLM configuration
 * Can be overridden via environment variables or user settings
 */
export function getLLMConfig(): LLMConfig {
  // Allow override via environment variable
  const modelName = import.meta.env.VITE_LLM_MODEL || DEFAULT_LLM_CONFIG.modelName;
  
  return {
    ...DEFAULT_LLM_CONFIG,
    modelName,
  };
}

/**
 * Check if LLM parsing is enabled
 * Can be disabled via feature flag
 */
export function isLLMParsingEnabled(): boolean {
  // Enable by default, can be disabled with VITE_ENABLE_LLM_PARSING=false
  // Can be explicitly enabled with VITE_ENABLE_LLM_PARSING=true
  const envValue = import.meta.env.VITE_ENABLE_LLM_PARSING;
  if (envValue === "false") return false;
  if (envValue === "true") return true;
  // Default: enabled (will fallback to deterministic if model fails to load)
  return true;
}
