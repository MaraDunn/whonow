/**
 * AI Configuration Module
 * Centralized configuration for all AI features with user preferences
 * 
 * Features:
 * - Granular feature flags (query parsing, semantic ranking, hybrid scoring)
 * - User opt-in/opt-out support (stored in localStorage)
 * - Environment variable overrides
 * - Platform detection (Tauri vs Browser)
 * - Debug mode support
 */

import { detectPlatform } from "../platformDetection";
import { devLog } from "@/lib/devLog";

export interface AIFeatureFlags {
  // Master AI switch - disables all AI features
  enableAI: boolean;
  
  // T5 model for natural language query parsing (~30MB)
  enableSemanticQueryParsing: boolean;
  
  // Embeddings for semantic similarity ranking (~80MB)
  enableSemanticRanking: boolean;
  
  // Hybrid scoring (keyword + semantic)
  enableHybridScoring: boolean;
  
  // Debug mode - detailed logging and diagnostics
  debugMode: boolean;
}

export interface AIPerformanceConfig {
  // Maximum time for query parsing (ms)
  queryParsingTimeoutMs: number;
  
  // Maximum time for embedding generation (ms)
  embeddingTimeoutMs: number;
  
  // Circuit breaker threshold (failures before auto-disable)
  maxConsecutiveFailures: number;
  
  // Minimum confidence threshold for AI results
  minConfidenceThreshold: number;
}

export interface AIModelConfig {
  // T5 model name
  llmModel: string;
  
  // Embedding model name
  embeddingModel: string;
  
  // Model storage URL (Supabase Storage for browser)
  modelStorageUrl?: string;
  
  // Maximum model size (MB)
  maxModelSizeMB: number;
}

export interface AIConfig {
  features: AIFeatureFlags;
  performance: AIPerformanceConfig;
  models: AIModelConfig;
  platform: 'tauri' | 'browser' | 'mobile' | 'pwa';
}

// LocalStorage keys for user preferences
const STORAGE_KEYS = {
  AI_ENABLED: 'whonow_ai_enabled',
  QUERY_PARSING_ENABLED: 'whonow_query_parsing_enabled',
  SEMANTIC_RANKING_ENABLED: 'whonow_semantic_ranking_enabled',
  HYBRID_SCORING_ENABLED: 'whonow_hybrid_scoring_enabled',
  DEBUG_MODE: 'whonow_ai_debug_mode',
} as const;

/**
 * Get default feature flags based on platform
 */
function getDefaultFeatureFlags(): AIFeatureFlags {
  const platform = detectPlatform();
  
  if (platform === 'desktop') {
    // Tauri desktop: All features enabled by default (models bundled)
    return {
      enableAI: true,
      enableSemanticQueryParsing: true,
      enableSemanticRanking: true,
      enableHybridScoring: true,
      debugMode: import.meta.env.DEV,
    };
  } else {
    // Browser/PWA: Classical NLP enabled by default (no downloads required)
    return {
      enableAI: true,
      enableSemanticQueryParsing: true, // Enabled by default (0MB, instant)
      enableSemanticRanking: false, // Opt-in required (80MB model)
      enableHybridScoring: false,
      debugMode: import.meta.env.DEV,
    };
  }
}

/**
 * Load feature flags from localStorage (user preferences)
 */
function loadUserPreferences(): Partial<AIFeatureFlags> {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {};
  }
  
  try {
    const getBool = (key: string) => {
      const v = localStorage.getItem(key);
      return v === null ? undefined : v === 'true';
    };
    return {
      enableAI: localStorage.getItem(STORAGE_KEYS.AI_ENABLED) === 'true'
        ? true
        : localStorage.getItem(STORAGE_KEYS.AI_ENABLED) === 'false'
        ? false
        : undefined,
      enableSemanticQueryParsing: getBool(STORAGE_KEYS.QUERY_PARSING_ENABLED),
      enableSemanticRanking: getBool(STORAGE_KEYS.SEMANTIC_RANKING_ENABLED),
      enableHybridScoring: getBool(STORAGE_KEYS.HYBRID_SCORING_ENABLED),
      debugMode: getBool(STORAGE_KEYS.DEBUG_MODE),
    };
  } catch (error) {
    console.warn('[AI Config] Failed to load user preferences:', error);
    return {};
  }
}

/**
 * Save user preferences to localStorage
 */
export function saveUserPreferences(preferences: Partial<AIFeatureFlags>): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  
  try {
    if (preferences.enableAI !== undefined) {
      localStorage.setItem(STORAGE_KEYS.AI_ENABLED, String(preferences.enableAI));
    }
    if (preferences.enableSemanticQueryParsing !== undefined) {
      localStorage.setItem(STORAGE_KEYS.QUERY_PARSING_ENABLED, String(preferences.enableSemanticQueryParsing));
    }
    if (preferences.enableSemanticRanking !== undefined) {
      localStorage.setItem(STORAGE_KEYS.SEMANTIC_RANKING_ENABLED, String(preferences.enableSemanticRanking));
    }
    if (preferences.enableHybridScoring !== undefined) {
      localStorage.setItem(STORAGE_KEYS.HYBRID_SCORING_ENABLED, String(preferences.enableHybridScoring));
    }
    if (preferences.debugMode !== undefined) {
      localStorage.setItem(STORAGE_KEYS.DEBUG_MODE, String(preferences.debugMode));
    }
    
    // Notify listeners of config change
    window.dispatchEvent(new CustomEvent('ai-config-changed', { detail: preferences }));
  } catch (error) {
    console.warn('[AI Config] Failed to save user preferences:', error);
  }
}

