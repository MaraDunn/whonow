/**
 * AI Utilities - Public API
 * Clean exports for AI functionality
 */

// Configuration
export {
  getAIConfig,
  isAIEnabled,
  isQueryParsingEnabled,
  isSemanticRankingEnabled,
  isHybridScoringEnabled,
  isDebugMode,
  enableFeature,
  disableFeature,
  saveUserPreferences,
  resetToDefaults,
  subscribeToConfigChanges,
  type AIConfig,
  type AIFeatureFlags,
  type AIPerformanceConfig,
  type AIModelConfig,
} from './aiConfig';

// AI Layer
export {
  enhanceQuery,
  isAIAvailable,
  getAIStatus,
  forceResetCircuitBreaker,
  type AIEnhancement,
  type AIMetadata,
} from './aiLayer';

// Model Loader
export {
  getModelUrl,
  getModelSize,
  loadModel,
  preloadModels,
  areModelsReady,
  clearModelCache,
  type ModelLoadProgress,
  type ModelLoadResult,
} from './modelLoader';

// Monitoring
export {
  trackQuery,
  updateModelStatus,
  getStats,
  getSuccessRate,
  getRecentEvents,
  clearStats,
  initializeDiagnostics,
  type AIStats,
  type AIEvent,
} from './aiMonitor';