/**
 * Get environment variable overrides
 */
function getEnvOverrides(): Partial<AIFeatureFlags> {
  return {
    enableAI: import.meta.env.VITE_ENABLE_AI === 'false' ? false : undefined,
    enableSemanticQueryParsing: import.meta.env.VITE_ENABLE_SEMANTIC_PARSING === 'false' ? false : undefined,
    enableSemanticRanking: import.meta.env.VITE_ENABLE_SEMANTIC_RANKING === 'false' ? false : undefined,
    debugMode: import.meta.env.VITE_AI_DEBUG_MODE === 'true' ? true : undefined,
  };
}

/**
 * Build complete feature flags (defaults + user prefs + env overrides)
 */
function buildFeatureFlags(): AIFeatureFlags {
  const defaults = getDefaultFeatureFlags();
  const userPrefs = loadUserPreferences();
  const envOverrides = getEnvOverrides();
  
  // Merge in order: defaults < user preferences < env overrides
  const merged = {
    ...defaults,
    ...Object.fromEntries(
      Object.entries(userPrefs).filter(([_, v]) => v !== undefined)
    ),
    ...Object.fromEntries(
      Object.entries(envOverrides).filter(([_, v]) => v !== undefined)
    ),
  } as AIFeatureFlags;
  
  // If AI is disabled, disable all sub-features
  if (!merged.enableAI) {
    merged.enableSemanticQueryParsing = false;
    merged.enableSemanticRanking = false;
    merged.enableHybridScoring = false;
  }
  
  return merged;
}

/**
 * Build performance configuration
 */
function buildPerformanceConfig(): AIPerformanceConfig {
  return {
    queryParsingTimeoutMs: parseInt(import.meta.env.VITE_AI_TIMEOUT_MS || '5000', 10),
    embeddingTimeoutMs: 2000,
    maxConsecutiveFailures: 3,
    minConfidenceThreshold: 0.6,
  };
}

/**
 * Build model configuration
 */
function buildModelConfig(): AIModelConfig {
  return {
    llmModel: import.meta.env.VITE_LLM_MODEL || 'Xenova/LaMini-Flan-T5-77M',
    embeddingModel: import.meta.env.VITE_EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2',
    modelStorageUrl: import.meta.env.VITE_MODEL_STORAGE_URL,
    maxModelSizeMB: 110,
  };
}

/**
 * Get complete AI configuration
 */
export function getAIConfig(): AIConfig {
  return {
    features: buildFeatureFlags(),
    performance: buildPerformanceConfig(),
    models: buildModelConfig(),
    platform: detectPlatform(),
  };
}

/**
 * Check if AI features are enabled
 */
export function isAIEnabled(): boolean {
  return getAIConfig().features.enableAI;
}

/**
 * Check if semantic query parsing is enabled
 */
export function isQueryParsingEnabled(): boolean {
  const config = getAIConfig();
  return config.features.enableAI && config.features.enableSemanticQueryParsing;
}

/**
 * Check if semantic ranking is enabled
 */
export function isSemanticRankingEnabled(): boolean {
  const config = getAIConfig();
  return config.features.enableAI && config.features.enableSemanticRanking;
}

/**
 * Check if hybrid scoring is enabled
 */
export function isHybridScoringEnabled(): boolean {
  const config = getAIConfig();
  return config.features.enableAI && config.features.enableHybridScoring;
}

/**
 * Check if debug mode is enabled
 */
export function isDebugMode(): boolean {
  return getAIConfig().features.debugMode;
}

/**
 * Enable a specific AI feature (saves to localStorage)
 */
export function enableFeature(feature: keyof AIFeatureFlags): void {
  const prefs: Partial<AIFeatureFlags> = {
    [feature]: true,
  };
  
  // If enabling a sub-feature, also enable master AI switch
  if (feature !== 'enableAI' && feature !== 'debugMode') {
    prefs.enableAI = true;
  }
  
  saveUserPreferences(prefs);
}

/**
 * Disable a specific AI feature (saves to localStorage)
 */
export function disableFeature(feature: keyof AIFeatureFlags): void {
  saveUserPreferences({
    [feature]: false,
  });
}

/**
 * Reset to default configuration
 */
export function resetToDefaults(): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    
    window.dispatchEvent(new CustomEvent('ai-config-changed', { detail: {} }));
  } catch (error) {
    console.warn('[AI Config] Failed to reset preferences:', error);
  }
}

/**
 * Subscribe to configuration changes
 */
export function subscribeToConfigChanges(callback: (config: AIConfig) => void): () => void {
  const handler = () => callback(getAIConfig());
  window.addEventListener('ai-config-changed', handler);
  
  return () => window.removeEventListener('ai-config-changed', handler);
}

// Log configuration on module load (debug mode only)
if (isDebugMode()) {
  devLog('[AI Config] Configuration loaded:', getAIConfig());
}
